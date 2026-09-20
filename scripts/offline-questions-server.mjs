// npm run server:offline
//
// Runs the normal backend, but battle (raid / fortify) questions are written
// locally from the player's OWN lesson notes instead of by Gemini — so you can
// develop and demo wars with no API key or quota. Questions are simple fill-in-the-blank
// statements taken from the topic's key points, but they are grounded in the
// studied material exactly like the Gemini ones and go through the same
// eligibility, no-repeat and grounding rules.
//
// Lessons, study quizzes and written answers still need Gemini.
import { hooks } from "../server/lib/warQuestions.js";

function factsOf(notes) {
  // notes lines look like "Title: lead sentence. Key points: a | b | c"
  const out = [];
  for (const line of String(notes).split("\n")) {
    const [head, kp] = line.split("Key points:");
    const title = head.split(":")[0].trim();
    for (const f of (kp || "").split("|").map((x) => x.trim()).filter((x) => x.length > 20)) out.push({ title, text: f });
  }
  return out;
}

const wordsOf = (text) => text.split(/\s+/).map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")).filter(Boolean);

// Fill-in-the-blank from a fact: blank the longest content word, offer 3 other
// terms from the student's own notes as distractors.
function cloze(fact, pool) {
  const words = wordsOf(fact);
  const cand = words.slice(2).filter((w) => w.length >= 6 && !/\d/.test(w));
  if (!cand.length) return null;
  const answer = cand.sort((a, b) => b.length - a.length)[0];
  const distract = [...new Set(pool.filter((w) => w.length >= 5 && w.toLowerCase() !== answer.toLowerCase()).map((w) => w))].sort(() => Math.random() - 0.5).slice(0, 3);
  if (distract.length < 3) return null;
  const blanked = fact.replace(new RegExp(`\\b${answer}\\b`), "_____");
  return { answer, distract, blanked };
}

hooks.generate = async (subject, picks, avoid) => {
  const asked = avoid.map((a) => a.q).join("\n");
  const pool = picks.flatMap((t) => factsOf(t.notes).flatMap((f) => wordsOf(f.text)));
  const usedNow = new Set();
  return picks
    .map((t) => {
      for (const f of factsOf(t.notes)) {
        const c = cloze(f.text, pool);
        if (!c) continue;
        const question = `Complete this statement about ${t.name}: "${c.blanked}"`;
        if (asked.includes(question) || usedNow.has(question)) continue;
        usedNow.add(question);
        return { topic: t.name, question, options: [c.answer, ...c.distract], correctIndex: 0, explanation: `From your notes: ${f.text}`, evidence: f.text };
      }
      return null; // nothing new to ask about this topic
    })
    .filter(Boolean);
};

console.log("[offline] battle questions are built from your lesson notes (no Gemini).");
await import("../server/index.js");
