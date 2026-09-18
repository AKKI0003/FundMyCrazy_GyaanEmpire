import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function levelFromXP(xp) {
  return clamp(1 + Math.floor(xp / 60), 1, 8);
}
