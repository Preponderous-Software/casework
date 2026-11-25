// Keyboard and mouse (pointer lock, or drag-to-look without it). Touch and gamepad come from the
// feel lane's ui/touch.ts and ui/pad.ts and are merged in by the game. Look deltas are raw radians
// at sensitivity 1; the game turns them into yaw/pitch with ui/stick.ts lookDelta.
import { LOOK_MOUSE } from "./ui/stick.ts";

export interface Intent {
  forward: number;
  right: number;
  run: boolean;
  /** Look deltas in radians at sensitivity 1 (positive x = moved right, positive y = moved down). */
  lookX: number;
  lookY: number;
}

export interface Controls {
  read(dt: number): Intent;
  /** Ask for pointer lock (desktop, on a click into the view). */
  lock(): void;
  unlock(): void;
  readonly locked: boolean;
  clear(): void;
}

const LOOK_DRAG = LOOK_MOUSE * 2;

export interface ControlHooks {
  /** A key pressed once (not held), e.g. "interact", "notebook", "back", "turn", "leave". */
  onPress(action: "interact" | "notebook" | "back" | "turn" | "leave"): void;
  /** A click/tap on the view without dragging, in client pixels. */
  onTap(x: number, y: number): void;
  /** Is the game taking input now (not in a menu or panel)? */
  active(): boolean;
}

export function createControls(surface: HTMLElement, hooks: ControlHooks): Controls {
  const held = new Set<string>();
  let lookX = 0, lookY = 0;
  let drag: { id: number; x: number; y: number; moved: number } | null = null;
  const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.("input, textarea, select");

  const kd = (e: KeyboardEvent) => {
    if (typing(e.target)) return;
    const k = e.code;
    if (k === "Escape") return hooks.onPress("back");
    if (!hooks.active()) return;
    if (k === "Tab" || k === "KeyN") {
      e.preventDefault();
      if (!e.repeat) hooks.onPress("notebook");
      return;
    }
    if ((k === "KeyE" || k === "Enter" || k === "Space") && !(e.target as HTMLElement | null)?.closest?.("button, a")) {
      e.preventDefault();
      if (!e.repeat) hooks.onPress("interact");
      return;
    }
    if (k === "KeyT" && !e.repeat) hooks.onPress("turn");
    if (k === "KeyQ" && !e.repeat) hooks.onPress("leave");
    if (/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(k)) {
      e.preventDefault();
      held.add(k);
    }
  };
  const ku = (e: KeyboardEvent) => held.delete(e.code);
  const blur = () => held.clear();
  const mm = (e: MouseEvent) => {
    if (document.pointerLockElement === surface && hooks.active()) {
      lookX += e.movementX * LOOK_MOUSE;
      lookY += e.movementY * LOOK_MOUSE;
    }
  };
  // Mouse or pen without pointer lock: drag to look, click to tap. (Touch is the touch module's.)
  const pd = (e: PointerEvent) => {
    if (e.pointerType === "touch" || !hooks.active()) return;
    if (document.pointerLockElement === surface) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    try {
      surface.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic */
    }
  };
  const pm = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (drag.moved > 5) {
      lookX += dx * LOOK_DRAG;
      lookY += dy * LOOK_DRAG;
    }
  };
  const pu = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const tap = drag.moved <= 5;
    drag = null;
    if (tap) hooks.onTap(e.clientX, e.clientY);
  };
  // Touch taps (no drag) count as taps too, for exam-region picking on phones.
  let touchStart: { x: number; y: number; t: number } | null = null;
  const ts = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    if (t && e.touches.length === 1 && !(t.target as HTMLElement).closest?.("button, a")) touchStart = { x: t.clientX, y: t.clientY, t: performance.now() };
  };
  const te = (e: TouchEvent) => {
    const t = e.changedTouches[0];
    if (touchStart && t && Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) < 10 && performance.now() - touchStart.t < 400 && hooks.active()) hooks.onTap(t.clientX, t.clientY);
    touchStart = null;
  };

  addEventListener("keydown", kd);
  addEventListener("keyup", ku);
  addEventListener("blur", blur);
  document.addEventListener("mousemove", mm);
  surface.addEventListener("pointerdown", pd);
  surface.addEventListener("pointermove", pm);
  surface.addEventListener("pointerup", pu);
  surface.addEventListener("pointercancel", () => (drag = null));
  surface.addEventListener("touchstart", ts, { passive: true });
  surface.addEventListener("touchend", te);

  return {
    read(dt) {
      const h = (...ks: string[]) => (ks.some((k) => held.has(k)) ? 1 : 0);
      void dt;
      const forward = h("KeyW", "ArrowUp") - h("KeyS", "ArrowDown");
      const right = h("KeyD", "ArrowRight") - h("KeyA", "ArrowLeft");
      const run = h("ShiftLeft", "ShiftRight") > 0;
      const out = { forward, right, run, lookX, lookY };
      lookX = lookY = 0;
      if (!hooks.active()) return { forward: 0, right: 0, run: false, lookX: 0, lookY: 0 };
      return out;
    },
    lock() {
      if (document.pointerLockElement !== surface) {
        try {
          const r = surface.requestPointerLock?.() as unknown as Promise<void> | undefined;
          r?.catch?.(() => {});
        } catch {
          /* not allowed here */
        }
      }
    },
    unlock() {
      if (document.pointerLockElement === surface) document.exitPointerLock?.();
    },
    get locked() {
      return document.pointerLockElement === surface;
    },
    clear() {
      held.clear();
      lookX = lookY = 0;
      drag = null;
    },
  };
}
