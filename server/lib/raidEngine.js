// server/lib/raidEngine.js
//
// The rules of a raid, as pure functions over a plain `state` object so they
// can be unit-tested without a server.
//
// A raid is a run of quiz questions (one subject each) against a base.
//   correct answer  -> a strike lands on the building for that question's subject
//   wrong answer    -> the strike is deflected, you lose a life, streak resets
// A strike is soaked in this order:  ward -> that building's armor -> building HP
// and once that building is destroyed, further strikes on its subject go
//   ward -> castle armor -> CASTLE HP.
// Castle HP reaching 0 = castle broken = the defender loses.

import { computeDefense } from "../../shared/baseRules.js";

export const BASE_DAMAGE = 24;
export const STREAK_BONUS = 4; // +4 per consecutive correct answer…
export const STREAK_BONUS_CAP = 4; // …up to +16
export const MAX_MISSES = 3;
export const STAR_1 = 0.25;
export const STAR_2 = 0.55;

export function questionCountFor(subjectCount) {
  return Math.max(6, Math.min(14, 2 * subjectCount + 2));
}

/** Snapshot base -> raid state. `wardNow` is the defender's ward at the moment the raid starts. */
export function initRaid(base, wardNow, { extraMisses = 0 } = {}) {
  const def = computeDefense(base);
  const state = {
    castle: { hp: def.castle.hp, max: def.castle.hp, armor: def.castle.armor, armorMax: def.castle.armor },
    buildings: def.buildings.map((b) => ({
      ref: b.ref,
      name: b.name,
      level: b.level,
      hp: b.hp,
      max: b.hp,
      armor: b.armor,
      armorMax: b.armor,
      destroyed: false,
    })),
    ward: Math.min(wardNow, def.wardCap),
    wardStart: Math.min(wardNow, def.wardCap),
    wardCap: def.wardCap,
    misses: 0,
    maxMisses: MAX_MISSES + extraMisses,
    streak: 0,
    correct: 0,
    index: 0,
    total: 0,
    dealt: 0,
    pool: 0,
    stars: 0,
    castleBroken: false,
    done: false,
    reason: null,
  };
  state.pool = state.castle.hp + state.castle.armor + state.buildings.reduce((s, b) => s + b.hp + b.armor, 0);
  return state;
}

// Drain `amount` from a list of {obj, key} layers in order.
// Returns what's left over plus how much each layer absorbed.
function soak(layers, amount) {
  let left = amount;
  const per = [];
  for (const { obj, key } of layers) {
    const t = Math.max(0, Math.min(obj[key], left));
    obj[key] -= t;
    left -= t;
    per.push(t);
  }
  return { left, per, taken: per.reduce((s, n) => s + n, 0) };
}

export function starsFor(state) {
  if (state.castleBroken) return 3;
  const pct = state.pool ? state.dealt / state.pool : 0;
  return pct >= STAR_2 ? 2 : pct >= STAR_1 ? 1 : 0;
}

/** Apply one answer. Mutates and returns { state, hit } where `hit` describes what happened. */
export function applyAnswer(state, question, choice) {
  if (state.done) return { state, hit: null };
  const correct = choice === question.correctIndex;
  const hit = { correct, damage: 0, ward: 0, armor: 0, hp: 0, target: null, castleHit: false, buildingDestroyed: false };

  if (correct) {
    state.correct++;
    state.streak++;
    const dmg = BASE_DAMAGE + Math.min(state.streak - 1, STREAK_BONUS_CAP) * STREAK_BONUS;
    hit.damage = dmg;

    // 1) ward soaks first (it's shield, not part of the "destruction" score)
    const w = Math.min(state.ward, dmg);
    state.ward -= w;
    hit.ward = w;
    let rest = dmg - w;

    // 2) the building this question is about
    // Questions come from the ATTACKER's own learned material, so each one is aimed
    // at a defender building via `targetRef` (assigned when the raid starts).
    const b = state.buildings.find((x) => x.ref === (question.targetRef ?? question.subjectId));
    if (b && !b.destroyed && rest > 0) {
      hit.target = b.ref;
      const r1 = soak([{ obj: b, key: "armor" }, { obj: b, key: "hp" }], rest);
      hit.armor += r1.per[0];
      hit.hp += r1.per[1];
      state.dealt += r1.taken;
      rest = r1.left;
      if (b.hp <= 0) {
        b.destroyed = true;
        hit.buildingDestroyed = true;
      }
    } else if (b) {
      hit.target = b.ref;
    }

    // 3) overflow (or a strike at an already-fallen building) goes to the castle
    if (rest > 0) {
      hit.castleHit = true;
      const r2 = soak([{ obj: state.castle, key: "armor" }, { obj: state.castle, key: "hp" }], rest);
      hit.armor += r2.per[0];
      hit.hp += r2.per[1];
      state.dealt += r2.taken;
      if (state.castle.hp <= 0) state.castleBroken = true;
    }
  } else {
    state.streak = 0;
    state.misses++;
  }

  state.index++;
  state.stars = starsFor(state);

  if (state.castleBroken) {
    state.done = true;
    state.reason = "castle_broken";
  } else if (state.misses >= state.maxMisses) {
    state.done = true;
    state.reason = "out_of_lives";
  } else if (state.index >= state.total) {
    state.done = true;
    state.reason = "questions_done";
  }
  return { state, hit };
}

export function rewardsFor(state) {
  const points = state.correct * 10 + state.stars * 15;
  const gems = state.stars > 0 ? state.stars + (state.castleBroken ? 3 : 0) : 0;
  return { points, gems };
}

/** What the client is allowed to see of a raid. */
export function publicState(state) {
  const { pool, wardStart, ...rest } = state;
  return { ...rest, destroyedPct: state.pool ? Math.round((state.dealt / state.pool) * 100) : 0 };
}
