import React from "react";
import { motion } from "framer-motion";
import { Flame, X } from "lucide-react";
import { TrimmedImg } from "../../game/sprites";
import { ART } from "../../game/assets";

export function GameIcon({ name, size = 22, className, style }) {
  return <TrimmedImg src={ART.icons[name]} height={size} className={className} style={style} />;
}

export function Chip({ icon, label, value, hint, onClick, plus }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="hud-panel flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-2 sm:pr-3 py-0.5 sm:py-1 sm:min-w-[92px] text-left" title={hint}>
      <span className="grid place-items-center w-7 h-7 shrink-0">{icon}</span>
      <span className="leading-none">
        <span className="hidden sm:block text-[10px] text-[#bfe3e6] font-sans font-semibold">{label}</span>
        <span className="block font-game text-[16px] sm:text-[19px] hud-outline tabular-nums">{value}</span>
      </span>
      {plus && <span className="ml-1 grid place-items-center w-5 h-5 rounded-full bg-[#48b45a] border border-[#1c5e2c] text-xs font-game">+</span>}
    </Tag>
  );
}

export function ResourcePills({ points, gems, streak, onGems }) {
  return (
    <div className="flex justify-end gap-1.5 sm:gap-2">
      <Chip icon={<GameIcon name="star" size={24} />} label="Study Points" value={points} hint="Earned from quizzes and written answers" />
      <Chip icon={<GameIcon name="gem" size={26} />} label="Focus Gems" value={gems} hint="Spend in the shop" onClick={onGems} plus={!!onGems} />
      <Chip icon={<Flame size={22} className="text-[#ff8a4c]" fill="#ff8a4c" />} label="Streak" value={`${streak}d`} hint="Study on consecutive days for bonus gems" />
    </div>
  );
}

export function DockButton({ icon, label, short, onClick, badge, tone, active, disabled }) {
  return (
    <button className="dock-btn" onClick={onClick} data-tone={tone} data-active={active ? "true" : undefined} disabled={disabled}>
      {badge ? <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 grid place-items-center rounded-full bg-[#e5493a] border-2 border-white font-game text-xs raid-alert">{badge}</span> : null}
      <span className="h-8 grid place-items-center">{icon}</span>
      <span className="font-game text-[12px] sm:text-[14px] hud-outline whitespace-nowrap">{short ? <><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span></> : label}</span>
    </button>
  );
}

/** Small nameplate that sits under a building. Kept tiny so the art stays the star. */
export function Nameplate({ name, sub, warn, progress }) {
  return (
    <div className="plate" data-warn={warn ? "true" : undefined}>
      <span className="font-display font-semibold text-[13px] max-w-[190px] truncate">{name}</span>
      {sub && <span className="text-[11px] text-[#cfe6e6]">{sub}</span>}
      {progress != null && (
        <span className="mt-0.5 block w-full h-[5px] rounded-full bg-black/40 overflow-hidden">
          <span className="block h-full rounded-full bg-[#7be08a]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      )}
    </div>
  );
}

export function HpBar({ value, max, armor = 0, armorMax = 0, width = 96, danger }) {
  const pct = max ? Math.max(0, Math.min(1, value / max)) : 0;
  const apct = armorMax ? Math.max(0, Math.min(1, armor / armorMax)) : 0;
  return (
    <div style={{ width }} className="rounded-full bg-black/55 border border-black/60 p-[2px]">
      <div className="h-[8px] rounded-full bg-black/40 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct * 100}%`, background: pct > 0.5 ? "#6fdc7a" : pct > 0.25 ? "#f2c85c" : "#ef5a48" }} />
      </div>
      {armorMax > 0 && (
        <div className="h-[4px] mt-[2px] rounded-full bg-black/40 overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${apct * 100}%`, background: "#8fb4d8" }} />
        </div>
      )}
    </div>
  );
}

export function GameModal({ title, subtitle, onClose, children, wide = false, footer, tabs }) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-[#06181c]/60 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className={`parch relative w-full ${wide ? "sm:max-w-4xl" : "sm:max-w-2xl"} max-h-[92vh] sm:max-h-[86vh] flex flex-col rounded-b-none sm:rounded-b-[18px]`}
      >
        <div className="relative shrink-0 px-5 pt-3 pb-3 text-white rounded-t-[14px] bg-gradient-to-b from-night-light to-night border-b-[3px] border-gold flex items-center gap-3">
          <GameIcon name="crest" size={38} />
          <div className="min-w-0 flex-1 leading-tight">
            <h2 className="font-game text-[24px] hud-outline truncate">{title}</h2>
            {subtitle && <p className="text-[12px] text-[#cfe6e6]">{subtitle}</p>}
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-full bg-[#d5563f] border-2 border-[#f6e4a8] text-white shadow hover:brightness-110">
              <X size={18} />
            </button>
          )}
        </div>
        {tabs && <div className="shrink-0 px-4 pt-3 flex gap-1.5 flex-wrap">{tabs}</div>}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 px-5 py-3 border-t-2 border-[#dcc58d] bg-[#efe1bc] rounded-b-[14px]">{footer}</div>}
      </motion.div>
    </motion.div>
  );
}

export function TabButton({ active, children, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative font-game text-[15px] px-4 py-1.5 rounded-t-xl rounded-b-md border-2 transition-colors ${active ? "bg-night text-gold-soft border-night" : "bg-[#efe1bc] text-parch-ink border-[#dcc58d] hover:bg-[#f7ecd0]"}`}
    >
      {children}
      {badge ? <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-[#e5493a] text-white text-[10px] font-sans font-bold">{badge}</span> : null}
    </button>
  );
}
