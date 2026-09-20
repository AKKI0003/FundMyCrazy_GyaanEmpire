const KEY = "gyanEmpire.player.v1";

export function loadPlayer() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p?.id) return p;
  } catch { /* fall through */ }
  const id = (crypto.randomUUID?.() || `p_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`).slice(0, 40);
  const p = { id, name: `Scholar-${id.slice(0, 4).toUpperCase()}` };
  savePlayer(p);
  return p;
}
export function savePlayer(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
