// Run: node scripts/test-war.mjs
// In-process tests (no HTTP, no Gemini, nothing written to disk).
process.env.GYAN_STORE_DISABLE_WRITE = "1";
process.env.GEMINI_API_KEY = "";
delete process.env.GYAN_DEMO_QUESTIONS;
import assert from "node:assert/strict";
import { db } from "../server/lib/store.js";
import { seedBots } from "../server/lib/bots.js";
import * as game from "../server/lib/game.js";
import { buildQuestionSet, hooks } from "../server/lib/warQuestions.js";
import { isMeta, isGrounded, filterQuestions } from "../server/lib/questionRules.js";
import { buildQuiz, lessonSource } from "../server/lib/quizBuilder.js";
import { normalizeLesson } from "../server/lib/lessonShape.js";
import { computeDefense, defaultCastlePos } from "../shared/baseRules.js";

let passed = 0;
const ok = (name, fn) => Promise.resolve().then(fn).then(() => { passed++; console.log("  ✓", name); }, (e) => { console.error("  ✗", name, "\n   ", e.message); process.exitCode = 1; });

// ---- fixtures ------------------------------------------------------------------
// Each topic's notes are 8 distinct factual sentences, like real lesson notes.
const W1 = ["photons", "enzymes", "tariffs", "vectors", "glaciers", "sonnets", "isotopes", "treaties"];
const W2 = ["refract", "catalyse", "distort", "rotate", "erode", "rhyme", "decay", "bind"];
const W3 = ["prisms", "substrates", "quotas", "matrices", "moraines", "stanzas", "neutrons", "envoys"];
const tag = (i) => String(i).padStart(2, "0");
const notesFor = (name) => Array.from({ length: 40 }, (_, i) => `${name} note: ${W1[i % 8]}${tag(i)} ${W2[i % 8]}${tag(i)} whenever ${W3[i % 8]}${tag(i)} appear in ${name} models.`).join(" ");
const topic = (id, name, level = 1) => ({ id, name, level, notes: notesFor(name) });
const cp = defaultCastlePos();
const SLOTS = [[4, 9], [14, 9], [9, 4], [9, 14]];
const baseOf = (subjects, { castleLevel = 1, extra = [] } = {}) => ({
  castleLevel,
  objects: [
    { uid: "castle", kind: "castle", ...cp },
    ...subjects.map((s, i) => ({ uid: `sub:${s.id}`, kind: "subject", ref: s.id, name: s.name, level: s.level || 1, x: SLOTS[i][0], y: SLOTS[i][1] })),
    ...extra,
  ],
  subjects: subjects.map((s) => ({ id: s.id, name: s.name, level: s.level || 1, topics: s.topics })),
});
const subj = (id, name, topics, level = 1) => ({ id, name, level, topics });

// A generator that behaves like a good model: one grounded question per requested topic.
const goodGen = async (subject, picks, avoid, source) => {
  const used = avoid.map((a) => a.q).join(" ");
  const taken = new Set();
  return picks.map((t) => {
    const sentences = t.notes.split(/(?<=\.)\s+/);
    const s = sentences.find((x) => !used.includes(x.split(" ")[2]) && !taken.has(x)) || sentences.find((x) => !taken.has(x)) || sentences[0];
    taken.add(s);
    const w = s.split(" ");
    return {
      topic: t.name,
      question: `Which statement about ${t.name} is correct regarding ${w[2]} ${w[3]} and ${w[5]}?`,
      options: [s, `${t.name} is unrelated to this`, `${t.name} was disproved`, `${t.name} only applies to hardware`],
      correctIndex: 0,
      explanation: "Because the notes say so.",
      evidence: s,
    };
  });
};
hooks.generate = goodGen;

seedBots();

