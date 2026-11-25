// The first-person HUD. Contextual: nothing sits on screen unless it is needed now. A crosshair dot,
// the use prompt when you look at something, one NEXT line, short toasts, a title card when you
// arrive somewhere, and the dialogue box while someone is talking.
//
// The dialogue box advances with a tap/click on it, E, Enter or Space, or gamepad A. While it is open
// those keys are taken by the box (a capture listener stops them), so the game's own E handler
// never fires underneath it; <html> carries .fp-speaking so the touch interact button hides.
import { FP_ICONS } from "./icons.ts";
import { glyph, inputMode, watchInputMode } from "./input-mode.ts";
import { advance, current, startDialogue, tickDialogue, visibleText, monogram, speakerHue, type DialogueLine, type DialogueState } from "./dialogue.ts";
import { PAD } from "./pad.ts";
import { loadSettings, onSettingsChange, type FpSettings } from "./settings.ts";

export interface Hud {
  prompt(text: string | null): void;
  objective(text: string): void;
  toast(text: string): void;
  say(lines: { who: string; name: string; text: string }[]): Promise<void>;
  arrive(name: string): void;
  crosshair(active: boolean): void;
  destroy(): void;
  /** True while the dialogue box is open (extra to the contract: lets the engine pause walking). */
  readonly speaking: boolean;
}

/** Fired on document whenever the prompt changes; detail is the label or null. touch.ts listens. */
export const PROMPT_EVENT = "casework:fp-prompt";

function h(tag: string, cls: string, html = ""): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/** Apply the look-and-feel settings to the page (reduced motion). */
export function applyFeel(s: FpSettings): void {
  document.documentElement.classList.toggle("fp-reduced", s.reducedMotion);
}

/** The prompt's label without a key the caller may have put in front ("E  Read the board"). */
export function promptLabel(text: string): string {
  return text.replace(/^(E|Enter)\s{2,}(?=\S)/, "").trim();
}

