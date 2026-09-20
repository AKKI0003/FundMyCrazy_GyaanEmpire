import React, { useState } from "react";
import { Shield, Wind, Swords } from "lucide-react";
import { GameModal, TabButton, GameIcon } from "./game/Hud";
import { PlaceholderSprite, placeholderBounds } from "./game/Placeholder";
import { TrimmedImg } from "../game/sprites";
import { itemArt } from "../game/assets";
import { CATEGORIES, SHOP_ITEMS } from "../../shared/catalog";
import { CASTLE_MAX_LEVEL, castleHp, armorCap, wardCap } from "../../shared/baseRules";

function Thumb({ item, size = 84 }) {
  const art = itemArt(item.id);
  if (art) return <TrimmedImg src={art.src} height={size} />;
  if (item.boost) return <span style={{ fontSize: size * 0.6 }} className="leading-none">{item.glyph}</span>;
  const [w, h] = item.size;
  const b = placeholderBounds(w, h, item.h);
  const vw = b.right - b.left + 16, vh = b.bottom - b.top + 16;
  return (
    <svg viewBox={`${b.left - 8} ${b.top - 8} ${vw} ${vh}`} width={size} height={(size * vh) / vw} style={{ maxHeight: size }}>
      <PlaceholderSprite w={w} h={h} tone={item.tone} glyph={item.glyph} boxH={item.h} />
    </svg>
  );
}

function Price({ cost }) {
  return (
    <span className="inline-flex items-center gap-1">
      <GameIcon name="gem" size={16} />
      <span>{cost}</span>
    </span>
  );
}

function ItemCard({ item, gems, onBuy }) {
  const afford = gems >= item.cost;
  const [w, h] = item.size;
  return (
    <div className="parch-card p-3 flex flex-col items-center text-center">
      <div className="h-[92px] w-full grid place-items-center"><Thumb item={item} /></div>
      <div className="font-display font-semibold text-[13.5px] leading-tight mt-1">{item.name}</div>
      <div className="text-[11.5px] text-[#6b5630] mt-0.5 min-h-[30px]">
        {item.protection > 0 && <div>+{item.protection} armor · reaches {item.guardRadius === 0 ? "touching" : `${item.guardRadius} tile${item.guardRadius > 1 ? "s" : ""}`}</div>}
        {item.wardBonus && <div>+{item.wardBonus} ward capacity</div>}
        {!item.protection && !item.wardBonus && <div>Decoration</div>}
        <div className="opacity-75">{w}×{h} tile{w * h > 1 ? "s" : ""}</div>
      </div>
      <button className="btn-gold btn-green mt-2 w-full text-[15px]" disabled={!afford} onClick={() => onBuy(item.id)} title={afford ? "" : `Need ${item.cost - gems} more gems`}>
        {afford ? <Price cost={item.cost} /> : <span className="text-[13px]">Need {item.cost - gems} more</span>}
      </button>
    </div>
  );
}

function CastleCard({ level, cost, gems, onUpgrade }) {
  const maxed = level >= CASTLE_MAX_LEVEL;
  const n = level + 1;
  return (
    <div className="parch-card p-4 flex gap-4 items-center sm:col-span-2">
      <span className="text-5xl leading-none">🏰</span>
      <div className="flex-1">
        <div className="font-display font-semibold">Castle Upgrade <span className="text-[#6b5630] font-normal text-sm">Level {level}{!maxed && ` → ${n}`}</span></div>
        {maxed ? (
          <p className="text-sm text-[#6b5630]">Your castle is at max level.</p>
        ) : (
          <p className="text-[12.5px] text-[#6b5630] mt-0.5">
            Castle HP {castleHp(level)} → <b>{castleHp(n)}</b> · armor cap {armorCap(level)} → <b>{armorCap(n)}</b> · ward capacity {wardCap(level)} → <b>{wardCap(n)}</b>
          </p>
        )}
      </div>
      {!maxed && (
        <button className="btn-gold btn-green shrink-0" disabled={gems < cost} onClick={onUpgrade}>
          {gems >= cost ? <Price cost={cost} /> : <span className="text-[13px]">Need {cost - gems} more</span>}
        </button>
      )}
    </div>
  );
}

export function ShopModal({ gems, castleLevel, castleUpgradeCost, defense, inventory, shieldUntil, onBuyPlaceable, onBuyBoost, onUpgradeCastle, onClose }) {
  const [cat, setCat] = useState("walls");
  const shieldLeftH = Math.max(0, (shieldUntil - Date.now()) / 3600e3);
  const category = CATEGORIES.find((c) => c.id === cat);
  const items = SHOP_ITEMS.filter((i) => i.category === cat && !(cat === "boosts" && i.boost === "castle"));

  return (
    <GameModal
      title="Shop"
      subtitle="Spend Focus Gems to fortify your base. All names and art here are placeholders."
      onClose={onClose}
      wide
      tabs={CATEGORIES.map((c) => (
        <TabButton key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</TabButton>
      ))}
      footer={
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 font-game text-lg"><GameIcon name="gem" size={22} /> {gems}</span>
          <span className="text-[#6b5630]">Base defense <b className="text-parch-ink">{defense.rating}</b> · armor cap <b className="text-parch-ink">{defense.armorCap}</b> per building · ward capacity <b className="text-parch-ink">{defense.wardCap}</b></span>
        </div>
      }
    >
      <p className="text-[13px] text-[#6b5630] mb-3">{category.blurb}</p>
      {cat === "walls" && (
        <p className="text-[12.5px] mb-3 px-3 py-2 rounded-lg bg-[#efe1bc] border border-[#dcc58d]">
          Walls protect every building they touch (or sit one tile away from). Ring your subjects and your castle — higher tiers pack more armor into each tile.
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cat === "boosts" && <CastleCard level={castleLevel} cost={castleUpgradeCost} gems={gems} onUpgrade={onUpgradeCastle} />}
        {items.map((it) =>
          it.boost ? (
            <div key={it.id} className="parch-card p-3 flex flex-col items-center text-center">
              <div className="h-[70px] grid place-items-center text-5xl">{it.boost === "shield" ? <Shield size={48} className="text-[#3b7a9c]" /> : it.boost === "secondWind" ? <Wind size={48} className="text-[#3b7a9c]" /> : <Swords size={48} />}</div>
              <div className="font-display font-semibold text-[13.5px] mt-1">{it.name}</div>
              <div className="text-[11.5px] text-[#6b5630] mt-0.5 min-h-[44px]">
                {it.blurb}
                {it.boost === "shield" && shieldLeftH > 0 && <div className="text-[#2f7f4a] font-semibold">Active · {shieldLeftH.toFixed(1)}h left</div>}
                {it.boost === "secondWind" && <div>Owned: {inventory.secondWind}</div>}
              </div>
              <button className="btn-gold btn-green mt-2 w-full" disabled={gems < it.cost} onClick={() => onBuyBoost(it.id)}>
                {gems >= it.cost ? <Price cost={it.cost} /> : <span className="text-[13px]">Need {it.cost - gems} more</span>}
              </button>
            </div>
          ) : (
            <ItemCard key={it.id} item={it} gems={gems} onBuy={onBuyPlaceable} />
          )
        )}
      </div>
    </GameModal>
  );
}