console.log("question rules");
await ok("rejects the exact bad questions from real output as lesson-structure/meta wording", () => {
  for (const q of [
    "Which of the following describes the 'Worked Example' stage where a model iterates through a dataset to refine its weights?",
    "In the context of the core mechanism of AI, which component is primarily responsible for mapping input features to an output prediction using learned weights?",
    "In the introduction to AI context, what is the 'feature space' typically defined as?",
    "According to the lesson, what does gradient descent minimise?",
  ]) assert.ok(isMeta(q), q);
  assert.ok(!isMeta("What does the learning rate scale during a gradient descent weight update?"));
  assert.ok(!isMeta("Which four-stage cycle does machine learning follow?"));
});
const LESSON = "Feature vectors convert raw data into numerical arrays. The objective function computes the discrepancy between predictions and ground-truth labels. Gradient Descent adjusts parameters opposite to the gradient, scaled by the learning rate.";
await ok("grounding: quotes that appear in the lesson pass; invented quotes fail", () => {
  assert.ok(isGrounded("The objective function computes the discrepancy between predictions and ground-truth labels.", LESSON));
  assert.ok(!isGrounded("The feature space is the set of all possible input variables used to describe data points.", LESSON));
  assert.ok(!isGrounded("", LESSON));
});
await ok("filterQuestions drops malformed, duplicate-option, lazy-option, meta and ungrounded questions", () => {
  const good = { question: "What does the learning rate scale in a weight update?", options: ["The step size", "The batch size", "The label count", "The layer depth"], correctIndex: 0, explanation: "x", evidence: "Gradient Descent adjusts parameters opposite to the gradient, scaled by the learning rate." };
  const raw = [
    good,
    { ...good, question: "Which describes the 'Worked Example' stage of this topic?" },
    { ...good, evidence: "Convolutional filters slide across images to detect edges." },
    { ...good, options: ["The step size", "The step size", "b", "c"] },
    { ...good, options: ["The step size", "b", "c", "All of the above"] },
    { ...good, correctIndex: 7 },
  ];
  const { kept, rejected } = filterQuestions(raw, LESSON);
  assert.equal(kept.length, 1);
  assert.equal(rejected.ungrounded, 1);
  assert.equal(rejected.malformed, 4);
});

console.log("study quiz");
const parts = [
  { title: "Introduction", explanation: LESSON, keyPoints: ["Feature vectors are numerical arrays of raw data."] },
  { title: "Worked example", explanation: "With x = 1.5 and w = 100 the prediction is 150. Loss = (150 - 300)^2 = 22,500.", keyPoints: [] },
];
await ok("lessonSource contains the taught text, not just stage names", () => {
  const src = lessonSource(parts);
  assert.ok(src.includes("22,500") && src.includes("Feature vectors"));
});
await ok("quiz retries past junk and returns exactly the requested count of grounded questions", async () => {
  let calls = 0;
  const mk = (q, ev) => ({ question: q, options: [`${q} A`, `${q} B`, `${q} C`, `${q} D`], correctIndex: 1, explanation: "e", evidence: ev });
  const generate = async () => {
    calls++;
    if (calls === 1) return { questions: [mk("Which describes the 'Worked Example' stage of learning?", "Loss = (150 - 300)^2 = 22,500."), mk("What is the loss when the prediction is 150 and the label is 300?", "Loss = (150 - 300)^2 = 22,500."), mk("What is Bayes rule about posterior odds?", "Bayes rule updates posterior odds.")] };
    return { questions: [
      mk("Which quantity is squared to compute the loss in the housing example?", "Loss = (150 - 300)^2 = 22,500."),
      mk("What numerical structure do feature vectors form from raw data?", "Feature vectors convert raw data into numerical arrays."),
      mk("Relative to the gradient, which direction does gradient descent move the parameters?", "Gradient Descent adjusts parameters opposite to the gradient, scaled by the learning rate."),
    ] };
  };
  const { questions, short } = await buildQuiz({ subject: "AI", topicName: "Intro", minutes: 5, lessonParts: parts }, generate);
  assert.equal(questions.length, 3, JSON.stringify(questions.map((q) => q.question)));
  assert.equal(short, false);
  assert.ok(questions.every((q) => q.evidence === undefined));
  assert.ok(!questions.some((q) => /Bayes|Worked Example/.test(q.question)));
});
await ok("quiz fails loudly (not with junk) if the model never produces a grounded question", async () => {
  const generate = async () => ({ questions: [{ question: "What is the capital of France exactly?", options: ["Paris", "Rome", "Oslo", "Bern"], correctIndex: 0, evidence: "Paris is the capital of France." }] });
  await assert.rejects(() => buildQuiz({ subject: "AI", topicName: "Intro", minutes: 5, lessonParts: parts }, generate), /reliable quiz/);
});

