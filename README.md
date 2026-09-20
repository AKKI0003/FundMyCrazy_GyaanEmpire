# Gyan Empire

Turn your syllabus into a base you have to defend.

Upload notes or a textbook photo and Gemini builds a skill-tree of topics. Every **subject** becomes a **building on your island**; studying its topics levels the building up. Around them you put a **Main Castle**, walls and defenses bought with **Focus Gems**, and then you fight **clan wars** — where every strike and every shield is a quiz answer.

> Clash-of-Clans-style base building, but the troops are your knowledge.

---

## Run it

```bash
npm install
cp .env.example .env        # add GEMINI_API_KEY (aistudio.google.com/apikey)
npm start                   # backend :8787 + frontend :5173
```

Open http://localhost:5173. `npm run server` / `npm run dev` start them separately.

The war features need the backend running. Lessons, quizzes **and** battle questions are written by Gemini, so you need a key for the real thing.

**No key / out of quota?** `npm run server:offline` runs the same backend but writes *battle* questions locally, as fill-in-the-blank statements taken from your own lesson notes. Handy for developing wars; lessons and study quizzes still need Gemini. (`GYAN_DEMO_QUESTIONS=1` is a separate, last-resort demo switch that uses a generic built-in question bank that is **not** your material.)

```bash
npm run test:war            # 31 in-process tests: question rules, learned-only sources, raids, fortify, clans
```

---

## What's built so far

### The base (home screen)
- A full-screen floating island (22 × 22 tiles) with pan, zoom, recenter and **real browser fullscreen**.
- **Main Castle** in the middle (4 × 4). If it breaks in a raid, you lose that clan-war round.
- **One building per subject** (3 × 3). Its art and toughness follow the subject's level. Add a subject → a new building appears on your island.
- **Move things like Clash of Clans:** tap *Edit base* (or *Move* on any building), drag it, and it snaps to the grid. Green footprint = valid, red = blocked; a blocked drop snaps back.
- Nameplates are small and sit on their own layer above everything, so walls can't bury them and the art stays the star.
- Tap any building for a popup: **Study** (subjects), **Upgrade** (castle), **Move**, **Sell** (shop items, 50% refund).

### The Shop (spend Focus Gems)
Walls, defenses, decor and boosts — **all names, costs and stats are placeholders**.
- **Walls** (5 tiers, wood → runic): protect every building they touch or sit one tile from. Higher tiers give more armor *per tile*, so tight space is a real decision.
- **Defenses:** Watchtower, Archive Vault, Guardian Statue (armor over a radius), Ward Totem (bigger ward), Moat.
- **Decor:** 12 pieces, purely cosmetic.
- **Boosts:** Castle Upgrade (levels 1→5, more HP / armor cap / ward), Peace Shield (12 h no-raid), Second Wind (+1 allowed miss in your next raid).
- Buying a piece drops it on the map with ✓ / ✗ buttons. **Walls keep coming** until you cancel, so you can ring a building fast.
- You get a one-time 10-gem welcome gift so the shop isn't empty.

### Lessons and quizzes (reworked)
- **Lessons are laid out like a study page, not an essay.** Each part is 3-5 headed sections with short bodies, numbered *steps*, *bullet* lists, a *term -> definition* table, and an optional tip. Every part opens with a one-line "you'll be able to..." summary and ends with self-contained key takeaways. Lessons saved before this change still display as they were.
- **Study quizzes are written from the lesson text you actually read.** Before, the model was only told the *names* of the lesson stages, so it quizzed the labels (e.g. "which describes the 'Worked Example' stage"). Now every question must quote a sentence from your lesson as evidence; the server checks the quote really appears, and rejects questions that talk about the lesson's structure ("in this lesson", "core mechanism stage"), have duplicate or "all of the above" options, or aren't self-contained. If the model can't produce enough grounded questions the quiz retries, then fails with a clear message rather than serving junk.
- The "write it out" prompt uses the same lesson text.

### The subject board (study a subject)
- Same engine as the base: topics are buildings on a mini-island, with **roads between prerequisites** that light up as you master them.
- Locked topics show as grey ghosts; select one to unlock early with gems.
- The study panel slides in on the side; everything else (lessons, timed sessions, quizzes, written answers, videos, streaks, milestone gems) is unchanged.

