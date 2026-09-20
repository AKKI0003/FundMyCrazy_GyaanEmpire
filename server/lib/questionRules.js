// server/lib/questionRules.js
//
// One definition of "a good question", used by the study quiz, raids and
// fortify so they can't drift apart.
//
// The failure modes this exists to stop (all seen in real output):
//   * "Which describes the 'Worked Example' stage…"   -> tests the LESSON'S
//     STRUCTURE instead of the subject.
//   * "In the introduction to AI context, what is…"   -> vague framing that
//     only makes sense if you remember how the lesson was laid out.
//   * Numeric questions whose options don't match the method the lesson used.
//   * Questions on things the student was never taught.
//
// Defence in depth: the PROMPT asks for grounded questions, then the CODE
// checks that each one quotes evidence that really appears in the source
// text the student was given, and rejects structure/meta wording.

export const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2));

// Wording that refers to the lesson itself instead of the subject.
const META = [
  /\b(this|the|that|our|above)\s+(lesson|passage|reading|text|syllabus|module|excerpt|part|section)\b/i,
  /\baccording to (the )?(lesson|text|passage|syllabus|part|section)\b/i,
  /['"‘“]?\b(worked example|core mechanism|core mechanics|common mistakes|summary (&|and) connections|introduction (&|and) context)\b['"’”]?\s+(stage|part|section|phase)\b/i,
  /\b(stage|part|section)\s+(\d|one|two|three|four|five)\b/i,
  /\b(in|during|within|from)\s+the\s+(context of\s+the\s+)?(core mechanism|worked example|introduction to \w+ context)\b/i,
  /\bin the (introduction|core mechanism|worked example)\b.*\bcontext\b/i,
  /\bwhich of the following describes the\b.*\b(stage|part|section)\b/i,
];

const LAZY_OPTION = /^(all of the above|none of the above|both [a-d] and [a-d]|a and b|b and c)\.?$/i;

export function isMeta(text) {
  return META.some((re) => re.test(text));
}

/**
 * Is `evidence` (a quote the model claims supports the answer) really in the
 * source? Token overlap rather than exact substring, so harmless whitespace or
 * punctuation differences don't reject good questions.
 */
export function isGrounded(evidence, source) {
  const e = tokens(evidence);
  if (e.size < 3) return false;
  const s = tokens(source);
  let hit = 0;
  for (const t of e) if (s.has(t)) hit++;
  return hit / e.size >= 0.75;
}

/** Structural validity + wording checks. Returns a cleaned question or null. */
export function cleanQuestion(q) {
  if (!q || typeof q.question !== "string") return null;
  const question = q.question.trim();
  if (question.length < 12 || question.length > 400) return null;
  if (!Array.isArray(q.options) || q.options.length !== 4) return null;
  const options = q.options.map((o) => String(o ?? "").trim());
  if (options.some((o) => !o || o.length > 220 || LAZY_OPTION.test(o))) return null;
  if (new Set(options.map(norm)).size !== 4) return null; // duplicate options
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) return null;
  if (isMeta(question) || options.some(isMeta)) return null;
  return {
    question,
    options,
    correctIndex: q.correctIndex,
    explanation: String(q.explanation || "").trim(),
    evidence: String(q.evidence || "").trim(),
    topic: q.topic ? String(q.topic).trim() : undefined,
  };
}

/**
 * Keep only questions that are well-formed AND grounded in `source`.
 * `requireEvidence` is false only for legacy data with no lesson text at all.
 */
export function filterQuestions(raw, source, { requireEvidence = true } = {}) {
  const kept = [];
  const rejected = { malformed: 0, ungrounded: 0 };
  for (const r of Array.isArray(raw) ? raw : []) {
    const c = cleanQuestion(r);
    if (!c) { rejected.malformed++; continue; }
    if (requireEvidence && !isGrounded(c.evidence, source)) { rejected.ungrounded++; continue; }
    kept.push(c);
  }
  return { kept, rejected };
}

/** Prompt block shared by every generator. */
export const QUESTION_RULES_PROMPT = `QUESTION RULES (all mandatory):
1. Base every question ONLY on the SOURCE MATERIAL above — facts, definitions, steps, formulas, numbers and reasoning that the student was actually taught. Do not use outside knowledge, and do not test anything the source doesn't state.
2. Test the SUBJECT, never the lesson itself. Never write "in this lesson", "the text", "the passage", "the syllabus", or name a lesson stage/part/section ("worked example stage", "core mechanism", "introduction context"). Never ask which part of the lesson covered something.
3. Each question must be fully self-contained: a student who forgot how the lesson was laid out must still understand exactly what is being asked. Include any numbers or definitions the question needs.
4. Exactly ONE option is correct. The other three must be plausible mistakes but clearly wrong according to the source. No "all of the above" / "none of the above" / "both A and B". Keep option lengths similar.
5. For numeric questions, recompute the answer yourself using the exact method the source used, and make sure exactly one option matches it.
6. Plain, grammatical, unambiguous wording. One idea per question. No trick questions.
7. Every question needs an "evidence" field: copy ONE sentence (or clause) word-for-word from the SOURCE MATERIAL that proves the correct answer. If you cannot quote such a sentence, do not write that question.`;

const STOP = new Set(("what which the and are does did following that this with from for how why when will would used most best "
  + "into than then them they their there these those have has had was were been being not but can could should about between").split(" "));
const contentTokens = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));

/** Content-word overlap (0..1) — filler like "which/the/what" doesn't count, so
 *  two different questions that merely share a sentence shape aren't "duplicates". */
export function similarity(a, b) {
  const A = contentTokens(a);
  const B = contentTokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

export const isRepeat = (question, previous, threshold = 0.85) =>
  previous.some((p) => similarity(p, question) >= threshold);
