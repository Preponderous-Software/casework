// Which input the player is using right now (keyboard and mouse, touch, or a gamepad), kept on
// <html data-fp-input="…"> so the CSS can show the right prompts and buttons, and so a prompt can show
// the right key: "E" with a keyboard, "A" with a gamepad, a tap button on touch.
export type InputMode = "kbd" | "touch" | "pad";

let installed = false;

function set(m: InputMode): void {
  const d = document.documentElement;
  if (d.dataset.fpInput !== m) {
    d.dataset.fpInput = m;
    document.dispatchEvent(new CustomEvent("casework:fp-input", { detail: m }));
  }
}

export function inputMode(): InputMode {
  const m = typeof document === "undefined" ? undefined : document.documentElement.dataset.fpInput;
  return m === "touch" || m === "pad" ? m : "kbd";
}

/** Start following the player's input. Safe to call more than once. */
export function watchInputMode(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  let coarse = false;
  try {
    coarse = matchMedia("(pointer: coarse)").matches || matchMedia("(hover: none)").matches;
  } catch {
    /* no media queries */
  }
  set(coarse ? "touch" : "kbd");
  addEventListener("pointerdown", (e) => set(e.pointerType === "touch" || e.pointerType === "pen" ? "touch" : "kbd"), true);
  addEventListener("keydown", () => set("kbd"), true);
  addEventListener("gamepadconnected", () => set("pad"));
  // a gamepad button or stick also switches (polled lightly; nothing runs without a pad)
  const poll = () => {
    const pads = navigator.getGamepads?.() ?? [];
    for (const gp of pads) {
      if (!gp) continue;
      if (gp.buttons.some((b) => b.pressed) || gp.axes.some((a) => Math.abs(a) > 0.5)) set("pad");
    }
    if (pads.some((p) => p)) requestAnimationFrame(poll);
    else padLoop = false;
  };
  let padLoop = false;
  addEventListener("gamepadconnected", () => {
    if (!padLoop) {
      padLoop = true;
      requestAnimationFrame(poll);
    }
  });
}

/** The key or button name for an action in the current input mode. */
export function glyph(action: "use" | "back" | "notebook", mode: InputMode = inputMode()): string {
  if (mode === "pad") return { use: "A", back: "B", notebook: "Y" }[action];
  return { use: "E", back: "Esc", notebook: "N" }[action];
}
