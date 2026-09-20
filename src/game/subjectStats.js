import { clamp, levelFromXP } from "../lib/utils";

export const XP_PER_TOPIC_MAX = 60 * 7; // level 8 cap (see levelFromXP)

/** Roll a subject's topic XP up into what the base needs to draw and defend it. */
export function subjectStats(subject) {
  const topics = subject.topics || [];
  if (!topics.length) return { level: 1, pct: 0, vulnerable: false, status: "Just started", ready: false };
  const xp = (t) => subject.xpMap?.[t.id] || 0;
  const total = topics.reduce((s, t) => s + xp(t), 0);
  const pct = clamp(Math.round((total / (topics.length * XP_PER_TOPIC_MAX)) * 100), 0, 100);
  const level = clamp(Math.round(topics.reduce((s, t) => s + levelFromXP(xp(t)), 0) / topics.length), 1, 8);
  const vulnerable = topics.some((t) => xp(t) > 0 && levelFromXP(xp(t)) <= 2);
  let status = "Just started";
  if (vulnerable) status = "Needs review";
  else if (pct >= 90) status = "High understanding";
  else if (pct >= 30) status = "In progress";
  return { level, pct, vulnerable, status, ready: pct >= 75 && level < 8 };
}

// ---- What counts as "learned" (this drives every battle/fortify question) -----------
// A topic is UNLOCKED when it has no prerequisites, was bought open with gems, or
// every prerequisite is at Level 2+. It is LEARNED once it is unlocked AND at least
// one lesson part has actually been taught. Locked topics, topics you never opened,
// and deleted subjects are never quizzed. Unlock or study more and the pool grows.
export function topicUnlocked(subject, topic) {
  if (!topic.prerequisites?.length) return true;
  if (subject.unlockedEarly?.[topic.id]) return true;
  return topic.prerequisites.every((p) => (subject.xpMap?.[p] || 0) >= 60);
}

export const topicLearned = (subject, topic) => topicUnlocked(subject, topic) && (subject.lessonHistory?.[topic.id]?.length || 0) > 0;

/** Compact study notes for a topic, built from the lesson parts the student was taught. */
export function topicNotes(subject, topic, max = 3000) {
  const parts = subject.lessonHistory?.[topic.id] || [];
  const text = parts
    .map((p) => {
      const lead = p.summary || (p.explanation || "").replace(/\s+/g, " ").slice(0, 300);
      const kp = (p.keyPoints || []).length ? ` Key points: ${p.keyPoints.join(" | ")}` : "";
      return `${p.title}: ${lead}${kp}`;
    })
    .join("\n");
  return text.slice(0, max);
}

export const learnedTopics = (subject) => (subject.topics || []).filter((t) => topicLearned(subject, t));
