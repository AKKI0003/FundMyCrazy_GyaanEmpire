# Notes for Dev 2

What changed since the last handoff, what contracts you can rely on, and what's still open. Read `README.md` first for the feature tour; this file is the "what do I need to know to keep building" part.

---

## 1. What changed (short version)

- The old **world map** (subjects placed by `%` coordinates) and the old **topic board** are gone. Replaced by:
  - `BaseScreen` — the home island: Main Castle, one building per subject, shop items.
  - `SubjectBoard` — the per-subject topic map, on the same engine.
  - Both render through `src/components/game/IsoStage.jsx`.
- **Deleted:** `WorldMap.jsx`, `EmpireBoard.jsx`, `EmpireOverview.jsx`, `Building.jsx`, `ResourceBar.jsx`. `worldPos` on subjects is no longer used; old saves still load, the field is just ignored.
- **New multiplayer server layer** (`server/routes/war.js` + `server/lib/*`): players, clans, clan wars, raids, fortify. Bots are seeded on first run.
- **Rules shared by client and server** live in `shared/` (`catalog.js`, `baseRules.js`). Both sides import the same file, so what the player sees and what the server enforces can't drift.
- **Second pass (lessons, quizzes, battle questions):** see section 10.

## 2. Things I found that you should know

1. **The handoff notes listed clan endpoints that were not in `server/index.js`.** They exist now, at the paths the notes described (`POST /api/clan/create`, `POST /api/clan/:clanId/join`, `POST /api/clan/:clanId/score`, `GET /api/clan/:clanId`, `GET /api/clans`). Request bodies accept `sessionId` as an alias for `playerId`. If Dev 1 has a local copy of those endpoints, reconcile before merging.
2. **XP → level formulas disagree.** React: `level = 1 + floor(xp / 60)`, capped at 8 (`src/lib/utils.js`). The Unity notes say `1 + xp / 20`, capped at 5. Pick one and move it into `shared/` so both sides use it.
3. **The gem economy is client-authoritative.** Gems, shop purchases, Peace Shield and Second Wind are decided in the browser and only *reported* to the server (the base snapshot, `shieldUntil`, `extraMisses`). The raid itself is server-scored; the economy isn't. See §6.
4. The zip extracted the old handoff file with a mangled name (`#U2014` for the em dash). It's cosmetic, but rename it if it looks wrong in git.

## 3. The base snapshot (the contract Unity/anything else can rely on)

Uploaded by the client on every change (debounced 0.9 s) via `POST /api/player/sync`, and readable with `GET /api/player/:id/base`.

```jsonc
{
  "castleLevel": 1,                       // 1..5
  "objects": [
    { "uid": "castle",         "kind": "castle",  "x": 9, "y": 9 },
    { "uid": "sub:<subjectId>","kind": "subject", "x": 4, "y": 9,
      "ref": "<subjectId>", "name": "AI", "level": 3 },        // level 1..8
    { "uid": "it_ab12cd",      "kind": "shop",    "x": 8, "y": 8,
      "itemId": "wall_stone" }                                  // id from shared/catalog.js
  ],
  "subjects": [                            // ONLY unlocked + studied topics, with their lesson notes
    { "id": "...", "name": "AI", "level": 3,
      "topics": [ { "id": "...", "name": "Search", "level": 2,
                    "notes": "<title>: <summary> Key points: a | b | c   (one line per lesson part, max 3200 chars)" } ] }
  ]
}
```

- Coordinates are **top-left tile** of the footprint on a **22 × 22** grid. Footprints: castle 4×4, subject 3×3, shop items per `catalog.js` (`size`).
- The server re-validates everything (`sanitizeBase` in `server/lib/game.js`): unknown item ids, out-of-bounds and overlapping objects are dropped, so a tampered snapshot can't stack walls on one tile.
- `computeDefense()` in `shared/baseRules.js` turns a snapshot into HP/armor per building.

## 4. API reference

All under `/api`, JSON in / JSON out. Errors are `{ "error": "message" }` with a real status code (404 unknown, 409 conflict/out of sync, 423 shielded).

| Method & path | Purpose |
|---|---|
| `POST /player/sync` `{playerId,name,base,shieldUntil}` | Upsert player + base snapshot |
| `GET /player/:id` | Brief profile (rating, ward, clan, stats) |
| `GET /player/:id/base` | Full snapshot + computed defense |
| `GET /incoming/:id` | Active raids on you, ward, recent raid log (poll every ~5 s) |
| `POST /clan/create` `{playerId,name}` | Create clan; id is a 5-char invite code |
| `POST /clan/:clanId/join` `{playerId}` | Join by code |
| `POST /clan/leave` `{playerId}` | Leave (deletes empty clans) |
| `GET /clan/:clanId?viewer=` | Members, war state, history |
| `GET /clans` | Leaderboard |
| `POST /clan/:clanId/score` `{delta}` | Add lifetime stars (kept for the Unity handoff) |
| `POST /clan/:clanId/war/start` `{playerId}` | Match against an idle human clan, else a bot clan |
| `POST /clan/:clanId/war/end` `{playerId}` | Settle now (also auto-settles at `endsAt`) |
| `GET /war/targets/:playerId` | War targets (enemy clan) or friendly targets |
| `POST /raid/start` `{playerId,defenderId,extraMisses,base?}` | Questions **without answers** from the *attacker's* learned topics, each with a `targetRef` (a defender building). Also returns `sources`. |
| `POST /raid/:id/answer` `{playerId,index,choice}` | Server scores it; returns hit, state, and `result` when done |
| `POST /raid/:id/retreat` | End early |
| `POST /fortify/start` `{playerId,base?}` | Questions from the player's own learned topics, weakest first. Also returns `sources`. |
| `POST /fortify/:id/answer` `{playerId,index,choice}` | Adds ward (extra while being raided) |

