import { useEffect, useState, useCallback } from "react";

// We fullscreen the whole document (not just the map) on purpose: modals, the
// shop and toasts all live in the same page, and the Fullscreen API only shows
// the subtree of the element you fullscreened. Fullscreening <html> keeps every
// overlay visible.
const root = () => document.documentElement;
const current = () => document.fullscreenElement || document.webkitFullscreenElement || null;
export const fullscreenSupported = () => !!(root().requestFullscreen || root().webkitRequestFullscreen);

export async function toggleFullscreen() {
  try {
    if (current()) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      await (root().requestFullscreen || root().webkitRequestFullscreen).call(root());
    }
    return true;
  } catch {
    return false;
  }
}

export function useFullscreen() {
  const [isFs, setIsFs] = useState(!!current());
  useEffect(() => {
    const sync = () => setIsFs(!!current());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);
  const toggle = useCallback(async () => {
    const ok = await toggleFullscreen();
    if (!ok) window.dispatchEvent(new CustomEvent("gyan:toast", { detail: "Fullscreen isn't available in this browser." }));
  }, []);
  return { isFs, toggle, supported: fullscreenSupported() };
}
