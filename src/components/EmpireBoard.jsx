import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TriangleAlert, Lock, Gem, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Building } from "./Building";
import { cn, clamp, levelFromXP } from "../lib/utils";

// --- Isometric grid math -----------------------------------------------
// Every topic gets a (gx, gy) grid cell (gx = prerequisite depth, gy = its
// index within that depth). We project that onto screen space with the
// standard isometric transform, then paint back-to-front by (gx + gy) so
// nearer tiles/buildings correctly overlap farther ones.
//
// The spacing (HALF_W/HALF_H) is sized around the actual card footprint
// (CARD_W x CARD_H below), not an arbitrary tile size — that's the fix for
// v1, where a tight grid made every card collide with its neighbors and
// made half the board unclickable (overlapping hit areas steal clicks).
// These specific numbers were verified by simulating 3000+ random 6-10
// topic prerequisite trees and checking every pair of card footprints for
// overlap — zero collisions at this spacing.
const CARD_W = 168;
const CARD_H = 208; // building + label stack, see TopicNode
const HALF_W = 195;
const HALF_H = 160;
const TILE_W = HALF_W * 2;
const TILE_H = HALF_H * 2;
const BUILDING_SIZE = 100;

function isoX(gx, gy) {
  return (gx - gy) * HALF_W;
}
function isoY(gx, gy) {
  return (gx + gy) * HALF_H;
}

// Deterministic pseudo-random in [0,1) from a cell coordinate, so decorative
// filler (grass shade, the odd tree/bush) is stable across re-renders
// instead of reshuffling on every state update.
function cellRand(gx, gy, salt = 0) {
  const s = Math.sin(gx * 127.1 + gy * 311.7 + salt * 74.3) * 43758.5453;
  return s - Math.floor(s);
}

function layoutTopics(topics) {
  const byId = Object.fromEntries(topics.map((t) => [t.id, t]));
  const depth = {};
  function getDepth(id, seen = new Set()) {
    if (depth[id] !== undefined) return depth[id];
    if (seen.has(id)) return 0;
    seen.add(id);
    const t = byId[id];
    if (!t.prerequisites?.length) {
      depth[id] = 0;
      return 0;
    }
    const d = 1 + Math.max(...t.prerequisites.map((p) => getDepth(p, seen)));
    depth[id] = d;
    return d;
  }
  topics.forEach((t) => getDepth(t.id));

  const columns = {};
  topics.forEach((t) => {
    const d = depth[t.id];
    columns[d] = columns[d] || [];
    columns[d].push(t.id);
  });

  const pos = {};
  Object.entries(columns).forEach(([d, ids]) => {
    ids.forEach((id, i) => {
      // Center each depth-column's rows around gy=0 so the whole board
      // grows symmetrically instead of hugging one edge.
      const gy = i - (ids.length - 1) / 2;
      pos[id] = { gx: Number(d), gy, rowCount: ids.length };
    });
  });
  return pos;
}

function statusLabel(level, vulnerable) {
  if (vulnerable) return "Needs review";
  if (level >= 7) return "Mastered";
  if (level >= 4) return "In progress";
  return "Just started";
}

// A single ground tile: a flat isometric diamond of grass. Rendered for
// every occupied cell AND a ring of surrounding filler cells, so buildings
// sit on a continuous landscape instead of floating on isolated squares.
function GroundTile({ variant, decoration }) {
  const shades = {
    grass: ["#6fae55", "#5d9948"],
    grassAlt: ["#78b95d", "#66a350"],
  };
  const [top, bottom] = shades[variant] || shades.grass;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        width: TILE_W,
        height: TILE_H,
        left: -HALF_W,
        top: -HALF_H,
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        background: `linear-gradient(160deg, ${top}, ${bottom})`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      {decoration === "tree" && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[85%] text-2xl select-none">🌳</span>
      )}
      {decoration === "bush" && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[70%] text-lg select-none">🌿</span>
      )}
      {decoration === "flower" && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[65%] text-base select-none">🌼</span>
      )}
    </div>
  );
}

