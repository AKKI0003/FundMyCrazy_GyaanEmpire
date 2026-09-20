// server/lib/quizBuilder.js
//
// Builds the study quiz for one topic FROM THE LESSON TEXT THE STUDENT ACTUALLY
// READ. (Before this, the model was only told the names of the lesson stages,
// so it wrote questions about the stages themselves.)
//
// `generate(promptText)` -> parsed JSON. Injected so it can be tested offline.

import { filterQuestions, QUESTION_RULES_PROMPT, isRepeat } from "./questionRules.js";

/** Plain-text version of everything taught so far — the ONLY thing questions may draw on. */
export function lessonSource(parts = []) {
  return parts
    .filter((p) => p && (p.explanation || p.keyPoints?.length))
    .map((p, i) => {
      const kp = (p.keyPoints || []).length ? `\nKey points: ${p.keyPoints.join(" | ")}` : "";
      return `PART ${i + 1} — ${p.title || "Untitled"}\n${(p.explanation || "").trim()}${kp}`;
    })
    .join("\n\n");
}

export function questionCountFor(minutes) {
  return minutes >= 25 ? 8 : minutes >= 15 ? 5 : 3;
}

function prompt({ subject, topicName, source, syllabusText, count, ask, difficulty, avoid }) {
  const material = source
    ? `SOURCE MATERIAL — everything the student has been taught about "${topicName}" so far:\n"""\n${source.slice(0, 24000)}\n"""`
    : `SOURCE MATERIAL — the student's syllabus excerpt (no lesson has been recorded yet):\n"""\n${(syllabusText || "").slice(0, 6000)}\n"""`;
  const avoidBlock = avoid.length ? `\nDo NOT reuse, rephrase, or test the same fact as any of these:\n${avoid.slice(-15).map((q) => `- ${q}`).join("\n")}\n` : "";
  return `Write a multiple-choice quiz on "${topicName}" (subject: ${subject}).

${material}

${QUESTION_RULES_PROMPT}

${difficulty}
Spread the questions across DIFFERENT parts of the source material — do not ask two questions about the same fact.
${avoidBlock}
Return EXACTLY ${ask} questions, numbered in your head 1..${ask}.
Return ONLY JSON: {"questions":[{"question":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"1-2 sentences, addressed to the student, saying why the correct option is right","evidence":"one sentence copied word-for-word from the SOURCE MATERIAL"}]}`;
}

export async function buildQuiz({ subject, topicName, minutes = 5, lessonParts = [], syllabusText = "", excludeQuestions = [] }, generate) {
  const count = questionCountFor(minutes);
  const source = lessonSource(lessonParts);
  const grounding = source || syllabusText || "";
  const difficulty =
    minutes >= 25
      ? "Go deeper: include at least 2 application questions (a small scenario or calculation drawn from the source), not just recall."
      : minutes >= 15
      ? "Mix direct recall with 1–2 lightly applied questions."
      : "Keep it to direct, foundational recall — this is a quick check-in.";

  const kept = [];
  const avoid = [...excludeQuestions];
  let lastRejected = { malformed: 0, ungrounded: 0 };

  for (let attempt = 0; attempt < 3 && kept.length < count; attempt++) {
    const need = count - kept.length;
    const ask = need + 2; // small buffer: some will be filtered out
    const json = await generate(prompt({ subject, topicName, source, syllabusText, count, ask, difficulty, avoid: [...avoid, ...kept.map((k) => k.question)] }));
    const { kept: good, rejected } = filterQuestions(json?.questions, grounding, { requireEvidence: !!grounding });
    lastRejected = rejected;
    for (const q of good) {
      if (kept.length >= count) break;
      if (isRepeat(q.question, [...avoid, ...kept.map((k) => k.question)])) continue;
      kept.push(q);
    }
  }

  if (!kept.length) {
    throw new Error(`Couldn't build a reliable quiz right now (${lastRejected.ungrounded} ungrounded, ${lastRejected.malformed} malformed) — please try again.`);
  }
  // `evidence` is for verification only; the student doesn't need it.
  return { questions: kept.map(({ evidence, topic, ...q }) => q), short: kept.length < count };
}
