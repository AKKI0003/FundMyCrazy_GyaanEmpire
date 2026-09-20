import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize, Minimize, LocateFixed } from "lucide-react";
import { Ground } from "./Ground";
import { PlaceholderSprite, placeholderBounds } from "./Placeholder";
import { HW, HH, footprintCenter, footprintCorners, pointsAttr, depthOf, toGrid, worldBounds, clamp } from "../../game/iso";
import { useSprites, alphaAt } from "../../game/sprites";
import { useFullscreen } from "../../game/fullscreen";
import { ART } from "../../game/assets";

const MIN_Z = 0.28;
const MAX_Z = 1.9;
const DRAG_PX = 5;

/**
 * IsoStage — the reusable game viewport (base, topic board, raid view).
 *
 * Camera: pan (drag empty ground), zoom (wheel / pinch / buttons), fit, and real
 * fullscreen. The camera lives in a ref and is applied straight to the DOM, so
 * zooming never re-renders React and — unlike the old board — never touches page
 * layout: the stage is `overflow: hidden`, wheel/pinch are captured, and only the
 * inner "world" layer is transformed.
 *
 * Items: { uid, x, y, w, h, src?, height?, ground?, placeholder?:{tone,glyph,boxH},
 *          label?, badge?, dim?, glow?, pending?, filter? }   (x,y,w,h in tiles)
 */