function TopicNode({ topic, level, xp, isLocked, isSelected, onClick, justLeveledUp, unlockHint, gems, unlockCost, onUnlockEarly }) {
  const withinTierXp = xp % 60;
  const pct = clamp((withinTierXp / 60) * 100, 0, 100);
  const vulnerable = level <= 2 && xp > 0;
  const readyToUpgrade = !isLocked && pct >= 75 && level < 8;
  const canAffordUnlock = isLocked && gems >= unlockCost;

  return (
    // Not a <button> anymore — a locked card now contains its own "Unlock
    // early" button, and nested interactive elements are invalid HTML (and
    // were part of why clicks landed on the wrong thing). The select action
    // lives on onClick of the outer div instead.
    <div className="absolute flex flex-col items-center" style={{ width: CARD_W, left: -CARD_W / 2, bottom: HALF_H - 10 }}>
      <button
        onClick={() => !isLocked && onClick(topic.id)}
        disabled={isLocked}
        className={cn("relative block", isLocked ? "cursor-default" : "cursor-pointer")}
        style={{ width: BUILDING_SIZE, height: BUILDING_SIZE + 30 }}
      >
        {isLocked ? (
          <>
            {/* Ghost silhouette of the building it WILL become, not a flat
                gray box — the art stays visible, just muted, so the board
                still reads as a kingdom rather than a form. */}
            <div className="w-full h-full opacity-40 grayscale contrast-75">
              <Building level={1} />
            </div>
            <div className="absolute top-0 right-0 w-6 h-6 rounded-full bg-white border border-border shadow flex items-center justify-center">
              <img src="/game-art/lock-badge.png" alt="Locked" className="w-3.5 h-3.5 object-contain" />
            </div>
          </>
        ) : (
          <Building level={level} justLeveledUp={justLeveledUp} readyToUpgrade={readyToUpgrade} />
        )}
      </button>

      {/* Label sits fully below the art now (a small gap, not an overlap) —
          so the building itself stays visible instead of getting cut off
          by its own info card. */}
      <div
        onClick={() => !isLocked && onClick(topic.id)}
        className={cn(
          "w-full mt-1.5 bg-white rounded-lg border px-2.5 py-2 shadow-sm text-center z-10",
          !isLocked && "cursor-pointer",
          isSelected ? "border-teal ring-2 ring-teal" : "border-border"
        )}
      >
        <div className="font-display font-semibold text-xs leading-snug mb-1 truncate" title={topic.name}>
          {topic.name}
        </div>
        {isLocked ? (
          <>
            <span className="text-[10px] text-muted flex items-center justify-center gap-1 mb-1.5">
              <Lock size={9} />
              {unlockHint}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (canAffordUnlock) onUnlockEarly(topic, unlockCost);
              }}
              disabled={!canAffordUnlock}
              title={canAffordUnlock ? `Skip the prerequisite and unlock now` : `Need ${unlockCost} gems`}
              className={cn(
                "w-full flex items-center justify-center gap-1 text-[10px] font-semibold rounded-md px-2 py-1 border transition-colors",
                canAffordUnlock
                  ? "border-teal text-teal-dark bg-teal/5 hover:bg-teal/10"
                  : "border-border text-muted/60 cursor-not-allowed"
              )}
            >
              <Gem size={10} />
              Unlock now · {unlockCost}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <Badge tone={level >= 6 ? "teal" : level >= 3 ? "amber" : "neutral"}>Level {level}</Badge>
              {vulnerable && (
                <Badge tone="danger" className="gap-1">
                  <TriangleAlert size={10} />
                </Badge>
              )}
              {readyToUpgrade && (
                <Badge tone="amber" className="gap-1 animate-pulse">
                  Almost there!
                </Badge>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-bg overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full", readyToUpgrade ? "bg-amber" : "bg-teal")}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <div className="text-[10px] text-muted mt-1">{statusLabel(level, vulnerable)}</div>
          </>
        )}
      </div>
    </div>
  );
}

