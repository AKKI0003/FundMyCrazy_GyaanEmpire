// server/lib/store.js
//
// Tiny JSON-file-backed store for players, clans, raids and fortify sessions.
// In-memory during runtime; flushed to server/data/store.json (debounced) so
// a restart doesn't wipe everyone's base. Swap this file for a real database
// (Postgres/Firestore/etc.) when you outgrow it — the rest of the server only
// talks to `db.players`, `db.clans`, `db.raids`, `db.fortifies` and `save()`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const FILE = process.env.GYAN_STORE_FILE || path.join(DIR, "store.json");

export const db = { players: {}, clans: {}, raids: {}, fortifies: {} };

export function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    db.players = raw.players || {};
    db.clans = raw.clans || {};
    // Live sessions don't survive a restart on purpose.
    db.raids = {};
    db.fortifies = {};
  } catch {
    // first run — start empty
  }
}

let timer = null;
export function save() {
  if (process.env.GYAN_STORE_DISABLE_WRITE) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify({ players: db.players, clans: db.clans }));
    } catch (e) {
      console.warn("[store] could not persist:", e.message);
    }
  }, 400);
}

export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
