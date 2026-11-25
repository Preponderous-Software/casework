// First-person rules on top of the case reducer. Pure (no DOM), so tests run them under node.
// The reducer stays the source of truth: these only decide what the world shows and which
// reducer command an interactable stands for.
import type { CaseDef } from "../../casework/case/model.ts";
import type { CaseState } from "../../casework/case/play.ts";
import type { Interactable } from "../../casework/world/types.ts";

/** The procedure that takes you to the scene. */
export const SCENE_PROCEDURE = "scene";

export const sceneLocationId = (caseId: string) => `scene-${caseId}`;

/** Findings the notebook shows: everything revealed, except scene findings you haven't looked
 * at in the house yet (the reducer reveals all scene findings when the scene procedure runs). */
export function visibleFindings(def: CaseDef, s: CaseState, looked: readonly string[]): string[] {
  return s.revealed.filter((id) => {
    const f = def.findings.find((x) => x.id === id);
    return !!f && (f.procedure !== SCENE_PROCEDURE || looked.includes(id));
  });
}

/** Scene findings still waiting to be looked at. */
export function unlookedSceneFindings(def: CaseDef, looked: readonly string[]): string[] {
  return def.findings.filter((f) => f.procedure === SCENE_PROCEDURE && !looked.includes(f.id)).map((f) => f.id);
}

const hoursCost = (h: number, cost: number) => `${h} h${cost ? ` · $${cost}` : ""}`;

/** The prompt for an interactable, adjusted to the active case (costs, done, not needed). */
export function promptFor(it: Interactable, def: CaseDef | null, s: CaseState | null, looked: readonly string[] = []): string {
  const a = it.action;
  switch (a.kind) {
    case "procedure": {
      if (!def || !s) return it.label;
      const p = def.procedures.find((x) => x.id === a.procedure);
      if (!p) return `${it.label} (not needed for this case)`;
      if (a.procedure === SCENE_PROCEDURE) return s.done.includes(p.id) ? `${it.label} (back to the scene)` : `${it.label} (${hoursCost(p.hours, p.cost)})`;
      if (s.done.includes(p.id)) return `${p.name}: done`;
      return `${it.label} (${hoursCost(p.hours, p.cost)})`;
    }
    case "exam": {
      if (!def || !s) return "The exam table is empty";
      const ex = def.procedures.find((p) => p.exam);
      if (ex && !s.done.includes(ex.id)) return `Begin the ${ex.name.toLowerCase()} (${hoursCost(ex.hours, ex.cost)})`;
      return it.label;
    }
    case "finding":
      return looked.includes(a.finding) ? `${it.label} (noted)` : it.label;
    default:
      return it.label;
  }
}

/** Procedures in the order a case needs them, with what's still missing first. */
export function missingRequirements(def: CaseDef, s: CaseState, procedure: string): string[] {
  const p = def.procedures.find((x) => x.id === procedure);
  return (p?.requires ?? []).filter((r) => !s.done.includes(r));
}
