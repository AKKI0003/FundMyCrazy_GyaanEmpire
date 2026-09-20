import React from "react";
import { Flame } from "lucide-react";

const MILESTONES = [3, 7, 14, 30];

function nextMilestone(streak) {
  return MILESTONES.find((m) => m > streak) || null;
}

function Stat({ icon, label, value, hint }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white">
      {icon}
      <div className="leading-tight">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-muted">{label}</span>
          <span className="text-sm font-semibold font-display">{value}</span>
        </div>
        {hint && <div className="text-[10px] text-amber">{hint}</div>}
      </div>
    </div>
  );
}

export function ResourceBar({ points, gems, streak }) {
  const next = nextMilestone(streak);
  const daysToGo = next ? next - streak : null;

  return (
    <div className="flex flex-wrap gap-2">
      <Stat
        icon={<img src="/game-art/star-icon.png" alt="" className="w-4 h-4 object-contain" />}
        label="Study Points"
        value={points}
      />
      <Stat
        icon={<img src="/game-art/gem-icon.png" alt="" className="w-4 h-4 object-contain" />}
        label="Focus Gems"
        value={gems}
        hint="Spend to unlock a locked topic early"
      />
      <Stat
        icon={<Flame size={14} className="text-danger" />}
        label="Streak"
        value={`${streak} day${streak === 1 ? "" : "s"}`}
        hint={
          next
            ? `${daysToGo} more study day${daysToGo === 1 ? "" : "s"} to +${next * 5} gems`
            : streak > 0
            ? "Study today to keep it alive"
            : null
        }
      />
    </div>
  );
}
