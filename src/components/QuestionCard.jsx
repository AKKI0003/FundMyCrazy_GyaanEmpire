import React, { useEffect, useRef, useState } from "react";
import { Check, X, Timer } from "lucide-react";

/**
 * One multiplayer question (raid or fortify). The correct answer never reaches
 * the browser until AFTER you've answered — `onSubmit(choice)` asks the server
 * and resolves with { correct, correctIndex, explanation, ... }.
 */
export function QuestionCard({ q, index, total, seconds = 30, onSubmit, onNext, nextLabel = "Next", okText = "Strike lands.", className = "" }) {
  const [picked, setPicked] = useState(null);
  const [res, setRes] = useState(null);
  const [left, setLeft] = useState(seconds);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submitted = useRef(false);

  useEffect(() => {
    if (res || !seconds) return;
    if (left <= 0) { submit(-1); return; }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, res]);

  async function submit(choice) {
    if (submitted.current) return;
    submitted.current = true;
    setPicked(choice);
    setBusy(true);
    try {
      setRes(await onSubmit(choice));
    } catch (e) {
      submitted.current = false;
      setPicked(null);
      setErr(e.message || "Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const lowTime = left <= 8;
  return (
    <div className={`parch p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-2 text-[12.5px]">
        <span className="font-semibold text-[#6b5630]">
          {q.subjectName}{q.topicName && q.topicName !== q.subjectName ? ` · ${q.topicName}` : ""}
        </span>
        <span className="flex items-center gap-3">
          <span className="text-[#6b5630]">{index + 1} / {total}</span>
          {seconds > 0 && !res && (
            <span className={`inline-flex items-center gap-1 font-game text-base tabular-nums ${lowTime ? "text-[#c2412d]" : "text-parch-ink"}`}>
              <Timer size={14} /> {Math.max(0, left)}
            </span>
          )}
        </span>
      </div>
      {q.targetName && <div className="text-[11.5px] font-semibold text-[#8a5b16] -mt-0.5 mb-1.5">⚔ A correct answer strikes {q.targetName}</div>}
      <h3 className="font-display font-semibold text-[16px] sm:text-[17px] leading-snug mb-3">{q.question}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const isRight = res && i === res.correctIndex;
          const isWrongPick = res && i === picked && !res.correct;
          return (
            <button
              key={i}
              disabled={!!res || busy}
              onClick={() => submit(i)}
              className={`text-left text-[14px] px-3 py-2.5 rounded-xl border-2 transition-colors flex items-start gap-2 ${
                isRight ? "bg-[#d6f2d6] border-[#2f9445]" : isWrongPick ? "bg-[#f8d9d3] border-[#b0402f]" : picked === i ? "bg-[#fff1c9] border-[#d9a231]" : "bg-[#fffaf0] border-[#dcc58d] hover:border-[#d9a231] hover:bg-[#fff4d6]"
              }`}
            >
              <span className="font-game w-5 shrink-0 text-[#8a5b16]">{"ABCD"[i]}</span>
              <span className="flex-1">{opt}</span>
              {isRight && <Check size={16} className="text-[#2f9445] mt-0.5" />}
              {isWrongPick && <X size={16} className="text-[#b0402f] mt-0.5" />}
            </button>
          );
        })}
      </div>
      {err && <p className="text-sm text-danger mt-2">{err}</p>}
      {res && (
        <div className="mt-3 flex items-start justify-between gap-3">
          <p className="text-[13px] text-[#5b4726] leading-snug flex-1">
            <b className={res.correct ? "text-[#2f7f4a]" : "text-[#b0402f]"}>{res.correct ? `${okText} ` : picked === -1 ? "Time's up. " : "Missed. "}</b>
            {res.explanation}
          </p>
          <button className="btn-gold btn-green shrink-0" onClick={() => onNext(res)}>{nextLabel}</button>
        </div>
      )}
    </div>
  );
}
