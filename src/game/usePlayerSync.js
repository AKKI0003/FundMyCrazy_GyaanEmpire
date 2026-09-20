import { useEffect, useRef, useState } from "react";
import { syncPlayer } from "../lib/api";
import { buildSnapshot } from "./baseState";

/**
 * Keeps the server's copy of your base up to date (debounced). That copy is what
 * other players raid and what your fortify questions are generated from.
 * `online` flips false if the war server can't be reached.
 */
export function usePlayerSync({ player, base, subjects }) {
  const [online, setOnline] = useState(null); // null = unknown yet
  const timer = useRef(null);
  useEffect(() => {
    // Sync even with ZERO subjects: otherwise the server keeps quizzing a deleted subject.
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await syncPlayer({ playerId: player.id, name: player.name, base: buildSnapshot(base, subjects), shieldUntil: base.shieldUntil });
        setOnline(true);
      } catch {
        setOnline(false);
      }
    }, 900);
    return () => clearTimeout(timer.current);
  }, [player.id, player.name, base, subjects]);
  return { online, setOnline };
}