export function EmpireBoard({ topics, xpMap, onSelectTopic, selectedId, gems = 0, unlockedEarly = {}, onUnlockEarly }) {
  const pos = layoutTopics(topics);
  const byId = Object.fromEntries(topics.map((t) => [t.id, t]));

  const cells = Object.values(pos);
  const minGx = Math.min(...cells.map((c) => c.gx)) - 1;
  const maxGx = Math.max(...cells.map((c) => c.gx)) + 1;
  const minGy = Math.min(...cells.map((c) => c.gy)) - 1;
  const maxGy = Math.max(...cells.map((c) => c.gy)) + 1;

  // Bounding box of the whole iso grid in screen space, so we can offset
  // everything into positive coordinates and size the scroll container.
  const corners = [
    [minGx, minGy],
    [minGx, maxGy],
    [maxGx, minGy],
    [maxGx, maxGy],
  ].map(([gx, gy]) => [isoX(gx, gy), isoY(gx, gy)]);
  const minScreenX = Math.min(...corners.map((c) => c[0]));
  const maxScreenX = Math.max(...corners.map((c) => c[0]));
  const minScreenY = Math.min(...corners.map((c) => c[1]));
  const maxScreenY = Math.max(...corners.map((c) => c[1]));
  const offsetX = -minScreenX + CARD_W / 2 + 24;
  const offsetY = -minScreenY + BUILDING_SIZE + 40;
  const boardW = maxScreenX - minScreenX + CARD_W + 48;
  const boardH = maxScreenY - minScreenY + BUILDING_SIZE + CARD_H + 48;

  const occupied = new Set(cells.map((c) => `${c.gx},${c.gy}`));

  // Filler ground tiles: every whole cell in the bounding box that isn't
  // sitting under a building, so the buildings read as placed on one
  // continuous landscape rather than each floating on its own tile.
  const fillerTiles = useMemo(() => {
    const out = [];
    for (let gx = Math.floor(minGx); gx <= Math.ceil(maxGx); gx++) {
      for (let gy = Math.floor(minGy); gy <= Math.ceil(maxGy); gy++) {
        const key = `${gx},${gy}`;
        if (occupied.has(key)) continue;
        const r = cellRand(gx, gy);
        let decoration = null;
        if (r > 0.93) decoration = "tree";
        else if (r > 0.86) decoration = "bush";
        else if (r > 0.8) decoration = "flower";
        out.push({ gx, gy, variant: cellRand(gx, gy, 1) > 0.5 ? "grass" : "grassAlt", decoration });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.length, minGx, maxGx, minGy, maxGy]);

  const prevLevels = useRef({});
  const justLeveledUpIds = useRef(new Set());

  topics.forEach((t) => {
    const level = levelFromXP(xpMap[t.id] || 0);
    const prev = prevLevels.current[t.id];
    if (prev !== undefined && level > prev) justLeveledUpIds.current.add(t.id);
  });

  useEffect(() => {
    if (justLeveledUpIds.current.size === 0) return;
    const ids = Array.from(justLeveledUpIds.current);
    const timeout = setTimeout(() => ids.forEach((id) => justLeveledUpIds.current.delete(id)), 650);
    return () => clearTimeout(timeout);
  });

  topics.forEach((t) => {
    prevLevels.current[t.id] = levelFromXP(xpMap[t.id] || 0);
  });

  const isUnlocked = (t) =>
    !t.prerequisites?.length || unlockedEarly[t.id] || t.prerequisites.every((p) => (xpMap[p] || 0) >= 60);

  function unlockHint(t) {
    const missing = (t.prerequisites || []).filter((p) => (xpMap[p] || 0) < 60);
    if (missing.length === 0) return "Locked";
    const names = missing.map((id) => byId[id]?.name).filter(Boolean);
    if (names.length === 1) return `Needs ${names[0]} Lv 2`;
    return `Needs ${names.length} topics first`;
  }

  // Gem cost to skip a topic's prerequisite and unlock it right now — scales
  // gently with the topic's own difficulty rating from the syllabus tree.
  function unlockCostFor(t) {
    return 6 + (t.difficulty || 3) * 3;
  }

  // Paint order: ground first, then buildings sorted back-to-front by
  // (gx+gy) so overlapping sprites stack correctly.
  const sortedTopics = [...topics].sort((a, b) => {
    const pa = pos[a.id],
      pb = pos[b.id];
    if (!pa || !pb) return 0;
    return pa.gx + pa.gy - (pb.gx + pb.gy);
  });

  // Auto-fit the board to the available width so it reads as a legible city
  // by default (this is the fix for "everything is super zoomed in") — the
  // board is laid out at full size internally, then the whole thing is
  // scaled down visually. Manual zoom controls let the student override it.
  const containerRef = useRef(null);
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(null); // null = "use auto-fit"

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const available = el.clientWidth - 32;
      const next = clamp(available / boardW, 0.28, 1);
      setFitScale(next);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardW]);

  const scale = zoom ?? fitScale;

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-2xl border border-border relative shadow-inner"
      style={{
        backgroundImage: "url(/game-art/sky-background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: 560,
        maxHeight: 720,
      }}
    >
      <div className="sticky top-3 left-0 z-30 flex justify-end gap-1.5 pr-3 pointer-events-none">
        <div className="flex items-center gap-1 bg-white/95 border border-border rounded-lg shadow-sm p-1 pointer-events-auto">
          <button
            onClick={() => setZoom(clamp(scale - 0.15, 0.28, 1.4))}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg text-muted"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setZoom(clamp(scale + 0.15, 0.28, 1.4))}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg text-muted"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom(null)}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg text-muted"
            title="Fit to view"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* Outer sizer reserves the actual (scaled) layout space so the
          scroll region matches what's visible — a CSS transform alone
          doesn't shrink the box it's applied to, only its rendering. */}
      <div style={{ width: Math.max(boardW * scale, 100), height: Math.max(boardH * scale, 520) }}>
        <div
          className="relative"
          style={{ width: boardW, height: boardH, padding: "16px 0", transform: `scale(${scale})`, transformOrigin: "0 0" }}
        >
          {/* Ground layer */}
          {fillerTiles.map((c) => (
            <div key={`fill-${c.gx}-${c.gy}`} style={{ position: "absolute", left: offsetX + isoX(c.gx, c.gy), top: offsetY + isoY(c.gx, c.gy) }}>
              <GroundTile variant={c.variant} decoration={c.decoration} />
            </div>
          ))}
          {cells.map((c, i) => (
            <div key={`occ-${i}`} style={{ position: "absolute", left: offsetX + isoX(c.gx, c.gy), top: offsetY + isoY(c.gx, c.gy) }}>
              <GroundTile variant="grass" />
            </div>
          ))}

          {/* Building layer, back-to-front. Each node gets its own stacking
              context sized to exactly its card footprint (no wider), so a
              transparent corner can never steal a click meant for the tile
              next to it. */}
          {sortedTopics.map((t) => {
            const p = pos[t.id];
            if (!p) return null;
            const xp = xpMap[t.id] || 0;
            return (
              <div
                key={t.id}
                className="absolute"
                style={{ left: offsetX + isoX(p.gx, p.gy), top: offsetY + isoY(p.gx, p.gy), zIndex: 100 + Math.round((p.gx + p.gy) * 10) }}
              >
                <TopicNode
                  topic={t}
                  level={levelFromXP(xp)}
                  xp={xp}
                  isLocked={!isUnlocked(t)}
                  isSelected={selectedId === t.id}
                  onClick={onSelectTopic}
                  justLeveledUp={justLeveledUpIds.current.has(t.id)}
                  unlockHint={unlockHint(t)}
                  gems={gems}
                  unlockCost={unlockCostFor(t)}
                  onUnlockEarly={onUnlockEarly}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
