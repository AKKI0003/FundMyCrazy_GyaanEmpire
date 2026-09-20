import React, { useCallback, useEffect, useState } from "react";
import { Swords, Shield, Copy, LogOut, Trophy, Clock } from "lucide-react";
import { GameModal, TabButton, GameIcon } from "./game/Hud";
import { savePlayer } from "../game/player";
import { createClan, joinClan, leaveClan, getClan, listClans, startWar, endWar, getTargets, getPlayer } from "../lib/api";

const rel = (t) => {
  const m = Math.max(0, Math.round((t - Date.now()) / 60000));
  return m >= 90 ? `${Math.round(m / 60)}h` : `${m}m`;
};

function Rules() {
  return (
    <details className="parch-card px-3 py-2 text-[13px] mb-3">
      <summary className="cursor-pointer font-semibold">How raids work</summary>
      <ul className="list-disc pl-5 mt-2 space-y-1 text-[#5b4726]">
        <li>A raid is a run of quiz questions written from <b>what you have unlocked and studied</b> — every subject you've learned gets asked, and questions never repeat. Locked or unopened topics (and deleted subjects) never appear; unlock and study more and the pool grows.</li>
        <li>Correct answer = a strike on that subject's building (streaks hit harder). Wrong answer = deflected, and you lose a life. Three lives.</li>
        <li>Damage is soaked by <b>ward</b>, then <b>armor</b> (walls, towers…), then HP. Once a building falls, its strikes hit the <b>castle</b>.</li>
        <li><b>Castle broken = the defender loses</b> — you take 3 stars and their clan-war round.</li>
        <li>Being raided? Answer <b>fortify</b> questions — ward is added live, even mid-raid.</li>
      </ul>
    </details>
  );
}

