import React from "react";
import { Zap, BookOpen, Trophy, Lock } from "lucide-react";
import { GameIcon } from "./game/Hud";

const DURATIONS = [
  { min: 5, label: "Quick Study", time: "5 min", hint: "3 quick recall questions", icon: Zap },
  { min: 15, label: "Focused Session", time: "15 min", hint: "5 questions, a bit applied", icon: BookOpen },
  { min: 25, label: "Deep Dive", time: "25 min", hint: "8 questions, real depth", icon: Trophy },
];

export function StudyPanel({
  topic, onStart, partsCompleted = 0, totalParts = 5, onResumeLesson, onRetakeQuiz, quizLoading,
  locked, unlockHint, unlockCost, gems = 0, onUnlock, level = 1,
}) {
  if (!topic) return null;
  const started = partsCompleted > 0;

  if (locked) {
    const afford = gems >= unlockCost;
    return (
      <div className="p-5">
        <div className="flex items-center gap-2 mb-1"><Lock size={16} className="text-[#8a5b16]" /><span className="text-xs font-semibold text-[#6b5630]">Locked topic</span></div>
        <h3 className="font-game text-2xl leading-tight mb-1">{topic.name}</h3>
        <p className="text-sm text-[#5b4726] mb-4">{unlockHint}. Master the prerequisite to open it — or skip ahead with gems.</p>
        <button className="btn-gold btn-green w-full flex items-center justify-center gap-2" disabled={!afford} onClick={onUnlock}>
          <GameIcon name="gem" size={18} /> {afford ? `Unlock now · ${unlockCost}` : `Need ${unlockCost - gems} more gems`}
        </button>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="text-xs font-semibold text-[#6b5630]">Level {level} building</div>
      <h3 className="font-game text-2xl leading-tight mb-1">{topic.name}</h3>
      {started ? (
        <p className="text-[12.5px] text-[#2f7f4a] mb-3">{partsCompleted}/{totalParts} parts taught — pick up where you left off, free of charge.</p>
      ) : <div className="mb-3" />}

      {started && (
        <div className="flex flex-col gap-2 mb-4">
          <button className="btn-gold text-[15px]" onClick={onResumeLesson}>Continue lesson</button>
          <button className="btn-gold text-[15px]" onClick={onRetakeQuiz} disabled={quizLoading}>{quizLoading ? "Building quiz…" : "Take another quiz"}</button>
        </div>
      )}

      <div className="text-xs font-semibold text-[#6b5630] mb-2">{started ? "Or study a fresh block" : "Choose how you want to study"}</div>
      <div className="space-y-2">
        {DURATIONS.map(({ min, label, time, hint, icon: Icon }) => (
          <button key={min} onClick={() => onStart(min)} className="w-full flex items-center gap-3 rounded-xl border-2 border-[#dcc58d] bg-[#fffaf0] px-3 py-2.5 text-left hover:border-[#d9a231] hover:bg-[#fff4d6] transition-colors">
            <div className="w-9 h-9 rounded-full bg-night grid place-items-center shrink-0"><Icon size={16} className="text-gold" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5"><span className="font-display font-semibold text-sm">{label}</span><span className="text-[11px] text-[#6b5630]">· {time}</span></div>
              <div className="text-[11.5px] text-[#6b5630] leading-tight">{hint}</div>
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-[#6b5630] mt-3">Longer sessions teach more of the topic and unlock a longer, deeper quiz. Higher topic levels make your subject building tougher to raid.</p>
    </div>
  );
}
