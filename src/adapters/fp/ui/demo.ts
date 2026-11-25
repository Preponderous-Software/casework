// Dev-only demo for the first-person UI (fp-ui-demo.html): mounts the HUD, touch controls, menus and
// audio over a painted backdrop so each state can be seen and screenshot without the 3D engine.
// ?view=hud | dialogue | title | pause | settings | arrive  picks a state; with no view, keys drive it:
// E interact · T toast · D dialogue · A arrival card · Esc pause · 1–5 ambiences · 0 silence.
import { createAudio, AMBIENCES, SFX } from "../audio/audio.ts";
import { createHud } from "./hud.ts";
import { createMenu } from "./menu.ts";
import { createTouchControls } from "./touch.ts";
import { createPadReader } from "./pad.ts";

const root = document.getElementById("game") as HTMLElement;
const view = new URLSearchParams(location.search).get("view") ?? "";
const hud = createHud(root);
const touch = createTouchControls(root);
const pad = createPadReader();
const audio = createAudio();
(window as unknown as { fpDemo: unknown }).fpDemo = { hud, audio, touch };

const LINES = [
  { who: "ruiz", name: "Dr. Ana Ruiz", text: "Morning. You must be the new examiner. Your first case came in overnight; the folder is on the intake board." },
  { who: "you", name: "You", text: "I'll take a look before the family calls." },
  { who: "narrator", name: "", text: "The fluorescent tubes hum. Somewhere down the corridor, a cooler door thuds shut." },
];

const startGame = () => {
  hud.objective("Pick up a case at the intake board");
  hud.arrive("County Medical Examiner — ground floor");
  audio.ambience("office");
  window.setTimeout(() => hud.prompt("Read the intake board"), 600);
};
const menu = createMenu(root, { hasSave: true, onStart: startGame, onResume: () => audio.sfx("click"), onNew: startGame, onQuit: () => menu.open("title") });

hud.crosshair(false);
switch (view) {
  case "title":
    menu.open("title");
    break;
  case "pause":
    hud.objective("Examine the body on the table");
    menu.open("pause");
    break;
  case "settings":
    menu.open("pause");
    (document.querySelector(".fp-tile:nth-child(2)") as HTMLElement | null)?.click();
    break;
  case "dialogue":
    hud.objective("Talk to Dr. Ruiz in her office");
    void hud.say(LINES);
    break;
  case "arrive":
    hud.objective("Look for signs of a struggle");
    hud.arrive("14 Alder Lane — the kitchen");
    break;
  case "hud":
  default:
    hud.objective("Pick up a case at the intake board");
    hud.prompt("Read the intake board");
    hud.crosshair(true);
    hud.toast("Case opened: The night shift");
    break;
}

// key-driven demo (no view)
addEventListener("keydown", (e) => {
  if (hud.speaking || menu.showing) return;
  if (e.code === "Escape") menu.open("pause");
  else if (e.code === "KeyE") interact();
  else if (e.code === "KeyT") hud.toast("Finding logged: Window latched from inside");
  else if (e.code === "KeyD") void hud.say(LINES);
  else if (e.code === "KeyA") hud.arrive("Basement stairs — 9 Birch Court");
  else if (e.code === "KeyS") audio.sfx(SFX[Math.floor(Math.random() * SFX.length)] ?? "click");
  else if (/^Digit[0-5]$/.test(e.code)) audio.ambience(e.code === "Digit0" ? null : (AMBIENCES[Number(e.code.slice(5)) - 1] ?? null));
});

function interact(): void {
  audio.sfx("paper");
  void hud.say(LINES.slice(0, 2)).then(() => {
    hud.toast("Case opened: The night shift");
    audio.sfx("success");
    hud.objective("Drive to the scene from the garage");
  });
}

let last = performance.now();
const frame = (t: number) => {
  const dt = Math.min(0.1, (t - last) / 1000);
  last = t;
  const tr = touch.read(), pr = pad.read(dt);
  if (!hud.speaking && !menu.showing) {
    if (tr.interact || pr.interact) interact();
    if (tr.pause || pr.pause) menu.open("pause");
    if (tr.notebook || pr.notebook) hud.toast("Notebook (the engine opens it)");
  }
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
