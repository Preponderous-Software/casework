// The exam view's event API: a tap on the body (3D) or a region button (the fallback list) both
// end up here as a RegionEvent. Game code subscribes with onRegion and never needs to know which
// view produced the event. Pure: no DOM, no engine.

export const REGIONS = [
  "head",
  "jaw",
  "neck",
  "chest",
  "abdomen",
  "back",
  "left-arm",
  "right-arm",
  "left-leg",
  "right-leg",
] as const;

export type Region = (typeof REGIONS)[number];

// Face up (supine) or face down (prone): livor mortis is checked on the back, face down.
export type Pose = "supine" | "prone";

export interface RegionEvent {
  region: Region;
  pose: Pose;
  via: "tap" | "list";
}

export type RegionListener = (event: RegionEvent) => void;

export const REGION_LABELS: Record<Region, string> = {
  head: "Head",
  jaw: "Jaw",
  neck: "Neck",
  chest: "Chest",
  abdomen: "Abdomen",
  back: "Back",
  "left-arm": "Left arm",
  "right-arm": "Right arm",
  "left-leg": "Left leg",
  "right-leg": "Right leg",
};

export function isRegion(x: unknown): x is Region {
  return typeof x === "string" && (REGIONS as readonly string[]).includes(x);
}

export class RegionEvents {
  #listeners = new Set<RegionListener>();
  #last: RegionEvent | null = null;

  // Subscribe; returns the unsubscribe function.
  onRegion(cb: RegionListener): () => void {
    this.#listeners.add(cb);
    return () => this.#listeners.delete(cb);
  }

  emit(event: RegionEvent): void {
    this.#last = event;
    for (const cb of [...this.#listeners]) cb(event);
  }

  get last(): RegionEvent | null {
    return this.#last;
  }
}