console.log("lesson layout");
await ok("structured lesson is kept and gets a plain-text explanation for later reuse", () => {
  const l = normalizeLesson({ title: "Core", summary: "You will know X.", sections: [
    { heading: "The big idea", body: "Short.", itemsStyle: "none", items: [], callout: "" },
    { heading: "How it works", body: "", itemsStyle: "steps", items: ["First", "Second"], callout: "Tip: check units." },
  ], keyPoints: ["a", "b"] });
  assert.equal(l.sections.length, 2);
  assert.match(l.explanation, /1\. First\n2\. Second/);
  assert.match(l.explanation, /Tip: check units/);
});
await ok("old single-essay shape is split into readable sections instead of one wall of text", () => {
  const l = normalizeLesson({ title: "T", explanation: "Para one.\n\nPara two.\n\nPara three.", keyPoints: [] });
  assert.equal(l.sections.length, 3);
});
await ok("junk sections are dropped and item styles are coerced", () => {
  const l = normalizeLesson({ title: "T", sections: [{ heading: "", body: "x" }, { heading: "Ok", body: "b", itemsStyle: "weird", items: ["i"] }, { heading: "Also", body: "c" }] });
  assert.equal(l.sections.length, 2);
  assert.equal(l.sections[0].itemsStyle, "bullets");
});

console.log("battle questions: only what you've learned");
await ok("spread across every learned subject, alternating, no repeats inside a set", async () => {
  const src = [subj("a", "Physics", [topic("a1", "Motion")]), subj("b", "History", [topic("b1", "Rome")]), subj("c", "Biology", [topic("c1", "Cells")])];
  const { questions } = await buildQuestionSet(src, {}, { total: 9 });
  assert.equal(questions.length, 9);
  assert.deepEqual(new Set(questions.map((q) => q.subjectId)), new Set(["a", "b", "c"]));
  assert.notEqual(questions[0].subjectId, questions[1].subjectId);
  assert.equal(new Set(questions.map((q) => q.question)).size, 9);
});
await ok("a second set for the same player never repeats the first", async () => {
  const src = [subj("a", "Physics", [topic("a1", "Motion"), topic("a2", "Forces")])];
  const one = await buildQuestionSet(src, {}, { total: 3 });
  const two = await buildQuestionSet(src, one.seen, { total: 3 });
  const first = new Set(one.questions.map((q) => q.question));
  assert.ok(two.questions.every((q) => !first.has(q.question)));
});
await ok("junk from the generator (ungrounded / meta) is dropped — fewer questions, never off-topic ones", async () => {
  hooks.generate = async (s, picks) => [
    { topic: picks[0].name, question: "Which of the following describes the 'Worked Example' stage of training?", options: ["a1", "b1", "c1", "d1"], correctIndex: 0, evidence: picks[0].notes.split(". ")[0] },
    { topic: picks[0].name, question: "What is the capital of France, really?", options: ["Paris", "Rome", "Oslo", "Bern"], correctIndex: 0, evidence: "Paris is the capital of France." },
  ];
  const { questions } = await buildQuestionSet([subj("a", "Physics", [topic("a1", "Motion")])], {}, { total: 3 });
  hooks.generate = goodGen;
  assert.equal(questions.length, 0);
});
await ok("no generator + no demo mode = no questions (the generic bank is NOT used for real players)", async () => {
  hooks.generate = null;
  const { questions } = await buildQuestionSet([subj("a", "Physics", [topic("a1", "Motion")])], {}, { total: 3 });
  hooks.generate = goodGen;
  assert.equal(questions.length, 0);
});
await ok("demo mode (GYAN_DEMO_QUESTIONS=1) re-enables the generic bank, flagged as such", async () => {
  hooks.generate = null;
  const { questions } = await buildQuestionSet([subj("a", "Physics", [topic("a1", "Motion")])], {}, { total: 3, demo: true });
  hooks.generate = goodGen;
  assert.equal(questions.length, 3);
});

