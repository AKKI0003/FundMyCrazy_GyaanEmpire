import React from "react";
import { Crown, Gem } from "lucide-react";
import { clamp, levelFromXP } from "../lib/utils";

const XP_PER_TOPIC_MAX = 60 * 7; // level 8 cap, from levelFromXP's clamp(1 + xp/60, 1, 8)

export function EmpireOverview({ topics, xpMap, gems }) {
  if (!topics?.length) return null;

  const totalXp = topics.reduce((sum, t) => sum + (xpMap[t.id] || 0), 0);
  const maxXp = topics.length * XP_PER_TOPIC_MAX;
  const masteryPct = clamp(Math.round((totalXp / maxXp) * 100), 0, 100);
  const empireLevel = Math.max(1, Math.round(topics.reduce((s, t) => s + levelFromXP(xpMap[t.id] || 0), 0) / topics.length));
  const mastered = topics.filter((t) => levelFromXP(xpMap[t.id] || 0) >= 8).length;
  const nextGemsAt = Math.ceil((masteryPct + 1) / 10) * 10;

  return (
    <div className="mb-4 rounded-xl border border-border bg-white px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-3 justify-between">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-amber/10 border border-amber/30 flex items-center justify-center shrink-0">
          <Crown size={19} className="text-amber" />
        </div>
        <div>
          <div className="font-display font-semibold text-base leading-tight text-ink">Empire Level {empireLevel}</div>
          <div className="text-xs text-muted">
            {mastered}/{topics.length} topics mastered · {masteryPct}% of the syllabus conquered
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-[160px] max-w-xs">
        <div className="h-1.5 rounded-full bg-bg border border-border overflow-hidden">
          <div className="h-full bg-teal rounded-full transition-all duration-500" style={{ width: `${masteryPct}%` }} />
        </div>
        <div className="text-[11px] text-muted mt-1.5 flex items-center gap-1">
          <Gem size={11} className="text-teal-dark" />
          {masteryPct < 100
            ? `${nextGemsAt - masteryPct}% more conquest unlocks a +5 gem milestone`
            : "Empire fully conquered — start a new one for a fresh challenge!"}
        </div>
      </div>
    </div>
  );
}
