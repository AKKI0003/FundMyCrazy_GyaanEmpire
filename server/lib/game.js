// server/lib/game.js
//
// Domain logic for multiplayer: players, clans, clan wars, raids, fortify.
// routes/war.js is a thin HTTP layer over this.

import { db, save, newId } from "./store.js";
import { botWard } from "./bots.js";
import { buildQuestionSet, totalFor } from "./warQuestions.js";
import { initRaid, applyAnswer, publicState, rewardsFor, questionCountFor } from "./raidEngine.js";
import { ITEM_BY_ID, isPlaceable } from "../../shared/catalog.js";
import { MAX_OBJECTS, computeDefense, inBounds, rectOf, rectsOverlap } from "../../shared/baseRules.js";

const WAR_MINUTES = Number(process.env.WAR_DURATION_MIN) || 24 * 60;
const RAID_IDLE_MS = 10 * 60 * 1000;
const FORTIFY_QUESTIONS = 5;
const WARD_PER_CORRECT = 10;
const WARD_RALLY_BONUS = 5; // extra per correct answer while you're actively being raided
const CASTLE_BREAK_WAR_BONUS = 2;

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const int = (n, d = 0) => (Number.isFinite(Number(n)) ? Math.round(Number(n)) : d);
const str = (s, max) => String(s ?? "").slice(0, max);

// ---------- Players --------------------------------------------------------

export function sanitizeBase(raw) {
  if (!raw || typeof raw !== "object") return null;
  const castleLevel = clamp(int(raw.castleLevel, 1), 1, 5);
  const kept = [];
  for (const o of (Array.isArray(raw.objects) ? raw.objects : []).slice(0, MAX_OBJECTS)) {
    const kind = ["castle", "subject", "shop"].includes(o?.kind) ? o.kind : null;
    if (!kind) continue;
    if (kind === "shop" && !(ITEM_BY_ID[o.itemId] && isPlaceable(ITEM_BY_ID[o.itemId]))) continue;
    if (kind === "castle" && kept.some((k) => k.kind === "castle")) continue;
    const obj = {
      uid: str(o.uid, 48),
      kind,
      x: int(o.x),
      y: int(o.y),
      ...(kind === "shop" ? { itemId: o.itemId } : {}),
      ...(kind === "subject" ? { ref: str(o.ref, 64), name: str(o.name, 60), level: clamp(int(o.level, 1), 1, 8) } : {}),
    };
    const r = rectOf(obj);
    if (!inBounds(r) || kept.some((k) => rectsOverlap(r, rectOf(k)))) continue;
    kept.push(obj);
  }
  if (!kept.some((k) => k.kind === "castle")) return null;
  // `subjects` = only the material this player has UNLOCKED and STUDIED (the client
  // decides; see topicLearned in src/game/subjectStats.js). Each topic carries the
  // notes from its lessons — that is what raid/fortify questions are written from.
  const subjects = (Array.isArray(raw.subjects) ? raw.subjects : []).slice(0, 12).map((s) => ({
    id: str(s.id, 64),
    name: str(s.name, 60),
    level: clamp(int(s.level, 1), 1, 8),
    topics: (Array.isArray(s.topics) ? s.topics : []).slice(0, 24).map((t) => ({
      id: str(t.id, 64), name: str(t.name, 80), level: clamp(int(t.level, 1), 1, 8), notes: str(t.notes, 3200),
    })),
  }));
  return { castleLevel, objects: kept, subjects };
}

export function syncPlayer({ playerId, name, base, shieldUntil }) {
  if (!playerId) throw new HttpError(400, "playerId is required");
  const clean = sanitizeBase(base);
  const p =
    db.players[playerId] ||
    (db.players[playerId] = {
      id: playerId, name: "Scholar", clanId: null, base: null, updatedAt: 0, shieldUntil: 0, ward: 0,
      seen: {}, stats: { raidsWon: 0, raidsLost: 0, defended: 0, lost: 0, stars: 0 }, log: [],
    });
  if (name) p.name = str(name, 24);
  if (clean) p.base = clean;
  if (shieldUntil !== undefined) p.shieldUntil = clamp(int(shieldUntil), 0, Date.now() + 24 * 3600e3);
  p.updatedAt = Date.now();
  if (p.base) p.ward = Math.min(p.ward, computeDefense(p.base).wardCap);
  save();
  return p;
}

function needPlayer(id) {
  const p = db.players[id];
  if (!p) throw new HttpError(404, "Unknown player — open your base first so it can sync.");
  return p;
}

