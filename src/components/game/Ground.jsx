import React, { useMemo } from "react";
import { HW, HH, toWorld, worldBounds } from "../../game/iso";

const GREENS = ["#7dbb5a", "#76b454", "#83c160", "#6fae4e"];
const TUFT = "#5b9642";

function rnd(a, b, s = 0) {
  const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.3) * 43758.5453;
  return v - Math.floor(v);
}

const T = 36; // cliff thickness
const D = 120; // rocky underside depth

/** A floating grass island, drawn as one SVG (tiles + cliff + rocks + grass tufts). */
export const Ground = React.memo(function Ground({ gw, gh, showGrid = false }) {
  const b = worldBounds(gw, gh);
  const pad = 6;
  const W = b.maxX - b.minX + pad * 2;
  const H = b.maxY + T + D + pad * 2;

  const { tiles, tufts } = useMemo(() => {
    const tiles = [];
    const tufts = [];
    for (let gx = 0; gx < gw; gx++) {
      for (let gy = 0; gy < gh; gy++) {
        const p = [toWorld(gx, gy), toWorld(gx + 1, gy), toWorld(gx + 1, gy + 1), toWorld(gx, gy + 1)];
        const base = GREENS[(gx + gy) % 2 === 0 ? 0 : 1];
        const alt = GREENS[2 + Math.floor(rnd(gx, gy, 1) * 2)];
        const fill = rnd(gx, gy, 2) > 0.78 ? alt : base;
        tiles.push({ k: `${gx},${gy}`, pts: p.map((q) => `${q.x},${q.y}`).join(" "), fill });
        const r = rnd(gx, gy, 3);
        if (r > 0.55) {
          const c = toWorld(gx + 0.2 + rnd(gx, gy, 4) * 0.6, gy + 0.2 + rnd(gx, gy, 5) * 0.6);
          tufts.push({ k: `t${gx},${gy}`, x: c.x, y: c.y, flower: r > 0.93, color: rnd(gx, gy, 6) > 0.5 ? "#fff6c9" : "#ffd3e0" });
        }
      }
    }
    return { tiles, tufts };
  }, [gw, gh]);

  const L = toWorld(0, gh);
  const Bm = toWorld(gw, gh);
  const R = toWorld(gw, 0);
  const lines = [];
  if (showGrid) {
    for (let i = 0; i <= gw; i++) {
      const a = toWorld(i, 0), c = toWorld(i, gh);
      lines.push(<line key={`a${i}`} x1={a.x} y1={a.y} x2={c.x} y2={c.y} />);
    }
    for (let j = 0; j <= gh; j++) {
      const a = toWorld(0, j), c = toWorld(gw, j);
      lines.push(<line key={`b${j}`} x1={a.x} y1={a.y} x2={c.x} y2={c.y} />);
    }
  }

  const under = `${L.x},${L.y + T} ${L.x + (Bm.x - L.x) * 0.22},${L.y + T + D * 0.55} ${Bm.x - 30},${Bm.y + T + D * 0.85} ${Bm.x},${Bm.y + T + D} ${Bm.x + 34},${Bm.y + T + D * 0.8} ${R.x - (R.x - Bm.x) * 0.25},${R.y + T + D * 0.5} ${R.x},${R.y + T}`;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`${b.minX - pad} ${-pad} ${W} ${H}`}
      style={{ position: "absolute", left: b.minX - pad, top: -pad, pointerEvents: "none", overflow: "visible" }}
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id="cliffL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a5703f" />
          <stop offset="1" stopColor="#7b4d29" />
        </linearGradient>
        <linearGradient id="cliffR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a31" />
          <stop offset="1" stopColor="#5f3b1f" />
        </linearGradient>
        <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d4526" />
          <stop offset="1" stopColor="#3d2a1a" />
        </linearGradient>
        <radialGradient id="islandShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#0b2a3a" stopOpacity=".28" />
          <stop offset="1" stopColor="#0b2a3a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={Bm.x} cy={Bm.y + T + D + 70} rx={gw * HW * 0.55} ry={46} fill="url(#islandShadow)" />
      <polygon points={under} fill="url(#rock)" />
      <polygon points={`${L.x},${L.y} ${Bm.x},${Bm.y} ${Bm.x},${Bm.y + T} ${L.x},${L.y + T}`} fill="url(#cliffL)" />
      <polygon points={`${Bm.x},${Bm.y} ${R.x},${R.y} ${R.x},${R.y + T} ${Bm.x},${Bm.y + T}`} fill="url(#cliffR)" />
      {/* grass lip on the cliff edge */}
      <polygon points={`${L.x},${L.y} ${Bm.x},${Bm.y} ${Bm.x},${Bm.y + 8} ${L.x},${L.y + 8}`} fill="#5a9440" />
      <polygon points={`${Bm.x},${Bm.y} ${R.x},${R.y} ${R.x},${R.y + 8} ${Bm.x},${Bm.y + 8}`} fill="#4c8237" />

      {tiles.map((t) => (
        <polygon key={t.k} points={t.pts} fill={t.fill} stroke={t.fill} strokeWidth=".8" />
      ))}
      {tufts.map((t) =>
        t.flower ? (
          <g key={t.k}>
            <circle cx={t.x} cy={t.y} r="2.2" fill={t.color} />
            <circle cx={t.x} cy={t.y} r=".9" fill="#f0a93a" />
          </g>
        ) : (
          <path key={t.k} d={`M${t.x} ${t.y} l-2.5 -5 M${t.x} ${t.y} l0 -6.5 M${t.x} ${t.y} l2.5 -5`} stroke={TUFT} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        )
      )}
      {showGrid && (
        <g stroke="rgba(255,255,255,.55)" strokeWidth="1.6">
          {lines}
        </g>
      )}
    </svg>
  );
});
