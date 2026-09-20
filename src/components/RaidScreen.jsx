import React, { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Flag, Star } from "lucide-react";
import { IsoStage } from "./game/IsoStage";
import { QuestionCard } from "./QuestionCard";
import { GameIcon } from "./game/Hud";
import { objectToItem } from "../game/baseItems";
import { GRID } from "../../shared/baseRules";
import { answerRaid, retreatRaid } from "../lib/api";

const REASONS = {
  castle_broken: "The castle has fallen!",
  out_of_lives: "You ran out of lives.",
  questions_done: "Out of questions.",
  retreat: "You retreated.",
  timeout: "The raid timed out.",
};

function Stars({ n }) {
  return (
    <div className="flex justify-center gap-1.5 my-2">
      {[1, 2, 3].map((i) => (
        <Star key={i} size={38} className={i <= n ? "text-[#f2b830]" : "text-[#cbbb93]"} fill={i <= n ? "#f6d374" : "transparent"} strokeWidth={1.8} />
      ))}
    </div>
  );
}

/**
 * The attack view: the defender's island, a run of questions (one subject each),
 * and live damage. All rules run on the server — this screen only draws them.
 */
export function RaidScreen({ raid, player, onFinish }) {
  const [state, setState] = useState(raid.state);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [fx, setFx] = useState(null); // { ref, dmg, key }
  const [shake, setShake] = useState(0);
  const [retreating, setRetreating] = useState(false);
  const fxKey = useRef(0);
  const shakeRef = useRef(null);

  // Restart the impact shake by replaying a CSS animation — NOT by changing a
  // React `key`, which would remount the question card and lose its state.
  useEffect(() => {
    const el = shakeRef.current;
    if (!shake || !el) return;
    el.classList.remove("hit-shake");
    void el.offsetWidth;
    el.classList.add("hit-shake");
  }, [shake]);

  const q = raid.questions[idx];
  const levelOf = (o) => o.level || 1;

  const items = useMemo(() => {
    return raid.base.objects.map((o) => {
      let obj = { ...o, level: o.kind === "castle" ? raid.base.castleLevel : o.level };
      let opts = { plain: false };
      if (o.kind === "castle") {
        opts.hp = { value: state.castle.hp, max: state.castle.max, armor: state.castle.armor, armorMax: state.castle.armorMax };
        opts.destroyed = state.castleBroken;
      } else if (o.kind === "subject") {
        const b = state.buildings.find((x) => x.ref === o.ref);
        if (b) { opts.hp = { value: b.hp, max: b.max, armor: b.armor, armorMax: b.armorMax }; opts.destroyed = b.destroyed; }
      }
      const it = objectToItem(obj, opts);
      const hitHere = fx && ((o.kind === "subject" && o.ref === fx.ref) || (o.kind === "castle" && fx.castle));
      if (hitHere) {
        it.badge = (
          <div className="relative">
            <span key={fx.key} className="float-up absolute left-1/2 -top-3 font-game text-[26px] text-[#ffd35c] hud-outline">−{fx.dmg}</span>
            {it.badge}
          </div>
        );
      }
      return it;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raid, state, fx]);

  // The question is from YOUR notes; `targetRef` says which of THEIR buildings a correct answer hits.
  const targetUid = q ? raid.base.objects.find((o) => o.kind === "subject" && o.ref === q.targetRef)?.uid : null;

  async function submit(choice) {
    const res = await answerRaid(raid.raidId, player.id, idx, choice);
    setState(res.state);
    if (res.correct) {
      setFx({ ref: res.hit.target, castle: res.hit.castleHit, dmg: res.hit.damage - res.hit.ward, key: ++fxKey.current });
      setShake((n) => n + 1);
    }
    return res;
  }

  async function doRetreat() {
    setRetreating(true);
    try {
      const r = await retreatRaid(raid.raidId, player.id);
      setState(r.state);
      setResult(r.result);
    } catch {
      onFinish(null);
    }
  }

  const hearts = state.maxMisses - state.misses;

  return (
    <div className="fixed inset-0 z-50 bg-[#8fd3f8]">
      <div ref={shakeRef} className="absolute inset-0">
        <IsoStage
          gw={GRID}
          gh={GRID}
          items={items}
          selectedUid={targetUid}
          movable={() => false}
          fitKey={`raid-${raid.raidId}`}
          fitInsets={{ top: 90, bottom: result ? 40 : 330, left: 70, right: 20 }}
          overlay={
            <div className="absolute inset-0 z-20 pointer-events-none" data-no-stage>
              <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="hud-panel pointer-events-auto flex items-center gap-3 pl-2 pr-4 py-1.5">
                  <GameIcon name="crest" size={38} />
                  <div className="leading-tight">
                    <div className="font-game text-[18px] hud-outline">Raiding {raid.defender.name}</div>
                    <div className="text-[11.5px] text-[#cfe6e6]">{raid.mode === "war" ? `Clan war vs ${raid.defender.clanName || "enemy"}` : "Friendly raid"} · {state.destroyedPct}% destroyed</div>
                  </div>
                </div>
                <div className="hud-panel pointer-events-auto flex items-center gap-4 px-4 py-2">
                  <span className="flex items-center gap-1" title="Lives — each wrong answer costs one">
                    {Array.from({ length: state.maxMisses }, (_, i) => (
                      <Heart key={i} size={20} className={i < hearts ? "text-[#ff6b5a]" : "text-[#ffffff44]"} fill={i < hearts ? "#ff6b5a" : "transparent"} />
                    ))}
                  </span>
                  <span className="text-[12px] tabular-nums" title="Correct answers in a row hit harder">🔥 x{state.streak}</span>
                  {state.ward > 0 && <span className="text-[12px]" title="The defender's ward soaks damage first">✨ {state.ward}</span>}
                  {!result && (
                    <button className="btn-gold btn-red !py-0.5 text-[13px] flex items-center gap-1" onClick={doRetreat} disabled={retreating}>
                      <Flag size={13} /> Retreat
                    </button>
                  )}
                </div>
              </div>
              {!result && q && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(760px,96vw)] pointer-events-auto">
                  <QuestionCard
                    key={idx}
                    q={q}
                    index={idx}
                    total={raid.questions.length}
                    onSubmit={submit}
                    onNext={(res) => (res.done ? setResult(res.result) : setIdx((i) => i + 1))}
                    nextLabel={idx + 1 >= raid.questions.length ? "See result" : "Next"}
                  />
                </div>
              )}
            </div>
          }
        />
      </div>

      {result && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-4 bg-[#06181c]/60 backdrop-blur-[2px]">
          <div className="parch w-full max-w-md p-6 text-center">
            <h2 className="font-game text-[30px] leading-tight">{result.castleBroken ? "Castle broken — victory!" : result.stars > 0 ? "Raid complete" : "Raid failed"}</h2>
            <p className="text-sm text-[#6b5630]">{REASONS[result.reason] || ""} {raid.defender.name}'s castle {result.castleBroken ? "fell." : "held."}</p>
            <Stars n={result.stars} />
            <p className="text-sm">{result.destroyedPct}% destroyed · {result.correct}/{result.answered} correct</p>
            <div className="mt-3 flex justify-center gap-5 font-game text-xl">
              <span className="inline-flex items-center gap-1.5"><GameIcon name="star" size={24} />+{result.rewards.points}</span>
              <span className="inline-flex items-center gap-1.5"><GameIcon name="gem" size={24} />+{result.rewards.gems}</span>
            </div>
            {result.mode === "war" && (
              <p className="text-sm mt-3 px-3 py-2 rounded-lg bg-[#efe1bc] border border-[#dcc58d]">
                Clan war: <b>+{result.warStars + result.bonusStars}</b> star{result.warStars + result.bonusStars === 1 ? "" : "s"} for your clan
                {result.bonusStars ? ` (includes +${result.bonusStars} for breaking their castle — they lose this round)` : ""}.
              </p>
            )}
            <button className="btn-gold btn-green mt-5 w-full text-lg" onClick={() => onFinish(result)}>Return to base</button>
          </div>
        </div>
      )}
    </div>
  );
}
