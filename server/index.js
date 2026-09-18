import "dotenv/config";
import express from "express";
import cors from "cors";
import { generateJsonWithFallback, MODEL_CHAIN } from "./lib/geminiClient.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️  GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.");
}
console.log("Gemini model fallback chain:", MODEL_CHAIN.join(" -> "));

app.post("/api/generate-tree", async (req, res) => {
  try {
    const { subject, text, imageBase64, imageMimeType } = req.body;
    if (!subject) return res.status(400).json({ error: "subject is required" });

    const parts = [
      {
        text: `You are structuring a study syllabus into a game "tech tree". Subject: ${subject}.
${text ? `Notes/syllabus text:\n${text}` : "Read the syllabus from the attached image."}
Return ONLY JSON matching this schema (no prose):
{"topics":[{"id":"string-slug","name":"Topic name (max 4 words)","difficulty":1-5,"prerequisites":["id of topic that must come first"]}]}
Identify 6 to 10 real topics from the content. Prerequisites must form a sensible learning order (basics first). Root topics have empty prerequisites arrays. Use short lowercase-hyphen ids.`,
      },
    ];
    if (imageBase64) {
      parts.push({ inlineData: { mimeType: imageMimeType || "image/jpeg", data: imageBase64 } });
    }

    const { json, modelUsed } = await generateJsonWithFallback(parts, { logLabel: "generate-tree" });
    if (!json.topics?.length) throw new Error("No topics returned — try adding more detail.");
    res.json({ ...json, _modelUsed: modelUsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to generate topic tree" });
  }
});

app.post("/api/generate-quiz", async (req, res) => {
  try {
    const { subject, topicName } = req.body;
    if (!subject || !topicName) return res.status(400).json({ error: "subject and topicName are required" });

    const { json, modelUsed } = await generateJsonWithFallback(
      [
        {
          text: `Create a short 3-question multiple choice quiz to check understanding of the topic "${topicName}" within the subject "${subject}".
Return ONLY JSON: {"questions":[{"question":"...","options":["a","b","c","d"],"correctIndex":0}]}`,
        },
      ],
      { logLabel: "generate-quiz" }
    );
    res.json({ ...json, _modelUsed: modelUsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to generate quiz" });
  }
});

// --- Shared empire state — the handshake point between React and Unity ---
// In-memory for the hackathon build. Swap for a real DB later — the shape
// below is the contract both sides code against.
const empireStore = new Map(); // sessionId -> { subject, topics, xpMap, points, gems, streak }

app.post("/api/empire/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { subject, topics, xpMap, points, gems, streak } = req.body;
  const existing = empireStore.get(sessionId) || {};
  const next = {
    subject: subject ?? existing.subject,
    topics: topics ?? existing.topics ?? [],
    xpMap: xpMap ?? existing.xpMap ?? {},
    points: points ?? existing.points ?? 0,
    gems: gems ?? existing.gems ?? 0,
    streak: streak ?? existing.streak ?? 0,
  };
  empireStore.set(sessionId, next);
  res.json(next);
});

app.get("/api/empire/:sessionId", (req, res) => {
  const state = empireStore.get(req.params.sessionId);
  if (!state) return res.status(404).json({ error: "No empire found for this session" });
  res.json(state);
});

// --- Clans + clan wars (new — needed for Unity multiplayer clan-war phase) ---
// In-memory Map for the hackathon. clanId -> { name, members: [sessionId,...], warScore }
const clanStore = new Map();

app.post("/api/clan/create", (req, res) => {
  const { clanId, name, sessionId } = req.body;
  if (!clanId || !name || !sessionId) return res.status(400).json({ error: "clanId, name, sessionId required" });
  if (clanStore.has(clanId)) return res.status(409).json({ error: "clanId already taken" });
  const clan = { name, members: [sessionId], warScore: 0 };
  clanStore.set(clanId, clan);
  res.json({ clanId, ...clan });
});

app.post("/api/clan/:clanId/join", (req, res) => {
  const { clanId } = req.params;
  const { sessionId } = req.body;
  const clan = clanStore.get(clanId);
  if (!clan) return res.status(404).json({ error: "No such clan" });
  if (!clan.members.includes(sessionId)) clan.members.push(sessionId);
  res.json({ clanId, ...clan });
});

app.post("/api/clan/:clanId/score", (req, res) => {
  // Unity calls this whenever a member finishes a quiz during clan-war phase
  const { clanId } = req.params;
  const { delta } = req.body; // points earned this quiz
  const clan = clanStore.get(clanId);
  if (!clan) return res.status(404).json({ error: "No such clan" });
  clan.warScore += Number(delta) || 0;
  res.json({ clanId, ...clan });
});

app.get("/api/clan/:clanId", (req, res) => {
  const clan = clanStore.get(req.params.clanId);
  if (!clan) return res.status(404).json({ error: "No such clan" });
  res.json({ clanId: req.params.clanId, ...clan });
});

app.get("/api/clans", (req, res) => {
  // leaderboard for the clan-war screen
  const all = [...clanStore.entries()]
    .map(([clanId, c]) => ({ clanId, ...c }))
    .sort((a, b) => b.warScore - a.warScore);
  res.json(all);
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Gyan Empire backend running on http://localhost:${PORT}`));