const learnerBase = () => baseOf([
  subj("m", "Mathematics", [topic("m1", "Algebra", 2)], 3),
  subj("p", "Physics", [topic("p1", "Motion", 1)], 2),
]);

await ok("fortify only uses learned topics of subjects that still exist (deleted / never-studied never appear)", async () => {
  const b = learnerBase();
  b.subjects.push(subj("ghost", "Deleted Subject", [topic("g1", "Ghost Topic")])); // no building => deleted
  b.subjects[0].topics.push({ id: "m2", name: "Locked Calculus", level: 1, notes: "" }); // no notes => never studied
  game.syncPlayer({ playerId: "me", name: "Tester", base: b });
  const f = await game.startFortify({ playerId: "me" });
  const names = f.sources.map((s) => `${s.subject}/${s.topic}`).join(" ");
  assert.ok(!/Deleted Subject|Ghost|Locked Calculus/.test(names), names);
  assert.ok(f.questions.every((q) => ["Mathematics", "Physics"].includes(q.subjectName)));
  assert.ok(f.questions.every((q) => !/Ghost|Locked Calculus/.test(q.question)));
});
await ok("deleting a subject takes effect immediately: the base sent with the request wins over a stale snapshot", async () => {
  game.syncPlayer({ playerId: "me", name: "Tester", base: learnerBase() });
  const after = baseOf([subj("m", "Mathematics", [topic("m1", "Algebra", 2)], 3)]); // Physics deleted client-side, sync not yet landed
  const f = await game.startFortify({ playerId: "me", base: after });
  assert.ok(f.questions.length > 0 && f.questions.every((q) => q.subjectName === "Mathematics"));
});
await ok("zero subjects: fortify and raid explain what to do instead of quizzing a stale base", async () => {
  game.syncPlayer({ playerId: "me", name: "Tester", base: learnerBase() });
  const empty = baseOf([]);
  await assert.rejects(() => game.startFortify({ playerId: "me", base: empty }), /lesson part in an unlocked topic/);
  await assert.rejects(() => game.startRaid({ playerId: "me", defenderId: "bot_aria", base: empty }), /lesson part in an unlocked topic/);
});
await ok("unlocking + studying another topic widens the pool on the very next request", async () => {
  const one = baseOf([subj("m", "Mathematics", [topic("m1", "Algebra", 3)], 3)]);
  game.syncPlayer({ playerId: "me", name: "Tester", base: one });
  const f1 = await game.startFortify({ playerId: "me" });
  assert.ok(!f1.sources.some((s) => s.topic === "Geometry"));
  const two = baseOf([subj("m", "Mathematics", [topic("m1", "Algebra", 3), topic("m2", "Geometry", 1)], 3)]);
  const f2 = await game.startFortify({ playerId: "me", base: two });
  assert.ok(f2.sources.some((s) => s.topic === "Geometry"), JSON.stringify(f2.sources)); // weakest-first => new level-1 topic is drilled
});
await ok("small pools ask fewer questions rather than repeating facts (max 3 per topic)", async () => {
  game.syncPlayer({ playerId: "me", name: "Tester", base: baseOf([subj("m", "Mathematics", [topic("m1", "Algebra")])]) });
  const f = await game.startFortify({ playerId: "me" });
  assert.ok(f.questions.length <= 3 && new Set(f.questions.map((q) => q.question)).size === f.questions.length);
});
await ok("fortify questions don't repeat across sessions", async () => {
  game.syncPlayer({ playerId: "zed", name: "Zed", base: baseOf([subj("z1", "Physics", [topic("t1", "Motion"), topic("t2", "Forces")]), subj("z2", "History", [topic("t3", "Rome"), topic("t4", "Greece")])]) });
  const seen = new Set();
  for (let n = 0; n < 2; n++) {
    const f = await game.startFortify({ playerId: "zed" });
    for (const q of db.fortifies[f.fortifyId].questions) { assert.ok(!seen.has(q.question), "repeat: " + q.question); seen.add(q.question); }
  }
});

