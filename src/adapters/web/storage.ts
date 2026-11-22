// SaveStore adapter: browser localStorage. A save that can't be read is set aside under a backup key
// instead of being overwritten, and the player is told.
import { emptyProfile, migrate, ProfileError, type Profile } from "../../kernel/profile.ts";

const KEY = "casework.profile";

export interface Loaded {
  profile: Profile;
  warning?: string;
}

export function loadProfile(): Loaded {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return { profile: emptyProfile(), warning: "This browser is blocking storage, so progress won't be kept." };
  }
  if (raw === null) return { profile: emptyProfile() };
  try {
    return { profile: migrate(JSON.parse(raw)) };
  } catch (e) {
    const why = e instanceof ProfileError ? e.message : "it isn't valid JSON";
    try {
      localStorage.setItem(`${KEY}.unreadable.${Date.now()}`, raw);
    } catch {
      /* nothing more we can do */
    }
    return { profile: emptyProfile(), warning: `Your saved progress couldn't be read (${why}). It was kept aside, and you're starting fresh.` };
  }
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage blocked: play continues without saving */
  }
}

/** An unfinished case, so a reload doesn't lose the shift. Best effort: never throws. */
export function loadCaseProgress<T>(caseId: string): T | null {
  try {
    const raw = localStorage.getItem(`casework.case.${caseId}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveCaseProgress(caseId: string, s: unknown): void {
  try {
    if (s === null) localStorage.removeItem(`casework.case.${caseId}`);
    else localStorage.setItem(`casework.case.${caseId}`, JSON.stringify(s));
  } catch {
    /* storage blocked */
  }
}
