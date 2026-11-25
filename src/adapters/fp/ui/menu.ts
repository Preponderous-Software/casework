// The title screen and the pause menu. Big icon tiles, one column on a phone; keyboard (Tab or the
// arrow keys, Enter, Esc), touch and gamepad (d-pad, A, B, Start) all work. Settings open inside the
// same card, so there is never a second layer to find your way out of.
import { FP_ICONS, type FpIcon } from "./icons.ts";
import { moveFocus, padNav } from "./pad.ts";
import { settingsPanel } from "./settings-panel.ts";
import { inputMode, watchInputMode } from "./input-mode.ts";

export interface MenuOpts {
  onStart(): void;
  onResume(): void;
  hasSave: boolean;
  /** New game when a save exists (extra to the contract). Without it, New game also calls onStart. */
  onNew?(): void;
  /** "Back to title" in the pause menu (extra). Without it the item reloads the page. */
  onQuit?(): void;
}

export interface Menu {
  open(kind: "title" | "pause"): void;
  close(): void;
  /** Which menu is showing, or null (extra to the contract). */
  readonly showing: "title" | "pause" | null;
}

/** Where the other ways to play live (relative to play.html at the site root). */
export const LINKS = { classic: "index.html", drill: "drill.html" } as const;

function tile(icon: FpIcon, label: string, sub: string, onClick: () => void, cls = ""): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `fp-tile ${cls}`.trim();
  b.innerHTML = `<span class="fp-tile-ic">${FP_ICONS[icon]}</span><span class="fp-tile-tx"><b></b><small></small></span>`;
  (b.querySelector("b") as HTMLElement).textContent = label;
  const sm = b.querySelector("small") as HTMLElement;
  sm.textContent = sub;
  sm.hidden = !sub;
  b.addEventListener("click", onClick);
  return b;
}

function links(): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = "fp-menu-links";
  nav.setAttribute("aria-label", "Other ways to play");
  nav.innerHTML = `<a href="${LINKS.classic}"><span>${FP_ICONS.folder}</span>Classic case mode</a><a href="${LINKS.drill}"><span>${FP_ICONS.clock}</span>Time-of-death drill</a>`;
  return nav;
}

export function createMenu(root: HTMLElement, opts: MenuOpts): Menu {
  watchInputMode();
  const back = document.createElement("div");
  back.className = "fp-menu-back";
  back.hidden = true;
  const card = document.createElement("div");
  card.className = "fp-menu";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.tabIndex = -1;
  back.append(card);
  root.append(back);

  let kind: "title" | "pause" | null = null;
  let view: "main" | "settings" = "main";
  let stopPad: (() => void) | null = null;
  let confirmNew = false;

  // keyboard and gamepad players get the first item focused; on touch a focus ring would just be noise
  const focusFirst = () => {
    if (inputMode() === "touch") return;
    (card.querySelector<HTMLElement>("button:not([disabled]), a[href]") ?? card).focus();
  };

  const paint = () => {
    card.replaceChildren();
    back.classList.toggle("title", kind === "title");
    back.classList.toggle("pause", kind === "pause");
    if (view === "settings") {
      card.setAttribute("aria-label", "Settings");
      card.append(settingsPanel(() => {
        view = "main";
        paint();
        focusFirst();
      }));
      return;
    }
    if (kind === "title") {
      card.setAttribute("aria-label", "Casework");
      const mark = document.createElement("header");
      mark.className = "fp-wordmark";
      mark.innerHTML = `<span class="fp-wordmark-ic">${FP_ICONS.badge}</span><h1>Casework</h1><p>County Medical Examiner. Your first week.</p>`;
      const tiles = document.createElement("div");
      tiles.className = "fp-tiles";
      if (opts.hasSave) tiles.append(tile("play", "Continue", "Pick up where you left off", () => { close(); opts.onStart(); }, "go"));
      const nb = tile("plus", "New game", opts.hasSave ? "Start the week over" : "Walk into the office", () => {
        if (opts.hasSave && !confirmNew) {
          confirmNew = true;
          (nb.querySelector("b") as HTMLElement).textContent = "Start over?";
          const sm = nb.querySelector("small") as HTMLElement;
          sm.textContent = "Press again: your saved week is replaced";
          nb.classList.add("warn");
          return;
        }
        close();
        (opts.onNew ?? opts.onStart)();
      }, opts.hasSave ? "" : "go");
      tiles.append(nb, tile("gear", "Settings", "Look, sound, comfort", () => { view = "settings"; paint(); focusFirst(); }));
      card.append(mark, tiles, links());
    } else {
      card.setAttribute("aria-label", "Paused");
      const head = document.createElement("header");
      head.className = "fp-pause-head";
      head.innerHTML = `<span class="fp-wordmark-ic">${FP_ICONS.pause}</span><h2>Paused</h2>`;
      const tiles = document.createElement("div");
      tiles.className = "fp-tiles";
      tiles.append(
        tile("play", "Resume", "", resume, "go"),
        tile("gear", "Settings", "", () => { view = "settings"; paint(); focusFirst(); }),
        tile("exit", "Back to title", "Your progress is saved", () => {
          if (opts.onQuit) { close(); opts.onQuit(); } else location.reload();
        }),
      );
      card.append(head, tiles, links());
    }
  };

  const resume = () => {
    if (kind !== "pause") return;
    close();
    opts.onResume();
  };
  const goBack = () => {
    if (view === "settings") {
      view = "main";
      paint();
      focusFirst();
    } else if (kind === "pause") resume();
  };

  const onKey = (e: KeyboardEvent) => {
    if (!kind) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      goBack();
      return;
    }
    const t = e.target as HTMLElement | null;
    const onRange = t instanceof HTMLInputElement && t.type === "range";
    if (e.key === "ArrowDown" || (e.key === "ArrowUp")) {
      e.preventDefault();
      moveFocus(card, e.key === "ArrowDown" ? "down" : "up");
    } else if (!onRange && t?.closest?.("[role=radiogroup]") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const btns = Array.from((t.closest("[role=radiogroup]") as HTMLElement).querySelectorAll<HTMLButtonElement>("button"));
      const i = btns.indexOf(t as HTMLButtonElement);
      const nb = btns[(i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length];
      nb?.click();
      nb?.focus();
    }
    // the game underneath never sees keys while a menu is open
    e.stopImmediatePropagation();
  };
  addEventListener("keydown", onKey, true);

  function close(): void {
    if (!kind) return;
    kind = null;
    back.hidden = true;
    document.documentElement.classList.remove("fp-menu-open");
    stopPad?.();
    stopPad = null;
  }

  return {
    get showing() {
      return kind;
    },
    open(k) {
      kind = k;
      view = "main";
      confirmNew = false;
      if (document.pointerLockElement) document.exitPointerLock?.();
      back.hidden = false;
      document.documentElement.classList.add("fp-menu-open");
      paint();
      focusFirst();
      stopPad?.();
      stopPad = padNav({ container: () => card, onBack: goBack, onStart: () => (view === "settings" ? goBack() : resume()) });
    },
    close,
  };
}
