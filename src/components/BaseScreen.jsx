import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Check, X, Pencil, Plus, ShoppingBag, Swords, Shield, Users } from "lucide-react";
import { IsoStage } from "./game/IsoStage";
import { ResourcePills, DockButton, GameIcon } from "./game/Hud";
import { ShopModal } from "./ShopModal";
import { WarHub } from "./WarHub";
import { RaidScreen } from "./RaidScreen";
import { FortifyModal } from "./FortifyModal";
import { objectToItem } from "../game/baseItems";
import { ITEM_BY_ID } from "../../shared/catalog";
import { GRID, SELL_REFUND, canPlaceAt, findFreeSpot, sizeOf } from "../../shared/baseRules";
import { getIncoming, startRaid as apiStartRaid } from "../lib/api";
import { buildSnapshot } from "../game/baseState";

const LOG_KEY = "gyanEmpire.lastRaidLog.v1";

function Btn({ children, tone = "gold", onClick, disabled, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`btn-gold ${tone === "green" ? "btn-green" : tone === "red" ? "btn-red" : ""} text-[14px] px-3 py-1 whitespace-nowrap`}>
      {children}
    </button>
  );
}

export function BaseScreen({
  subjects, baseApi, gems, points, streak, player, setPlayer, online,
  onOpenSubject, onAddSubject, spendGems, addGems, addPoints, toast,
}) {
  const { base, objects, defense } = baseApi;
  const [selectedUid, setSelectedUid] = useState(null);
  const [edit, setEdit] = useState(false);
  const [placing, setPlacing] = useState(null); // { itemId, x, y }
  const [shop, setShop] = useState(false);
  const [hub, setHub] = useState(null); // 'war' | 'clan' | 'defense'
  const [raid, setRaid] = useState(null);
  const [fortify, setFortify] = useState(false);
  const [incoming, setIncoming] = useState(null);
  const [busy, setBusy] = useState(false);

  // One-time welcome gift so the shop isn't empty on first open.
  const welcomed = useRef(false);
  useEffect(() => {
    if (!base.welcomed && subjects.length && !welcomed.current) {
      welcomed.current = true; // ref guard: StrictMode runs effects twice in dev
      addGems(10);
      baseApi.markWelcomed();
      toast("Welcome! Here are 10 Focus Gems — open the Shop to fortify your base.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- incoming raids (polling) ---------------------------------------------------
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const d = await getIncoming(player.id);
        if (!live) return;
        setIncoming(d);
        const seen = Number(localStorage.getItem(LOG_KEY) || 0);
        const fresh = (d.log || []).filter((l) => l.at > seen);
        if (seen && fresh.length) {
          const l = fresh[0];
          toast(l.castleBroken ? `💥 ${l.byName} broke your castle!` : `🛡️ Your castle held against ${l.byName} (${l.destroyedPct}% damage).`);
        }
        if (d.log?.[0]) localStorage.setItem(LOG_KEY, String(d.log[0].at));
        else if (!seen) localStorage.setItem(LOG_KEY, String(Date.now()));
      } catch { /* unknown player until first sync, or server down */ }
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => { live = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id, online]);

  const underAttack = incoming?.active?.[0];

  // ---- stage items -----------------------------------------------------------------
  const items = useMemo(() => {
    const list = objects.map((o) => objectToItem(o));
    if (placing) list.push(objectToItem({ uid: "__placing", kind: "shop", itemId: placing.itemId, x: placing.x, y: placing.y }, { pending: true }));
    return list;
  }, [objects, placing]);

  const placingObj = placing && { uid: "__placing", kind: "shop", itemId: placing.itemId };
  const placingValid = placing ? canPlaceAt(objects, placingObj, placing.x, placing.y) : false;

  const canDrop = useCallback(
    (uid, x, y) => {
      const o = uid === "__placing" ? placingObj : objects.find((q) => q.uid === uid);
      return !!o && canPlaceAt(objects, o, x, y);
    },
    [objects, placingObj]
  );

  const onMove = (uid, x, y) => {
    if (uid === "__placing") setPlacing((p) => ({ ...p, x, y }));
    else baseApi.moveObject(uid, x, y);
  };

  // ---- placing (shop purchases) --------------------------------------------------
  const beginPlacing = (itemId, near) => {
    const item = ITEM_BY_ID[itemId];
    const spot = findFreeSpot(objects, item.size, near || { x: GRID / 2, y: GRID / 2 }, { margin: 0 });
    if (!spot) return toast("There's no free space left on your island.");
    setEdit(false);
    setSelectedUid(null);
    setPlacing({ itemId, ...spot });
    setShop(false);
  };

  const confirmPlacing = () => {
    if (!placing || !placingValid) return;
    const { itemId, x, y } = placing;
    if (!baseApi.placeItem(itemId, x, y)) return toast("Not enough gems for that.");
    const item = ITEM_BY_ID[itemId];
    // Walls: keep going — drop the next piece right beside the last one (if you can afford it).
    if (item.category === "walls" && gems - item.cost >= item.cost) {
      const [w, h] = item.size;
      const spot = findFreeSpot([...objects, { uid: "x", kind: "shop", itemId, x, y }], item.size, { x: x + w / 2 + 1, y: y + h / 2 }, { margin: 0 });
      if (spot) return setPlacing({ itemId, ...spot });
    }
    setPlacing(null);
  };

  const buyBoost = (id) => {
    const item = ITEM_BY_ID[id];
    if (!spendGems(item.cost)) return toast("Not enough gems.");
    if (item.boost === "shield") { baseApi.buyShield(item.hours); toast(`🛡️ Peace Shield active for ${item.hours} hours.`); }
    if (item.boost === "secondWind") { baseApi.addSecondWind(); toast("💨 Second Wind added — it's used automatically in your next raid."); }
  };
  const upgradeCastle = () => {
    if (baseApi.upgradeCastle()) toast(`🏰 Castle upgraded to level ${base.castleLevel + 1}!`);
  };
  const sell = (uid) => {
    const refund = baseApi.sellObject(uid);
    addGems(refund);
    setSelectedUid(null);
    toast(refund ? `Sold for ${refund} gem${refund > 1 ? "s" : ""}.` : "Sold.");
  };

  // ---- raids ------------------------------------------------------------------------
  // Fresh snapshot of what you have unlocked + studied, sent with every raid/fortify request.
  const getSnapshot = () => buildSnapshot(base, subjects);
  const attack = async (target) => {
    if (busy) return;
    setBusy(true);
    try {
      const extra = base.inventory.secondWind > 0 ? 1 : 0;
      const r = await apiStartRaid(player.id, target.id, extra, getSnapshot());
      if (extra) baseApi.useSecondWind();
      setHub(null);
      setRaid(r);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  // ---- selection popup -----------------------------------------------------------------
  const selected = objects.find((o) => o.uid === selectedUid);
  const popup = (() => {
    if (placing) {
      const item = ITEM_BY_ID[placing.itemId];
      return {
        uid: "__placing",
        lift: 18,
        node: (
          <div className="hud-panel flex items-center gap-2 p-1.5">
            <button className="hud-round !bg-[#2f9445]" onClick={confirmPlacing} disabled={!placingValid} title="Place here" aria-label="Confirm placement"><Check size={20} /></button>
            <div className="px-1 text-center leading-tight">
              <div className="font-display text-[12.5px] font-semibold">{item.name}</div>
              <div className="text-[11px] text-[#cfe6e6] flex items-center gap-1 justify-center"><GameIcon name="gem" size={12} />{item.cost}{!placingValid && <span className="text-[#ff9c8c]"> · blocked</span>}</div>
            </div>
            <button className="hud-round !bg-[#b0402f]" onClick={() => setPlacing(null)} title="Cancel" aria-label="Cancel placement"><X size={20} /></button>
          </div>
        ),
      };
    }
    if (!selected) return null;
    const d = selected.kind === "castle" ? defense.castle : defense.buildings.find((b) => b.uid === selected.uid);
    const item = selected.kind === "shop" ? ITEM_BY_ID[selected.itemId] : null;
    const title = selected.kind === "castle" ? "Main Castle" : selected.kind === "subject" ? selected.name : item.name;
    const sub =
      selected.kind === "castle" ? `Level ${base.castleLevel} · HP ${d.hp} · armor ${d.armor}/${defense.armorCap}` :
      selected.kind === "subject" ? `Lv ${selected.level} · ${selected.status} · HP ${d.hp} · armor ${d.armor}/${defense.armorCap}` :
      item.protection ? `+${item.protection} armor to what it guards` : item.wardBonus ? `+${item.wardBonus} ward capacity` : "Decoration";
    return {
      uid: selected.uid,
      node: (
        <div className="hud-panel px-3 py-2 min-w-[210px] text-center">
          <div className="font-game text-[19px] hud-outline leading-tight">{title}</div>
          <div className="text-[11.5px] text-[#cfe6e6] mt-0.5">{sub}</div>
          <div className="flex gap-2 mt-2 justify-center">
            {selected.kind === "subject" && <Btn tone="green" onClick={() => onOpenSubject(selected.ref)}>Study</Btn>}
            {selected.kind === "castle" && baseApi.castleUpgradeCost != null && (
              <Btn tone="green" disabled={gems < baseApi.castleUpgradeCost} onClick={upgradeCastle} title={gems < baseApi.castleUpgradeCost ? `Need ${baseApi.castleUpgradeCost} gems` : ""}>
                Upgrade · {baseApi.castleUpgradeCost}💎
              </Btn>
            )}
            <Btn onClick={() => setEdit(true)}>Move</Btn>
            {selected.kind === "shop" && <Btn tone="red" onClick={() => sell(selected.uid)}>Sell +{Math.floor(item.cost * SELL_REFUND)}</Btn>}
          </div>
        </div>
      ),
    };
  })();

  // ---- HUD -------------------------------------------------------------------------------
  const overlay = (
    <div className="absolute inset-0 z-20 pointer-events-none" data-no-stage>
      <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 flex items-start justify-between gap-2 sm:gap-3 flex-wrap">
        <div className="pointer-events-auto flex flex-col gap-1.5 sm:gap-2 items-start">
          <button className="hud-panel flex items-center gap-2 pl-2 pr-4 py-1.5 text-left" onClick={() => setHub("clan")}>
            <GameIcon name="crest" size={32} />
            <span className="leading-tight">
              <span className="block font-game text-[15px] sm:text-[18px] hud-outline">{player.name}</span>
              <span className="hidden sm:block text-[11px] text-[#cfe6e6]">{incoming ? "Ready for war" : online === false ? "Offline — start the server for wars" : "Connecting…"}</span>
            </span>
          </button>
          <div className="hud-panel px-2.5 sm:px-3 py-0.5 sm:py-1 text-[11px] sm:text-[12px] flex items-center gap-2 sm:gap-3">
            <span title="Total HP + armor of your castle and subject buildings">🛡️ Defense <b className="font-game text-[15px]">{defense.rating}</b></span>
            <span title="Fill it by answering fortify questions">✨ Ward <b className="font-game text-[15px]">{incoming ? incoming.ward : 0}/{defense.wardCap}</b></span>
          </div>
        </div>
        <div className="pointer-events-auto"><ResourcePills points={points} gems={gems} streak={streak} onGems={() => setShop(true)} /></div>
      </div>

      {underAttack && (
        <div className="absolute top-[118px] sm:top-[88px] left-1/2 -translate-x-1/2 pointer-events-auto w-max max-w-[94vw]">
          <div className="hud-panel raid-alert !border-[#ff8a73] flex items-center gap-3 px-4 py-2">
            <Swords size={22} className="text-[#ff8a73]" />
            <div className="leading-tight text-sm">
              <div className="font-game text-[17px] hud-outline">{underAttack.attackerName} is raiding your base!</div>
              <div className="text-[12px] text-[#cfe6e6]">Question {underAttack.index}/{underAttack.total} · castle {underAttack.castleHp}/{underAttack.castleMax}. Answer to add ward.</div>
            </div>
            <Btn tone="red" onClick={() => setFortify(true)}>Defend!</Btn>
          </div>
        </div>
      )}

      {edit && !placing && (
        <div className="absolute top-[118px] sm:top-[88px] left-1/2 -translate-x-1/2 pointer-events-auto w-max max-w-[94vw] hud-panel px-4 py-2 text-sm flex items-center gap-3">
          <span><b className="font-game text-base">Edit mode</b> — drag anything to rearrange. It snaps to the grid.</span>
          <Btn tone="green" onClick={() => setEdit(false)}>Done</Btn>
        </div>
      )}
      {placing && (
        <div className="absolute top-[118px] sm:top-[88px] left-1/2 -translate-x-1/2 pointer-events-auto w-max max-w-[94vw] hud-panel px-4 py-2 text-sm">
          Drag to position, then tap <b>✓</b>. {ITEM_BY_ID[placing.itemId].category === "walls" && "Walls keep coming until you cancel."}
        </div>
      )}

      <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-end gap-2 sm:gap-3 px-3 overflow-x-auto max-w-full pb-1 pt-3">
          <DockButton icon={<ShoppingBag size={26} />} label="Shop" onClick={() => setShop(true)} />
          <DockButton icon={<Plus size={28} />} label="Add subject" short="Add" onClick={onAddSubject} />
          <DockButton icon={<Pencil size={24} />} label={edit ? "Done" : "Edit base"} short={edit ? "Done" : "Edit"} active={edit} onClick={() => { setPlacing(null); setEdit((e) => !e); setSelectedUid(null); }} />
          <DockButton icon={<Shield size={26} />} label="Fortify" onClick={() => setFortify(true)} />
          <DockButton icon={<Users size={26} />} label="Clan" onClick={() => setHub("clan")} />
          <DockButton icon={<Swords size={28} />} label="War" tone="war" badge={underAttack ? "!" : null} onClick={() => setHub("war")} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#8fd3f8]">
      <IsoStage
        gw={GRID}
        gh={GRID}
        items={items}
        selectedUid={placing ? "__placing" : selectedUid}
        onSelect={(uid) => { if (!placing) setSelectedUid(uid); }}
        showGrid={edit || !!placing}
        showFootprints={edit && !placing}
        movable={(uid) => (placing ? uid === "__placing" : edit)}
        canDrop={canDrop}
        onMove={onMove}
        popup={popup}
        overlay={overlay}
        fitKey={`base-${subjects.length}`}
        fitInsets={{ top: 130, bottom: 130, left: 70, right: 20 }}
      />

      <AnimatePresence>
        {shop && (
          <ShopModal
            gems={gems}
            castleLevel={base.castleLevel}
            castleUpgradeCost={baseApi.castleUpgradeCost}
            defense={defense}
            inventory={base.inventory}
            shieldUntil={base.shieldUntil}
            onBuyPlaceable={(id) => beginPlacing(id)}
            onBuyBoost={buyBoost}
            onUpgradeCastle={upgradeCastle}
            onClose={() => setShop(false)}
          />
        )}
        {hub && (
          <WarHub
            key="hub"
            tab={hub}
            setTab={setHub}
            player={player}
            setPlayer={setPlayer}
            online={online}
            incoming={incoming}
            attackBusy={busy}
            secondWind={base.inventory.secondWind}
            onAttack={attack}
            onFortify={() => { setHub(null); setFortify(true); }}
            onClose={() => setHub(null)}
            toast={toast}
          />
        )}
      </AnimatePresence>

      {raid && (
        <RaidScreen
          raid={raid}
          player={player}
          onFinish={(res) => {
            if (res?.rewards) {
              addPoints(res.rewards.points);
              addGems(res.rewards.gems);
            }
            setRaid(null);
          }}
        />
      )}
      <AnimatePresence>
        {fortify && <FortifyModal player={player} getSnapshot={getSnapshot} onClose={() => setFortify(false)} />}
      </AnimatePresence>
    </div>
  );
}
