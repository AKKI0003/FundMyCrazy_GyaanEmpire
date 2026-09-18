import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import { Badge } from "./ui/badge";
import { Building } from "./Building";
import { cn, clamp, levelFromXP } from "../lib/utils";

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
      pos[id] = { col: Number(d), row: i, rowCount: ids.length };
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

function TopicNode({ topic, level, xp, isLocked, isSelected, onClick, justLeveledUp }) {
  const pct = clamp(((xp % 60) / 60) * 100, 0, 100);
  const vulnerable = level <= 2 && xp > 0;

  return (
    <motion.button
      whileHover={!isLocked ? { y: -3 } : {}}
      animate={justLeveledUp ? { y: [0, -10, 0] } : {}}
      transition={justLeveledUp ? { duration: 0.5, ease: "easeOut" } : {}}
      onClick={() => !isLocked && onClick(topic.id)}
      disabled={isLocked}
      className={cn(
        "flex flex-col items-center w-52 focus:outline-none",
        isLocked ? "opacity-45 cursor-not-allowed" : "cursor-pointer"
      )}
    >
      <div className={cn("w-24 h-24 drop-shadow-md", isSelected && "drop-shadow-lg")}>
        {isLocked ? (
          <div className="w-full h-full flex items-center justify-center">
            <img src="/game-art/lock-badge.png" alt="Locked" className="w-9 h-9 object-contain opacity-90" />
          </div>
        ) : (
          <Building level={level} justLeveledUp={justLeveledUp} />
        )}
      </div>
      <div
        className={cn(
          "w-full bg-white/95 rounded-lg border px-3 py-2 -mt-1 shadow-sm text-center backdrop-blur-sm",
          isSelected ? "border-teal ring-2 ring-teal" : "border-border"
        )}
      >
        <div className="font-display font-semibold text-xs leading-snug mb-1">{topic.name}</div>
        {isLocked ? (
          <span className="text-[11px] text-muted">Locked</span>
        ) : (
          <>
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <Badge tone={level >= 6 ? "teal" : level >= 3 ? "amber" : "neutral"}>Level {level}</Badge>
              {vulnerable && (
                <Badge tone="danger" className="gap-1">
                  <TriangleAlert size={10} />
                </Badge>
              )}
            </div>
            <div className="h-1 rounded-full bg-bg overflow-hidden">
              <motion.div
                className="h-full bg-teal rounded-full"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <div className="text-[10px] text-muted mt-1">{statusLabel(level, vulnerable)}</div>
          </>
        )}
      </div>
    </motion.button>
  );
}

export function EmpireBoard({ topics, xpMap, onSelectTopic, selectedId }) {
  const pos = layoutTopics(topics);
  const maxCol = Math.max(...Object.values(pos).map((p) => p.col));
  const maxRows = Math.max(...Object.values(pos).map((p) => p.rowCount));
  const colWidth = 232;
  const rowHeight = 168;
  const padTop = 32;
  const svgW = (maxCol + 1) * colWidth;
  const svgH = Math.max(maxRows, 1) * rowHeight + padTop;

  // Track each topic's previous rendered level so we can detect a level-up
  // and trigger Building's pop/ring animation exactly once, right when it
  // happens (not on every re-render).
  const prevLevels = useRef({});
  const justLeveledUpIds = useRef(new Set());

  topics.forEach((t) => {
    const level = levelFromXP(xpMap[t.id] || 0);
    const prev = prevLevels.current[t.id];
    if (prev !== undefined && level > prev) {
      justLeveledUpIds.current.add(t.id);
    }
  });

  useEffect(() => {
    // Clear the "just leveled up" flags shortly after render so the
    // animation plays once, then the building settles back to its normal
    // idle state instead of replaying every time xpMap changes elsewhere.
    if (justLeveledUpIds.current.size === 0) return;
    const ids = Array.from(justLeveledUpIds.current);
    const timeout = setTimeout(() => {
      ids.forEach((id) => justLeveledUpIds.current.delete(id));
    }, 650);
    return () => clearTimeout(timeout);
  });

  topics.forEach((t) => {
    prevLevels.current[t.id] = levelFromXP(xpMap[t.id] || 0);
  });

  const isUnlocked = (t) =>
    !t.prerequisites?.length || t.prerequisites.every((p) => (xpMap[p] || 0) >= 60);

  return (
    <div
      className="overflow-x-auto rounded-xl border border-border relative"
      style={{
        backgroundImage: "url(/game-art/sky-background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative" style={{ width: svgW, minWidth: "100%", height: svgH, padding: "0 24px" }}>
        <svg className="absolute inset-0 pointer-events-none" width={svgW} height={svgH}>
          {topics.map((t) =>
            (t.prerequisites || []).map((pid) => {
              const a = pos[pid],
                b = pos[t.id];
              if (!a || !b) return null;
              const x1 = a.col * colWidth + 24 + 208,
                y1 = a.row * rowHeight + padTop + 48;
              const x2 = b.col * colWidth + 24 + 24,
                y2 = b.row * rowHeight + padTop + 48;
              const active = (xpMap[pid] || 0) >= 60;
              return (
                <line
                  key={`${pid}-${t.id}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={active ? "path-line-active" : "path-line"}
                  strokeDasharray={active ? "0" : "6 6"}
                />
              );
            })
          )}
        </svg>
        {topics.map((t) => {
          const p = pos[t.id];
          if (!p) return null;
          const xp = xpMap[t.id] || 0;
          return (
            <div
              key={t.id}
              className="absolute"
              style={{ left: p.col * colWidth + 24, top: p.row * rowHeight + padTop }}
            >
              <TopicNode
                topic={t}
                level={levelFromXP(xp)}
                xp={xp}
                isLocked={!isUnlocked(t)}
                isSelected={selectedId === t.id}
                onClick={onSelectTopic}
                justLeveledUp={justLeveledUpIds.current.has(t.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
