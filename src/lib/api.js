async function get(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function generateTopicTree({ subject, text, imageBase64, imageMimeType }) {
  return post("/api/generate-tree", { subject, text, imageBase64, imageMimeType });
}

// syllabusText is the original text the user pasted on setup — carried
// through so lessons/quizzes are grounded in what THEY actually gave us,
// not Gemini's generic knowledge of the subject.
// priorSections carries what was ACTUALLY written in earlier parts (not
// just an abstract stage label) so the server can stop the model from
// re-deriving the same analogy/facts every call — each request is
// otherwise stateless and has no memory of its own past output.
export function generateLesson({ subject, topicName, partIndex, syllabusText, priorSections }) {
  return post("/api/generate-lesson", { subject, topicName, partIndex, syllabusText, priorSections });
}
// lessonParts = the lesson text the student was actually taught ({title, explanation, keyPoints}[]).
// Quiz and written-prompt questions are written from it, not from the topic name alone.
export function generateQuiz({ subject, topicName, minutes, excludeQuestions, syllabusText, lessonParts }) {
  return post("/api/generate-quiz", { subject, topicName, minutes, excludeQuestions, syllabusText, lessonParts });
}

export function generateWrittenPrompt({ subject, topicName, partsCovered, syllabusText, lessonParts }) {
  return post("/api/generate-written-prompt", { subject, topicName, partsCovered, syllabusText, lessonParts });
}
export function gradeWrittenAnswer({ subject, topicName, prompt, answer, syllabusText }) {
  return post("/api/grade-written-answer", { subject, topicName, prompt, answer, syllabusText });
}

// Best-effort — resolves to {videos: []} rather than throwing if the
// backend has no YOUTUBE_API_KEY configured or the request fails, so a
// missing video panel never blocks the lesson itself.
export async function getTopicVideos({ topicName, subject }) {
  try {
    return await post("/api/topic-videos", { topicName, subject });
  } catch {
    return { videos: [] };
  }
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---- Multiplayer: players, clans, wars, raids, fortify ------------------------
// `playerId` is a random id stored in localStorage (src/game/player.js). There is
// no login yet — see DEV2_NOTES.md.
export const syncPlayer = (body) => post("/api/player/sync", body);
export const getPlayer = (id) => get(`/api/player/${id}`);
export const getIncoming = (id) => get(`/api/incoming/${id}`);

export const createClan = (playerId, name) => post("/api/clan/create", { playerId, name });
export const joinClan = (playerId, clanId) => post(`/api/clan/${encodeURIComponent(clanId)}/join`, { playerId });
export const leaveClan = (playerId) => post("/api/clan/leave", { playerId });
export const getClan = (clanId, playerId) => get(`/api/clan/${clanId}?viewer=${playerId}`);
export const listClans = () => get("/api/clans");
export const startWar = (clanId, playerId) => post(`/api/clan/${clanId}/war/start`, { playerId });
export const endWar = (clanId, playerId) => post(`/api/clan/${clanId}/war/end`, { playerId });

export const getTargets = (playerId) => get(`/api/war/targets/${playerId}`);
// `base` = the freshest snapshot, sent with the request so unlocking/studying/deleting a moment ago counts.
export const startRaid = (playerId, defenderId, extraMisses = 0, base) => post("/api/raid/start", { playerId, defenderId, extraMisses, base });
export const answerRaid = (raidId, playerId, index, choice) => post(`/api/raid/${raidId}/answer`, { playerId, index, choice });
export const retreatRaid = (raidId, playerId) => post(`/api/raid/${raidId}/retreat`, { playerId });

export const startFortify = (playerId, base) => post("/api/fortify/start", { playerId, base });
export const answerFortify = (fortifyId, playerId, index, choice) => post(`/api/fortify/${fortifyId}/answer`, { playerId, index, choice });
