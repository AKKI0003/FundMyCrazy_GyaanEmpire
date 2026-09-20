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

  // The Main Castle (4x4). Levels 1-5, generated from ART_PROMPTS.md's
  // castle set (L5 replaces the old reused gold-castle placeholder).
  castle: {
    default: { src: "/game-art/building-castle.png", height: 480 },
    levels: [
      { src: "/game-art/castle/castle-l1.png", height: 320 },
      { src: "/game-art/castle/castle-l2.png", height: 355 },
      { src: "/game-art/castle/castle-l3.png", height: 395 },
      { src: "/game-art/castle/castle-l4.png", height: 445 },
      { src: "/game-art/castle/castle-l5.png", height: 480 },
    ],
  },

  // Custom UI icons (transparent PNGs). Leave a key out and the app keeps
  // its current emoji / Lucide icon.
  ui: {
    shop: "/game-art/ui/shop.png",
    addSubject: "/game-art/ui/add-subject.png",
    editBase: "/game-art/ui/edit-base.png",
    fortify: "/game-art/ui/fortify.png",
    clan: "/game-art/ui/clan.png",
    war: "/game-art/ui/war.png",
    defense: "/game-art/ui/defense.png",
    ward: "/game-art/ui/ward.png",
    streak: "/game-art/ui/streak.png",
  },

  // Subject buildings (3x3), "classic" family. The highest entry whose
  // minLevel <= the building's level wins. Same list is used for topics on
  // a subject board.
  subjectTiers: [
    { minLevel: 1, src: "/game-art/building-tent.png", height: 175 },
    { minLevel: 3, src: "/game-art/building-library.png", height: 260 },
    { minLevel: 6, src: "/game-art/building-tower.png", height: 350 },
  ],
};

// Shop items by id -> { src, height, ground? }. Any id left out is drawn as a
// colour-coded placeholder block (see components/game/Placeholder.jsx).
export const ITEM_ART = {
  wall_wood: { src: "/game-art/walls/wall-wood.png", height: 74, ground: 1 },
  wall_stone: { src: "/game-art/walls/wall-stone.png", height: 80, ground: 1 },
  wall_iron: { src: "/game-art/walls/wall-iron.png", height: 86, ground: 1 },
  wall_crystal: { src: "/game-art/walls/wall-crystal.png", height: 96, ground: 1 },
  wall_runic: { src: "/game-art/walls/wall-runic.png", height: 108, ground: 1 },
  tower_watch: { src: "/game-art/defenses/tower-watch.png", height: 260, ground: 0.75 },
  tower_archive: { src: "/game-art/defenses/tower-archive.png", height: 150, ground: 0.85 },
  statue_guardian: { src: "/game-art/defenses/statue-guardian.png", height: 250, ground: 0.75 },
  ward_totem: { src: "/game-art/defenses/ward-totem.png", height: 120, ground: 0.6 },
  moat: { src: "/game-art/defenses/moat.png", height: 52, ground: 1 },
  decor_oak: { src: "/game-art/decor/oak.png", height: 110, ground: 0.6 },
  decor_pine: { src: "/game-art/decor/pine.png", height: 130, ground: 0.6 },
  decor_flowers: { src: "/game-art/decor/flowers.png", height: 52, ground: 1 },
  decor_hedge: { src: "/game-art/decor/hedge.png", height: 70, ground: 1 },
  decor_bench: { src: "/game-art/decor/bench.png", height: 50, ground: 0.8 },
  decor_lantern: { src: "/game-art/decor/lantern.png", height: 110, ground: 0.5 },
  decor_banner: { src: "/game-art/decor/banner.png", height: 135, ground: 0.5 },
  decor_campfire: { src: "/game-art/decor/campfire.png", height: 60, ground: 0.7 },
  decor_pond: { src: "/game-art/decor/pond.png", height: 96, ground: 1 },
  decor_fountain: { src: "/game-art/decor/fountain.png", height: 150, ground: 0.8 },
  decor_statue: { src: "/game-art/decor/statue.png", height: 240, ground: 0.75 },
  // decor_garden (Hedge Maze) has no generated art yet — still a placeholder block.
  boost_castle: { src: "/game-art/ui/boost-castle.png", height: 64 },
  boost_shield: { src: "/game-art/ui/boost-shield.png", height: 64 },
  boost_secondwind: { src: "/game-art/ui/boost-secondwind.png", height: 64 },
};

export function castleArt(level) {
  return ART.castle.levels[level - 1] || ART.castle.default;
}

// BUILDING FAMILIES — this is what stops every topic looking identical.
// "classic" is the original camp -> library -> tower. Five more families
// generated from ART_PROMPTS.md now give six kinds of building with no
// repeats until the seventh topic.
export const BUILDING_FAMILIES = [
  { id: "classic", tiers: ART.subjectTiers },
  { id: "observatory", tiers: [
      { minLevel: 1, src: "/game-art/buildings/observatory-t1.png", height: 180 },
      { minLevel: 3, src: "/game-art/buildings/observatory-t2.png", height: 255 },
      { minLevel: 6, src: "/game-art/buildings/observatory-t3.png", height: 340 },
    ] },
  { id: "workshop", tiers: [
      { minLevel: 1, src: "/game-art/buildings/workshop-t1.png", height: 180 },
      { minLevel: 3, src: "/game-art/buildings/workshop-t2.png", height: 255 },
      { minLevel: 6, src: "/game-art/buildings/workshop-t3.png", height: 340 },
    ] },
  { id: "alchemy", tiers: [
      { minLevel: 1, src: "/game-art/buildings/alchemy-t1.png", height: 180 },
      { minLevel: 3, src: "/game-art/buildings/alchemy-t2.png", height: 255 },
      { minLevel: 6, src: "/game-art/buildings/alchemy-t3.png", height: 340 },
    ] },
  { id: "forum", tiers: [
      { minLevel: 1, src: "/game-art/buildings/forum-t1.png", height: 180 },
      { minLevel: 3, src: "/game-art/buildings/forum-t2.png", height: 255 },
      { minLevel: 6, src: "/game-art/buildings/forum-t3.png", height: 340 },
    ] },
  { id: "conservatory", tiers: [
      { minLevel: 1, src: "/game-art/buildings/conservatory-t1.png", height: 180 },
      { minLevel: 3, src: "/game-art/buildings/conservatory-t2.png", height: 255 },
      { minLevel: 6, src: "/game-art/buildings/conservatory-t3.png", height: 340 },
    ] },
];

export function buildingArt(level, variant = 0) {
  const fam = BUILDING_FAMILIES[Math.abs(variant) % BUILDING_FAMILIES.length];
  let pick = fam.tiers[0];
  for (const t of fam.tiers) if (level >= t.minLevel) pick = t;
  return pick;
}

// Kept for older callers: the first family.
export const subjectArt = (level) => buildingArt(level, 0);

/** uid -> variant index, counting subject buildings in order (same order on every client). */
export function subjectVariants(objects) {
  const map = new Map();
  let i = 0;
  for (const o of objects) if (o.kind === "subject") map.set(o.uid, i++);
  return map;
}

export function itemArt(itemId) {
  return ITEM_ART[itemId] || null;
}