## 5. How raids and questions work (where to change them)

- **Rules:** `server/lib/raidEngine.js` (pure functions). Constants at the top: `BASE_DAMAGE`, streak bonus, `MAX_MISSES`, star thresholds. Damage order is ward → armor → HP; once a building is destroyed its strikes go to the castle.
- **Formulas:** `shared/baseRules.js` — `castleHp`, `subjectHp`, `armorCap`, `wardCap`, castle upgrade costs.
- **Prices/protection:** `shared/catalog.js`.
- **Questions:** `server/lib/warQuestions.js` (rules shared with the study quiz in `questionRules.js`).
  - Sources are the answering player's **learned** topics only: `learnedSources()` in `game.js` keeps subjects that still have a building in the base and topics that carry notes.
  - Allocation is round-robin over learned subjects, a different topic per question, interleaved. Max 3 questions per topic (`MAX_PER_TOPIC`), so small pools ask fewer questions instead of repeating.
  - History is per **answering player**, per **subject name**, last 80. Repeat check = normalised hash **or** >= 0.85 *content-word* overlap (stop-words ignored).
  - Each Gemini question must include `evidence` copied from the notes; `filterQuestions` drops ungrounded or structure-y ones.
  - **No offline bank for real players.** `GYAN_DEMO_QUESTIONS=1` turns the generic bank on for demos. `npm run server:offline` swaps Gemini for a local cloze generator built from the notes.
  - `hooks.generate` (exported from `warQuestions.js`) lets tests and the offline server replace the model.
- **Concurrency rule:** one active raid per defender. A second attacker gets a 409 until the first finishes or idles out (10 min).
- **Ward accounting:** starting a raid moves the defender's ward *into* the raid; whatever is left is returned when it ends. Fortify during a raid adds to the live raid.

## 6. Open work, roughly in priority order

1. **Auth.** A player is a random UUID in `localStorage` (`src/game/player.js`). Add real login and stop trusting `playerId` from the body. Every route takes it from `req.body`/`req.query` today.
2. **Server-authoritative economy.** Move gems, shop purchases, castle level, shields and Second Wind to the server (buy = `POST /shop/buy`, server checks balance, updates the snapshot). Right now a player can edit `localStorage` for free gems, a max castle, or a permanent shield.
3. **Database.** `server/lib/store.js` is a JSON file, flushed 400 ms after the last change. Swap it for Postgres/Firestore; the rest of the server only touches `db.players / clans / raids / fortifies` and `save()`.
4. **Realtime.** Raid alerts and clan-war scores use 5 s polling (`BaseScreen`). A websocket/SSE channel for `incoming` would make "defend live" feel much better.
5. **Bot behavior.** Bot clans don't attack; their score is invented when a war ends (`endWar`). Fine for demos, not for a real war.
6. **Matchmaking.** Right now: random idle human clan, else a bot clan. Rating-based matching is a small change in `startWar`.
7. **Anti-cheat on answers.** The server holds the answers and scores, but there's no per-question server timer (the 30 s is client-side) and no rate limiting.
8. **Verify pass for answer keys.** Grounding proves a question quotes the notes, not that the marked answer is right. A cheap second model call ("solve this from the notes and compare") would catch wrong keys.
9. **Accessibility/perf.** The stage is pointer-only; keyboard users can only zoom and fullscreen. Ground is one SVG (~500 polygons), fine at 22×22 but worth canvas-ifying if you grow the grid.

## 7. Art & content swap guide

- Everything visual is wired in **`src/game/assets.js`**. Drop transparent PNGs in `public/game-art/`; they are **auto-cropped** on load (`src/game/sprites.jsx`), so no manual trimming.
  - `ART.castle.levels[i]` — castle art per level (falls back to `default`).
  - `ART.subjectTiers` — subject/topic building art by level.
  - `ITEM_ART[itemId] = { src, height }` — real art for any shop item. Until set, the item is drawn as a colour-coded block by `Placeholder.jsx` (tone + emoji from `catalog.js`).
  - `height` is world px at zoom 1 (one tile = 96 × 48). A 3×3 footprint is 288 px wide.
