import "dotenv/config";
import express from "express";
import cors from "cors";
import { generateJsonWithFallback, MODEL_CHAIN } from "./lib/geminiClient.js";
import { load as loadStore } from "./lib/store.js";
import { buildQuiz, lessonSource } from "./lib/quizBuilder.js";
import { normalizeLesson } from "./lib/lessonShape.js";
import { seedBots } from "./lib/bots.js";
import warRouter from "./routes/war.js";

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

const LESSON_STAGES = [
  {
    label: "Introduction & context",
    layout: "Sections: \"What it is\" (a crisp definition in the body), \"Where it came from\" (itemsStyle \"bullets\" \u2014 one dated or named milestone each; skip gracefully if ahistorical), \"Why it matters today\" (itemsStyle \"bullets\" of concrete real uses).",
    instruction:
      "What this specific topic covers per the syllabus; where it came from (origin, key names/dates, or the problem that motivated it, whenever the subject has a real history — skip gracefully if ahistorical), and why it matters today. This stage is conceptual scene-setting — no worked example here.",
  },
  {
    label: "Core mechanism",
    layout: "Sections: \"The big idea\" (short body), \"How it works\" (itemsStyle \"steps\" \u2014 each step names the component it involves, in order), \"Key terms\" (itemsStyle \"terms\" \u2014 each item written as \"Term \u2014 plain definition\").",
    instruction:
      "The formal, precise definition of the technique/process: name its actual components/steps/parts explicitly (e.g. if this is an algorithm, list its steps in order; if it's a framework, name its parts). Write this like a textbook's technical definition section, not a re-told story. Do not use a narrative scenario or analogy here — that's for the next stage.",
  },
  {
    label: "Worked example",
    layout: "Sections: \"The setup\" (itemsStyle \"bullets\" listing every given value), \"Step by step\" (itemsStyle \"steps\" \u2014 each step shows the actual calculation/state and its result), \"What the result tells us\" (short body). Use the SAME numbers throughout.",
    instruction:
      "One FULLY concrete worked example, traced step by step with actual specific values/states/names — not a scene-setting analogy with no real steps. Pick a minimal concrete scenario (specific numbers, named entities, or an explicit small case from the syllabus) and walk through exactly what happens at each step in order, referencing the mechanism from the previous stage by name. A reader should be able to follow along and reproduce the steps themselves.",
  },
  {
    label: "Common mistakes & edge cases",
    layout: "3\u20134 sections, ONE PER TRAP: heading = the mistake, body = why it happens, callout = \"Fix: \u2026\".",
    instruction:
      "What students usually get wrong on exactly this material — specific misconceptions, edge cases, or failure modes — and how to avoid each one. Frame this as a list of distinct traps, each with why it happens and the fix, not a recap of the definition.",
  },
  {
    label: "Summary & connections",
    layout: "Sections: \"What you now know\" (itemsStyle \"bullets\" naming specific facts/steps/terms, one line each), \"How it connects\" (short body or bullets linking to neighbouring topics).",
    instruction:
      "A tight recap that names the specific facts/steps/terms already taught (by name, in one line each) and then explains how this topic connects to the topics around it in the syllabus. This is the only stage allowed to reference earlier stages directly.",
  },
];

function syllabusBlock(syllabusText) {
  if (!syllabusText || !syllabusText.trim()) return "";
  return `\n\nHere is the student's actual syllabus text. Ground everything you write in what THIS excerpt actually says about the topic — use its specific sub-points, techniques, and terminology instead of generic textbook knowledge:\n"""\n${syllabusText.slice(0, 6000)}\n"""`;
}

function stageLabels() {
  return LESSON_STAGES.map((s) => s.label);
}


