// Gamepad: walking/looking input in the same shape as the touch controls (so the engine merges
// keyboard, touch and pad the same way), and menu navigation (d-pad or left stick moves focus, A
// presses, B goes back, Start pauses or resumes). Standard mapping only. Ported from Frozen Star's
// controls.js and ui/padnav.js (MIT, same owner).
import { LOOK_PAD, deadzone } from "./stick.ts";

export const PAD = { a: 0, b: 1, x: 2, y: 3, start: 9, up: 12, down: 13, left: 14, right: 15 } as const;

export interface PadRead { forward: number; right: number; run: boolean; lookDx: number; lookDy: number; interact: boolean; notebook: boolean; pause: boolean; back: boolean }

const firstPad = (): Gamepad | null => {
  for (const gp of navigator.getGamepads?.() ?? []) if (gp && gp.mapping === "standard") return gp;
  return null;
};

/** A reader for walking with a gamepad: call read(dt) once a frame. Buttons report on the frame
 * they go down (edges), sticks report every frame. lookDx/lookDy are radians at sensitivity 1. */
export function createPadReader(): { read(dt: number): PadRead } {
  let prev: boolean[] = [];
  return {
    read(dt) {
      const gp = firstPad();
      const none: PadRead = { forward: 0, right: 0, run: false, lookDx: 0, lookDy: 0, interact: false, notebook: false, pause: false, back: false };
      if (!gp) {
        prev = [];
        return none;
      }
      const down = gp.buttons.map((b) => b.pressed);
      const edge = (i: number) => !!down[i] && !prev[i];
      const [lx, ly] = deadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
      const [rx, ry] = deadzone(gp.axes[2] ?? 0, gp.axes[3] ?? 0);
      const out: PadRead = {
        forward: -ly,
        right: lx,
        run: Math.hypot(lx, ly) > 0.92 || !!down[10],
        lookDx: rx * Math.abs(rx) * LOOK_PAD * dt,
        lookDy: ry * Math.abs(ry) * LOOK_PAD * 0.7 * dt,
        interact: edge(PAD.a),
        notebook: edge(PAD.y),
        pause: edge(PAD.start),
        back: edge(PAD.b),
      };
      prev = down;
      return out;
    },
  };
}

const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled])";

function visible(el: HTMLElement): boolean {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && !el.closest("[hidden]");
}

/** Move focus up/down through the focusable controls in `root`; left/right nudges a focused slider. */
export function moveFocus(root: HTMLElement, dir: "up" | "down" | "left" | "right"): void {
  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
  if (!all.length) return;
  const a = document.activeElement as HTMLElement | null;
  if ((dir === "left" || dir === "right") && a instanceof HTMLInputElement && a.type === "range" && all.includes(a)) {
    const step = Number(a.step) || 1;
    a.value = String(Number(a.value) + (dir === "right" ? step : -step) * 2);
    a.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  const i = a ? all.indexOf(a) : -1;
  const d = dir === "down" || dir === "right" ? 1 : -1;
  const next = all[i < 0 ? 0 : (i + d + all.length) % all.length];
  next?.focus();
  next?.scrollIntoView?.({ block: "nearest" });
}

/** Drive a menu with a gamepad while it is open. Returns a stop function. */
export function padNav(opts: { container: () => HTMLElement | null; onBack?: () => void; onStart?: () => void }): () => void {
  let prev: boolean[] = [];
  let holdDir: string | null = null;
  let holdT = 0;
  let raf = 0;
  let alive = true;
  const tick = (now: number) => {
    if (!alive) return;
    const gp = firstPad();
    if (gp) {
      const b = (i: number) => !!gp.buttons[i]?.pressed;
      const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
      const dir = b(PAD.up) || ay < -0.6 ? "up" : b(PAD.down) || ay > 0.6 ? "down" : b(PAD.left) || ax < -0.6 ? "left" : b(PAD.right) || ax > 0.6 ? "right" : null;
      const root = opts.container();
      if (root) {
        if (dir && dir !== holdDir) {
          moveFocus(root, dir);
          holdT = now + 380;
        } else if (dir && now > holdT) {
          moveFocus(root, dir);
          holdT = now + 110;
        }
        if (b(PAD.a) && !prev[PAD.a]) {
          const a = document.activeElement as HTMLElement | null;
          if (a && root.contains(a) && a !== document.body) a.click();
          else moveFocus(root, "down");
        }
        if (b(PAD.b) && !prev[PAD.b]) opts.onBack?.();
      }
      if (b(PAD.start) && !prev[PAD.start]) opts.onStart?.();
      holdDir = dir;
      prev = gp.buttons.map((x) => x.pressed);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
  };
}