/**
 * The material a player can be quizzed on: subjects that still exist in their base
 * AND topics they've unlocked + studied (i.e. that carry lesson notes). Anything
 * else — a deleted subject, a locked or never-opened topic — is excluded here even
 * if a stale snapshot still lists it.
 */
export function learnedSources(base) {
  if (!base) return [];
  const live = new Set(base.objects.filter((o) => o.kind === "subject").map((o) => o.ref));
  return (base.subjects || [])
    .filter((s) => live.has(s.id))
    .map((s) => ({ ...s, topics: s.topics.filter((t) => t.notes && t.notes.trim().length > 20) }))
    .filter((s) => s.topics.length);
}

const NOTHING_LEARNED = "Finish at least one lesson part in an unlocked topic first — battle questions come only from what you've learned.";

export function briefPlayer(p, { forViewer } = {}) {
  const def = p.base ? computeDefense(p.base) : null;
  const raid = activeRaidOn(p.id);
  return {
    id: p.id,
    name: p.name,
    isBot: !!p.isBot,
    clanId: p.clanId,
    clanName: p.clanId ? db.clans[p.clanId]?.name : null,
    castleLevel: p.base?.castleLevel || 1,
    subjects: (p.base?.objects || []).filter((o) => o.kind === "subject").map((o) => ({ id: o.ref, name: o.name, level: o.level })),
    learned: (() => {
      const src = learnedSources(p.base);
      return { subjects: src.length, topics: src.reduce((n, s) => n + s.topics.length, 0) };
    })(),
    rating: def?.rating || 0,
    ward: raid ? raid.state.ward : p.ward,
    wardCap: def?.wardCap || 0,
    shielded: !p.isBot && p.shieldUntil > Date.now(),
    shieldUntil: p.shieldUntil,
    underAttack: !!raid,
    stats: p.stats,
    isMe: forViewer === p.id,
  };
}

/** The full base snapshot (layout + subjects) — what other players raid, and what Unity can render. */
export function getBase(id) {
  const p = needPlayer(id);
  if (!p.base) throw new HttpError(404, "This player hasn't built a base yet.");
  return { playerId: p.id, name: p.name, base: p.base, defense: computeDefense(p.base) };
}

export function getPlayer(id) {
  return briefPlayer(needPlayer(id), { forViewer: id });
}

// ---------- Clans & wars -----------------------------------------------------

function makeClanCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let tries = 0; tries < 50; tries++) {
    const code = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join("");
    if (!db.clans[code]) return code;
  }
  return newId("clan");
}

export function createClan({ playerId, name, clanId }) {
  const p = needPlayer(playerId);
  if (p.clanId) throw new HttpError(409, "Leave your current clan first.");
  const nm = str(name, 24).trim();
  if (!nm) throw new HttpError(400, "Give your clan a name.");
  const id = clanId && !db.clans[clanId] ? str(clanId, 24) : makeClanCode();
  db.clans[id] = { id, name: nm, ownerId: playerId, members: [playerId], createdAt: Date.now(), stars: 0, wins: 0, losses: 0, war: null, history: [] };
  p.clanId = id;
  save();
  return clanView(id, playerId);
}

export function joinClan({ playerId, clanId }) {
  const p = needPlayer(playerId);
  const code = String(clanId || "").trim().toUpperCase();
  const clan = db.clans[code] || db.clans[clanId];
  if (!clan || clan.isBot) throw new HttpError(404, "No clan with that code.");
  if (p.clanId && p.clanId !== clan.id) throw new HttpError(409, "Leave your current clan first.");
  if (clan.members.length >= 20) throw new HttpError(409, "That clan is full (20 members).");
  if (!clan.members.includes(playerId)) clan.members.push(playerId);
  p.clanId = clan.id;
  save();
  return clanView(clan.id, playerId);
}

export function leaveClan({ playerId }) {
  const p = needPlayer(playerId);
  const clan = p.clanId && db.clans[p.clanId];
  if (clan) {
    clan.members = clan.members.filter((m) => m !== playerId);
    if (clan.ownerId === playerId) clan.ownerId = clan.members[0] || null;
    if (!clan.members.length) {
      if (clan.war) endWar(clan.id, { silent: true });
      delete db.clans[clan.id];
    }
  }
  p.clanId = null;
  save();
  return { ok: true };
}

function sweepWar(clan) {
  if (clan?.war && Date.now() >= clan.war.endsAt) endWar(clan.id);
}

