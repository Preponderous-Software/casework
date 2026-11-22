// Entry point for index.html: the home page.
import { loadPack } from "./content.ts";
import { loadProfile, saveProfile } from "./storage.ts";
import { today } from "./clock.ts";
import { startHome } from "./home.ts";
import { mountThemeSwitch } from "./theme.ts";

mountThemeSwitch();

async function boot() {
  const root = document.getElementById("app");
  if (!root) return;
  try {
    const pack = await loadPack("packs/forensics-core");
    const { profile, warning } = loadProfile();
    startHome(root, { pack, profile, save: saveProfile, today }, warning);
  } catch (e) {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "notice";
    p.textContent = `Casework couldn't load its content (${e instanceof Error ? e.message : e}). Reload the page to try again.`;
    root.append(p);
  }
}

boot();
