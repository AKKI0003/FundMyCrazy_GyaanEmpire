// server/lib/geminiClient.js
//
// Modular Gemini caller. Tries a list of models in order; on a rate-limit
// (429 / RESOURCE_EXHAUSTED), overload (503), or an unavailable/retired
// model (404 / "no longer available") it automatically moves to the next
// model in the chain instead of failing the request.

import { GoogleGenerativeAI } from "@google/generative-ai";

// gemini-2.5-flash returned 404 "no longer available to new users" on this
// account, so it's no longer first. gemini-3.6-flash is what Google's own
// error message told this key to use. Override via env GEMINI_MODEL_CHAIN
// if your account's available models differ.
const DEFAULT_CHAIN = [
  "gemini-3.6-flash",       // confirmed working for this account
  "gemini-3.1-flash-lite",  // stable fallback, separate quota bucket
  "gemini-3-flash-preview", // preview fallback, separate quota bucket
  "gemini-2.5-flash-lite",  // older line, kept last in case it still works
];

export const MODEL_CHAIN = (process.env.GEMINI_MODEL_CHAIN || DEFAULT_CHAIN.join(","))
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// --- lightweight per-model usage tracker (in-memory, resets on restart) ---
const cooldowns = new Map(); // modelName -> timestamp (ms) until which we skip it
// Models that 404'd are dead for this account/key for the whole process —
// no point retrying them every request, so we remember and skip permanently
// once we've seen one fail as "not found"/"no longer available".
const deadModels = new Set();

function isOnCooldown(model) {
  const until = cooldowns.get(model);
  return until && Date.now() < until;
}

function setCooldown(model, ms = 60_000) {
  cooldowns.set(model, Date.now() + ms);
}

function extractJson(text) {
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function isTransientRetryable(err) {
  const msg = (err && err.message) || "";
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("overloaded")
  );
}

function isModelDead(err) {
  const msg = (err && err.message) || "";
  return (
    msg.includes("404") ||
    msg.includes("no longer available") ||
    msg.includes("not found") ||
    msg.includes("NOT_FOUND")
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Calls Gemini with automatic fallback across MODEL_CHAIN.
 * `parts` = the same content-parts array you'd normally pass to
 * model.generateContent([...]).
 * Returns { json, modelUsed }. Throws only if every model in the chain fails.
 */
export async function generateJsonWithFallback(parts, { logLabel = "gemini" } = {}) {
  let lastErr;

  for (const modelName of MODEL_CHAIN) {
    if (deadModels.has(modelName)) continue;
    if (isOnCooldown(modelName)) {
      console.log(`[${logLabel}] skipping ${modelName} (on cooldown)`);
      continue;
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await model.generateContent(parts);
        console.log(`[${logLabel}] served by ${modelName}`);
        return { json: extractJson(result.response.text()), modelUsed: modelName };
      } catch (err) {
        lastErr = err;

        if (isModelDead(err)) {
          console.warn(`[${logLabel}] ${modelName} is unavailable for this key (404) — permanently skipping it this run`);
          deadModels.add(modelName);
          break; // straight to next model, no point retrying a 404
        }

        if (isTransientRetryable(err)) {
          if (attempt === 0) {
            await sleep(400);
            continue;
          }
          console.warn(`[${logLabel}] ${modelName} rate-limited/overloaded, falling back`);
          setCooldown(modelName);
          break;
        }

        // Non-retryable (bad request, safety block, etc) — no point
        // trying other models with the same broken input.
        throw err;
      }
    }
  }

  throw new Error(
    `All models in fallback chain exhausted. Last error: ${lastErr?.message || "unknown"}`
  );
}