export function listClans() {
  return Object.values(db.clans)
    .map((c) => ({ id: c.id, name: c.name, members: c.members.length, stars: c.stars, wins: c.wins, losses: c.losses, isBot: !!c.isBot, atWar: !!c.war }))
    .sort((a, b) => b.stars - a.stars || b.wins - a.wins);
}

function warView(clan, viewerId) {
  const w = clan.war;
  if (!w) return null;
  const enemy = db.clans[w.enemyId];
  return {
    id: w.id,
    startedAt: w.startedAt,
    endsAt: w.endsAt,
    enemy: { id: w.enemyId, name: w.enemyName, isBot: !!enemy?.isBot, members: (enemy?.members || []).map((m) => db.players[m]).filter(Boolean).map((m) => briefPlayer(m)) },
    score: { mine: w.score[clan.id] || 0, theirs: w.score[w.enemyId] || 0 },
    fallen: w.fallen,
    best: Object.fromEntries(Object.entries(w.best).filter(([k]) => k.startsWith(`${viewerId}:`)).map(([k, v]) => [k.split(":")[1], v])),
    attacks: w.attacks.slice(-12).reverse(),
  };
}

export function clanView(clanId, viewerId) {
  const clan = db.clans[clanId];
  if (!clan) throw new HttpError(404, "Clan not found.");
  sweepWar(clan);
  return {
    id: clan.id,
    name: clan.name,
    ownerId: clan.ownerId,
    stars: clan.stars,
    wins: clan.wins,
    losses: clan.losses,
    history: (clan.history || []).slice(-5).reverse(),
    members: clan.members.map((m) => db.players[m]).filter(Boolean).map((m) => briefPlayer(m, { forViewer: viewerId })),
    war: warView(db.clans[clanId], viewerId),
  };
}

export function startWar({ clanId, playerId }) {
  const clan = db.clans[clanId];
  if (!clan || !clan.members.includes(playerId)) throw new HttpError(403, "Only clan members can declare war.");
  sweepWar(clan);
  if (clan.war) throw new HttpError(409, "Your clan is already at war.");
  if (!clan.members.some((m) => db.players[m]?.base)) throw new HttpError(409, "Someone in the clan needs a base first.");

  const idle = Object.values(db.clans).filter((c) => c.id !== clan.id && !c.isBot && !c.war && c.members.some((m) => db.players[m]?.base));
  const bots = Object.values(db.clans).filter((c) => c.isBot);
  const enemy = idle.length ? idle[Math.floor(Math.random() * idle.length)] : bots[Math.floor(Math.random() * bots.length)];
  if (!enemy) throw new HttpError(409, "No opponent clan is available right now.");

  const id = newId("war");
  const startedAt = Date.now();
  const endsAt = startedAt + WAR_MINUTES * 60_000;
  const mk = (self, other) => ({ id, startedAt, endsAt, enemyId: other.id, enemyName: other.name, score: { [self.id]: 0, [other.id]: 0 }, best: {}, fallen: [], attacks: [] });
  clan.war = mk(clan, enemy);
  if (!enemy.isBot) enemy.war = mk(enemy, clan);
  save();
  return clanView(clan.id, playerId);
}

export function endWar(clanId, { silent } = {}) {
  const clan = db.clans[clanId];
  if (!clan?.war) return null;
  const w = clan.war;
  const enemy = db.clans[w.enemyId];

  // Bot clans don't attack in real time — give them a believable score so a
  // war against one still resolves to a win / loss / draw.
  if (enemy?.isBot) {
    const seed = [...w.id].reduce((s, c) => s + c.charCodeAt(0), 0);
    const members = Math.max(1, clan.members.length);
    w.score[enemy.id] = Math.round(members * (1.6 + (seed % 7) / 5));
  }
  const mine = w.score[clan.id] || 0;
  const theirs = w.score[w.enemyId] || 0;
  const outcome = mine > theirs ? "win" : mine < theirs ? "loss" : "draw";
  const record = (c, me, other, oc) => {
    if (!c || c.isBot) return;
    if (oc === "win") c.wins++;
    if (oc === "loss") c.losses++;
    c.history = [...(c.history || []), { at: Date.now(), vs: other === w.enemyId ? w.enemyName : clan.name, mine: me, theirs: other === w.enemyId ? theirs : mine, outcome: oc }].slice(-20);
    c.war = null;
  };
  record(clan, mine, w.enemyId, outcome);
  if (enemy && !enemy.isBot && enemy.war?.id === w.id) {
    record(enemy, theirs, clan.id, outcome === "win" ? "loss" : outcome === "loss" ? "win" : "draw");
  }
  if (!silent) save();
  return { outcome, mine, theirs };
}