app.post("/api/generate-lesson", async (req, res) => {
  try {
    const { subject, topicName, partIndex = 0, syllabusText = "", priorSections = [] } = req.body;
    if (!subject || !topicName) return res.status(400).json({ error: "subject and topicName are required" });

    const stageIndex = Math.min(Math.max(Number(partIndex) || 0, 0), LESSON_STAGES.length - 1);
    const stage = LESSON_STAGES[stageIndex];

    // What was ACTUALLY written before — both the facts (keyPoints) and a
    // slice of the real prose (openingExcerpt) — not just an abstract stage
    // label. Each call to the model is stateless, so without the real
    // wording it has no way to know it already opened with "imagine a maze"
    // and just reaches for the same generic scene every single time.
    const priorBlock = priorSections.length
      ? `\n\nThe student has already been taught these earlier parts of THIS SAME topic — here is exactly what was already said, including the actual opening wording used:\n${priorSections
          .map(
            (p, i) =>
              `Part ${i + 1} — "${p.title}": ${(p.keyPoints || []).join("; ")}${
                p.openingExcerpt ? `\n  Opened with: "${p.openingExcerpt}..."` : ""
              }`
          )
          .join("\n")}\n\nHARD RULES: (1) Do not restate any fact, definition, or key point listed above in different words. (2) Do not reuse any analogy, scenario, or opening image already used above (e.g. if a maze/apprentice/other scenario appears above, pick a completely different one, or none). (3) Every sentence in this part should teach something not already covered above.`
      : "\n\nThis is the very first part the student is seeing on this topic — you may introduce/define it here, but only here.";

    const { json, modelUsed } = await generateJsonWithFallback(
      [
        {
          text: `You are a patient teacher walking a student through "${topicName}" (subject: ${subject}), stage by stage, like a real lesson. The stages are, in order: ${stageLabels().join(" → ")}.

This call is ONLY for stage ${stageIndex + 1} of ${LESSON_STAGES.length}: "${stage.label}".
Stage brief: ${stage.instruction}
${priorBlock}
${syllabusBlock(syllabusText)}

Write a WELL-ORGANISED study page of 350-450 words in total — substantial enough that a careful reader spends a few real minutes on it, but laid out so it can be scanned and revisited, NOT as an essay. Reference specific sub-points, techniques, or terms from the syllabus excerpt for THIS topic rather than generic textbook filler. This stage must be structurally different from the others (per its stage brief above), not just reworded.

LAYOUT (mandatory):
- 3 to 5 sections. Each has a short concrete heading (2-6 words; never just "Introduction" or "Overview").
- A section's "body" is at most 2-3 short sentences (about 55 words max). Never write a long paragraph. Leave "body" empty if the section is only a list.
- Anything list-like goes in "items", with itemsStyle "steps" (ordered procedure), "bullets" (parallel facts/examples) or "terms" (each item is "Term — plain definition"). Use "none" with no items when a section is only body text.
- "callout" is optional: ONE short tip, warning, or rule of thumb (max 25 words). Empty string if none.
- Put formulas and worked numbers on their own item lines so they are easy to read.
${stage.layout ? `- Layout for THIS stage: ${stage.layout}` : ""}
- "summary": ONE plain sentence (max 30 words) saying what the reader will know or be able to do after this part.
- "keyPoints": exactly 4 takeaways. Each must make sense ON ITS OWN out of context: name the specific term, number or entity (never "this", "it" or "the model" without saying which). They are reused later to write quiz questions, so they must be true, specific facts.

Return ONLY JSON: {"title":"short stage title","summary":"one sentence","sections":[{"heading":"...","body":"...","itemsStyle":"steps|bullets|terms|none","items":["..."],"callout":""}],"keyPoints":["...","...","...","..."]}`,
        },
      ],
      { logLabel: "generate-lesson" }
    );
    const lesson = normalizeLesson(json);
    res.json({ ...lesson, partIndex: stageIndex, totalParts: LESSON_STAGES.length, _modelUsed: modelUsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to generate lesson" });
  }
});

app.post("/api/generate-quiz", async (req, res) => {
  try {
    const { subject, topicName, minutes = 5, excludeQuestions = [], syllabusText = "", lessonParts = [] } = req.body;
    if (!subject || !topicName) return res.status(400).json({ error: "subject and topicName are required" });

    // Questions are written from the lesson text the student actually read
    // (`lessonParts`) and every one must quote evidence from it — see
    // server/lib/quizBuilder.js and questionRules.js.
    const generate = async (text) => (await generateJsonWithFallback([{ text }], { logLabel: "generate-quiz" })).json;
    const { questions, short } = await buildQuiz({ subject, topicName, minutes, lessonParts, syllabusText, excludeQuestions }, generate);
    res.json({ questions, short });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to generate quiz" });
  }
});

// Suggests real YouTube videos for a topic. Non-fatal by design: if no key
// is configured, or the YouTube API errors, we return an empty list instead
// of a 500 — a missing video panel shouldn't break the lesson itself.
app.post("/api/topic-videos", async (req, res) => {
  const { topicName, subject } = req.body;
  if (!topicName) return res.status(400).json({ error: "topicName is required" });
  if (!process.env.YOUTUBE_API_KEY) return res.json({ videos: [] });

  try {
    const q = `${topicName} ${subject || ""}`.trim();
    const url =
      "https://www.googleapis.com/youtube/v3/search?" +
      new URLSearchParams({
        part: "snippet",
        type: "video",
        maxResults: "3",
        safeSearch: "strict",
        relevanceLanguage: "en",
        q,
        key: process.env.YOUTUBE_API_KEY,
      });
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || `YouTube API returned ${r.status}`);

    const videos = (data.items || [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet?.title || "Untitled",
        channelTitle: item.snippet?.channelTitle || "",
        thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
      }));
    res.json({ videos });
  } catch (err) {
    console.error("[topic-videos]", err.message);
    res.json({ videos: [] }); // degrade gracefully, never block the lesson
  }
});

