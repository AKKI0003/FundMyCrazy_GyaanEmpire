import React from "react";
import { cn } from "../lib/utils";

const TIER_IMAGES = [
  "/game-art/building-tent.png",
  "/game-art/building-tent.png",
  "/game-art/building-library.png",
  "/game-art/building-library.png",
  "/game-art/building-tower.png",
  "/game-art/building-tower.png",
  "/game-art/building-castle.png",
  "/game-art/building-castle.png",
];

const TIER_COLORS = [
  { bg: "#8a5a3b", text: "#fff" },
  { bg: "#5c6b78", text: "#fff" },
  { bg: "#5b3f8f", text: "#fff" },
  { bg: "#c7922b", text: "#fff" },
];

// Grounded building sprite: sits directly on the isometric tile the board
// gives it (a drop shadow anchors it to the ground), instead of floating on
// its own island. The board owns terrain/ground now; this component only
// owns the building art and its level-up feedback.
export function Building({ level, justLeveledUp, readyToUpgrade }) {
  const idx = Math.min(Math.max(level, 1), 8) - 1;
  const src = TIER_IMAGES[idx];
  const tierColor = TIER_COLORS[Math.floor(idx / 2)];

  const scale = 0.62 + (level - 1) * 0.06;
  const saturate = 0.6 + level * 0.06;
  const brightness = 0.92 + level * 0.012;
  const isGlowing = level >= 7;

  return (
    <div className="relative w-full h-full flex items-end justify-center">
      {/* Ground contact shadow — this is what "grounds" the sprite onto the
          tile beneath it instead of reading as cut-and-pasted. */}
      <div
        className="absolute bottom-[6%] rounded-[50%] bg-black/25 blur-[2px]"
        style={{ width: "56%", height: "14%" }}
      />

      {isGlowing && (
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-60"
          style={{ background: "radial-gradient(circle, #ffd97a 0%, transparent 70%)" }}
        />
      )}

      {readyToUpgrade && !justLeveledUp && (
        <div className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-amber flex items-center justify-center text-[10px] font-bold text-white animate-pulse shadow">
          !
        </div>
      )}

      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          transform: `scale(${scale})`,
          filter: `saturate(${saturate}) brightness(${brightness}) drop-shadow(0 3px 2px rgba(0,0,0,0.25)) ${
            isGlowing ? "drop-shadow(0 0 6px #ffd97a)" : ""
          }`,
        }}
        className={cn(
          "relative w-[92%] h-[92%] object-contain object-bottom select-none pointer-events-none transition-transform duration-200 z-20",
          justLeveledUp && "animate-[buildingPop_0.6s_ease-out]"
        )}
      />

      {level >= 7 && (
        <>
          <span className="absolute top-1 left-2 text-[11px] animate-pulse z-20">✨</span>
          <span className="absolute top-3 right-3 text-[9px] animate-pulse z-20" style={{ animationDelay: "0.3s" }}>
            ✨
          </span>
        </>
      )}

      <div
        className="absolute -bottom-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow z-20"
        style={{ backgroundColor: tierColor.bg, color: tierColor.text }}
      >
        Lv {level}
      </div>

      {justLeveledUp && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-10 h-10 rounded-full border-4 border-amber animate-[ringPulse_0.6s_ease-out]" />
        </div>
      )}
    </div>
  );
}
