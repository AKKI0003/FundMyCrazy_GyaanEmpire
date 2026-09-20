// Isometric projection shared by every stage (base, topic board, raid view).
//
// Grid space:  (gx, gy) in tiles, gx grows toward the bottom-right, gy toward
//              the bottom-left. Screen space ("world px" at zoom 1) is a plain
//              2:1 dimetric projection.
export const HW = 48; // half tile width  (tile is 96 x 48)
export const HH = 24; // half tile height

export const toWorld = (gx, gy) => ({ x: (gx - gy) * HW, y: (gx + gy) * HH });
export const toGrid = (x, y) => ({ gx: (y / HH + x / HW) / 2, gy: (y / HH - x / HW) / 2 });

/** Center of a w x h footprint whose top-left tile is (x, y), in world px. */
export const footprintCenter = (x, y, w, h) => toWorld(x + w / 2, y + h / 2);

/** The four corners of a footprint, RELATIVE to its own center (top, right, bottom, left). */
export function footprintCorners(w, h) {
  return [
    { x: ((h - w) / 2) * HW, y: (-(w + h) / 2) * HH },
    { x: ((w + h) / 2) * HW, y: ((w - h) / 2) * HH },
    { x: ((w - h) / 2) * HW, y: ((w + h) / 2) * HH },
    { x: (-(w + h) / 2) * HW, y: ((h - w) / 2) * HH },
  ];
}

export const pointsAttr = (pts) => pts.map((p) => `${p.x},${p.y}`).join(" ");

/** Painter's-order depth: bigger = nearer the viewer = drawn later. */
export const depthOf = (x, y, w, h) => x + w - 1 + (y + h - 1) + x * 0.001;

export function worldBounds(gw, gh) {
  return { minX: -gh * HW, maxX: gw * HW, minY: 0, maxY: (gw + gh) * HH };
}

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
