// Base layout state: where the castle, subject buildings and shop pieces sit.
// Subjects themselves (topics, XP) stay in App state; the base only stores
// *placement* plus the things bought with gems.
import { useEffect, useMemo, useState, useCallback } from "react";
import { ITEM_BY_ID } from "../../shared/catalog";
import {
  CASTLE_MAX_LEVEL, CASTLE_UPGRADE_COST, SELL_REFUND, canPlaceAt, defaultCastlePos, findFreeSpot, sizeOf, computeDefense,
} from "../../shared/baseRules";
import { subjectStats, topicLearned, topicNotes } from "./subjectStats";
import { levelFromXP } from "../lib/utils";

const KEY = "gyanEmpire.base.v1";
const rid = () => Math.random().toString(36).slice(2, 8);

export function emptyBase() {
  return { castleLevel: 1, objects: [{ uid: "castle", kind: "castle", ...defaultCastlePos() }], inventory: { secondWind: 0 }, shieldUntil: 0, welcomed: false };
}

export function loadBase() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw?.objects) return { ...emptyBase(), ...raw, inventory: { secondWind: 0, ...(raw.inventory || {}) } };
  } catch { /* first run */ }
  return emptyBase();
}

/** Make sure the castle exists and every subject has exactly one building (and no orphans). */
export function reconcile(base, subjects) {
  let objects = base.objects.filter((o) => o.kind !== "subject" || subjects.some((s) => `sub:${s.id}` === o.uid));
  if (!objects.some((o) => o.kind === "castle")) objects = [{ uid: "castle", kind: "castle", ...defaultCastlePos() }, ...objects];
  const cp = objects.find((o) => o.kind === "castle");
  let changed = objects.length !== base.objects.length;
  for (const s of subjects) {
    if (objects.some((o) => o.uid === `sub:${s.id}`)) continue;
    const spot = findFreeSpot(objects, [3, 3], { x: cp.x + 2, y: cp.y + 2 }, { margin: 2 }) || findFreeSpot(objects, [3, 3], { x: cp.x + 2, y: cp.y + 2 }, { margin: 0 }) || { x: 0, y: 0 };
    objects = [...objects, { uid: `sub:${s.id}`, kind: "subject", ref: s.id, ...spot }];
    changed = true;
  }
  return changed ? { ...base, objects } : base;
}

/** Placement + live subject data -> objects the renderer / rules engine can use. */
export function toRenderObjects(base, subjects) {
  const out = [];
  for (const o of base.objects) {
    if (o.kind === "castle") out.push({ ...o, level: base.castleLevel, name: "Main Castle" });
    else if (o.kind === "subject") {
      const s = subjects.find((x) => x.id === o.ref);
      if (!s) continue;
      const st = subjectStats(s);
      out.push({ ...o, name: s.subject, level: st.level, pct: st.pct, vulnerable: st.vulnerable, status: st.status, ready: st.ready });
    } else out.push(o);
  }
  return out;
}

export function buildSnapshot(base, subjects) {
  const objects = toRenderObjects(base, subjects).map((o) => ({
    uid: o.uid, kind: o.kind, x: o.x, y: o.y,
    ...(o.kind === "shop" ? { itemId: o.itemId } : {}),
    ...(o.kind === "subject" ? { ref: o.ref, name: o.name, level: o.level } : {}),
  }));
  return {
    castleLevel: base.castleLevel,
    objects,
    // ONLY what the player has unlocked AND studied, with notes from those lessons.
    // The server writes every raid / fortify question from this and nothing else, so
    // deleted subjects, locked topics and unopened topics can never be quizzed.
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.subject,
      level: subjectStats(s).level,
      topics: (s.topics || [])
        .filter((t) => topicLearned(s, t))
        .map((t) => ({ id: t.id, name: t.name, level: levelFromXP(s.xpMap?.[t.id] || 0), notes: topicNotes(s, t) })),
    })),
  };
}

/**
 * useBase — owns base layout + everything bought with gems.
 * `spendGems(n)` must return false (and not spend) if the player can't afford it.
 */
export function useBase({ subjects, spendGems, gems, toast }) {
  const [base, setBase] = useState(() => reconcile(loadBase(), subjects));

  // keep in step with subjects being added / deleted
  useEffect(() => {
    setBase((b) => reconcile(b, subjects));
  }, [subjects]);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(base)); } catch { /* storage full / private mode */ }
  }, [base]);

  const objects = useMemo(() => toRenderObjects(base, subjects), [base, subjects]);
  const defense = useMemo(() => computeDefense({ castleLevel: base.castleLevel, objects }), [base.castleLevel, objects]);

  const moveObject = useCallback((uid, x, y) => {
    setBase((b) => {
      const o = b.objects.find((q) => q.uid === uid);
      if (!o || !canPlaceAt(b.objects, o, x, y)) return b;
      return { ...b, objects: b.objects.map((q) => (q.uid === uid ? { ...q, x, y } : q)) };
    });
  }, []);

  const placeItem = useCallback((itemId, x, y) => {
    const item = ITEM_BY_ID[itemId];
    if (!item) return false;
    if (!canPlaceAt(base.objects, { uid: "__new", kind: "shop", itemId }, x, y)) return false;
    if (!spendGems(item.cost)) return false;
    setBase((b) => ({ ...b, objects: [...b.objects, { uid: `it_${rid()}`, kind: "shop", itemId, x, y }] }));
    return true;
  }, [base.objects, spendGems]);

  // Returns the gems refunded (0 if the object can't be sold).
  const sellObject = useCallback((uid) => {
    const o = base.objects.find((q) => q.uid === uid);
    if (!o || o.kind !== "shop") return 0;
    setBase((b) => ({ ...b, objects: b.objects.filter((q) => q.uid !== uid) }));
    return Math.floor((ITEM_BY_ID[o.itemId]?.cost || 0) * SELL_REFUND);
  }, [base.objects]);

  const castleUpgradeCost = base.castleLevel < CASTLE_MAX_LEVEL ? CASTLE_UPGRADE_COST[base.castleLevel] : null;
  const upgradeCastle = useCallback(() => {
    if (base.castleLevel >= CASTLE_MAX_LEVEL) return false;
    const cost = CASTLE_UPGRADE_COST[base.castleLevel];
    if (!spendGems(cost)) return false;
    setBase((b) => ({ ...b, castleLevel: Math.min(CASTLE_MAX_LEVEL, b.castleLevel + 1) }));
    return true;
  }, [base.castleLevel, spendGems]);

  const buyShield = useCallback((hours) => {
    setBase((b) => ({ ...b, shieldUntil: Math.max(Date.now(), b.shieldUntil) + hours * 3600e3 }));
  }, []);
  const addSecondWind = useCallback(() => setBase((b) => ({ ...b, inventory: { ...b.inventory, secondWind: b.inventory.secondWind + 1 } })), []);
  const useSecondWind = useCallback(() => setBase((b) => ({ ...b, inventory: { ...b.inventory, secondWind: Math.max(0, b.inventory.secondWind - 1) } })), []);
  const markWelcomed = useCallback(() => setBase((b) => ({ ...b, welcomed: true })), []);

  return { base, objects, defense, moveObject, placeItem, sellObject, upgradeCastle, castleUpgradeCost, buyShield, addSecondWind, useSecondWind, markWelcomed, gems };
}