export function IsoStage({
  gw,
  gh,
  items,
  paths = [],
  selectedUid = null,
  onSelect,
  showGrid = false,
  movable, // (uid) => bool
  canDrop, // (uid, x, y) => bool
  onMove, // (uid, x, y)
  popup = null, // { uid, node }
  overlay = null, // screen-space children (HUD)
  fitKey = "",
  fitInsets = { top: 80, bottom: 90, left: 20, right: 20 },
  fitMaxZoom = 1.05,
  showFootprints = false,
  controlsClassName = "",
  skyed = true,
}) {
  const boxRef = useRef(null);
  const worldRef = useRef(null);
  const cam = useRef({ x: 0, y: 0, z: 1 });
  const userMoved = useRef(false);
  const [zoomShown, setZoomShown] = useState(1);
  const [drag, setDrag] = useState(null); // { uid, x, y, valid }
  const dragRef = useRef(null);
  const { isFs, toggle: toggleFs, supported: fsSupported } = useFullscreen();

  const sprites = useSprites(items.map((i) => i.src));

  // ---- layout ---------------------------------------------------------------
  const laid = useMemo(() => {
    return items
      .map((it) => {
        const live = drag && drag.uid === it.uid ? drag : null;
        const x = live ? live.x : it.x;
        const y = live ? live.y : it.y;
        const c = footprintCenter(x, y, it.w, it.h);
        const groundY = ((it.w + it.h) / 2) * HH * (it.ground ?? 0.55);
        let rect = null;
        let meta = null;
        if (it.src) {
          meta = sprites[it.src];
          if (meta) {
            const sh = it.height * (it.scale || 1);
            const sw = (sh * meta.w) / meta.h;
            rect = { left: c.x - sw / 2, top: c.y + groundY - sh, w: sw, h: sh };
          }
        } else if (it.placeholder) {
          const b = placeholderBounds(it.w, it.h, it.placeholder.boxH);
          rect = { left: c.x + b.left, top: c.y + b.top, w: b.right - b.left, h: b.bottom - b.top };
        }
        return { it, x, y, c, groundY, rect, meta, z: depthOf(x, y, it.w, it.h), live };
      })
      .sort((a, b) => a.z - b.z);
  }, [items, sprites, drag]);
  const laidRef = useRef(laid);
  laidRef.current = laid;

  // ---- camera ---------------------------------------------------------------
  const apply = useCallback((animate = false) => {
    const el = worldRef.current;
    if (!el) return;
    const { x, y, z } = cam.current;
    el.style.transition = animate ? "transform .28s cubic-bezier(.2,.8,.2,1)" : "none";
    el.style.transform = `translate3d(${x}px,${y}px,0) scale(${z})`;
    el.style.setProperty("--inv", String(clamp(1 / z, 0.85, 1.7)));
  }, []);

  const constrain = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    const b = worldBounds(gw, gh);
    const c = cam.current;
    const wx = clamp((r.width / 2 - c.x) / c.z, b.minX - 120, b.maxX + 120);
    const wy = clamp((r.height / 2 - c.y) / c.z, b.minY - 120, b.maxY + 200);
    c.x = r.width / 2 - wx * c.z;
    c.y = r.height / 2 - wy * c.z;
  }, [gw, gh]);

  const zoomAt = useCallback(
    (factor, sx, sy, animate = false) => {
      const c = cam.current;
      const z2 = clamp(c.z * factor, MIN_Z, MAX_Z);
      const wx = (sx - c.x) / c.z;
      const wy = (sy - c.y) / c.z;
      c.z = z2;
      c.x = sx - wx * z2;
      c.y = sy - wy * z2;
      constrain();
      apply(animate);
      setZoomShown(z2);
    },
    [apply, constrain]
  );

  const fit = useCallback(
    (animate = false) => {
      const box = boxRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      if (!r.width || !r.height) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const l of laidRef.current) {
        const corners = footprintCorners(l.it.w, l.it.h);
        for (const p of corners) {
          minX = Math.min(minX, l.c.x + p.x); maxX = Math.max(maxX, l.c.x + p.x);
          minY = Math.min(minY, l.c.y + p.y); maxY = Math.max(maxY, l.c.y + p.y);
        }
        if (l.rect) {
          minX = Math.min(minX, l.rect.left); maxX = Math.max(maxX, l.rect.left + l.rect.w);
          minY = Math.min(minY, l.rect.top - 30); maxY = Math.max(maxY, l.rect.top + l.rect.h + 50);
        }
      }
      if (!isFinite(minX)) {
        const b = worldBounds(gw, gh);
        [minX, maxX, minY, maxY] = [b.minX, b.maxX, b.minY, b.maxY];
      }
      const pad = 50;
      const availW = r.width - fitInsets.left - fitInsets.right;
      const availH = r.height - fitInsets.top - fitInsets.bottom;
      const z = clamp(Math.min(availW / (maxX - minX + pad * 2), availH / (maxY - minY + pad * 2)), MIN_Z, fitMaxZoom);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      cam.current = { z, x: fitInsets.left + availW / 2 - cx * z, y: fitInsets.top + availH / 2 - cy * z };
      constrain();
      apply(animate);
      setZoomShown(z);
    },
    [gw, gh, fitInsets.top, fitInsets.bottom, fitInsets.left, fitInsets.right, fitMaxZoom, apply, constrain]
  );

  // Auto-fit until the person moves the camera themselves; always re-fit when fitKey changes.
  const lastFitKey = useRef(null);
  const spritesReady = Object.values(sprites).filter(Boolean).length;
  useLayoutEffect(() => {
    if (lastFitKey.current !== fitKey) {
      lastFitKey.current = fitKey;
      userMoved.current = false;
    }
    if (!userMoved.current) fit(false);
  }, [fitKey, spritesReady, fit, items.length]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => {
      if (!userMoved.current) fit(false);
      else { constrain(); apply(false); }
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [fit, constrain, apply]);

  // ---- hit testing ------------------------------------------------------------
  const screenToWorld = (sx, sy) => {
    const r = boxRef.current.getBoundingClientRect();
    const c = cam.current;
    return { x: (sx - r.left - c.x) / c.z, y: (sy - r.top - c.y) / c.z };
  };

  const hitTest = (wx, wy) => {
    const list = laidRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const l = list[i];
      if (l.rect && wx >= l.rect.left && wx <= l.rect.left + l.rect.w && wy >= l.rect.top && wy <= l.rect.top + l.rect.h) {
        if (l.meta) {
          const a = alphaAt(l.meta, ((wx - l.rect.left) / l.rect.w) * l.meta.w, ((wy - l.rect.top) / l.rect.h) * l.meta.h);
          if (a > 28) return l;
        } else if (l.it.placeholder) return l;
      }
      const g = toGrid(wx, wy);
      if (g.gx >= l.x && g.gx < l.x + l.it.w && g.gy >= l.y && g.gy < l.y + l.it.h) return l;
    }
    return null;
  };

  // ---- gestures -----------------------------------------------------------------
  const handlers = useRef({});
  handlers.current = { onSelect, movable, canDrop, onMove };

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const pointers = new Map();
    let mode = null; // 'pan' | 'drag' | 'pinch'
    let down = null;
    let pinch = null;

    const onWheel = (e) => {
      e.preventDefault();
      userMoved.current = true;
      const r = box.getBoundingClientRect();
      const k = e.ctrlKey ? 0.012 : 0.0016;
      zoomAt(Math.exp(-e.deltaY * k), e.clientX - r.left, e.clientY - r.top);
    };

    const onDown = (e) => {
      if (e.target.closest("[data-no-stage]")) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      box.setPointerCapture?.(e.pointerId);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        mode = "pinch";
        down = null;
        return;
      }
      const w = screenToWorld(e.clientX, e.clientY);
      const hit = hitTest(w.x, w.y);
      down = { x: e.clientX, y: e.clientY, cx: cam.current.x, cy: cam.current.y, hit, moved: false, w };
      if (hit && handlers.current.movable?.(hit.it.uid)) {
        const g = toGrid(w.x, w.y);
        down.grab = { dx: g.gx - (hit.x + hit.it.w / 2), dy: g.gy - (hit.y + hit.it.h / 2) };
        mode = "drag";
      } else mode = "pan";
    };

    const onMovePtr = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === "pinch" && pointers.size >= 2) {
        userMoved.current = true;
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const r = box.getBoundingClientRect();
        cam.current.x += mx - pinch.mx;
        cam.current.y += my - pinch.my;
        zoomAt(d / pinch.d, mx - r.left, my - r.top);
        pinch = { d, mx, my };
        return;
      }
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) > DRAG_PX) down.moved = true;
      if (!down.moved) return;
      if (mode === "pan") {
        userMoved.current = true;
        cam.current.x = down.cx + dx;
        cam.current.y = down.cy + dy;
        constrain();
        apply(false);
        box.style.cursor = "grabbing";
      } else if (mode === "drag") {
        const w = screenToWorld(e.clientX, e.clientY);
        const g = toGrid(w.x, w.y);
        const it = down.hit.it;
        const x = Math.round(g.gx - down.grab.dx - it.w / 2);
        const y = Math.round(g.gy - down.grab.dy - it.h / 2);
        const cur = dragRef.current;
        if (!cur || cur.x !== x || cur.y !== y) {
          const next = { uid: it.uid, x, y, valid: handlers.current.canDrop ? handlers.current.canDrop(it.uid, x, y) : true };
          dragRef.current = next;
          setDrag(next);
        }
      }
    };

    const end = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      box.releasePointerCapture?.(e.pointerId);
      box.style.cursor = "";
      if (mode === "pinch") {
        if (pointers.size < 2) mode = null;
        return;
      }
      const d = down;
      down = null;
      if (!d) return;
      if (mode === "drag" && d.moved) {
        const fin = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (fin && fin.valid) handlers.current.onMove?.(fin.uid, fin.x, fin.y);
        return;
      }
      if (!d.moved && e.type === "pointerup") handlers.current.onSelect?.(d.hit ? d.hit.it.uid : null);
      mode = null;
    };

    box.addEventListener("wheel", onWheel, { passive: false });
    box.addEventListener("pointerdown", onDown);
    box.addEventListener("pointermove", onMovePtr);
    box.addEventListener("pointerup", end);
    box.addEventListener("pointercancel", end);
    const stopGesture = (e) => e.preventDefault(); // Safari pinch-zoom
    box.addEventListener("gesturestart", stopGesture);
    return () => {
      box.removeEventListener("wheel", onWheel);
      box.removeEventListener("pointerdown", onDown);
      box.removeEventListener("pointermove", onMovePtr);
      box.removeEventListener("pointerup", end);
      box.removeEventListener("pointercancel", end);
      box.removeEventListener("gesturestart", stopGesture);
    };
  }, [apply, constrain, zoomAt]);

  const centerZoom = (f) => {
    userMoved.current = true;
    const r = boxRef.current.getBoundingClientRect();
    zoomAt(f, r.width / 2, r.height / 2, true);
  };

  // Keyboard: + / - / 0 / F
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      if (e.key === "+" || e.key === "=") centerZoom(1.25);
      else if (e.key === "-") centerZoom(0.8);
      else if (e.key === "0") { userMoved.current = false; fit(true); }
      else if (e.key === "f" || e.key === "F") toggleFs();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- render -----------------------------------------------------------------------
  const selected = laid.find((l) => l.it.uid === selectedUid);
  const dragged = drag ? laid.find((l) => l.it.uid === drag.uid) : null;
  const popupItem = popup && laid.find((l) => l.it.uid === popup.uid);

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 overflow-hidden select-none"
      style={{
        touchAction: "none",
        cursor: "grab",
        overscrollBehavior: "contain",
        ...(skyed ? { backgroundImage: `url(${ART.sky})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
      }}
    >
      <div ref={worldRef} style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", willChange: "transform", ["--inv"]: 1 }}>
        <Ground gw={gw} gh={gh} showGrid={showGrid} />

        {/* footprints, paths, selection */}
        <svg width="1" height="1" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
          {paths.map((p, i) => (
            <path key={i} d={p.d} fill="none" stroke={p.active ? "#f6e4a8" : "#d9c79a"} strokeOpacity={p.active ? 0.95 : 0.6} strokeWidth={p.active ? 9 : 7} strokeLinecap="round" strokeDasharray={p.active ? "" : "1 14"} />
          ))}
          {showFootprints &&
            laid.map((l) => (
              <polygon key={`fp${l.it.uid}`} transform={`translate(${l.c.x} ${l.c.y})`} points={pointsAttr(footprintCorners(l.it.w, l.it.h))} fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" />
            ))}
          {selected && !selected.live && !drag && (
            <polygon transform={`translate(${selected.c.x} ${selected.c.y})`} points={pointsAttr(footprintCorners(selected.it.w, selected.it.h))} fill="rgba(255,226,138,.22)" stroke="#ffe28a" strokeWidth="3" strokeLinejoin="round" />
          )}
          {drag && dragged && (
            <polygon
              transform={`translate(${dragged.c.x} ${dragged.c.y})`}
              points={pointsAttr(footprintCorners(dragged.it.w, dragged.it.h))}
              fill={drag.valid ? "rgba(90,220,120,.42)" : "rgba(240,70,60,.45)"}
              stroke={drag.valid ? "#b8ffc8" : "#ffb3ad"}
              strokeWidth="3"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {laid.map((l) => {
          const { it, c, groundY, rect, live } = l;
          const isDragging = !!live;
          return (
            <div
              key={it.uid}
              data-uid={it.uid}
              style={{
                position: "absolute",
                left: c.x,
                top: c.y,
                zIndex: 10 + Math.round(l.z * 10),
                transition: isDragging ? "left .07s, top .07s" : undefined,
                pointerEvents: "none",
              }}
            >
              {it.src && rect && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      left: -((it.w + it.h) / 2) * HW * 0.62,
                      top: groundY - ((it.w + it.h) / 2) * HH * 0.36,
                      width: ((it.w + it.h) / 2) * HW * 1.24,
                      height: ((it.w + it.h) / 2) * HH * 0.72,
                      borderRadius: "50%",
                      background: "radial-gradient(closest-side, rgba(20,40,20,.42), rgba(20,40,20,0))",
                    }}
                  />
                  {it.glow && (
                    <div style={{ position: "absolute", left: rect.left - c.x, top: rect.top - c.y, width: rect.w, height: rect.h, background: "radial-gradient(closest-side, rgba(255,222,120,.55), rgba(255,222,120,0))", filter: "blur(6px)" }} />
                  )}
                  <img
                    src={l.meta.url}
                    alt=""
                    draggable={false}
                    style={{
                      position: "absolute",
                      left: rect.left - c.x,
                      top: rect.top - c.y - (isDragging ? 10 : 0),
                      width: rect.w,
                      height: rect.h,
                      maxWidth: "none",
                      filter: [it.filter, isDragging ? "drop-shadow(0 12px 8px rgba(0,0,0,.3))" : "drop-shadow(0 4px 3px rgba(20,40,20,.25))"].filter(Boolean).join(" "),
                      opacity: it.dim ? 0.5 : it.pending ? 0.9 : 1,
                      transition: "top .12s",
                    }}
                  />
                </>
              )}
              {!it.src && it.placeholder && (
                <PlaceholderSprite w={it.w} h={it.h} tone={it.placeholder.tone} glyph={it.placeholder.glyph} boxH={it.placeholder.boxH} dim={it.dim} pending={it.pending} />
              )}
            </div>
          );
        })}

        {/* Nameplates + badges live in their own layer ABOVE every sprite, so a wall
            in front of a building can never bury its label. */}
        {laid.map((l) => {
          const { it, c, groundY, rect } = l;
          if (!it.badge && !it.label) return null;
          return (
            <div key={`lb${it.uid}`} style={{ position: "absolute", left: c.x, top: c.y, zIndex: 5000, pointerEvents: "none" }}>
              {it.badge && rect && (
                <div data-no-stage style={{ position: "absolute", left: 0, top: rect.top - c.y - 6, transform: "translate(-50%,-100%) scale(var(--inv))", transformOrigin: "50% 100%", pointerEvents: "auto", whiteSpace: "nowrap" }}>
                  {it.badge}
                </div>
              )}
              {it.label && (
                <div style={{ position: "absolute", left: 0, top: groundY + 6, transform: "translateX(-50%) scale(var(--inv))", transformOrigin: "50% 0", whiteSpace: "nowrap" }}>
                  {it.label}
                </div>
              )}
            </div>
          );
        })}

        {popup && popupItem && (
          <div
            data-no-stage
            style={{
              position: "absolute",
              left: popupItem.c.x,
              top: (popupItem.rect ? popupItem.rect.top : popupItem.c.y - 60) - (popup.lift ?? 26),
              zIndex: 9000,
              transform: "translate(-50%,-100%) scale(var(--inv))",
              transformOrigin: "50% 100%",
              pointerEvents: "auto",
            }}
          >
            {popup.node}
          </div>
        )}
      </div>

      {overlay}

      <div className={`absolute z-20 flex flex-col gap-2 left-3 top-1/2 -translate-y-1/2 ${controlsClassName}`} data-no-stage>
        <button className="hud-round" onClick={() => centerZoom(1.3)} title="Zoom in (+)" aria-label="Zoom in"><ZoomIn size={18} /></button>
        <button className="hud-round" onClick={() => centerZoom(0.77)} title="Zoom out (−)" aria-label="Zoom out"><ZoomOut size={18} /></button>
        <button className="hud-round" onClick={() => { userMoved.current = false; fit(true); }} title="Recenter (0)" aria-label="Recenter"><LocateFixed size={18} /></button>
        {fsSupported && (
          <button className="hud-round" onClick={toggleFs} title={isFs ? "Exit fullscreen (F)" : "Fullscreen (F)"} aria-label="Toggle fullscreen">
            {isFs ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}
