import React, { useMemo } from "react";
import { ArrowLeft, Trash2, Crown, Gem } from "lucide-react";
import { IsoStage } from "./game/IsoStage";
import { ResourcePills, Nameplate, GameIcon } from "./game/Hud";
import { StudyPanel } from "./StudyPanel";
import { subjectArt } from "../game/assets";
import { footprintCenter } from "../game/iso";
import { subjectStats, topicUnlocked } from "../game/subjectStats";
import { levelFromXP, clamp } from "../lib/utils";

const PITCH = 6; // tiles between topic plots (3x3 building + breathing room)

// depth = how many prerequisites deep; rows spread topics at the same depth.
function layoutTopics(topics) {
  const byId = Object.fromEntries(topics.map((t) => [t.id, t]));
  const depth = {};
  const getDepth = (id, seen = new Set()) => {
    if (depth[id] !== undefined) return depth[id];
    if (seen.has(id)) return 0;
    seen.add(id);
    const t = byId[id];
    const pre = (t?.prerequisites || []).filter((p) => byId[p]);
    return (depth[id] = pre.length ? 1 + Math.max(...pre.map((p) => getDepth(p, seen))) : 0);
  };
  topics.forEach((t) => getDepth(t.id));
  const cols = {};
  topics.forEach((t) => (cols[depth[t.id]] = [...(cols[depth[t.id]] || []), t.id]));
  const maxRows = Math.max(...Object.values(cols).map((c) => c.length));
  const pos = {};
  Object.entries(cols).forEach(([d, ids]) => ids.forEach((id, i) => (pos[id] = { depth: Number(d), row: i + (maxRows - ids.length) / 2 })));
  return { pos, depths: Object.keys(cols).length, rows: maxRows };
}

