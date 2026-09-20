// Sprite loader.
//
// The art PNGs are 669x373 canvases with the actual artwork floating in the
// middle of a lot of transparent padding. Drawing them "as is" made every
// building look tiny (and every 16px icon roughly 6px). So the first time a
// sprite is used we crop it to its visible pixels (alpha bounding box), keep
// the alpha mask for pixel-accurate click detection, and cache the result.
//
// Bonus: any new asset dropped into public/game-art/ is auto-trimmed the same
// way — nobody has to pre-crop art or hand-tune offsets.
import React, { useEffect, useReducer } from "react";

const cache = new Map(); // src -> { meta?, promise }
const ALPHA_THRESHOLD = 10;

function trimImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement("canvas");
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        const ctx = cv.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
        let minX = cv.width, minY = cv.height, maxX = -1, maxY = -1;
        for (let y = 0; y < cv.height; y++) {
          for (let x = 0; x < cv.width; x++) {
            if (data[(y * cv.width + x) * 4 + 3] > ALPHA_THRESHOLD) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) return resolve({ url: src, w: cv.width, h: cv.height, mask: null });
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const out = document.createElement("canvas");
        out.width = w;
        out.height = h;
        out.getContext("2d").drawImage(cv, minX, minY, w, h, 0, 0, w, h);
        const mask = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = data[((y + minY) * cv.width + (x + minX)) * 4 + 3];
        resolve({ url: out.toDataURL("image/png"), w, h, mask });
      } catch {
        resolve({ url: src, w: img.naturalWidth, h: img.naturalHeight, mask: null });
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function loadSprite(src) {
  let entry = cache.get(src);
  if (!entry) {
    entry = { meta: undefined, promise: trimImage(src).then((m) => { entry.meta = m; return m; }) };
    cache.set(src, entry);
  }
  return entry.promise;
}

export const getSprite = (src) => cache.get(src)?.meta;

/** Load a set of sprites; re-renders the caller once as each finishes. */
export function useSprites(srcs) {
  const [, bump] = useReducer((n) => n + 1, 0);
  const key = srcs.filter(Boolean).sort().join("|");
  useEffect(() => {
    let live = true;
    key.split("|").filter(Boolean).forEach((s) => {
      if (getSprite(s) === undefined) loadSprite(s).then(() => live && bump());
    });
    return () => { live = false; };
  }, [key]);
  return Object.fromEntries(srcs.filter(Boolean).map((s) => [s, getSprite(s)]));
}

/** Alpha at (px, py) in the sprite's own trimmed pixel space. */
export function alphaAt(meta, px, py) {
  if (!meta?.mask) return 255;
  const x = Math.floor(px), y = Math.floor(py);
  if (x < 0 || y < 0 || x >= meta.w || y >= meta.h) return 0;
  return meta.mask[y * meta.w + x];
}

/** <img> of a trimmed sprite at a given rendered height (or width). */
export function TrimmedImg({ src, height, width, className, style, alt = "", ...rest }) {
  const metas = useSprites([src]);
  const m = metas[src];
  if (!m) return <span className={className} style={{ display: "inline-block", width: width || height, height: height || width, ...style }} />;
  const ar = m.w / m.h;
  const h = height ?? width / ar;
  const w = width ?? height * ar;
  return <img src={m.url} alt={alt} draggable={false} className={className} style={{ width: w, height: h, maxWidth: "none", ...style }} {...rest} />;
}
