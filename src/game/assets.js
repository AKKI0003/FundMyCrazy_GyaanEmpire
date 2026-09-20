// src/game/assets.js
//
// ONE PLACE to wire art into the game. Everything is looked up through here, so
// swapping placeholder art for real art means editing this file and dropping
// PNGs in public/game-art/ — no component changes.
//
//   src     path under /public (transparent PNG; padding is auto-trimmed at
//           runtime, so you don't need to crop it)
//   height  how tall the sprite is drawn, in world px at zoom 1. One tile is
//           96 x 48 world px, so a 3x3 building footprint is 288 wide. Width
//           follows the art's aspect ratio.
//   ground  (optional) how far down the footprint the sprite's feet sit,
//           0 = center of the footprint, 1 = its front corner. Default 0.55.

export const ART = {
  sky: "/game-art/sky-background.png",
  icons: {
    gem: "/game-art/gem-icon.png",
    star: "/game-art/star-icon.png",
    lock: "/game-art/lock-badge.png",
    crest: "/game-art/crest.png",
  },
  frames: {
    corner: "/game-art/corner-frame.png",
    divider: "/game-art/divider.png",
  },

  // The Main Castle (4x4). PLACEHOLDER art — reuses the gold castle sprite.
  // To give it its own art per level, add `{ src, height }` entries to `levels`
  // (index 0 = level 1). Missing levels fall back to `default`.
  castle: {
    default: { src: "/game-art/building-castle.png", height: 480 },
    levels: [],
  },

  // Subject buildings (3x3). The highest entry whose minLevel <= the
  // building's level wins. Same list is used for topics on a subject board.
  subjectTiers: [
    { minLevel: 1, src: "/game-art/building-tent.png", height: 175 },
    { minLevel: 3, src: "/game-art/building-library.png", height: 260 },
    { minLevel: 6, src: "/game-art/building-tower.png", height: 350 },
  ],
};

// Shop items by id -> { src, height, ground? }. Empty = every item is drawn as a
// colour-coded placeholder block (see components/game/Placeholder.jsx).
// Example once you have art:
//   wall_stone: { src: "/game-art/wall-stone.png", height: 60 },
export const ITEM_ART = {};

export function castleArt(level) {
  return ART.castle.levels[level - 1] || ART.castle.default;
}

export function subjectArt(level) {
  let pick = ART.subjectTiers[0];
  for (const t of ART.subjectTiers) if (level >= t.minLevel) pick = t;
  return pick;
}

export function itemArt(itemId) {
  return ITEM_ART[itemId] || null;
}
