// server/routes/war.js — HTTP layer for multiplayer. All logic lives in lib/game.js.
import express from "express";
import * as game from "../lib/game.js";

const router = express.Router();

// Accept `sessionId` as an alias for `playerId` — the Unity handoff notes call it that.
const pid = (req) => req.body?.playerId || req.body?.sessionId || req.query?.playerId || req.query?.viewer;

const wrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (e) {
    if (e instanceof game.HttpError) return res.status(e.status).json({ error: e.message, ...e.extra });
    console.error("[war]", e);
    res.status(500).json({ error: e.message || "Server error" });
  }
};

// players
router.post("/player/sync", wrap((r) => game.briefPlayer(game.syncPlayer({ playerId: pid(r), name: r.body.name, base: r.body.base, shieldUntil: r.body.shieldUntil }), { forViewer: pid(r) })));
router.get("/player/:id", wrap((r) => game.getPlayer(r.params.id)));
router.get("/player/:id/base", wrap((r) => game.getBase(r.params.id)));
router.get("/incoming/:id", wrap((r) => game.incoming(r.params.id)));

// clans (paths match the handoff notes; `clanId`/`sessionId` aliases accepted)
router.post("/clan/create", wrap((r) => game.createClan({ playerId: pid(r), name: r.body.name, clanId: r.body.clanId })));
router.post("/clan/leave", wrap((r) => game.leaveClan({ playerId: pid(r) })));
router.post("/clan/:clanId/join", wrap((r) => game.joinClan({ playerId: pid(r), clanId: r.params.clanId })));
router.post("/clan/:clanId/score", wrap((r) => game.addClanScore(r.params.clanId, r.body.delta)));
router.post("/clan/:clanId/war/start", wrap((r) => game.startWar({ clanId: r.params.clanId, playerId: pid(r) })));
router.post("/clan/:clanId/war/end", wrap((r) => {
  const clan = game.clanView(r.params.clanId, pid(r));
  if (!clan.members.some((m) => m.id === pid(r))) throw new game.HttpError(403, "Only clan members can end a war.");
  const result = game.endWar(r.params.clanId);
  return { result, clan: game.clanView(r.params.clanId, pid(r)) };
}));
router.get("/clan/:clanId", wrap((r) => game.clanView(r.params.clanId, pid(r))));
router.get("/clans", wrap(() => ({ clans: game.listClans() })));

// war / raids
router.get("/war/targets/:id", wrap((r) => game.listTargets(r.params.id)));
router.post("/raid/start", wrap((r) => game.startRaid({ playerId: pid(r), defenderId: r.body.defenderId, extraMisses: r.body.extraMisses, base: r.body.base })));
router.post("/raid/:id/answer", wrap((r) => game.answerRaid({ raidId: r.params.id, playerId: pid(r), index: r.body.index, choice: r.body.choice })));
router.post("/raid/:id/retreat", wrap((r) => game.retreatRaid({ raidId: r.params.id, playerId: pid(r) })));

// fortify (defender answers questions to fill their ward)
router.post("/fortify/start", wrap((r) => game.startFortify({ playerId: pid(r), base: r.body.base })));
router.post("/fortify/:id/answer", wrap((r) => game.answerFortify({ fortifyId: r.params.id, playerId: pid(r), index: r.body.index, choice: r.body.choice })));

export default router;