console.log("raids");
game.syncPlayer({ playerId: "me", name: "Tester", base: learnerBase() });
async function runRaid(defenderId, { correctAll = true, missAll = false, attacker = "me" } = {}) {
  const r = await game.startRaid({ playerId: attacker, defenderId });
  const raid = db.raids[r.raidId];
  let last;
  for (let i = 0; i < raid.questions.length; i++) {
    const q = raid.questions[i];
    const choice = missAll ? (q.correctIndex + 1) % 4 : correctAll ? q.correctIndex : 0;
    last = game.answerRaid({ raidId: r.raidId, playerId: attacker, index: i, choice });
    if (last.done) break;
  }
  return { start: r, last };
}
await ok("raid questions come from the ATTACKER's learned subjects and never leak answers", async () => {
  const r = await game.startRaid({ playerId: "me", defenderId: "bot_finn" });
  assert.ok(r.questions.every((q) => ["Mathematics", "Physics"].includes(q.subjectName)));
  assert.ok(r.questions.every((q) => q.correctIndex === undefined && q.explanation === undefined && q.evidence === undefined));
  assert.ok(r.sources.length > 0);
  game.retreatRaid({ raidId: r.raidId, playerId: "me" });
});
await ok("every one of the defender's buildings gets targeted", async () => {
  const r = await game.startRaid({ playerId: "me", defenderId: "bot_orin" }); // 5 buildings
  const targeted = new Set(r.questions.map((q) => q.targetRef));
  const buildings = db.players.bot_orin.base.objects.filter((o) => o.kind === "subject").length;
  assert.equal(targeted.size, Math.min(buildings, r.questions.length));
  game.retreatRaid({ raidId: r.raidId, playerId: "me" });
});
await ok("perfect run breaks a weak, unfortified castle (3 stars)", async () => {
  db.players.bot_finn.base.objects = db.players.bot_finn.base.objects.filter((o) => o.kind !== "shop");
  db.players.bot_finn.ward = 0;
  const { last } = await runRaid("bot_finn");
  assert.equal(last.result.castleBroken, true, JSON.stringify(last.state));
  assert.equal(last.result.stars, 3);
});
await ok("three misses end the raid with no stars", async () => {
  const { last } = await runRaid("bot_aria", { missAll: true });
  assert.equal(last.result.reason, "out_of_lives");
  assert.equal(last.result.stars, 0);
});
await ok("fortified veteran base survives a perfect run", async () => {
  const { last } = await runRaid("bot_orin");
  assert.equal(last.result.castleBroken, false, `orin fell: ${JSON.stringify(last.state)}`);
});
await ok("ward soaks damage before anything else", async () => {
  db.players.bot_finn.base.objects = db.players.bot_finn.base.objects.filter((o) => o.kind !== "shop");
  db.players.bot_finn.ward = 999;
  const r = await game.startRaid({ playerId: "me", defenderId: "bot_finn" });
  const raid = db.raids[r.raidId];
  const before = raid.state.castle.hp + raid.state.buildings[0].hp;
  const out = game.answerRaid({ raidId: r.raidId, playerId: "me", index: 0, choice: raid.questions[0].correctIndex });
  assert.equal(out.hit.ward, 24);
  assert.equal(raid.state.castle.hp + raid.state.buildings[0].hp, before);
  game.retreatRaid({ raidId: r.raidId, playerId: "me" });
});
await ok("can't raid a shielded human; can't stack raids on one defender", async () => {
  const a = await game.startRaid({ playerId: "me", defenderId: "bot_zara" });
  await assert.rejects(() => game.startRaid({ playerId: "zed", defenderId: "bot_zara" }), /already under attack/);
  game.retreatRaid({ raidId: a.raidId, playerId: "me" });
  game.syncPlayer({ playerId: "shy", name: "Shy", base: baseOf([subj("x", "Art", [topic("x1", "Color")])]), shieldUntil: Date.now() + 3600e3 });
  await assert.rejects(() => game.startRaid({ playerId: "me", defenderId: "shy" }), /Peace Shield/);
});

