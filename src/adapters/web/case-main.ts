// Entry point for case.html?case=<id>: one case, with the 3D exam room.
import type { CaseState } from "../../casework/case/play.ts";
import { createExamView } from "../exam3d/exam-room.ts";
import { startCaseApp } from "./case-app.ts";
import { loadPack } from "./content.ts";
import { loadCaseProgress, loadProfile, saveCaseProgress, saveProfile } from "./storage.ts";
import { today } from "./clock.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function boot() {
  const id = new URLSearchParams(location.search).get("case") ?? "";
  try {
    const pack = await loadPack("packs/forensics-core");
    const def = pack.cases.find((c) => c.id === id);
    if (!def) {
      $("top").innerHTML = `<p class="notice">There's no case called "${id.replace(/[<>&"]/g, "")}". <a href="./">See all cases</a>.</p>`;
      return;
    }
    const { profile } = loadProfile();
    startCaseApp({
      pack,
      def,
      profile,
      saveProfile,
      loadProgress: () => {
        const s = loadCaseProgress<CaseState>(def.id);
        return s && s.caseId === def.id && !s.signed ? s : null;
      },
      saveProgress: (s) => saveCaseProgress(def.id, s),
      today,
      createExam: () =>
        createExamView(
          { canvas: $<HTMLCanvasElement>("view"), last: $("last"), turn: $<HTMLButtonElement>("turn"), regions: $("regions"), fallback: $("fallback"), status: $("status") },
          { engineBase: "engine" },
        ),
    });
  } catch (e) {
    $("top").innerHTML = "";
    const p = document.createElement("p");
    p.className = "notice";
    p.textContent = `The case couldn't load (${e instanceof Error ? e.message : e}). Reload the page to try again.`;
    $("top").append(p);
  }
}

boot();