### Clan wars (multiplayer)
- **Players, clans (invite code), leaderboard, clan wars** with matchmaking against another clan (or a bot clan when none is free).
- **Raid** = a run of quiz questions, one subject each, against another player's base.
  - Correct → a strike on that subject's building (streaks hit harder, 24 → 40 dmg). Wrong → deflected, you lose one of 3 lives.
  - Damage is soaked in order: **ward → armor → HP**. Once a building falls, its strikes hit the **castle**.
  - **Castle broken = the defender loses**; attacker gets 3★ + 2 bonus clan-war stars.
  - Stars: ★ ≥ 25% of the base destroyed, ★★ ≥ 55%, ★★★ castle broken.
- **Being raided:** the defender sees a live alert and can **fortify** — answer questions from their own subjects to add **ward** (a shield spent first). It lands in the raid *while it's happening*, with a bonus.
- **Fortify any time** to pre-fill ward. Questions favor your weakest topics.
- Bot players/clans are seeded so one person can test everything alone.

### Battle questions: only what you've learned
Raid and fortify questions come **only from topics you have unlocked *and* studied** (at least one lesson part taught), written from the notes of those lessons.
- A **deleted subject**, a **locked topic**, or a topic you **never opened** can never appear. Unlock and study another topic and the pool grows on the very next request.
- **Attacking** uses *your own* studied material (not the defender's syllabus). Each question is aimed at one of the defender's buildings, every building in their base gets targeted, and the question card tells you which.
- **Fortify** uses your own studied topics too, weakest first, and shows a "Drawing on what you've studied: ..." line so you can see exactly what it used.
- Questions are spread across every learned subject and different topics, never repeat for you (per-player, per-subject history), and must quote evidence from your notes.
- If you've learned very little you get fewer questions (max 3 per topic) rather than repeats. If you've learned nothing yet you get a clear "finish a lesson part first" message.
- The freshest snapshot of what you've learned is sent with every raid/fortify request, so a change made a second ago counts.
- Correct answers never reach the browser until you've answered.

### Fixes from the last build
| Problem | Cause | Fix |
|---|---|---|
| Fullscreen button did nothing | It was wired to "fit to view" | Real Fullscreen API on `<html>` (so modals/toasts stay visible), plus `F` key |
| Zoom zoomed the whole page | Layout box was resized inside a scroller | Camera is a CSS transform on one inner layer; wheel/pinch are captured; the page never scrolls or zooms |
| Art barely visible | Sprites are 669×373 canvases with lots of transparent padding, shrunk into a 100 px box; icons rendered ~6 px | Sprites are auto-cropped to their visible pixels at load (also gives pixel-accurate clicks) and drawn at real size |
| Labels covered the art | Big white label cards | Small nameplates on a top layer |
| Board cards unreadable | Tight grid + tiny scale | Topic buildings at full size with roads between them |
| "Set state during render" on a missing subject | `goToWorld()` called while rendering | Guard effect |
| Toast off-center | framer-motion overwrote Tailwind's translate | Wrapper element |
| Lessons were a wall of text | One 380-450 word essay field, rendered as a single paragraph | Structured sections (headings, steps, bullets, term tables, tips) |
| Quiz questions off-topic, meta or badly worded | Quiz endpoint never received the lesson text, only stage names | Written from the lesson text; must quote evidence; structure/meta wording rejected |
| Fortify asked about a deleted subject and locked topics | Server quizzed a stored snapshot of *every* subject; the snapshot was not sent at all with 0 subjects and could lag a moment behind | Only unlocked + studied topics are sent, fresh with each request and even with 0 subjects |

---

## Where things live

```
shared/                 rules used by BOTH client and server
  catalog.js            shop items (placeholder names/costs/stats)
  baseRules.js          grid, footprints, HP/armor/ward formulas, placement + defense math
server/
  index.js              Gemini endpoints (tree, lesson, quiz, written) + mounts the war router
  routes/war.js         HTTP layer for players / clans / wars / raids / fortify
  lib/game.js           all multiplayer logic
  lib/raidEngine.js     the raid rules as pure functions
  lib/questionRules.js  what makes a good question (grounding, meta-wording filter), shared by quiz + battles
  lib/quizBuilder.js    study quiz written from the lesson text
  lib/lessonShape.js    coerces Gemini's lesson JSON into the structured layout
  lib/warQuestions.js   learned-only, coverage + no-repeat battle question builder
  lib/questionBank.js   generic bank, demo mode only (GYAN_DEMO_QUESTIONS=1)
  lib/bots.js           seeded bot players/clans
  lib/store.js          JSON-file store (server/data/store.json, git-ignored)
src/
  App.jsx               state: subjects, gems/points/streak, view switching
  components/
    BaseScreen.jsx      island, HUD, dock, edit/placing, popups
    SubjectBoard.jsx    topic map for one subject
    ShopModal.jsx  WarHub.jsx  RaidScreen.jsx  FortifyModal.jsx  QuestionCard.jsx
    game/IsoStage.jsx   the reusable pan/zoom/drag/fullscreen viewport
    game/Ground.jsx  Placeholder.jsx  Hud.jsx
  game/
    assets.js           ★ the one place to wire in art
    iso.js  sprites.jsx (auto-trim)  baseState.js  player.js  usePlayerSync.js
scripts/test-war.mjs    server-rule tests
scripts/offline-questions-server.mjs   backend with locally-written battle questions (no Gemini)
```

## Swapping in real art
Everything goes through **`src/game/assets.js`**: drop transparent PNGs in `public/game-art/` (no need to crop them) and point the manifest at them — castle per level, subject tiers, and any shop item by id. Items without art render as colour-coded placeholder blocks.

## Tuning the game
All numbers live in `shared/baseRules.js` (HP, armor cap, ward, castle costs), `shared/catalog.js` (prices, protection), and the top of `server/lib/raidEngine.js` (damage, lives, star thresholds). Set `WAR_DURATION_MIN=5` in `.env` to test a whole war quickly (or use *End war*).

## Config
`.env` — `GEMINI_API_KEY`, `YOUTUBE_API_KEY` (optional), `PORT`, `WAR_DURATION_MIN`, `GYAN_STORE_FILE`, `GYAN_DEMO_QUESTIONS` (demo only). See `.env.example`.

The YouTube key can be the *same* key as the Gemini key if it was created in Google Cloud Console with "YouTube Data API v3" enabled and the key's API restrictions allow it.

## Data
Browser `localStorage`: `gyanEmpire.subjects.v1` (subjects/topics/XP/points/gems), `gyanEmpire.base.v1` (layout, castle level, shield, inventory), `gyanEmpire.player.v1` (player id + name), `gyanEmpire.streak.v1`. Old saves migrate automatically. Server: `server/data/store.json`.

## Known limits (be honest with players/judges)
- **No login.** A player is a random id in `localStorage`; anyone who edits it is someone else.
- **Gems, shop purchases and shields are decided by the client** and only *reported* to the server. The raid itself is server-authoritative; the economy isn't. Fine for a demo; see `DEV2_NOTES.md` for the fix.
- The war server is single-process with a JSON file. No websockets: raid alerts arrive by 5-second polling.
- Bot clans don't attack in real time; their score is settled when a war ends.
- **Nothing here has run against live Gemini.** The lesson layout, quiz grounding and battle-question paths are covered by tests with injected/stand-in generators, and by browser runs against hand-written lesson content. How often real Gemini output passes the grounding check (and follows the new lesson layout) still needs a real-key trial. If the check turns out too strict, tune `isGrounded` in `server/lib/questionRules.js`.
- The grounding check proves a question *quotes* your notes; it can't prove the marked answer is right. There is no second "verify" pass yet.
- Battle questions are written from compact notes (each lesson part's title, summary and key takeaways), not the full lesson text, so they are concept-level. The study quiz uses the full text.

## Deploying
`npm run build` → `dist/`. Run `server/index.js` anywhere that can hold env vars and a writable disk (Render, Railway, a VPS), and point `/api` at it (reverse proxy, or change the fetch base in `src/lib/api.js`).
