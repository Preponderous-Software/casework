// Entry point for the web build: wires the browser adapters into the drill.
import { startDrill } from "./drill-app.ts";
import { loadPack } from "./content.ts";
import { loadProfile, saveProfile } from "./storage.ts";
import { randomSeed, today } from "./clock.ts";
import { mountThemeSwitch } from "./theme.ts";

mountThemeSwitch();

/** `?seed=N` fixes the first body (for screenshots, bug reports and sharing a body). */
function seedSource(): () => number {
  const fixed = Number.parseInt(new URLSearchParams(location.search).get("seed") ?? "", 10);
  let first = Number.isFinite(fixed);
  return () => {
    if (first) {
      first = false;
      return fixed;
    }
    return randomSeed();
  };
}

async function boot() {
  const root = document.getElementById("app");
  if (!root) return;
  try {
    const pack = await loadPack("packs/forensics-core");
    const { profile, warning } = loadProfile();
    startDrill(root, { pack, profile, save: saveProfile, today, seed: seedSource() }, warning);
  } catch (e) {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "notice";
    p.textContent = `The lessons couldn't load (${e instanceof Error ? e.message : e}). Reload the page to try again.`;
    root.append(p);
  }
}

boot();