function TargetCard({ t, onAttack, busy, noMaterial }) {
  const blocked = t.shielded || t.fallen;
  return (
    <div className={`parch-card p-3 flex items-center gap-3 ${blocked ? "opacity-70" : ""}`}>
      <div className="w-11 h-11 rounded-full bg-night grid place-items-center shrink-0"><GameIcon name="crest" size={30} /></div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-[15px] truncate">{t.name}{t.isBot && <span className="ml-1.5 text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded bg-[#e6d6ab] text-[#6b5630] align-middle">BOT</span>}</div>
        <div className="text-[12px] text-[#6b5630] truncate">
          Castle Lv {t.castleLevel} · defense {t.rating} · ✨ {t.ward}/{t.wardCap}
        </div>
        <div className="text-[11.5px] text-[#6b5630] truncate">{t.subjects.map((s) => s.name).join(", ") || "No subjects"}</div>
      </div>
      <div className="text-right shrink-0">
        {t.bestStars > 0 && <div className="text-[12px] mb-1">{"★".repeat(t.bestStars)}{"☆".repeat(3 - t.bestStars)}</div>}
        {t.fallen ? <span className="text-[12px] font-semibold text-[#b0402f]">Castle fell</span> : t.shielded ? <span className="text-[12px] text-[#3b7a9c]">🛡️ Shielded</span> : t.underAttack ? <span className="text-[12px] text-[#b0402f]">Under attack</span> : (
          <button className="btn-gold btn-red" disabled={busy || noMaterial} title={noMaterial ? "Finish a lesson part first" : ""} onClick={() => onAttack(t)}>Attack</button>
        )}
      </div>
    </div>
  );
}

function WarTab({ player, online, onAttack, attackBusy, secondWind, refreshKey }) {
  const [data, setData] = useState(null);
  const [clan, setClan] = useState(null);
  const [learned, setLearned] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      setErr("");
      const t = await getTargets(player.id);
      setData(t);
      const me = await getPlayer(player.id);
      setLearned(me.learned);
      setClan(me.clanId ? await getClan(me.clanId, player.id) : null);
    } catch (e) { setErr(e.message); }
  }, [player.id]);
  useEffect(() => { if (online !== false) load(); }, [load, online, tick, refreshKey]);

  if (online === false) return <p className="text-sm">The war server isn't reachable. Run <code>npm run server</code> (or <code>npm start</code>) and reopen this panel.</p>;
  if (!data && !err) return <p className="text-sm animate-pulse text-[#6b5630]">Scouting enemy bases…</p>;
  if (err) return <p className="text-sm text-danger">{err.includes("Unknown player") ? "Your base hasn't synced yet — give it a second, then reopen." : err}</p>;

  const war = clan?.war;
  const act = async (fn) => { setLoading(true); try { await fn(); setTick((n) => n + 1); } catch (e) { setErr(e.message); } finally { setLoading(false); } };

  return (
    <div>
      <Rules />
      {learned && learned.topics === 0 && (
        <p className="text-[13px] mb-3 px-3 py-2 rounded-lg bg-[#fbe3dc] border border-[#e9a99a]">
          Raid and fortify questions come only from topics you've <b>unlocked and studied</b>. Finish at least one lesson part first, then come back.
        </p>
      )}
      {learned && learned.topics > 0 && <p className="text-[12.5px] text-[#6b5630] mb-2">Your questions draw on {learned.topics} studied topic{learned.topics === 1 ? "" : "s"} across {learned.subjects} subject{learned.subjects === 1 ? "" : "s"}.</p>}
      {secondWind > 0 && <p className="text-[12.5px] mb-2">💨 You own {secondWind} Second Wind — used automatically for one extra miss in your next raid.</p>}
      {clan && (
        <div className="parch-card p-3 mb-3">
          {war ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-game text-xl">{clan.name} <span className="text-[#8a5b16]">vs</span> {war.enemy.name}</div>
                <div className="text-[12.5px] text-[#6b5630] flex items-center gap-1"><Clock size={13} /> ends in {rel(war.endsAt)} · break their castles to win rounds</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-game text-3xl tabular-nums">{war.score.mine}<span className="text-[#8a5b16] mx-1">–</span>{war.enemy.isBot ? "?" : war.score.theirs}<span className="text-base ml-1">★</span></div>
                <button className="btn-gold text-[13px]" disabled={loading} onClick={() => { if (window.confirm("End the war now and settle the score?")) act(() => endWar(clan.id, player.id)); }}>End war</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm">{clan.name} is at peace. Declare war to be matched with a rival clan.</p>
              <button className="btn-gold btn-red" disabled={loading} onClick={() => act(() => startWar(clan.id, player.id))}><Swords size={15} className="inline mr-1 -mt-0.5" />Declare war</button>
            </div>
          )}
          {war?.enemy.isBot && <p className="text-[11.5px] text-[#6b5630] mt-2">Bot clans don't attack in real time — their score is settled when the war ends.</p>}
        </div>
      )}
      {!clan && <p className="text-[13px] mb-3 px-3 py-2 rounded-lg bg-[#efe1bc] border border-[#dcc58d]">You're not in a clan. Clan wars need one (Clan tab) — until then you can still run friendly raids below for gems.</p>}

      <h3 className="font-game text-lg mb-2">{data.mode === "war" ? `Enemy bases — ${data.enemyName}` : "Friendly raids"}</h3>
      <div className="grid gap-2">
        {data.targets.length === 0 && <p className="text-sm text-[#6b5630]">No bases to raid yet. Another player needs to open their base first.</p>}
        {data.targets.map((t) => <TargetCard key={t.id} t={t} onAttack={onAttack} busy={attackBusy} noMaterial={learned?.topics === 0} />)}
      </div>
    </div>
  );
}

function ClanTab({ player, setPlayer, online, refreshKey, bump }) {
  const [me, setMe] = useState(null);
  const [clan, setClan] = useState(null);
  const [clans, setClans] = useState([]);
  const [name, setName] = useState(player.name);
  const [clanName, setClanName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setErr("");
      const p = await getPlayer(player.id);
      setMe(p);
      setClan(p.clanId ? await getClan(p.clanId, player.id) : null);
      setClans((await listClans()).clans);
    } catch (e) { setErr(e.message); }
  }, [player.id]);
  useEffect(() => { if (online !== false) load(); }, [load, online, refreshKey]);

  const run = (fn) => async () => { try { setErr(""); await fn(); await load(); bump(); } catch (e) { setErr(e.message); } };

  if (online === false) return <p className="text-sm">The war server isn't reachable. Run <code>npm run server</code> and reopen this panel.</p>;

  return (
    <div className="space-y-4">
      <div className="parch-card p-3">
        <label className="text-[12.5px] font-semibold text-[#6b5630]">Your player name</label>
        <div className="flex gap-2 mt-1">
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-lg border-2 border-[#dcc58d] bg-[#fffaf0] px-3 py-1.5 text-sm outline-none focus:border-[#d9a231]" />
          <button className="btn-gold" disabled={!name.trim() || name === player.name} onClick={() => { const p = { ...player, name: name.trim() }; savePlayer(p); setPlayer(p); }}>Save</button>
        </div>
        {me && <p className="text-[12px] text-[#6b5630] mt-2">Raids won {me.stats.raidsWon} · lost {me.stats.raidsLost} · defended {me.stats.defended} · castle broken {me.stats.lost} · ★ {me.stats.stars}</p>}
      </div>

      {err && <p className="text-sm text-danger">{err}</p>}

      {clan ? (
        <div className="parch-card p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-game text-2xl">{clan.name}</div>
              <div className="text-[12.5px] text-[#6b5630]">{clan.stars}★ lifetime · {clan.wins}W {clan.losses}L</div>
            </div>
            <div className="flex gap-2">
              <button className="btn-gold text-[13px]" onClick={() => navigator.clipboard?.writeText(clan.id)} title="Copy invite code"><Copy size={13} className="inline mr-1 -mt-0.5" />Code: {clan.id}</button>
              <button className="btn-gold btn-red text-[13px]" onClick={run(() => leaveClan(player.id))}><LogOut size={13} className="inline mr-1 -mt-0.5" />Leave</button>
            </div>
          </div>
          <div className="mt-3 grid gap-1.5">
            {clan.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg bg-[#fffaf0] border border-[#e6d6ab]">
                <span className="font-semibold">{m.name}{m.isMe ? " (you)" : ""}</span>
                <span className="text-[12px] text-[#6b5630] ml-auto">Castle {m.castleLevel} · {m.subjects.length} subject{m.subjects.length === 1 ? "" : "s"} · defense {m.rating}</span>
              </div>
            ))}
          </div>
          {clan.history.length > 0 && (
            <div className="mt-3 text-[12.5px] text-[#5b4726]">
              <b>Recent wars:</b> {clan.history.map((h, i) => <span key={i} className="ml-2">{h.outcome === "win" ? "🏆" : h.outcome === "loss" ? "💀" : "🤝"} vs {h.vs} ({h.mine}–{h.theirs})</span>)}
            </div>
          )}
          <p className="text-[12px] text-[#6b5630] mt-2">Share the code so classmates can join. Everyone's subjects become part of your clan's strength.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="parch-card p-3">
            <div className="font-game text-lg mb-1">Start a clan</div>
            <input value={clanName} maxLength={24} placeholder="Clan name" onChange={(e) => setClanName(e.target.value)} className="w-full rounded-lg border-2 border-[#dcc58d] bg-[#fffaf0] px-3 py-1.5 text-sm outline-none focus:border-[#d9a231]" />
            <button className="btn-gold btn-green mt-2 w-full" disabled={!clanName.trim()} onClick={run(() => createClan(player.id, clanName))}>Create</button>
          </div>
          <div className="parch-card p-3">
            <div className="font-game text-lg mb-1">Join with a code</div>
            <input value={code} maxLength={12} placeholder="e.g. K7Q2M" onChange={(e) => setCode(e.target.value.toUpperCase())} className="w-full rounded-lg border-2 border-[#dcc58d] bg-[#fffaf0] px-3 py-1.5 text-sm outline-none focus:border-[#d9a231] tracking-widest" />
            <button className="btn-gold mt-2 w-full" disabled={!code.trim()} onClick={run(() => joinClan(player.id, code))}>Join</button>
          </div>
        </div>
      )}

      <div>
        <h3 className="font-game text-lg mb-1 flex items-center gap-1.5"><Trophy size={17} /> Leaderboard</h3>
        <div className="grid gap-1">
          {clans.slice(0, 8).map((c, i) => (
            <div key={c.id} className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg border ${clan?.id === c.id ? "bg-[#fff1c9] border-[#d9a231]" : "bg-[#fffaf0] border-[#e6d6ab]"}`}>
              <span className="font-game w-5 text-[#8a5b16]">{i + 1}</span>
              <span className="font-semibold">{c.name}</span>
              {c.isBot && <span className="text-[10px] px-1.5 rounded bg-[#e6d6ab] text-[#6b5630]">BOT</span>}
              <span className="ml-auto text-[12px] text-[#6b5630]">{c.stars}★ · {c.members} members{c.atWar ? " · ⚔ at war" : ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DefenseTab({ incoming, onFortify }) {
  if (!incoming) return <p className="text-sm animate-pulse text-[#6b5630]">Loading…</p>;
  const shieldH = Math.max(0, (incoming.shieldUntil - Date.now()) / 3600e3);
  return (
    <div className="space-y-4">
      <div className="parch-card p-3">
        <div className="flex justify-between text-[13px] mb-1"><span className="font-semibold">✨ Ward</span><span>{incoming.ward} / {incoming.wardCap}</span></div>
        <div className="h-3 rounded-full bg-[#e2d3aa] border border-[#c9b37a] overflow-hidden"><div className="h-full" style={{ width: `${incoming.wardCap ? (incoming.ward / incoming.wardCap) * 100 : 0}%`, background: "linear-gradient(90deg,#8fe0f0,#5aaee0)" }} /></div>
        <p className="text-[12.5px] text-[#6b5630] mt-2">Ward soaks the first damage of any raid. Fill it by answering fortify questions — they're drawn from topics you've unlocked and studied, weakest first.</p>
        <button className="btn-gold btn-green mt-2" onClick={onFortify}><Shield size={15} className="inline mr-1 -mt-0.5" />Fortify now</button>
      </div>
      {shieldH > 0 && <p className="text-sm">🛡️ Peace Shield active for {shieldH.toFixed(1)}h more — nobody can raid you.</p>}
      {incoming.active.length > 0 && <p className="text-sm font-semibold text-[#b0402f]">⚔ {incoming.active[0].attackerName} is raiding you right now!</p>}
      <div>
        <h3 className="font-game text-lg mb-1">Recent raids on you</h3>
        {incoming.log.length === 0 ? <p className="text-sm text-[#6b5630]">Nobody has raided you yet.</p> : (
          <div className="grid gap-1">
            {incoming.log.slice(0, 8).map((l, i) => (
              <div key={i} className="text-sm px-2 py-1.5 rounded-lg bg-[#fffaf0] border border-[#e6d6ab] flex items-center gap-2">
                <span>{l.castleBroken ? "💥" : "🛡️"}</span>
                <span><b>{l.byName}</b> {l.castleBroken ? "broke your castle" : `damaged ${l.destroyedPct}% of your base`}</span>
                <span className="ml-auto text-[12px] text-[#6b5630]">{l.mode === "war" ? "clan war" : "friendly"} · {"★".repeat(l.stars) || "0★"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function WarHub({ tab, setTab, player, setPlayer, online, incoming, attackBusy, secondWind, onAttack, onFortify, onClose }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((n) => n + 1);
  return (
    <GameModal
      title={tab === "clan" ? "Clan" : tab === "defense" ? "Defense" : "War room"}
      subtitle="Wars are won with knowledge: every strike and every shield is a quiz answer."
      onClose={onClose}
      wide
      tabs={[
        <TabButton key="war" active={tab === "war"} onClick={() => setTab("war")}>War</TabButton>,
        <TabButton key="clan" active={tab === "clan"} onClick={() => setTab("clan")}>Clan</TabButton>,
        <TabButton key="defense" active={tab === "defense"} onClick={() => setTab("defense")} badge={incoming?.active?.length ? "!" : null}>Defense</TabButton>,
      ]}
    >
      {tab === "war" && <WarTab player={player} online={online} onAttack={onAttack} attackBusy={attackBusy} secondWind={secondWind} refreshKey={refreshKey} />}
      {tab === "clan" && <ClanTab player={player} setPlayer={setPlayer} online={online} refreshKey={refreshKey} bump={bump} />}
      {tab === "defense" && <DefenseTab incoming={incoming} onFortify={onFortify} />}
    </GameModal>
  );
}
