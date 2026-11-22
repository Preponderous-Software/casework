// The player's progress: skills, review cards and simple stats. Versioned from the first release so
// a save is never lost: every older version migrates forward, and a save from a newer version than
// this build understands is refused rather than overwritten.
import type { Card } from "./review.ts";
import type { Mastery, SkillId } from "./skills.ts";

export const PROFILE_VERSION = 1;

export interface Profile {
  version: typeof PROFILE_VERSION;
  skills: Partial<Record<SkillId, Mastery>>;
  cards: Card[];
  stats: { drills: number; drillsHit: number; bestStreak: number; streak: number };
}

export class ProfileError extends Error {}

export function emptyProfile(): Profile {
  return { version: PROFILE_VERSION, skills: {}, cards: [], stats: { drills: 0, drillsHit: 0, bestStreak: 0, streak: 0 } };
}

/** Turn whatever was stored into a current Profile. Throws ProfileError for data that can't be
 * trusted, so the caller can keep the raw save aside instead of replacing it. */
export function migrate(raw: unknown): Profile {
  if (raw === null || raw === undefined) return emptyProfile();
  if (typeof raw !== "object") throw new ProfileError("save is not an object");
  const v = (raw as { version?: unknown }).version;
  if (typeof v !== "number") throw new ProfileError("save has no version");
  if (v > PROFILE_VERSION) throw new ProfileError(`save is version ${v}; this build understands up to ${PROFILE_VERSION}`);
  // Version 1 is the first format, so it only needs checking. Later versions add steps here.
  const p = raw as Profile;
  if (typeof p.skills !== "object" || p.skills === null || !Array.isArray(p.cards) || typeof p.stats !== "object") {
    throw new ProfileError("save is missing skills, cards or stats");
  }
  return { ...emptyProfile(), ...p, stats: { ...emptyProfile().stats, ...p.stats } };
}

/** A file the player can keep, and import on another host or device. */
export function exportProfile(p: Profile): string {
  return JSON.stringify({ app: "casework", ...p }, null, 2);
}

export function importProfile(text: string): Profile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProfileError("file is not valid JSON");
  }
  const { app, ...rest } = raw as { app?: unknown };
  if (app !== "casework") throw new ProfileError("file is not a Casework progress file");
  return migrate(rest);
}