export function SubjectBoard({
  subject, gems, points, streak, selectedId, onSelectTopic, onBack, onDelete, onUnlockEarly, studyProps, error,
}) {
  const { topics, xpMap, unlockedEarly } = subject;
  const { pos, depths, rows } = useMemo(() => layoutTopics(topics), [topics]);
  const gw = depths * PITCH + 1;
  const gh = rows * PITCH + 1;
  const byId = Object.fromEntries(topics.map((t) => [t.id, t]));
  const xp = (t) => xpMap[t.id] || 0;
  const isUnlocked = (t) => topicUnlocked(subject, t);
  const unlockCost = (t) => 6 + (t.difficulty || 3) * 3;
  const unlockHint = (t) => {
    const missing = (t.prerequisites || []).filter((p) => (xpMap[p] || 0) < 60).map((p) => byId[p]?.name).filter(Boolean);
    if (!missing.length) return "Locked";
    return missing.length === 1 ? `Needs ${missing[0]} at Level 2` : `Needs ${missing.length} topics first`;
  };

  const tile = (t) => ({ x: 1 + pos[t.id].depth * PITCH + 0, y: 1 + pos[t.id].row * PITCH });

  const items = useMemo(
    () =>
      topics.map((t) => {
        const level = levelFromXP(xp(t));
        const locked = !isUnlocked(t);
        const art = subjectArt(locked ? 1 : level);
        const within = (xp(t) % 60) / 60;
        const vulnerable = level <= 2 && xp(t) > 0;
        const ready = !locked && within >= 0.75 && level < 8;
        const { x, y } = tile(t);
        return {
          uid: t.id, x, y, w: 3, h: 3, src: art.src, height: art.height, ground: art.ground,
          filter: locked ? "grayscale(.95) brightness(.72) contrast(.95)" : undefined,
          glow: level >= 7 && !locked,
          label: <Nameplate name={t.name} sub={locked ? `🔒 ${unlockHint(t)}` : `Lv ${level}${vulnerable ? " · Needs review" : level >= 8 ? " · Mastered" : ""}`} warn={vulnerable} progress={locked ? null : level >= 8 ? 1 : within} />,
          badge: locked ? <span className="grid place-items-center w-9 h-9 rounded-full bg-[#fdf3d0] border-2 border-gold shadow"><GameIcon name="lock" size={22} /></span> : ready ? <span className="grid place-items-center w-6 h-6 rounded-full bg-amber text-white font-game text-sm border-2 border-white animate-pulse">!</span> : null,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topics, xpMap, unlockedEarly]
  );

  const paths = useMemo(() => {
    const out = [];
    for (const t of topics) {
      for (const pid of t.prerequisites || []) {
        const p = byId[pid];
        if (!p || !pos[p.id]) continue;
        const a = tile(p), b = tile(t);
        const A = footprintCenter(a.x, a.y, 3, 3), B = footprintCenter(b.x, b.y, 3, 3);
        const my = (A.y + B.y) / 2 + 30;
        out.push({ d: `M${A.x} ${A.y + 40} Q${(A.x + B.x) / 2} ${my + 40} ${B.x} ${B.y + 40}`, active: (xpMap[p.id] || 0) >= 60 });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, xpMap]);

  const st = subjectStats(subject);
  const mastered = topics.filter((t) => levelFromXP(xp(t)) >= 8).length;
  const nextGemsAt = Math.ceil((st.pct + 1) / 10) * 10;
  const sel = topics.find((t) => t.id === selectedId) || null;
  const locked = sel ? !isUnlocked(sel) : false;

  const overlay = (
    <div className="absolute inset-0 z-20 pointer-events-none" data-no-stage>
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="pointer-events-auto flex items-center gap-2">
          <button className="hud-round" onClick={onBack} aria-label="Back to base" title="Back to base"><ArrowLeft size={20} /></button>
          <div className="hud-panel px-4 py-1.5 leading-tight">
            <div className="font-game text-[20px] hud-outline">{subject.subject}</div>
            <div className="text-[11.5px] text-[#cfe6e6] flex items-center gap-1.5">
              <Crown size={12} className="text-gold" /> Level {st.level} · {mastered}/{topics.length} mastered · {st.pct}% conquered
            </div>
          </div>
          <button className="hud-round" title="Delete this subject" aria-label="Delete subject" onClick={() => { if (window.confirm(`Delete "${subject.subject}" and all its progress? This can't be undone.`)) onDelete(); }}><Trash2 size={17} /></button>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <ResourcePills points={points} gems={gems} streak={streak} />
          <div className="hud-panel px-3 py-1 text-[11.5px] flex items-center gap-1.5"><Gem size={12} className="text-gem" />{st.pct < 100 ? `${nextGemsAt - st.pct}% more conquest unlocks a +5 gem milestone` : "Fully conquered!"}</div>
        </div>
      </div>

      {!sel && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hud-panel px-4 py-2 text-sm pointer-events-none">Tap a building to study that topic. Roads light up as you master each one.</div>
      )}
      {sel && (
        <div className="pointer-events-auto parch absolute left-2 right-2 bottom-2 sm:left-auto sm:right-3 sm:bottom-auto sm:top-[104px] sm:w-[340px] max-h-[62vh] sm:max-h-[calc(100%-124px)] overflow-y-auto">
          <StudyPanel topic={sel} locked={locked} unlockHint={unlockHint(sel)} unlockCost={unlockCost(sel)} gems={gems} onUnlock={() => onUnlockEarly(sel, unlockCost(sel))} level={levelFromXP(xp(sel))} {...studyProps} />
          {error && <p className="text-sm text-danger px-5 pb-4">{error}</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#8fd3f8]">
      <IsoStage
        gw={gw}
        gh={gh}
        items={items}
        paths={paths}
        selectedUid={selectedId}
        onSelect={onSelectTopic}
        overlay={overlay}
        fitKey={`board-${subject.id}`}
        fitInsets={{ top: 110, bottom: 60, left: 70, right: 40 }}
      />
    </div>
  );
}
