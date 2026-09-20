// server/lib/lessonShape.js

// Gemini sometimes ignores the requested layout. Coerce whatever comes back
// into the structured shape the lesson page renders, and derive a plain-text
// `explanation` from it (used as the "already taught" record for later parts
// and as the source text the quiz is written from).
export function normalizeLesson(json) {
  const clean = (v, max = 600) => String(v ?? "").trim().slice(0, max);
  let sections = (Array.isArray(json.sections) ? json.sections : [])
    .map((sec) => {
      const style = ["steps", "bullets", "terms", "none"].includes(sec?.itemsStyle) ? sec.itemsStyle : "bullets";
      const items = (Array.isArray(sec?.items) ? sec.items : []).map((i) => clean(i, 400)).filter(Boolean).slice(0, 10);
      return { heading: clean(sec?.heading, 80), body: clean(sec?.body, 500), itemsStyle: items.length ? style : "none", items, callout: clean(sec?.callout, 200) };
    })
    .filter((sec) => sec.heading && (sec.body || sec.items.length))
    .slice(0, 6);
  // Model returned the old single-essay shape (or junk): keep the text, split it into readable paragraphs.
  if (sections.length < 2 && json.explanation) {
    const paras = String(json.explanation).split(/\n{2,}|(?<=\.)\s{2,}/).map((p) => p.trim()).filter(Boolean);
    sections = paras.slice(0, 5).map((p, i) => ({ heading: i === 0 ? clean(json.title, 80) || "Overview" : `Continued (${i + 1})`, body: p.slice(0, 700), itemsStyle: "none", items: [], callout: "" }));
  }
  const explanation = sections
    .map((sec) => [sec.heading + ".", sec.body, ...sec.items.map((it, i) => (sec.itemsStyle === "steps" ? `${i + 1}. ${it}` : `- ${it}`)), sec.callout].filter(Boolean).join("\n"))
    .join("\n\n");
  return {
    title: clean(json.title, 90) || "Lesson",
    summary: clean(json.summary, 220),
    sections,
    explanation,
    keyPoints: (Array.isArray(json.keyPoints) ? json.keyPoints : []).map((k) => clean(k, 300)).filter(Boolean).slice(0, 5),
  };
}