// Handoff compat: Unity can add to a clan's lifetime stars directly.
export function addClanScore(clanId, delta) {
  const clan = db.clans[clanId];
  if (!clan) throw new HttpError(404, "Clan not found.");
  clan.stars += int(delta);
  save();
  return { id: clan.id, stars: clan.stars };
}

export function listTargets(playerId) {
  const me = needPlayer(playerId);
  const clan = me.clanId && db.clans[me.clanId];
  if (clan) sweepWar(clan);
  const mineDef = me.base ? computeDefense(me.base).rating : 0;

  if (clan?.war) {
    const w = clan.war;
    const enemy = db.clans[w.enemyId];
    const targets = (enemy?.members || [])
      .map((m) => db.players[m])
      .filter((p) => p?.base)
      .map((p) => ({ ...briefPlayer(p), fallen: w.fallen.includes(p.id), bestStars: w.best[`${playerId}:${p.id}`] || 0 }));
    return { mode: "war", warEndsAt: w.endsAt, enemyName: w.enemyName, targets };
  }

  const pool = Object.values(db.players)
    .filter((p) => p.id !== playerId && p.base && (!clan || p.clanId !== clan.id))
    .sort((a, b) => Math.abs(computeDefense(a.base).rating - mineDef) - Math.abs(computeDefense(b.base).rating - mineDef))
    .slice(0, 6);
  return { mode: "friendly", targets: pool.map((p) => ({ ...briefPlayer(p), fallen: false, bestStars: 0 })) };
}

// ---------- Raids --------------------------------------------------------------

function activeRaidOn(defenderId) {
  return Object.values(db.raids).find((r) => r.defenderId === defenderId && !r.state.done) || null;
}

function stripAnswers(qs) {
  return qs.map(({ question, options, subjectId, subjectName, topicName, targetRef, targetName }) => ({ question, options, subjectId, subjectName, topicName, targetRef, targetName }));
}

function sweepRaids() {
  const now = Date.now();
  for (const r of Object.values(db.raids)) {
    if (!r.state.done && now - r.lastAt > RAID_IDLE_MS) finishRaid(r, "timeout");
  }
}

export async function startRaid({ playerId, defenderId, extraMisses = 0, base }) {
  sweepRaids();
  // Take the freshest snapshot straight from the client so unlocking / studying /
  // deleting a subject a moment ago is already reflected (no waiting on the debounced sync).
  if (base) syncPlayer({ playerId, base });
  const attacker = needPlayer(playerId);
  const defender = needPlayer(defenderId);
  if (playerId === defenderId) throw new HttpError(400, "You can't raid yourself.");
  if (!defender.base) throw new HttpError(409, "That base isn't ready to be raided.");
  if (!defender.isBot && defender.shieldUntil > Date.now()) throw new HttpError(423, `${defender.name} is under a Peace Shield.`);
  if (activeRaidOn(defenderId)) throw new HttpError(409, `${defender.name} is already under attack — try again in a moment.`);

  // Questions come from what the ATTACKER has learned (not the defender's syllabus).
  const sources = learnedSources(attacker.base);
  if (!sources.length) throw new HttpError(409, NOTHING_LEARNED);

  // walk away from any raid this attacker left open
  Object.values(db.raids).filter((r) => r.attackerId === playerId && !r.state.done).forEach((r) => finishRaid(r, "retreat"));

  // War rules: if your clan is at war, you can't skip past the enemy to hit others.
  const aClan = attacker.clanId && db.clans[attacker.clanId];
  if (aClan) sweepWar(aClan);
  let mode = "friendly";
  let warId = null;
  if (aClan?.war) {
    if (defender.clanId === aClan.war.enemyId) {
      mode = "war";
      warId = aClan.war.id;
      if (aClan.war.fallen.includes(defenderId)) throw new HttpError(409, `${defender.name}'s castle already fell in this war.`);
    }
  }

  const total = totalFor(questionCountFor(sources.length), sources);
  const { questions, seen, used } = await buildQuestionSet(sources, attacker.seen, { total, mode: "even" });
  if (!questions.length) throw new HttpError(503, "Couldn't find new questions from your notes right now — try again shortly, or study another lesson part to give it more to ask about.");
  attacker.seen = seen;

  // Aim each question at one of the defender's buildings, round-robin from a random
  // start, so every subject building in their base is a target.
  const buildings = defender.base.objects.filter((o) => o.kind === "subject");
  const start = Math.floor(Math.random() * Math.max(1, buildings.length));
  questions.forEach((q, i) => {
    const b = buildings[(start + i) % Math.max(1, buildings.length)];
    if (b) { q.targetRef = b.ref; q.targetName = b.name; }
  });

  const wardNow = defender.ward;
  const state = initRaid(defender.base, wardNow, { extraMisses: clamp(int(extraMisses), 0, 1) });
  state.total = questions.length;
  defender.ward = 0; // held by the raid until it ends

  const raid = {
    id: newId("raid"), attackerId: playerId, defenderId, mode, warId, questions, state,
    startedAt: Date.now(), lastAt: Date.now(),
  };
  db.raids[raid.id] = raid;
  save();

  return {
    raidId: raid.id,
    mode,
    defender: { id: defender.id, name: defender.name, clanName: defender.clanId ? db.clans[defender.clanId]?.name : null },
    base: { castleLevel: defender.base.castleLevel, objects: defender.base.objects },
    state: publicState(state),
    questions: stripAnswers(questions),
    sources: used,
  };
}