export function createHud(root: HTMLElement): Hud {
  watchInputMode();
  let settings = loadSettings();
  applyFeel(settings);
  const offSettings = onSettingsChange((s) => {
    settings = s;
    applyFeel(s);
  });
  const reduced = () => settings.reducedMotion;

  const layer = h("div", "fp-hud");
  const cross = h("div", "fp-cross");
  const prompt = h("div", "fp-prompt");
  prompt.hidden = true;
  const next = h("div", "fp-next");
  next.setAttribute("role", "status");
  next.hidden = true;
  next.innerHTML = `<span class="fp-next-ic">${FP_ICONS.next}</span><span class="fp-next-tx"><small>Next</small><b></b></span>`;
  const toasts = h("div", "fp-toasts");
  toasts.setAttribute("role", "status");
  toasts.setAttribute("aria-live", "polite");
  const card = h("div", "fp-arrive");
  card.hidden = true;
  card.setAttribute("aria-live", "polite");
  const box = h("div", "fp-say");
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-live", "polite");
  box.setAttribute("aria-label", "Conversation");
  box.innerHTML = `<span class="fp-say-tile" aria-hidden="true"></span><div class="fp-say-body"><b class="fp-say-name"></b><p class="fp-say-text"></p></div><span class="fp-say-more" aria-hidden="true"></span>`;
  layer.append(cross, prompt, next, toasts, card, box);
  root.append(layer);

  // ---- prompt ----
  let promptText: string | null = null;
  const paintPrompt = () => {
    prompt.hidden = !promptText;
    if (!promptText) return;
    const mode = inputMode();
    const key = mode === "touch" ? `<span class="fp-tap">${FP_ICONS.hand}</span>` : `<kbd>${glyph("use", mode)}</kbd>`;
    prompt.innerHTML = `${key}<span></span>`;
    (prompt.lastElementChild as HTMLElement).textContent = promptText;
  };
  const onInput = () => {
    paintPrompt();
    if (!box.hidden) paintMore();
  };
  document.addEventListener("casework:fp-input", onInput);

  // ---- objective ----
  let nextTimer = 0;
  // ---- arrival card ----
  let cardTimer = 0;

  // ---- dialogue ----
  let dlg: DialogueState | null = null;
  let finish: (() => void) | null = null;
  let chain: Promise<void> = Promise.resolve();
  let raf = 0;
  let last = 0;
  let padPrevA = true; // a held A that opened the talk shouldn't skip its first line
  const tile = box.querySelector(".fp-say-tile") as HTMLElement;
  const nameEl = box.querySelector(".fp-say-name") as HTMLElement;
  const textEl = box.querySelector(".fp-say-text") as HTMLElement;
  const more = box.querySelector(".fp-say-more") as HTMLElement;
  const paintMore = () => {
    const mode = inputMode();
    more.innerHTML = mode === "touch" ? "Tap ▸" : `<kbd>${glyph("use", mode)}</kbd> ▸`;
  };
  const paintLine = () => {
    if (!dlg) return;
    const l = current(dlg);
    if (!l) return;
    const narr = l.who === "narrator";
    box.classList.toggle("narrator", narr);
    box.classList.toggle("you", l.who === "you");
    box.style.setProperty("--who-h", String(speakerHue(l.who)));
    tile.textContent = narr ? "" : monogram(l.name || l.who);
    tile.hidden = narr;
    nameEl.textContent = narr ? "" : l.name || l.who;
    nameEl.hidden = narr;
    const shown = visibleText(dlg);
    // the whole line is laid out from the start (so the box never jumps); the rest is invisible
    textEl.innerHTML = "";
    const a = document.createElement("span");
    a.textContent = shown;
    const b = document.createElement("span");
    b.className = "fp-say-rest";
    b.textContent = l.text.slice(shown.length);
    textEl.append(a, b);
    box.classList.toggle("typing", shown.length < l.text.length);
  };
  const frame = (t: number) => {
    if (!dlg) return;
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    const before = dlg.shown;
    dlg = tickDialogue(dlg, dt);
    if (Math.floor(dlg.shown) !== Math.floor(before)) paintLine();
    // gamepad A advances too
    const gp = navigator.getGamepads?.().find((p) => p && p.mapping === "standard");
    const a = !!gp?.buttons[PAD.a]?.pressed;
    if (a && !padPrevA) press();
    padPrevA = a;
    raf = requestAnimationFrame(frame);
  };
  const press = () => {
    if (!dlg) return;
    const r = advance(dlg, reduced());
    dlg = r.state;
    if (r.did === "done") close();
    else paintLine();
  };
  const close = () => {
    cancelAnimationFrame(raf);
    dlg = null;
    box.hidden = true;
    document.documentElement.classList.remove("fp-speaking");
    const f = finish;
    finish = null;
    f?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (!dlg) return;
    if (e.code === "KeyE" || e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) press();
    }
  };
  addEventListener("keydown", onKey, true);
  const onBoxDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    press();
  };
  box.addEventListener("pointerdown", onBoxDown);

  const open = (lines: DialogueLine[]): Promise<void> =>
    new Promise((res) => {
      dlg = startDialogue(lines, reduced());
      if (dlg.done) {
        dlg = null;
        res();
        return;
      }
      finish = res;
      box.hidden = false;
      document.documentElement.classList.add("fp-speaking");
      paintMore();
      paintLine();
      last = 0;
      padPrevA = true;
      raf = requestAnimationFrame(frame);
    });

  const hud: Hud = {
    get speaking() {
      return dlg !== null;
    },
    prompt(text) {
      const t = text ? promptLabel(text) : null;
      if (t === promptText) return;
      promptText = t || null;
      paintPrompt();
      document.dispatchEvent(new CustomEvent(PROMPT_EVENT, { detail: promptText }));
    },
    objective(text) {
      const b = next.querySelector("b") as HTMLElement;
      if (!text) {
        next.hidden = true;
        b.textContent = "";
        return;
      }
      const changed = b.textContent !== text || next.hidden;
      next.hidden = false;
      b.textContent = text;
      if (!changed) return;
      next.classList.remove("flash", "quiet");
      void next.offsetWidth;
      next.classList.add("flash");
      // after a while it steps back (still readable) so it doesn't compete with the room
      clearTimeout(nextTimer);
      nextTimer = window.setTimeout(() => next.classList.add("quiet"), 9000);
    },
    toast(text) {
      if (!text) return;
      const t = h("div", "fp-toast", `<span class="fp-toast-ic">${FP_ICONS.check}</span><span></span>`);
      (t.lastElementChild as HTMLElement).textContent = text;
      toasts.append(t);
      while (toasts.children.length > 3) toasts.firstElementChild?.remove();
      const sec = Math.min(6, 2.2 + text.length * 0.03);
      window.setTimeout(() => t.classList.add("out"), sec * 1000);
      window.setTimeout(() => t.remove(), sec * 1000 + 700);
    },
    say(lines) {
      const run = chain.then(() => open(lines.map((l) => ({ who: String(l.who ?? ""), name: String(l.name ?? ""), text: String(l.text ?? "") }))));
      chain = run.catch(() => undefined);
      return run;
    },
    arrive(name) {
      if (!name) return;
      // "County Medical Examiner — ground floor" → big title, small place line
      const [title, ...rest] = name.split(/\s+[—–-]\s+/);
      card.innerHTML = `<span class="fp-arrive-ic">${FP_ICONS.pin}</span><h2></h2><p></p>`;
      (card.querySelector("h2") as HTMLElement).textContent = title ?? name;
      const sub = card.querySelector("p") as HTMLElement;
      sub.textContent = rest.join(" — ");
      sub.hidden = rest.length === 0;
      card.hidden = false;
      card.classList.remove("show");
      void card.offsetWidth;
      card.classList.add("show");
      clearTimeout(cardTimer);
      cardTimer = window.setTimeout(() => {
        card.hidden = true;
        card.classList.remove("show");
      }, 3400);
    },
    crosshair(active) {
      cross.classList.toggle("active", active);
    },
    destroy() {
      cancelAnimationFrame(raf);
      clearTimeout(nextTimer);
      clearTimeout(cardTimer);
      removeEventListener("keydown", onKey, true);
      document.removeEventListener("casework:fp-input", onInput);
      offSettings();
      if (dlg) close();
      document.documentElement.classList.remove("fp-speaking");
      layer.remove();
    },
  };
  return hud;
}