console.log("fortify ward");
await ok("correct answers fill ward up to the cap; wrong adds nothing", async () => {
  game.syncPlayer({ playerId: "me", name: "Tester", base: learnerBase() });
  const f = await game.startFortify({ playerId: "me" });
  const s = db.fortifies[f.fortifyId];
  const a = game.answerFortify({ fortifyId: f.fortifyId, playerId: "me", index: 0, choice: s.questions[0].correctIndex });
  assert.equal(a.wardAdded, 10);
  if (s.questions.length > 1) {
    const b = game.answerFortify({ fortifyId: f.fortifyId, playerId: "me", index: 1, choice: (s.questions[1].correctIndex + 1) % 4 });
    assert.equal(b.wardAdded, 0);
  }
  assert.ok(db.players.me.ward <= computeDefense(db.players.me.base).wardCap && db.players.me.ward > 0);
});
await ok("defender can rally DURING a raid; it lands in the live raid with a bonus", async () => {
  game.syncPlayer({ playerId: "bob", name: "Bob", base: baseOf([subj("b1", "Chemistry", [topic("bt", "Acids")], 2)]) });
  const raid = await game.startRaid({ playerId: "me", defenderId: "bob" });
  assert.equal(game.incoming("bob").active.length, 1);
  const f = await game.startFortify({ playerId: "bob" });
  assert.equal(f.underAttack, true);
  const s = db.fortifies[f.fortifyId];
  const a = game.answerFortify({ fortifyId: f.fortifyId, playerId: "bob", index: 0, choice: s.questions[0].correctIndex });
  assert.equal(a.wardAdded, 15);
  assert.equal(db.raids[raid.raidId].state.ward, 15);
  game.retreatRaid({ raidId: raid.raidId, playerId: "me" });
});

console.log("clans & wars");
await ok("create clan, war on a bot clan, castle break = fallen + bonus, score bookkeeping", async () => {
  game.syncPlayer({ playerId: "me", name: "Tester", base: learnerBase() });
  db.players.me.seen = {}; // fixture notes only hold 8 facts per topic; earlier tests used them up
  const clan = game.createClan({ playerId: "me", name: "Testers" });
  const war = game.startWar({ clanId: clan.id, playerId: "me" });
  assert.ok(war.war && war.war.enemy.members.length === 3);
  const t = game.listTargets("me");
  assert.equal(t.mode, "war");
  const victimId = t.targets.map((x) => x.id).find((id) => db.players[id].base.subjects.length <= 3);
  db.players[victimId].base.objects = db.players[victimId].base.objects.filter((o) => o.kind !== "shop");
  db.players[victimId].base.castleLevel = 1;
  db.players[victimId].ward = 0;
  const { last } = await runRaid(victimId);
  const mine = game.clanView(clan.id, "me").war;
  if (last.result.castleBroken) {
    assert.ok(mine.fallen.includes(victimId));
    assert.equal(last.result.bonusStars, 2);
    await assert.rejects(() => game.startRaid({ playerId: "me", defenderId: victimId }), /already fell/);
  }
  assert.equal(mine.score.mine, last.result.warStars + last.result.bonusStars);
  assert.ok(["win", "loss", "draw"].includes(game.endWar(clan.id).outcome));
  assert.equal(game.clanView(clan.id, "me").war, null);
});
await ok("second human clan is matched and both sides see the shared score", async () => {
  game.syncPlayer({ playerId: "eve", name: "Eve", base: baseOf([subj("e1", "Art", [topic("e1t", "Color")], 1)]) });
  const c2 = game.createClan({ playerId: "eve", name: "Rivals" });
  const c1 = Object.values(db.clans).find((c) => c.name === "Testers");
  db.players.me.seen = {};
  const started = game.startWar({ clanId: c1.id, playerId: "me" });
  assert.equal(started.war.enemy.id, c2.id);
  db.players.eve.base.objects = db.players.eve.base.objects.filter((o) => o.kind !== "shop");
  await runRaid("eve");
  assert.equal(game.clanView(c2.id, "eve").war.score.theirs, game.clanView(c1.id, "me").war.score.mine);
  game.endWar(c1.id);
  assert.equal(db.clans[c2.id].war, null);
});

console.log(`\n${process.exitCode ? "FAILED" : "all passed"} (${passed} ok)`);
process.exit(process.exitCode || 0);