- New shop items: add an entry to `SHOP_ITEMS` in `shared/catalog.js`. It appears in the shop and is enforced by the server automatically (unknown ids are rejected by `sanitizeBase`).
- The HUD font (Lilita One) loads from Google Fonts in `index.html`; it falls back to Sora offline.

## 8. Gotchas (things that bit me)

- **Don't change a React `key` on a wrapper to restart an animation** if it contains state (I did this on the raid screen and it remounted the question card mid-answer). Replay the CSS animation instead, as `RaidScreen.jsx` does now.
- Tailwind's preflight sets `max-width: 100%` on `<img>`. Absolutely-positioned sprites inside a zero-width parent collapse to width 0 unless you set `maxWidth: "none"` (done in `IsoStage` and `TrimmedImg`).
- framer-motion writes its own `transform`, which wipes Tailwind `-translate-*` classes on the same element. Center with a wrapper (see `Toast.jsx`).
- React StrictMode runs effects twice in dev. One-shot effects (welcome gift) need a ref guard.
- The Fullscreen API only shows the fullscreened element's subtree, which is why fullscreen targets `<html>` (modals live outside the map).
- Camera state is a ref applied directly to the DOM (`IsoStage`), not React state, so zooming doesn't re-render. If you add UI that needs the zoom level, read `zoomShown` or lift a callback; don't put the camera in state.

## 9. Testing

```bash
npm run test:war      # 31 tests: question rules, learned-only sources, lesson shape, quiz builder, raid math, ward, fortify, clans
```

In-process, no network, nothing written to disk. There are **no automated UI tests**; the browser flows in the README were checked by hand with a headless browser. A Playwright suite for edit-mode drag, shop placement and the raid screen would be a good next investment.

---

## 10. Second pass: lessons, quizzes, and what battles ask about

**Reported problems:** lessons were hard to scan; quiz questions were off-topic or oddly worded; fortify asked about a deleted subject and a locked, unstudied topic.

### Root causes
1. `/api/generate-lesson` asked for one 380-450 word `explanation` string and the page rendered it as one paragraph.
2. `/api/generate-quiz` **was never sent the lesson text**, only the topic name and the *labels* of the stages taught ("Worked example", "Core mechanism"). The model quizzed the labels ("which describes the 'Worked Example' stage...").
3. Battle questions came from the server's stored snapshot of *every* subject. That snapshot (a) had no notion of unlocked/studied, (b) was not sent when the player had **zero** subjects (`usePlayerSync` returned early), and (c) could lag by the debounce.

### What changed
- **Lesson JSON** is now `{ title, summary, sections:[{heading, body, itemsStyle: steps|bullets|terms|none, items[], callout}], keyPoints[4] }`. `server/lib/lessonShape.js` coerces model output (and the old single-essay shape) into it and derives a plain-text `explanation`. `lessonHistory[topicId][i]` now also stores `summary` and `sections`; **old saved lessons have neither and still render** (fallback in `LessonPage.jsx`).
- **`keyPoints` are written to stand alone** (specific term/number/name) because they are reused as battle-question source notes.
- **`/api/generate-quiz` takes `lessonParts`** (`{title, explanation, keyPoints}[]`) and builds via `server/lib/quizBuilder.js`. The client no longer sends `partsCovered` for quizzes. Same `lessonParts` for `/api/generate-written-prompt`.
- **`server/lib/questionRules.js`** is the single definition of a good question: meta-wording regexes, lazy/duplicate-option checks, `isGrounded(evidence, source)` (75% token overlap), content-word similarity for repeats. If real Gemini output is rejected too often, this is where to tune.
- **"Learned" is defined client-side** (`topicUnlocked`, `topicLearned`, `topicNotes` in `src/game/subjectStats.js`): unlocked (no prereqs, or bought open, or every prereq >= 60 XP) **and** at least one lesson part taught. `buildSnapshot` sends only those topics, with notes.
- **Fresh snapshot with every raid/fortify request** (`base` in the body), and sync even with zero subjects. The server also re-checks that a subject still has a building (`learnedSources`), so a stale snapshot can't resurrect a deleted subject.
- **Attack questions now come from the attacker's own learned material**, aimed at defender buildings via `targetRef` (round-robin from a random start). Previously they came from the defender's syllabus. To restore that, change `startRaid` in `game.js` and the `targetRef` lookup in `raidEngine.applyAnswer`.
- `FortifyModal` starts exactly one session (StrictMode double effects used to burn unasked questions and show a false failure).

### Product decision to confirm
"Learned" = unlocked **and** studied. A topic that is unlocked but never opened doesn't count. If you'd rather count any unlocked topic, change `topicLearned`, but then questions can cover material the student hasn't been taught (and there are no notes to ground them in).

### Not verified
Nothing has run against live Gemini. Expect to tune the lesson prompt and the grounding threshold after a real-key trial; watch the server log for `Couldn't build a reliable quiz (N ungrounded, M malformed)`.
