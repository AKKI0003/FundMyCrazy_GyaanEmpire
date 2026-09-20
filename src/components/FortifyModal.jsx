import React, { useEffect, useRef, useState } from "react";
import { GameModal } from "./game/Hud";
import { QuestionCard } from "./QuestionCard";
import { startFortify, answerFortify } from "../lib/api";

export function SourcesLine({ sources = [] }) {
  if (!sources.length) return null;
  const bySubject = {};
  for (const s of sources) (bySubject[s.subject] ||= new Set()).add(s.topic);
  return (
    <p className="text-[12px] text-[#6b5630] mb-3">
      Drawing on what you've studied:{" "}
      {Object.entries(bySubject).map(([sub, topics], i) => (
        <span key={sub}>{i > 0 && " · "}<b>{sub}</b> ({[...topics].join(", ")})</span>
      ))}
    </p>
  );
}

function WardBar({ ward, cap }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[12.5px] mb-1"><span className="font-semibold">✨ Ward</span><span className="tabular-nums">{ward} / {cap}</span></div>
      <div className="h-3 rounded-full bg-[#e2d3aa] border border-[#c9b37a] overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${cap ? (ward / cap) * 100 : 0}%`, background: "linear-gradient(90deg,#8fe0f0,#5aaee0)" }} />
      </div>
    </div>
  );
}

/** Defender's quiz: every correct answer adds ward — a shield that soaks raid damage first. */
export function FortifyModal({ player, getSnapshot, onClose }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [idx, setIdx] = useState(0);
  const [ward, setWard] = useState(0);
  const [cap, setCap] = useState(0);
  const [rally, setRally] = useState(false);
  const [summary, setSummary] = useState(null);

  // Start exactly ONE session. (StrictMode runs effects twice in dev; a second request
  // would burn through unasked questions and can report a false failure.)
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Send the freshest snapshot with the request so a topic you just unlocked/studied
    // (or a subject you just deleted) is reflected immediately.
    startFortify(player.id, getSnapshot())
      .then((s) => { setSession(s); setWard(s.ward); setCap(s.wardCap); setRally(s.underAttack); })
      .catch((e) => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameModal title="Fortify your base" subtitle={rally ? "Under attack — every correct answer counts extra!" : "Answer questions on topics you've studied to build ward. Ward soaks raid damage before anything else."} onClose={onClose}>
      {error && (
        <div className="parch-card p-4 text-sm">
          <p className="font-semibold mb-1">Can't start a fortify round yet</p>
          <p className="text-[#5b4726]">{error}</p>
        </div>
      )}
      {!session && !error && <p className="text-sm text-[#6b5630] animate-pulse">Gathering questions from every subject in your base…</p>}
      {session && !summary && (
        <>
          <WardBar ward={ward} cap={cap} />
          <SourcesLine sources={session.sources} />
          <QuestionCard
            key={idx}
            q={session.questions[idx]}
            index={idx}
            total={session.questions.length}
            okText="Ward raised."
            nextLabel={idx + 1 >= session.questions.length ? "Finish" : "Next"}
            onSubmit={async (choice) => {
              const r = await answerFortify(session.fortifyId, player.id, idx, choice);
              setWard(r.ward); setCap(r.wardCap); setRally(r.underAttack);
              return r;
            }}
            onNext={(r) => (r.done ? setSummary(r.summary) : setIdx((i) => i + 1))}
          />
        </>
      )}
      {summary && (
        <div className="text-center py-4">
          <div className="text-5xl mb-2">🛡️</div>
          <h3 className="font-game text-2xl">{summary.correct}/{summary.total} correct</h3>
          <p className="text-sm text-[#6b5630] mt-1">Ward is now <b>{ward}/{cap}</b>{summary.gained ? ` (+${summary.gained})` : ""}. It's spent first when someone raids you.</p>
          {ward >= cap && <p className="text-xs text-[#6b5630] mt-1">Ward is full — upgrade your castle or buy Ward Totems for more capacity.</p>}
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-gold" onClick={() => { setSession(null); setSummary(null); setIdx(0); setError(""); startFortify(player.id, getSnapshot()).then((s) => { setSession(s); setWard(s.ward); setCap(s.wardCap); }).catch((e) => setError(e.message)); }}>Another round</button>
            <button className="btn-gold btn-green" onClick={onClose}>Back to base</button>
          </div>
        </div>
      )}
    </GameModal>
  );
}
