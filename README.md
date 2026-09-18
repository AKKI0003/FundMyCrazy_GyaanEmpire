# Gyan Empire

Turn your syllabus into a game empire. Upload notes or a textbook photo, Gemini builds a skill-tree of topics, and studying each topic levels up its building.

## Stack
- Frontend: React + Vite + Tailwind, shadcn-style components (cva + cn), framer-motion, lucide-react
- Backend: Express, holds the Gemini API key server-side (never exposed to the browser)

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and add your Gemini API key (get one at aistudio.google.com/apikey):
   ```
   cp .env.example .env
   ```
3. Run both the backend and frontend together:
   ```
   npm start
   ```
   Or separately: `npm run server` (port 8787) and `npm run dev` (port 5173).
4. Open http://localhost:5173

## How it works
1. **Setup screen** — enter a subject and paste syllabus text or upload a textbook photo.
2. Backend calls Gemini to structure the content into a topic tree (`/api/generate-tree`), with real prerequisite relationships.
3. **Empire board** — topics render as a skill tree; locked topics need prerequisites finished first.
4. **Study session** — pick a duration, study for real, then Gemini generates a 3-question quiz on that exact topic (`/api/generate-quiz`).
5. Quiz score levels up the topic's building and updates Study Points, Focus Gems, and Streak.
6. Low-level topics get flagged "Needs revision" — the hook for the raid/clan-war mechanic in the next build phase.

## Deploying
Build the frontend with `npm run build` (outputs to `dist/`) and deploy the backend anywhere that can hold an env var (Render, Railway, a small VPS). Point the frontend's `/api` calls at your deployed backend URL, or serve both from the same host behind a reverse proxy.
