import React from "react";
import { ITEM_BY_ID } from "../../shared/catalog";
import { sizeOf } from "../../shared/baseRules";
import { castleArt, subjectArt, itemArt } from "./assets";
import { Nameplate, HpBar } from "../components/game/Hud";

/**
 * Turn a base object into an IsoStage item. One function so the home base, the
 * enemy base in a raid and the shop previews all draw things the same way.
 *
 * opts: { pending, dim, hp:{value,max,armor,armorMax}, destroyed, plain (no labels) }
 */
export function objectToItem(o, opts = {}) {
  const [w, h] = sizeOf(o);
  const base = { uid: o.uid, x: o.x, y: o.y, w, h, pending: opts.pending, dim: opts.dim };

  const hpBadge = opts.hp ? <HpBar value={opts.hp.value} max={opts.hp.max} armor={opts.hp.armor} armorMax={opts.hp.armorMax} width={o.kind === "castle" ? 130 : 96} /> : null;
  const wreck = opts.destroyed ? "grayscale(1) brightness(.6)" : undefined;

  if (o.kind === "castle") {
    const a = castleArt(o.level || 1);
    return {
      ...base, src: a.src, height: a.height * (1 + ((o.level || 1) - 1) * 0.03), ground: a.ground, glow: (o.level || 1) >= 4 && !opts.destroyed, filter: wreck,
      label: opts.plain ? null : <Nameplate name="Main Castle" sub={`Level ${o.level || 1}`} />,
      badge: hpBadge,
    };
  }
  if (o.kind === "subject") {
    const a = subjectArt(o.level || 1);
    return {
      ...base, src: a.src, height: a.height, ground: a.ground, glow: (o.level || 1) >= 7 && !opts.destroyed, filter: wreck,
      label: opts.plain ? null : <Nameplate name={o.name} sub={`Lv ${o.level || 1}${o.status ? ` · ${o.status}` : ""}`} warn={o.vulnerable} progress={o.pct != null ? o.pct / 100 : undefined} />,
      badge: hpBadge || (o.ready ? <span className="grid place-items-center w-6 h-6 rounded-full bg-amber text-white font-game text-sm border-2 border-white animate-pulse">!</span> : null),
    };
  }
  const item = ITEM_BY_ID[o.itemId];
  const art = itemArt(o.itemId);
  if (art) return { ...base, src: art.src, height: art.height, ground: art.ground };
  return { ...base, placeholder: { tone: item?.tone || "neutral", glyph: item?.glyph, boxH: item?.h ?? 30 } };
}
