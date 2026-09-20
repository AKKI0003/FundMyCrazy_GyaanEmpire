// server/lib/bots.js
//
// Seeds a few bot players + two bot clans on first run so a single developer
// can test raids, fortify and clan wars without a second browser. Bots use the
// same base-snapshot shape as real players (built with the shared rules), so
// nothing downstream treats them specially except: they can't be shielded and
// their ward slowly refills.

import { db, save } from "./store.js";
import { BANK_SUBJECT_TOPICS } from "./questionBank.js";
import { CASTLE_SIZE, defaultCastlePos, computeDefense } from "../../shared/baseRules.js";

const SLOTS = [[4, 9], [14, 9], [9, 4], [9, 14], [4, 4], [14, 14]];

function ring(c, item, tiers) {
  // perimeter tiles one step out from the castle, skipping the four corners
  const { x, y } = c;
  const [w, h] = CASTLE_SIZE;
  const out = [];
  for (let i = 0; i < w; i++) {
    out.push([x + i, y - 1], [x + i, y + h]);
  }
  for (let j = 0; j < h; j++) {
    out.push([x - 1, y + j], [x + w, y + j]);
  }
  return out.map(([px, py], i) => ({ uid: `w${i}`, kind: "shop", itemId: tiers[i % tiers.length], x: px, y: py }));
}

function makeBase({ castleLevel, subjectKeys, wallTiers, towers = 0, extras = [] }) {
  const cp = defaultCastlePos();
  const objects = [{ uid: "castle", kind: "castle", x: cp.x, y: cp.y }];
  const subjects = [];
  subjectKeys.forEach((key, i) => {
    const level = 1 + ((i * 2 + castleLevel) % 5);
    const name = key.replace(/\b\w/g, (m) => m.toUpperCase());
    const id = `bot_${key.replace(/\W+/g, "_")}`;
    const [x, y] = SLOTS[i];
    objects.push({ uid: `s${i}`, kind: "subject", ref: id, name, level, x, y });
    const topicNames = BANK_SUBJECT_TOPICS[key] || ["General Knowledge"];
    subjects.push({ id, name, level, syllabus: "", topics: topicNames.map((t, k) => ({ id: `${id}_${k}`, name: t, level: 1 + ((level + k) % 6) })) });
  });
  objects.push(...ring(cp, null, wallTiers));
  for (let t = 0; t < towers; t++) {
    objects.push({ uid: `t${t}`, kind: "shop", itemId: "tower_watch", x: t === 0 ? 7 : 13, y: t === 0 ? 7 : 14 });
  }
  objects.push(...extras);
  return { castleLevel, objects, subjects };
}

const BOT_PLAYERS = [
  { id: "bot_aria", name: "Sage Aria", clan: "bot_clan_lore", base: () => makeBase({ castleLevel: 1, subjectKeys: ["mathematics", "physics"], wallTiers: ["wall_wood"] }) },
  { id: "bot_milo", name: "Scribe Milo", clan: "bot_clan_lore", base: () => makeBase({ castleLevel: 2, subjectKeys: ["history", "geography", "english"], wallTiers: ["wall_stone", "wall_wood"], towers: 1 }) },
  { id: "bot_rhea", name: "Archivist Rhea", clan: "bot_clan_lore", base: () => makeBase({ castleLevel: 3, subjectKeys: ["biology", "chemistry", "physics", "mathematics"], wallTiers: ["wall_iron", "wall_stone"], towers: 2 }) },
  { id: "bot_finn", name: "Cadet Finn", clan: "bot_clan_quill", base: () => makeBase({ castleLevel: 1, subjectKeys: ["computer science & ai"], wallTiers: ["wall_wood"] }) },
  { id: "bot_zara", name: "Scholar Zara", clan: "bot_clan_quill", base: () => makeBase({ castleLevel: 2, subjectKeys: ["chemistry", "mathematics", "english"], wallTiers: ["wall_stone"], towers: 1 }) },
  { id: "bot_orin", name: "Lorekeeper Orin", clan: "bot_clan_quill", base: () => makeBase({ castleLevel: 4, subjectKeys: ["history", "biology", "geography", "computer science & ai", "physics"], wallTiers: ["wall_crystal", "wall_iron"], towers: 2 }) },
];

const BOT_CLANS = [
  { id: "bot_clan_lore", name: "Lore Keepers" },
  { id: "bot_clan_quill", name: "Quill & Compass" },
];

export function botWard(base) {
  if (!base) return 0;
  const def = computeDefense(base);
  return Math.min(def.wardCap, 15 + base.castleLevel * 8);
}

export function seedBots() {
  let changed = false;
  for (const c of BOT_CLANS) {
    if (!db.clans[c.id]) {
      db.clans[c.id] = { id: c.id, name: c.name, ownerId: null, members: [], createdAt: Date.now(), stars: 0, wins: 0, losses: 0, war: null, history: [], isBot: true };
      changed = true;
    }
  }
  for (const b of BOT_PLAYERS) {
    if (!db.players[b.id]) {
      const base = b.base();
      db.players[b.id] = {
        id: b.id, name: b.name, clanId: b.clan, base, updatedAt: Date.now(), shieldUntil: 0,
        ward: botWard(base), seen: {}, stats: { raidsWon: 0, raidsLost: 0, defended: 0, lost: 0, stars: 0 }, log: [], isBot: true,
      };
      const clan = db.clans[b.clan];
      if (!clan.members.includes(b.id)) clan.members.push(b.id);
      changed = true;
    }
  }
  if (changed) save();
}