export function answerRaid({ raidId, playerId, index, choice }) {
  const raid = db.raids[raidId];
  if (!raid || raid.attackerId !== playerId) throw new HttpError(404, "Raid not found.");
  if (raid.state.done) throw new HttpError(409, "This raid is over.");
  if (int(index, -1) !== raid.state.index) throw new HttpError(409, "Out of sync with the raid — refresh.");
  const q = raid.questions[raid.state.index];
  const { hit } = applyAnswer(raid.state, q, int(choice, -1));
  raid.lastAt = Date.now();
  const out = { correct: hit.correct, correctIndex: q.correctIndex, explanation: q.explanation, hit, state: publicState(raid.state), done: raid.state.done };
  if (raid.state.done) out.result = finishRaid(raid, raid.state.reason);
  save();
  return out;
}

export function retreatRaid({ raidId, playerId }) {
  const raid = db.raids[raidId];
  if (!raid || raid.attackerId !== playerId) throw new HttpError(404, "Raid not found.");
  if (raid.state.done) return { state: publicState(raid.state), done: true };
  const result = finishRaid(raid, "retreat");
  return { state: publicState(raid.state), done: true, result };
}

function finishRaid(raid, reason) {
  if (raid.result) return raid.result;
  const s = raid.state;
  s.done = true;
  s.reason = s.reason || reason;
  s.stars = s.castleBroken ? 3 : s.stars;
  const attacker = db.players[raid.attackerId];
  const defender = db.players[raid.defenderId];
  const rewards = rewardsFor(s);

  // ward comes back (whatever wasn't consumed); bots slowly refill
  if (defender) defender.ward = defender.isBot ? botWard(defender.base) : Math.min(s.ward, computeDefense(defender.base).wardCap);

  let warStars = 0;
  let bonusStars = 0;
  let fallen = false;

  if (raid.mode === "war" && raid.warId) {
    const aClan = db.clans[attacker?.clanId];
    const w = aClan?.war;
    if (w && w.id === raid.warId) {
      const key = `${raid.attackerId}:${raid.defenderId}`;
      const prev = w.best[key] || 0;
      warStars = Math.max(0, s.stars - prev);
      w.best[key] = Math.max(prev, s.stars);
      if (s.castleBroken && !w.fallen.includes(raid.defenderId)) {
        w.fallen.push(raid.defenderId);
        bonusStars = CASTLE_BREAK_WAR_BONUS;
        fallen = true;
      }
      const add = warStars + bonusStars;
      w.score[aClan.id] = (w.score[aClan.id] || 0) + add;
      aClan.stars += add;
      w.attacks.push({ at: Date.now(), attackerId: attacker.id, attackerName: attacker.name, defenderId: defender.id, defenderName: defender.name, stars: s.stars, castleBroken: s.castleBroken });
      // mirror onto the enemy clan's copy of the war (human clans only)
      const eClan = db.clans[defender?.clanId];
      if (eClan?.war?.id === w.id) {
        eClan.war.score = w.score;
        eClan.war.fallen = w.fallen;
        eClan.war.attacks = w.attacks;
        eClan.war.best = w.best;
      }
    }
  }

  if (attacker) {
    attacker.stats.stars += s.stars;
    if (s.castleBroken) attacker.stats.raidsWon++;
    else attacker.stats.raidsLost++;
  }
  if (defender) {
    if (s.castleBroken) defender.stats.lost++;
    else defender.stats.defended++;
    defender.log = [
      { at: Date.now(), byId: attacker?.id, byName: attacker?.name || "Someone", stars: s.stars, castleBroken: s.castleBroken, destroyedPct: publicState(s).destroyedPct, mode: raid.mode, reason },
      ...(defender.log || []),
    ].slice(0, 20);
  }

  raid.result = {
    reason,
    stars: s.stars,
    castleBroken: s.castleBroken,
    destroyedPct: publicState(s).destroyedPct,
    correct: s.correct,
    answered: s.index,
    rewards,
    warStars,
    bonusStars,
    defenderFallen: fallen,
    mode: raid.mode,
  };
  save();
  return raid.result;
}

