// Entry point for play.html: Casework in first person.
import { STORY_FILES, useStory, type StoryContent } from "../../casework/story/index.ts";
import { loadPack } from "../web/content.ts";
import { loadProfile, saveProfile } from "../web/storage.ts";
import { today } from "../web/clock.ts";
import { startGame } from "./game.ts";
import { loadSave, type KeyValue } from "./save.ts";
import { createView } from "./view.ts";

const PACK = "packs/forensics-core";

async function getJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

function store(): KeyValue | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function fail(root: HTMLElement, why: string): void {
  const box = document.createElement("div");
  box.className = "fp-fallback";
  box.innerHTML = `<h1>Casework</h1><p></p><p>You can still play every case in <a href="index.html">classic mode</a>.</p>`;
  (box.querySelector("p") as HTMLElement).textContent = why;
  root.append(box);
  for (const l of Array.from(document.querySelectorAll<HTMLElement>(".sk-loader"))) l.hidden = true;
}

async function boot(): Promise<void> {
  const root = document.getElementById("game")!;
  const surface = document.getElementById("surface")!;
  const canvas = document.getElementById("view") as HTMLCanvasElement;
  try {
    const [week, texts] = await Promise.all([getJson(`${PACK}/${STORY_FILES.week}`), getJson(`${PACK}/${STORY_FILES.texts}`)]);
    if (week && texts) {
      const problems = useStory({ week, texts } as StoryContent);
      if (problems.length) console.warn("casework fp: story problems", problems);
    }
    const pack = await loadPack(PACK);
    const { profile, warning: pw } = loadProfile();
    const { save, warning: sw } = loadSave(store());
    let frame: (dt: number) => void = () => {};
    const view = await createView({ canvas, engineBase: "engine", frame: (dt) => frame(dt), onFatal: (msg) => fail(root, msg) });
    if (typeof view === "string") return fail(root, view);
    await startGame({ root, surface, view, pack, profile, saveProfile, save, store: store(), today, fetchJson: getJson, packBase: PACK, warning: pw ?? sw });
    frame = (window as unknown as { __fpFrame: (dt: number) => void }).__fpFrame;
  } catch (e) {
    console.error(e);
    fail(root, `Casework couldn't start (${e instanceof Error ? e.message : String(e)}). Reload the page to try again.`);
  }
}

boot();
