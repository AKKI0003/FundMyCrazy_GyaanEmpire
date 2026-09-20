# Handoff — React side (Dev 2) & Unity integration contract

Split: Dev 1 is building the actual game (empire visualization, raids, clan wars) in **Unity**. Dev 2 owns everything below — the parts that don't need Unity to be ready first, so neither of you is blocked on the other.

## What you own (Dev 2)

1. **Setup flow** — already built: subject name, paste syllabus text, or upload a textbook photo. (`src/components/SetupScreen.jsx`)
2. **Backend + Gemini integration** — already built and working: `server/index.js` holds the Gemini API key (never exposed to the browser), exposes:
   - `POST /api/generate-tree` → turns syllabus text/image into a topic tree (`{topics: [{id, name, difficulty, prerequisites}]}`)
   - `POST /api/generate-quiz` → generates a 3-question quiz for a given topic
   - `POST/GET /api/empire/:sessionId` → **new** — shared state store, this is the handshake point with Unity (see contract below)
3. **Study session + quiz flow** — already built: timer, quiz modal, scoring, XP/level updates. (`src/components/StudyPanel.jsx`, `QuizModal.jsx`)
4. **Embedding the Unity build once Dev 1 has a WebGL export** — see below.
5. Anything cosmetic/UX in the React shell (header, resource bar, onboarding polish) that isn't the core game board itself — that's Unity's job now.

You can keep developing and demoing your half **right now** without waiting on any Unity file — just fake the "launch empire" button to log to console until the WebGL build exists.

## The integration contract (so you're never blocked on each other)

**Data shape both sides agree on:**
```json
{
  "subject": "Class 10 Chemistry",
  "topics": [
    { "id": "atomic-structure", "name": "Atomic Structure", "difficulty": 2, "prerequisites": [] },
    { "id": "chemical-bonding", "name": "Chemical Bonding", "difficulty": 3, "prerequisites": ["atomic-structure"] }
  ],
  "xpMap": { "atomic-structure": 45, "chemical-bonding": 0 },
  "points": 30,
  "gems": 1,
  "streak": 2
}
```

**How state flows:**
1. React runs the setup screen, calls `/api/generate-tree`, gets the topic list.
2. React `POST`s that to `/api/empire/:sessionId` (sessionId = any string — a UUID you generate per browser session is fine).
3. React hands off to Unity by loading the Unity WebGL build with that `sessionId` passed in as a URL query param: `unity-build/index.html?session=abc123`.
4. **Unity's job**: on load, `GET /api/empire/abc123` to fetch topics + xp, render the actual empire/game with it, run the raid/clan-war mechanics.
5. When a player finishes a study session inside Unity, Unity should either:
   - call `/api/generate-quiz` directly (same backend, same contract Dev 2 already built — no need to duplicate it in Unity), then
   - `POST` the updated `xpMap`/`points`/`gems`/`streak` back to `/api/empire/abc123` so React's meta-layer (header stats, "back to dashboard" screen) stays in sync.

This means **the backend is the single source of truth** — neither of you needs to pass data through postMessage/iframe hacks. Unity just needs `fetch()` (or Unity's `UnityWebRequest`) pointed at the same backend URL.

## Where the Unity build goes

Drop the WebGL export into `public/unity-build/` in this repo. Once it's there, React should replace the placeholder "launch empire" step with:
```jsx
window.location.href = `/unity-build/index.html?session=${sessionId}`;
```
(or embed it in an `<iframe>` if you want the resource-bar header to stay visible around it — your call once you see how the Unity build looks.)

## Current repo state

- `npm install`, copy `.env.example` → `.env` with your Gemini key, `npm start` runs both frontend (5173) and backend (8787) together.
- Model is pinned to `gemini-3.6-flash` in `server/index.js` — confirmed correct as of now. If Google renames it again, that's the one line to change.
- Everything currently works end to end except: no persistence across page reloads yet (that's what `/api/empire/:sessionId` is for — wire it in once you pick how you're generating/storing the sessionId, e.g. `localStorage`).

Backend now has a modular Gemini fallback chain (server/lib/geminiClient.js) — no behavior change on the React side, but response JSON from /api/generate-tree and /api/generate-quiz now includes a _modelUsed field (harmless to ignore, useful for debugging during judging if something looks off).
New endpoints for clans, needed by Unity, that Dev 2 may also want to surface in the React meta-layer (e.g. "your clan" badge in the header):
POST /api/clan/create { clanId, name, sessionId }
POST /api/clan/:clanId/join { sessionId }
POST /api/clan/:clanId/score { delta }
GET /api/clan/:clanId
GET /api/clans (sorted leaderboard)
Unity leveling formula is currently level = clamp(1 + xp/20, 1, 5) inside EmpireManager.cs — if React's StudyPanel.jsx uses a different XP→level curve for its own display, the two need to match or a topic could show a different level in the React header vs the Unity board. Worth a 2-minute sync.
ApiClient.BaseUrl in Unity must be flipped from localhost:8787 to the real deployed backend URL before the final WebGL build — remind Dev 1 (i.e., yourself) the morning of Day 3.