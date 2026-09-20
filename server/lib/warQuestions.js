// server/lib/warQuestions.js
//
// Builds the question set for a raid or a fortify session.
//
// WHERE QUESTIONS COME FROM (this was wrong before):
//   Only from topics the answering player has UNLOCKED *and* actually STUDIED,
//   written from the notes of the lessons they were taught. A deleted subject,
//   a locked topic, or a topic they never opened can never appear. The client
//   sends exactly that eligible material in the base snapshot (see
//   src/game/subjectStats.js -> topicLearned), and it is refreshed right before
//   every raid/fortify, so unlocking or studying more widens the pool at once.
//
// THE OTHER RULES:
//   1. COVERAGE — spread round-robin over every learned subject, and over
//      different topics inside each; interleaved so consecutive questions change subject.
//   2. NO REPEATS — per-player, per-subject history (hash + word-overlap).
//   3. GROUNDED — each question must quote evidence found in that player's notes
//      (server/lib/questionRules.js). Ungrounded / structure-y questions are dropped.
//
// If the generator can't produce enough valid questions we return FEWER rather
// than pad with off-topic ones. (`GYAN_DEMO_QUESTIONS=1` re-enables the generic
// offline bank for demos without a Gemini key — clearly not the student's material.)

import crypto from "node:crypto";
import { generateJsonWithFallback } from "./geminiClient.js";
import { bankFor } from "./questionBank.js";
import { filterQuestions, QUESTION_RULES_PROMPT, isRepeat, norm } from "./questionRules.js";

const HISTORY_PER_SUBJECT = 80;
export const MAX_PER_TOPIC = 3; // more than this and there aren't enough distinct facts

/** Tests replace the generator here; production leaves it null (uses Gemini). */
export const hooks = { generate: null };

export const hashQ = (q) => crypto.createHash("sha1").update(norm(q)).digest("hex").slice(0, 12);
export const subjectKey = (name) => norm(name).slice(0, 40) || "general";

function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Randomise option order so a model's habit of putting the answer first doesn't leak.
function shuffleOptions(q) {
  const order = shuffle([0, 1, 2, 3]);
  return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) };
}

function allocate(total, n, caps) {
  return Array.from({ length: n }, (_, i) => Math.min(caps[i], Math.floor(total / n) + (i < total % n ? 1 : 0)));
}

// 'weakest' (fortify): lowest-level topics first. 'even' (raid): random rotation.
function pickTopics(subject, count, mode) {
  const topics = [...subject.topics];
  const ordered = mode === "weakest" ? topics.sort((a, b) => (a.level || 1) - (b.level || 1)) : shuffle(topics);
  return Array.from({ length: count }, (_, i) => ordered[i % ordered.length]);
}

export const totalFor = (desired, sources) =>
  Math.max(1, Math.min(desired, sources.reduce((n, s) => n + s.topics.length, 0) * MAX_PER_TOPIC));

function sourceText(picks) {
  const seen = new Set();
  return picks
    .filter((t) => (seen.has(t.id) ? false : seen.add(t.id)))
    .map((t) => `TOPIC: ${t.name}\n${t.notes}`)
    .join("\n\n");
}

async function geminiForSubject(subject, picks, avoid, source) {
  const plan = picks.map((t, i) => `${i + 1}. topic "${t.name}"`).join("\n");
  const avoidBlock = avoid.length ? `\nDo NOT repeat, rephrase or re-test any of these earlier questions:\n${avoid.slice(-15).map((a) => `- ${a.q}`).join("\n")}\n` : "";
  const { json } = await generateJsonWithFallback(
    [
      {
        text: `Write ${picks.length} multiple-choice questions for a quiz battle in "${subject.name}".

SOURCE MATERIAL — the notes from lessons this student has actually completed:
"""
${source}
"""

${QUESTION_RULES_PROMPT}

Write ONE question per line below, in this order, each about that topic and each testing a DIFFERENT fact:
${plan}
${avoidBlock}
Return ONLY JSON: {"questions":[{"topic":"topic name","question":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"one sentence","evidence":"one sentence copied word-for-word from the SOURCE MATERIAL"}]}`,
      },
    ],
    { logLabel: "war-questions" }
  );
  return json.questions || [];
}

/**
 * @param sources [{ id, name, topics:[{ id, name, level, notes }] }] — LEARNED material only
 * @param seen    { [subjectKey]: [{h,q,at}] } — what THIS player was already asked
 * @param opts    { total, mode: 'even'|'weakest', generate?, demo? }
 * @returns { questions, seen, used:[{subject, topic}] }
 */
export async function buildQuestionSet(sources, seen = {}, { total = 8, mode = "even", generate, demo } = {}) {
  const gen = generate || hooks.generate || (process.env.GEMINI_API_KEY ? geminiForSubject : null);
  const allowDemo = demo ?? process.env.GYAN_DEMO_QUESTIONS === "1";
  const caps = sources.map((s) => s.topics.length * MAX_PER_TOPIC);
  const counts = allocate(total, sources.length, caps);
  const nextSeen = { ...seen };
  const used = [];

  const perSubject = await Promise.all(
    sources.map(async (subject, i) => {
      const key = subjectKey(subject.name);
      const history = nextSeen[key] || [];
      const picks = pickTopics(subject, counts[i], mode);
      const chosen = [];
      const source = sourceText(picks);

      const accept = (q, topicName, opts) => {
        if (isRepeat(q.question, history.map((h) => h.q)) || isRepeat(q.question, chosen.map((c) => c.question))) return false;
        chosen.push({ ...shuffleOptions(q), topicName: topicName || q.topic || subject.name, ...opts });
        return true;
      };

      for (let attempt = 0; attempt < 2 && gen && chosen.length < picks.length; attempt++) {
        try {
          const want = picks.slice(chosen.length);
          const raw = await gen(subject, want, [...history, ...chosen.map((c) => ({ q: c.question }))], source);
          const { kept } = filterQuestions(raw, source);
          kept.forEach((q) => chosen.length < picks.length && accept(q, q.topic));
        } catch (e) {
          console.warn(`[war-questions] generator failed for "${subject.name}": ${String(e.message).slice(0, 140)}`);
        }
      }

      // Demo mode only: generic questions by subject NAME. Not the student's material.
      if (allowDemo && chosen.length < picks.length) {
        const pool = shuffle(bankFor(subject.name).q);
        for (const [topic, question, options, correctIndex, explanation] of pool) {
          if (chosen.length >= picks.length) break;
          accept({ question, options, correctIndex, explanation }, topic, { demo: true });
        }
      }

      nextSeen[key] = [...history, ...chosen.map((c) => ({ h: hashQ(c.question), q: c.question, at: Date.now() }))].slice(-HISTORY_PER_SUBJECT);
      chosen.forEach((c) => used.push({ subject: subject.name, topic: c.topicName }));

      return chosen.map((c) => ({
        question: c.question,
        options: c.options,
        correctIndex: c.correctIndex,
        explanation: c.explanation || "",
        topicName: c.topicName,
        subjectId: subject.id,
        subjectName: subject.name,
      }));
    })
  );

  // Interleave so consecutive questions come from different subjects.
  const questions = [];
  const queues = perSubject.map((q) => [...q]);
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) questions.push(q.shift());
  return { questions, seen: nextSeen, used };
}
