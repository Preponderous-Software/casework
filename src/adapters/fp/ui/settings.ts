// First-person settings: look speed, invert Y, field of view, reduced motion, volume and mute.
// Kept in this browser at casework.fp.settings. The loader is tolerant: a missing, broken or
// half-written record, numbers saved as strings, or values out of range all come back as sensible
// settings, never an error. Nothing here touches the DOM at import time, so tests run without one.

export interface FpSettings { sensitivity: number; invertY: boolean; fov: number; reducedMotion: boolean; volume: number; muted: boolean }

export const SETTINGS_KEY = "casework.fp.settings";

/** Ranges for the numeric settings: [min, max, step]. The settings panel uses the same numbers. */
export const RANGES = {
  sensitivity: [0.2, 3, 0.05],
  fov: [55, 100, 1],
  volume: [0, 1, 0.05],
} as const;

/** Does the device ask for less motion? (false where there is no window, as in tests) */
export function systemReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function defaultSettings(reducedMotion = systemReducedMotion()): FpSettings {
  return { sensitivity: 1, invertY: false, fov: 72, reducedMotion, volume: 0.8, muted: false };
}

/** Clean any value into valid settings. Unknown keys are dropped; bad values take the default. */
export function cleanSettings(raw: unknown, base: FpSettings = defaultSettings()): FpSettings {
  const s = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown, [lo, hi]: readonly [number, number, number], d: number): number => {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : d);
  return {
    sensitivity: num(s.sensitivity, RANGES.sensitivity, base.sensitivity),
    invertY: bool(s.invertY, base.invertY),
    fov: Math.round(num(s.fov, RANGES.fov, base.fov)),
    reducedMotion: bool(s.reducedMotion, base.reducedMotion),
    volume: num(s.volume, RANGES.volume, base.volume),
    muted: bool(s.muted, base.muted),
  };
}

/** Parse what storage held (null when nothing was saved). */
export function parseSettings(text: string | null | undefined, base: FpSettings = defaultSettings()): FpSettings {
  if (!text) return { ...base };
  try {
    return cleanSettings(JSON.parse(text), base);
  } catch {
    return { ...base };
  }
}

type Listener = (s: FpSettings) => void;
const listeners = new Set<Listener>();

/** Run `fn` whenever settings are saved (the settings panel, a mute key). Returns an unsubscribe. */
export function onSettingsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(): FpSettings {
  let text: string | null = null;
  try {
    text = storage()?.getItem(SETTINGS_KEY) ?? null;
  } catch {
    /* storage blocked: defaults */
  }
  return parseSettings(text);
}

export function saveSettings(s: FpSettings): void {
  const c = cleanSettings(s);
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(c));
  } catch {
    /* storage blocked: the change lasts for this page only */
  }
  for (const fn of [...listeners]) {
    try {
      fn({ ...c });
    } catch {
      /* one listener failing never stops the others */
    }
  }
}