// ---------- Fortify ------------------------------------------------------------

export async function startFortify({ playerId, base }) {
  if (base) syncPlayer({ playerId, base }); // freshest snapshot first (see startRaid)
  const p = needPlayer(playerId);
  if (!p.base) throw new HttpError(409, "Build something first — your base hasn't synced yet.");
  const sources = learnedSources(p.base);
  if (!sources.length) throw new HttpError(409, NOTHING_LEARNED);
  const total = totalFor(Math.max(FORTIFY_QUESTIONS, sources.length), sources);
  const { questions, seen, used } = await buildQuestionSet(sources, p.seen, { total, mode: "weakest" });
  if (!questions.length) throw new HttpError(503, "Couldn't find new questions from your notes right now — try again shortly, or study another lesson part to give it more to ask about.");
  p.seen = seen;
  const f = { id: newId("fort"), playerId, questions, index: 0, correct: 0, gained: 0 };
  db.fortifies[f.id] = f;
  save();
  const cap = computeDefense(p.base).wardCap;
  const raid = activeRaidOn(playerId);
  return { fortifyId: f.id, questions: stripAnswers(questions), ward: raid ? raid.state.ward : p.ward, wardCap: cap, underAttack: !!raid, sources: used };
}

export function answerFortify({ fortifyId, playerId, index, choice }) {
  const f = db.fortifies[fortifyId];
  if (!f || f.playerId !== playerId) throw new HttpError(404, "Fortify session not found.");
  if (f.index >= f.questions.length) throw new HttpError(409, "Session finished.");
  if (int(index, -1) !== f.index) throw new HttpError(409, "Out of sync — refresh.");
  const p = db.players[playerId];
  const q = f.questions[f.index];
  const correct = int(choice, -1) === q.correctIndex;
  const cap = computeDefense(p.base).wardCap;
  const raid = activeRaidOn(playerId);
  let added = 0;
  if (correct) {
    f.correct++;
    const want = WARD_PER_CORRECT + (raid ? WARD_RALLY_BONUS : 0);
    if (raid) {
      added = Math.min(want, cap - raid.state.ward);
      raid.state.ward += Math.max(0, added);
    } else {
      added = Math.min(want, cap - p.ward);
      p.ward += Math.max(0, added);
    }
    f.gained += Math.max(0, added);
  }
  f.index++;
  save();
  const ward = raid ? raid.state.ward : p.ward;
  return { correct, correctIndex: q.correctIndex, explanation: q.explanation, wardAdded: Math.max(0, added), ward, wardCap: cap, done: f.index >= f.questions.length, summary: f.index >= f.questions.length ? { correct: f.correct, total: f.questions.length, gained: f.gained } : null, underAttack: !!raid, rally: !!raid };
}

// ---------- Incoming (defender's view) -----------------------------------------

export function incoming(playerId) {
  sweepRaids();
  const p = needPlayer(playerId);
  const raid = activeRaidOn(playerId);
  const def = p.base ? computeDefense(p.base) : null;
  return {
    ward: raid ? raid.state.ward : p.ward,
    wardCap: def?.wardCap || 0,
    shieldUntil: p.shieldUntil,
    active: raid
      ? [{ raidId: raid.id, attackerName: db.players[raid.attackerId]?.name || "Someone", index: raid.state.index, total: raid.state.total, castleHp: raid.state.castle.hp, castleMax: raid.state.castle.max, startedAt: raid.startedAt }]
      : [],
    log: p.log || [],
    stats: p.stats,
  };
}
