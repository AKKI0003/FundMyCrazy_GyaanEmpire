import React from "react";
import { Flame } from "lucide-react";

function Stat({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-white">
      {icon}
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-semibold font-display">{value}</span>
    </div>
  );
}

export function ResourceBar({ points, gems, streak }) {
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
      />
      <Stat
        icon={<Flame size={14} className="text-danger" />}
        label="Streak"
        value={`${streak} day${streak === 1 ? "" : "s"}`}
      />
    </div>
  );
}
