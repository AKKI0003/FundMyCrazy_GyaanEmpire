// shared/catalog.js
//
// The shop catalogue. Pure data, imported by BOTH the React client and the
// Express server (the server needs protection values to compute how strong a
// base is when someone raids it).
//
// ALL NAMES / COSTS / NUMBERS HERE ARE PLACEHOLDERS. Art is wired separately in
// src/game/assets.js (by item id) — until an item has art there, the client
// draws a generic isometric placeholder block for it.
//
//   size          [w, h] footprint in grid tiles
//   protection    armor this piece adds to every building it "guards"
//   guardRadius   how far (in empty tiles between footprints) that armor reaches.
//                 0 = only touching, 1 = touching or one tile gap, ...
//   wardBonus     extra ward capacity (ward = the shield you fill by answering
//                 fortify questions)
//   tone / glyph  placeholder colour + emoji used until real art exists
//   h             placeholder block height in px (world space)

export const CATEGORIES = [
  { id: "walls", label: "Walls", blurb: "Ring your buildings. Higher tiers give more protection per tile." },
  { id: "defenses", label: "Defenses", blurb: "Guard everything around them." },
  { id: "decor", label: "Decor", blurb: "No protection — just make the base yours." },
  { id: "boosts", label: "Boosts", blurb: "Upgrades and one-off help." },
];

export const SHOP_ITEMS = [
  // ---- Walls -------------------------------------------------------------
  { id: "wall_wood", name: "Wooden Palisade", category: "walls", cost: 1, size: [1, 1], protection: 4, guardRadius: 1, tone: "wood", glyph: "🪵", h: 22 },
  { id: "wall_stone", name: "Stone Wall", category: "walls", cost: 2, size: [1, 1], protection: 10, guardRadius: 1, tone: "stone", glyph: "🧱", h: 28 },
  { id: "wall_iron", name: "Iron Rampart", category: "walls", cost: 4, size: [1, 1], protection: 20, guardRadius: 1, tone: "iron", glyph: "⛓️", h: 34 },
  { id: "wall_crystal", name: "Crystal Barrier", category: "walls", cost: 8, size: [1, 1], protection: 38, guardRadius: 1, tone: "crystal", glyph: "💠", h: 40 },
  { id: "wall_runic", name: "Runic Ward-Wall", category: "walls", cost: 15, size: [1, 1], protection: 65, guardRadius: 1, tone: "runic", glyph: "🔮", h: 46 },

  // ---- Defenses ----------------------------------------------------------
  { id: "tower_watch", name: "Watchtower", category: "defenses", cost: 10, size: [2, 2], protection: 24, guardRadius: 3, tone: "stone", glyph: "🗼", h: 92 },
  { id: "tower_archive", name: "Archive Vault", category: "defenses", cost: 14, size: [2, 2], protection: 16, guardRadius: 5, tone: "iron", glyph: "📚", h: 64 },
  { id: "statue_guardian", name: "Guardian Statue", category: "defenses", cost: 18, size: [2, 2], protection: 40, guardRadius: 2, tone: "runic", glyph: "🗿", h: 84 },
  { id: "ward_totem", name: "Ward Totem", category: "defenses", cost: 6, size: [1, 1], protection: 0, guardRadius: 0, wardBonus: 12, tone: "crystal", glyph: "🔱", h: 54 },
  { id: "moat", name: "Moat Segment", category: "defenses", cost: 2, size: [1, 1], protection: 8, guardRadius: 1, tone: "water", glyph: "🌊", h: 6 },

  // ---- Decor -------------------------------------------------------------
  { id: "decor_oak", name: "Oak Tree", category: "decor", cost: 1, size: [1, 1], protection: 0, tone: "leaf", glyph: "🌳", h: 60 },
  { id: "decor_pine", name: "Pine Tree", category: "decor", cost: 1, size: [1, 1], protection: 0, tone: "leaf", glyph: "🌲", h: 66 },
  { id: "decor_flowers", name: "Flower Bed", category: "decor", cost: 1, size: [1, 1], protection: 0, tone: "bloom", glyph: "🌼", h: 8 },
  { id: "decor_hedge", name: "Garden Hedge", category: "decor", cost: 1, size: [1, 1], protection: 0, tone: "leaf", glyph: "🌿", h: 22 },
  { id: "decor_bench", name: "Study Bench", category: "decor", cost: 1, size: [1, 1], protection: 0, tone: "wood", glyph: "🪑", h: 18 },
  { id: "decor_lantern", name: "Lantern Post", category: "decor", cost: 2, size: [1, 1], protection: 0, tone: "gold", glyph: "🏮", h: 46 },
  { id: "decor_banner", name: "Clan Banner", category: "decor", cost: 2, size: [1, 1], protection: 0, tone: "crimson", glyph: "🚩", h: 60 },
  { id: "decor_campfire", name: "Campfire", category: "decor", cost: 2, size: [1, 1], protection: 0, tone: "ember", glyph: "🔥", h: 14 },
  { id: "decor_pond", name: "Lily Pond", category: "decor", cost: 4, size: [2, 2], protection: 0, tone: "water", glyph: "🪷", h: 5 },
  { id: "decor_fountain", name: "Scholar's Fountain", category: "decor", cost: 6, size: [2, 2], protection: 0, tone: "stone", glyph: "⛲", h: 58 },
  { id: "decor_statue", name: "Founder Statue", category: "decor", cost: 8, size: [2, 2], protection: 0, tone: "stone", glyph: "🗽", h: 88 },
  { id: "decor_garden", name: "Hedge Maze", category: "decor", cost: 15, size: [3, 3], protection: 0, tone: "leaf", glyph: "🌀", h: 34 },

  // ---- Boosts (not placed on the map) -------------------------------------
  { id: "boost_castle", name: "Castle Upgrade", category: "boosts", boost: "castle", cost: 0, size: [0, 0], glyph: "🏰", blurb: "More castle HP, higher armor cap and a bigger ward. Cost rises each level." },
  { id: "boost_shield", name: "Peace Shield (12h)", category: "boosts", boost: "shield", cost: 10, size: [0, 0], glyph: "🛡️", hours: 12, blurb: "Nobody can raid you for 12 hours. Studying is still allowed." },
  { id: "boost_secondwind", name: "Second Wind", category: "boosts", boost: "secondWind", cost: 3, size: [0, 0], glyph: "💨", blurb: "One extra allowed miss in your next raid." },
];

export const ITEM_BY_ID = Object.fromEntries(SHOP_ITEMS.map((i) => [i.id, i]));

export function isPlaceable(item) {
  return !!item && !item.boost;
}
