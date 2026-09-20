import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, TriangleAlert } from "lucide-react";
import { Building } from "./Building";
import { cn, clamp, levelFromXP } from "../lib/utils";

const XP_PER_TOPIC_MAX = 60 * 7;
const DRAG_THRESHOLD = 6; // px of movement before a press counts as a drag, not a click

function subjectStats(subject) {
  const topics = subject.topics || [];
  if (!topics.length) return { level: 1, statusLabel: "Just started", vulnerable: false, pct: 0 };
  const totalXp = topics.reduce((s, t) => s + (subject.xpMap?.[t.id] || 0), 0);
  const maxXp = topics.length * XP_PER_TOPIC_MAX;
  const pct = clamp(Math.round((totalXp / maxXp) * 100), 0, 100);
  const avgLevel = Math.max(1, Math.round(topics.reduce((s, t) => s + levelFromXP(subject.xpMap?.[t.id] || 0), 0) / topics.length));
  const vulnerable = topics.some((t) => {
    const xp = subject.xpMap?.[t.id] || 0;
    return xp > 0 && levelFromXP(xp) <= 2;
  });
  let statusLabel = "Just started";
  if (vulnerable) statusLabel = "Needs review";
  else if (pct >= 90) statusLabel = "High understanding";
  else if (pct >= 30) statusLabel = "In progress";
  return { level: avgLevel, statusLabel, vulnerable, pct };
}

function SubjectBuilding({ subject, onEnter, onMove, bounds }) {
  const stats = subjectStats(subject);
  const ref = useRef(null);
  const dragState = useRef(null);
  const [dragPos, setDragPos] = useState(null); // {xPct,yPct} while actively dragging

  const pos = dragPos || subject.worldPos || { xPct: 50, yPct: 50 };

  function onPointerDown(e) {
    const boundsEl = bounds.current;
    if (!boundsEl) return;
    const rect = boundsEl.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      rect,
    };
    e.target.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    const d = dragState.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) d.moved = true;
    if (!d.moved) return;
    const xPct = clamp(((e.clientX - d.rect.left) / d.rect.width) * 100, 4, 96);
    const yPct = clamp(((e.clientY - d.rect.top) / d.rect.height) * 100, 8, 92);
    setDragPos({ xPct, yPct });
  }

  function onPointerUp() {
    const d = dragState.current;
    dragState.current = null;
    if (!d) return;
    if (d.moved && dragPos) {
      onMove(dragPos);
    } else if (!d.moved) {
      onEnter();
    }
    setDragPos(null);
  }

  return (
    <motion.div
      ref={ref}
      className="absolute flex flex-col items-center cursor-grab active:cursor-grabbing select-none touch-none"
      style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%`, transform: "translate(-50%, -50%)", width: 150 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      whileHover={{ y: -3 }}
    >
      <div className="relative" style={{ width: 130, height: 140 }}>
        <Building level={stats.level} readyToUpgrade={stats.pct >= 75 && stats.level < 8} />
      </div>
      <div className="w-full -mt-1 bg-white rounded-lg border border-border px-3 py-2 shadow-sm text-center pointer-events-none">
        <div className="font-display font-semibold text-sm leading-snug truncate" title={subject.subject}>
          {subject.subject}
        </div>
        <div className={cn("text-xs mt-0.5 flex items-center justify-center gap-1", stats.vulnerable ? "text-danger" : "text-muted")}>
          {stats.vulnerable && <TriangleAlert size={11} />}
          Level {stats.level} · {stats.statusLabel}
        </div>
      </div>
    </motion.div>
  );
}

export function WorldMap({ subjects, onEnterSubject, onMoveSubject, onAddSubject }) {
  const bounds = useRef(null);

  return (
    <div
      ref={bounds}
      className="relative rounded-2xl border border-border overflow-hidden shadow-inner"
      style={{
        backgroundImage: "url(/game-art/sky-background.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: 480,
        height: "min(70vh, 600px)",
      }}
    >
      {subjects.map((s) => (
        <SubjectBuilding
          key={s.id}
          subject={s}
          bounds={bounds}
          onEnter={() => onEnterSubject(s.id)}
          onMove={(worldPos) => onMoveSubject(s.id, worldPos)}
        />
      ))}

      <button
        onClick={onAddSubject}
        className="absolute flex flex-col items-center gap-2 group"
        style={{ right: "5%", top: "8%", width: 130 }}
      >
        <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/70 bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors">
          <Plus size={26} className="text-white drop-shadow" />
        </div>
        <div className="text-xs font-semibold text-white drop-shadow bg-black/20 rounded-full px-2.5 py-1">Add a subject</div>
      </button>
    </div>
  );
}
