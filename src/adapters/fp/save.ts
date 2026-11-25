// The first-person save: where you stand, which case is on your desk, each case's reducer state
// and which scene findings you've looked at. Versioned, under its own key (casework.fp.save), so it
// never touches the classic pages' saves; skills and best scores stay in the shared kernel profile
// (casework.profile). A save that can't be read is kept aside, never overwritten.
import type { CaseState } from "../../casework/case/play.ts";

export const FP_SAVE_KEY = "casework.fp.save";
export const FP_SAVE_VERSION = 1;

export interface FpSave {
  version: typeof FP_SAVE_VERSION;
  at: { location: string; x: number; z: number; yaw: number };
  active: string | null;
  cases: Record<string, CaseState>;
  looked: Record<string, string[]>;
  /** The story lane's state (opaque here). */
  story: unknown;
}

export function newSave(story: unknown): FpSave {
  return { version: FP_SAVE_VERSION, at: { location: "office", x: NaN, z: NaN, yaw: 0 }, active: null, cases: {}, looked: {}, story };
}

/** A current save from whatever was stored, or null when it can't be trusted. */
export function migrateSave(raw: unknown): FpSave | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<FpSave> & { version?: unknown };
  if (r.version !== FP_SAVE_VERSION) return null; // only one version so far; newer ones are refused
  const at = r.at;
  if (!at || typeof at.location !== "string" || ![at.x, at.z, at.yaw].every((n) => typeof n === "number" || n === null)) return null;
  if (r.active !== null && typeof r.active !== "string") return null;
  if (!r.cases || typeof r.cases !== "object" || !r.looked || typeof r.looked !== "object") return null;
  return {
    version: FP_SAVE_VERSION,
    at: { location: at.location, x: at.x ?? NaN, z: at.z ?? NaN, yaw: at.yaw ?? 0 },
    active: r.active ?? null,
    cases: r.cases as Record<string, CaseState>,
    looked: r.looked as Record<string, string[]>,
    story: r.story ?? null,
  };
}

export interface KeyValue {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function loadSave(store: KeyValue | null): { save: FpSave | null; warning?: string } {
  if (!store) return { save: null };
  let raw: string | null;
  try {
    raw = store.getItem(FP_SAVE_KEY);
  } catch {
    return { save: null, warning: "This browser is blocking storage, so progress won't be kept." };
  }
  if (raw === null) return { save: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const save = migrateSave(parsed);
  if (save) return { save };
  try {
    store.setItem(`${FP_SAVE_KEY}.unreadable.${Date.now()}`, raw);
  } catch {
    /* nothing more to do */
  }
  return { save: null, warning: "Your first-person save couldn't be read. It was kept aside, and you're starting a fresh shift." };
}

export function storeSave(store: KeyValue | null, s: FpSave): void {
  try {
    store?.setItem(FP_SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: play continues */
  }
}
