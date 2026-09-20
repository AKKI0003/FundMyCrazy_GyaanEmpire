import React from "react";
import { footprintCorners } from "../../game/iso";

// Placeholder look for shop items that don't have art yet. Colour-coded by
// `tone` so walls read as tiers at a glance. Drawn around the footprint's
// center (the parent positions the SVG origin there).
const TONES = {
  wood: ["#c08a55", "#a0703f", "#7f5730"],
  stone: ["#c9cdd2", "#a7adb5", "#858c96"],
  iron: ["#8fa1b3", "#6a7d92", "#4c5d70"],
  crystal: ["#8fe8f1", "#4fc3d4", "#2f95ac"],
  runic: ["#c9a0f0", "#9668cf", "#6d44a3"],
  water: ["#7cc8ee", "#5aaee0", "#3f90c4"],
  leaf: ["#6fbf59", "#4f9f44", "#3a7f36"],
  bloom: ["#f5a6c1", "#e582a5", "#c4628a"],
  gold: ["#f7d774", "#dcae3d", "#b3862a"],
  crimson: ["#e0705f", "#bd4a3a", "#8f3327"],
  ember: ["#f6a15a", "#e2723a", "#b6501f"],
  neutral: ["#d6d0c0", "#b8b19d", "#968f7a"],
};

const isWall = (tone, h) => h <= 50 && ["wood", "stone", "iron", "crystal", "runic"].includes(tone);

export function placeholderBounds(w, h, boxH) {
  const halfW = ((w + h) / 2) * 48;
  const halfH = ((w + h) / 2) * 24;
  return { left: -halfW, right: halfW, top: -boxH - halfH - 22, bottom: halfH };
}

export function PlaceholderSprite({ w, h, tone = "neutral", glyph, boxH = 30, dim, pending }) {
  const [top, left, right] = TONES[tone] || TONES.neutral;
  const wall = isWall(tone, boxH);
  const inset = wall ? 0.97 : 0.78;
  const [A, B, C, D] = footprintCorners(w, h).map((p) => ({ x: p.x * inset, y: p.y * inset }));
  const up = (p) => `${p.x},${p.y - boxH}`;
  const pt = (p) => `${p.x},${p.y}`;
  const flat = boxH <= 10;
  const size = Math.max(18, Math.min(44, (w + h) * 10 + 8));
  return (
    <svg width="1" height="1" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: dim ? 0.45 : pending ? 0.92 : 1 }}>
      {!flat && <ellipse cx="0" cy={C.y * 0.5} rx={Math.abs(B.x) * 0.9} ry={Math.abs(C.y) * 0.55} fill="rgba(0,0,0,.22)" />}
      {!flat && (
        <>
          <polygon points={`${pt(D)} ${pt(C)} ${up(C)} ${up(D)}`} fill={left} stroke="rgba(0,0,0,.18)" strokeWidth="1" />
          <polygon points={`${pt(C)} ${pt(B)} ${up(B)} ${up(C)}`} fill={right} stroke="rgba(0,0,0,.18)" strokeWidth="1" />
        </>
      )}
      <polygon points={`${up(A)} ${up(B)} ${up(C)} ${up(D)}`} fill={top} stroke="rgba(0,0,0,.2)" strokeWidth="1" />
      {wall && (
        <polyline points={`${D.x * 0.5},${D.y * 0.5 + C.y * 0.5 - boxH * 0.5} ${C.x * 0.5 + D.x * 0.5},${(C.y + D.y) * 0.5 - boxH * 0.5}`} stroke="rgba(0,0,0,.18)" strokeWidth="1" fill="none" />
      )}
      {glyph && !wall && (
        <text x="0" y={-boxH - (flat ? -2 : 8)} textAnchor="middle" fontSize={size} style={{ userSelect: "none" }}>
          {glyph}
        </text>
      )}
    </svg>
  );
}
