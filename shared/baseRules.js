// shared/baseRules.js
//
// Game rules that must be identical on the client (what you see) and the
// server (what actually happens in a raid). Pure functions, no imports from
// either side. Change a number here and both sides agree.

import { ITEM_BY_ID } from "./catalog.js";

export const GRID = 22; // the base island is GRID x GRID tiles
export const CASTLE_SIZE = [4, 4];
export const SUBJECT_SIZE = [3, 3];
export const CASTLE_MAX_LEVEL = 5;
// Gem cost to upgrade FROM level (index) TO level (index + 1).
export const CASTLE_UPGRADE_COST = [0, 20, 40, 80, 150];
export const SELL_REFUND = 0.5;

export const castleHp = (lvl) => 100 + 60 * (lvl - 1);
export const subjectHp = (lvl) => 40 + 14 * lvl;
export const armorCap = (castleLvl) => 60 + 40 * castleLvl;

// Ward = the temporary shield a player fills by answering "fortify" questions.
export const wardCap = (castleLvl, totems = 0) => 30 + 15 * castleLvl + 12 * totems;

export const MAX_OBJECTS = 400;

export function sizeOf(o) {
  if (o.kind === "castle") return CASTLE_SIZE;
  if (o.kind === "subject") return SUBJECT_SIZE;
  return ITEM_BY_ID[o.itemId]?.size || [1, 1];
}

export function rectOf(o) {
  const [w, h] = sizeOf(o);
  return { x: o.x, y: o.y, w, h };
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// Empty tiles between two footprints (0 = touching or overlapping).
export function rectGap(a, b) {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.max(dx, dy);
}

export function inBounds(r, grid = GRID) {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= grid && r.y + r.h <= grid;
}

/** Can `obj` sit at (x, y) without leaving the island or overlapping anything? */
export function canPlaceAt(objects, obj, x, y, grid = GRID) {
  const [w, h] = sizeOf(obj);
  const r = { x, y, w, h };
  if (!inBounds(r, grid)) return false;
  return !objects.some((o) => o.uid !== obj.uid && rectsOverlap(r, rectOf(o)));
}

/**
 * How strong is this base?
 *
 * `objects` need: uid, kind ('castle'|'subject'|'shop'), x, y, and for shop
 * pieces `itemId`, for subjects `level`. Returns HP + armor per target.
 * Armor = the sum of protection from every guard piece whose reach touches the
 * target, capped by the castle level (so you can't stack walls forever).
 */
export function computeDefense({ castleLevel = 1, objects = [] }) {
  const cap = armorCap(castleLevel);
  const guards = objects
    .filter((o) => o.kind === "shop")
    .map((o) => ({ item: ITEM_BY_ID[o.itemId], rect: rectOf(o) }))
    .filter((g) => g.item && g.item.protection > 0);

  const armorFor = (targetRect) => {
    let raw = 0;
    for (const g of guards) {
      if (rectGap(targetRect, g.rect) <= (g.item.guardRadius ?? 0)) raw += g.item.protection;
    }
    return { raw, armor: Math.min(raw, cap) };
  };

  const castleObj = objects.find((o) => o.kind === "castle");
  const castleArmor = castleObj ? armorFor(rectOf(castleObj)) : { raw: 0, armor: 0 };
  const castle = { hp: castleHp(castleLevel), armor: castleArmor.armor, armorRaw: castleArmor.raw };

  const buildings = objects
    .filter((o) => o.kind === "subject")
    .map((o) => {
      const a = armorFor(rectOf(o));
      const lvl = Math.max(1, o.level || 1);
      return { uid: o.uid, ref: o.ref, name: o.name, level: lvl, hp: subjectHp(lvl), armor: a.armor, armorRaw: a.raw };
    });

  const totems = objects.filter((o) => o.kind === "shop" && ITEM_BY_ID[o.itemId]?.wardBonus).length;
  const ward = wardCap(castleLevel, totems);
  const rating = Math.round(castle.hp + castle.armor + buildings.reduce((s, b) => s + b.hp + b.armor, 0));

  return { castle, buildings, armorCap: cap, wardCap: ward, rating };
}

// ---- Layout helpers (used by the client to auto-place, by the server for bots)

/** Find a free top-left tile for a w x h footprint, spiralling out from `near`. */
export function findFreeSpot(objects, size, near = { x: GRID / 2, y: GRID / 2 }, { margin = 1, grid = GRID } = {}) {
  const [w, h] = size;
  const taken = objects.map(rectOf);
  const fits = (x, y, m) => {
    const r = { x: x - m, y: y - m, w: w + 2 * m, h: h + 2 * m };
    if (x < 0 || y < 0 || x + w > grid || y + h > grid) return false;
    return !taken.some((t) => rectsOverlap(r, t));
  };
  const cx = Math.round(near.x - w / 2);
  const cy = Math.round(near.y - h / 2);
  for (const m of [margin, 0]) {
    for (let d = 0; d < grid; d++) {
      let best = null;
      let bestDist = Infinity;
      for (let dx = -d; dx <= d; dx++) {
        for (let dy = -d; dy <= d; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (!fits(x, y, m)) continue;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            best = { x, y };
            bestDist = dist;
          }
        }
      }
      if (best) return best;
    }
  }
  return null;
}

export function defaultCastlePos() {
  return { x: Math.floor((GRID - CASTLE_SIZE[0]) / 2), y: Math.floor((GRID - CASTLE_SIZE[1]) / 2) };
}
