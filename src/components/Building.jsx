import React from "react";
import { cn } from "../lib/utils";

// Four real tiers of Gemini-generated art, mapped across the existing 8
// levels (levelFromXP in lib/utils.js already caps at 8) the same way the
// old placeholder TIERS array duplicated its last couple of entries —
// levels 1-2 share the humblest building, 7-8 share the grandest one.
const TIER_IMAGES = [
  "/game-art/building-tent.png",    // levels 1-2
  "/game-art/building-tent.png",
  "/game-art/building-library.png", // levels 3-4
  "/game-art/building-library.png",
  "/game-art/building-tower.png",   // levels 5-6
  "/game-art/building-tower.png",
  "/game-art/building-castle.png",  // levels 7-8
  "/game-art/building-castle.png",
];

export function Building({ level, justLeveledUp }) {
  const src = TIER_IMAGES[Math.min(Math.max(level, 1), TIER_IMAGES.length) - 1];

  return (
    <div className="relative w-full h-full flex items-end justify-center">
      {/* platform / shadow so the building doesn't look like it's floating */}
      <div
        className="absolute bottom-0 w-[78%] h-[22%] rounded-[50%] bg-[#3f7a45]/70"
        style={{ boxShadow: "0 6px 10px rgba(0,0,0,0.18)" }}
      />
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn(
          "relative w-[88%] h-[88%] object-contain object-bottom select-none pointer-events-none",
          justLeveledUp && "animate-[buildingPop_0.6s_ease-out]"
        )}
      />
      {justLeveledUp && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full border-4 border-amber animate-[ringPulse_0.6s_ease-out]" />
        </div>
      )}
    </div>
  );
}
