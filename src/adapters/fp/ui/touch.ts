// Touch controls: a stick for the left thumb (it appears where the thumb lands on the left half; a
// faint ring waits in the lower left), drag anywhere on the right half to look, a big interact
// button that appears only while a prompt is showing, a notebook button and a pause button. Only
// shown when the player is on touch (html[data-fp-input=touch]). Ported from Frozen Star's
// controls.js (MIT, same owner).
//
// read() is polled once a frame. forward/right are −1..1; lookDx/lookDy are radians at sensitivity 1
// (+x = finger moved right, +y = finger moved down; feed them through stick.ts lookDelta with the
// player's settings, like the mouse); interact/notebook/pause are true once per tap.
import { FP_ICONS } from "./icons.ts";
import { watchInputMode } from "./input-mode.ts";
import { PROMPT_EVENT } from "./hud.ts";
import { LOOK_TOUCH, STICK_RADIUS, knob, stick } from "./stick.ts";

export interface TouchRead { forward: number; right: number; lookDx: number; lookDy: number; interact: boolean; notebook: boolean; /** extra: the pause button */ pause: boolean; /** extra: stick pushed to its rim */ run: boolean }

/** Touches that start on these belong to the UI, not the view. */
const UI = "button, a, input, label, .fp-say, .fp-menu-back, .fp-panel, .fp-sheet, [data-fp-ui]";

export function createTouchControls(root: HTMLElement): { read(): TouchRead; destroy(): void } {
  watchInputMode();
  const layer = document.createElement("div");
  layer.className = "fp-touch";
  layer.innerHTML =
    `<div class="fp-stick rest" aria-hidden="true"><i></i></div>` +
    `<button type="button" class="fp-t-use" hidden><span>${FP_ICONS.hand}</span><b>Use</b></button>` +
    `<button type="button" class="fp-t-btn fp-t-notebook" aria-label="Notebook">${FP_ICONS.notebook}</button>` +
    `<button type="button" class="fp-t-btn fp-t-pause" aria-label="Pause">${FP_ICONS.pause}</button>`;
  root.append(layer);
  const stickEl = layer.querySelector(".fp-stick") as HTMLElement;
  const knobEl = stickEl.querySelector("i") as HTMLElement;
  const use = layer.querySelector(".fp-t-use") as HTMLButtonElement;
  const useLabel = use.querySelector("b") as HTMLElement;

  let interact = false, notebook = false, pause = false;
  let lookDx = 0, lookDy = 0;
  let move = { forward: 0, right: 0, run: false };
  let stickTouch: { id: number; x: number; y: number } | null = null;
  let lookTouch: { id: number; x: number; y: number } | null = null;

  const tap = (b: Element, fn: () => void) =>
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  tap(use, () => (interact = true));
  tap(layer.querySelector(".fp-t-notebook") as Element, () => (notebook = true));
  tap(layer.querySelector(".fp-t-pause") as Element, () => (pause = true));
  // keyboard users who reach these buttons get the same actions
  use.addEventListener("click", (e) => { if (e.detail === 0) interact = true; });

  const onPrompt = (e: Event) => {
    const label = (e as CustomEvent<string | null>).detail;
    use.hidden = !label;
    // the button carries the verb ("Read", "Examine"); the full prompt is on screen above it
    if (label) useLabel.textContent = (label.split(/\s+/)[0] ?? "Use").slice(0, 12);
  };
  document.addEventListener(PROMPT_EVENT, onPrompt);

  const rest = () => {
    stickEl.style.left = "";
    stickEl.style.top = "";
    stickEl.style.bottom = "";
    stickEl.classList.remove("on");
    stickEl.classList.add("rest");
    knobEl.style.transform = "";
  };

  const down = (e: PointerEvent) => {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    if ((e.target as Element | null)?.closest?.(UI)) return;
    if (document.documentElement.classList.contains("fp-menu-open")) return;
    const r = root.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (!stickTouch && x < r.width / 2) {
      stickTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
      stickEl.style.left = `${x}px`;
      stickEl.style.top = `${y}px`;
      stickEl.style.bottom = "auto";
      stickEl.classList.add("on");
      stickEl.classList.remove("rest");
    } else if (!lookTouch && x >= r.width / 2) {
      lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
    } else return;
    try {
      root.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer already ended */
    }
    e.preventDefault();
  };
  const moveH = (e: PointerEvent) => {
    if (stickTouch && e.pointerId === stickTouch.id) {
      const dx = e.clientX - stickTouch.x, dy = e.clientY - stickTouch.y;
      const [kx, ky] = knob(dx, dy);
      knobEl.style.transform = `translate(${kx}px, ${ky}px)`;
      move = stick(dx, dy, STICK_RADIUS);
      e.preventDefault();
    } else if (lookTouch && e.pointerId === lookTouch.id) {
      lookDx += (e.clientX - lookTouch.x) * LOOK_TOUCH;
      lookDy += (e.clientY - lookTouch.y) * LOOK_TOUCH;
      lookTouch.x = e.clientX;
      lookTouch.y = e.clientY;
      e.preventDefault();
    }
  };
  const up = (e: PointerEvent) => {
    if (stickTouch && e.pointerId === stickTouch.id) {
      stickTouch = null;
      move = { forward: 0, right: 0, run: false };
      rest();
    }
    if (lookTouch && e.pointerId === lookTouch.id) lookTouch = null;
  };
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", moveH);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
  // a menu opening mid-drag drops both thumbs, so nothing keeps walking behind it
  const onBlur = () => {
    stickTouch = null;
    lookTouch = null;
    move = { forward: 0, right: 0, run: false };
    rest();
  };
  addEventListener("blur", onBlur);

  return {
    read() {
      const out: TouchRead = { forward: move.forward, right: move.right, run: move.run, lookDx, lookDy, interact, notebook, pause };
      lookDx = 0;
      lookDy = 0;
      interact = notebook = pause = false;
      return out;
    },
    destroy() {
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", moveH);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
      removeEventListener("blur", onBlur);
      document.removeEventListener(PROMPT_EVENT, onPrompt);
      layer.remove();
    },
  };
}
