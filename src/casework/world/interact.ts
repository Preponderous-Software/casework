// Which interactable the player is aiming at. Pure: eye position, look direction and reach in,
// one interactable (or none) out. An interactable counts when it is within reach of the eye on the
// floor plan (horizontal distance, as layout-check measures it, so a rug's corner on the floor is as
// reachable as a poster at eye height) and close enough to the line of sight; the nearest to the
// crosshair (by angle, then distance) wins.
import type { Box, Interactable, Location, Vec3 } from "./types.ts";

export const DEFAULT_REACH = 1.6;
/** Half-width (metres) of the target zone around an interactable's point. */
const AIM_RADIUS = 0.38;
/** Never stricter than this cone (radians), so far targets stay easy to hit. */
const MIN_CONE = 0.14;

/** Is this interactable available with this case active? */
export function availableTo(i: Interactable, activeCaseId: string | null): boolean {
  return !i.caseId || i.caseId === activeCaseId;
}

/** The interactables in a location that the active case allows. */
export function available(loc: Location, activeCaseId: string | null): Interactable[] {
  return loc.interactables.filter((i) => availableTo(i, activeCaseId));
}

export interface Aim {
  target: Interactable;
  distance: number;
  /** Angle between the look direction and the target, radians. */
  angle: number;
}

/** Does the floor-plan segment (x0, z0)–(x1, z1) pass through the box? (Slab test.) */
export function segmentHitsBox(x0: number, z0: number, x1: number, z1: number, b: Box): boolean {
  let t0 = 0, t1 = 1;
  const d = [x1 - x0, z1 - z0], o = [x0, z0], lo = [b[0], b[1]], hi = [b[2], b[3]];
  for (let i = 0; i < 2; i++) {
    if (Math.abs(d[i]!) < 1e-12) {
      if (o[i]! < lo[i]! || o[i]! > hi[i]!) return false;
      continue;
    }
    let a = (lo[i]! - o[i]!) / d[i]!, c = (hi[i]! - o[i]!) / d[i]!;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    if (t0 > t1) return false;
  }
  return true;
}

/** Is the target hidden behind a wall? Walls that contain the target (a window or a phone mounted
 * in the wall) don't count. */
export function occluded(eye: Vec3, at: Vec3, walls: readonly Box[]): boolean {
  return walls.some((b) => !(at[0] >= b[0] && at[0] <= b[2] && at[2] >= b[1] && at[2] <= b[3]) && segmentHitsBox(eye[0], eye[2], at[0], at[2], b));
}

/** The interactable the eye is aimed at, or null. `dir` need not be unit length. Targets behind
 * any of `walls` don't count. */
export function aimAt(eye: Vec3, dir: Vec3, list: readonly Interactable[], activeCaseId: string | null = null, walls: readonly Box[] = []): Aim | null {
  const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const d: Vec3 = [dir[0] / dl, dir[1] / dl, dir[2] / dl];
  let best: Aim | null = null;
  let bestScore = Infinity;
  for (const it of list) {
    if (!availableTo(it, activeCaseId)) continue;
    const v: Vec3 = [it.at[0] - eye[0], it.at[1] - eye[1], it.at[2] - eye[2]];
    const dist = Math.hypot(v[0], v[1], v[2]);
    if (Math.hypot(v[0], v[2]) > (it.reach ?? DEFAULT_REACH)) continue;
    if (dist < 1e-6) return { target: it, distance: 0, angle: 0 };
    const cos = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / dist;
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    const cone = Math.max(MIN_CONE, Math.atan(AIM_RADIUS / dist));
    if (angle > cone) continue;
    if (walls.length && occluded(eye, it.at, walls)) continue;
    const score = angle / cone + dist * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = { target: it, distance: dist, angle };
    }
  }
  return best;
}

/** The interactable nearest the walker's feet within reach, ignoring aim: for touch players who
 * walk up to something without lining up the crosshair. */
export function nearest(eye: Vec3, list: readonly Interactable[], activeCaseId: string | null = null, slack = 0.3, walls: readonly Box[] = []): Interactable | null {
  let best: Interactable | null = null;
  let bestD = Infinity;
  for (const it of list) {
    if (!availableTo(it, activeCaseId)) continue;
    const dh = Math.hypot(it.at[0] - eye[0], it.at[2] - eye[2]);
    if (dh > (it.reach ?? DEFAULT_REACH) + slack) continue;
    if (walls.length && occluded(eye, it.at, walls)) continue;
    if (dh < bestD) {
      bestD = dh;
      best = it;
    }
  }
  return best;
}