// Open-ended reflection question, generated from what the student has
// actually been taught so far (same stage-gating as the quiz) — this feeds
// the "write it out" mode, which pays more points than a multiple-choice
// quiz for the deeper, harder-to-fake effort of composing a real answer.
app.post("/api/generate-written-prompt", async (req, res) => {
  try {
    const { subject, topicName, partsCovered = 1, syllabusText = "", lessonParts = [] } = req.body;
    if (!subject || !topicName) return res.status(400).json({ error: "subject and topicName are required" });

    const coveredStages = LESSON_STAGES.slice(0, Math.min(Math.max(partsCovered, 1), LESSON_STAGES.length));
    const taught = lessonSource(lessonParts);
    const { json, modelUsed } = await generateJsonWithFallback(
      [
        {
          text: `Write ONE open-ended reflection question for a student who has just studied "${topicName}" (subject: ${subject}), covering: ${coveredStages
            .map((s) => s.label)
            .join(", ")}.
${taught ? `\nThe student has been taught ONLY this (base the question strictly on it; never mention "the lesson", a stage name, or a part number):\n"""\n${taught.slice(0, 20000)}\n"""\n` : syllabusBlock(syllabusText)}
The question must be self-contained and must require explaining a concept, working through reasoning, or applying what was learned in the student's own words — never a yes/no or single-fact recall question that a multiple-choice quiz would already cover just as well.
Return ONLY JSON: {"prompt":"the question, one sentence"}`,
        },
      ],
      { logLabel: "written-prompt" }
    );
    res.json({ prompt: json.prompt, _modelUsed: modelUsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to generate a written prompt" });
  }
});

// Grades a free-text answer against the same syllabus grounding used to
// teach the topic. Score is intentionally conservative — a vague or
// memorized-sounding answer should not read as a 90.
app.post("/api/grade-written-answer", async (req, res) => {
  try {
    const { subject, topicName, prompt, answer, syllabusText = "" } = req.body;
    if (!subject || !topicName || !prompt || !answer) {
      return res.status(400).json({ error: "subject, topicName, prompt and answer are required" });
    }
    const { json, modelUsed } = await generateJsonWithFallback(
      [
        {
          text: `You are grading a student's written answer for the topic "${topicName}" (subject: ${subject}).
Question asked: "${prompt}"
Student's answer: """${String(answer).slice(0, 4000)}"""
${syllabusBlock(syllabusText)}
Grade fairly and encouragingly but honestly on a 0-100 scale — a vague, generic, or memorized-sounding answer should score noticeably lower than one that shows real, specific understanding, even if both are grammatically fine. An empty or off-topic answer scores near 0.
Return ONLY JSON: {"score":0-100,"feedback":"2-3 sentences of specific, encouraging feedback written directly to the student — what was right, and one concrete thing to improve"}`,
        },
      ],
      { logLabel: "grade-written-answer" }
    );
    const score = Math.max(0, Math.min(100, Math.round(Number(json.score) || 0)));
    res.json({ score, feedback: json.feedback || "", _modelUsed: modelUsed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to grade the answer" });
  }
});

const empireStore = new Map();

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

// Multiplayer: players, clans, clan wars, raids, fortify (see server/routes/war.js)
loadStore();
seedBots();
app.use("/api", warRouter);

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Gyan Empire backend running on http://localhost:${PORT}`));
