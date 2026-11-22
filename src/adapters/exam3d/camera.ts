// The orbit camera around the table, in the engine host's convention, and rays through the screen.
// Pure: no DOM, no engine.
//
// The host (engine/host.cpp) is first person: it puts the eye at the kit camera's target and looks
// along -(cos p cos y, sin p, cos p sin y). So an orbit is the eye placed at
// centre + dist * (cos p cos y, sin p, cos p sin y): looking back along that vector it sees the
// centre.

import { v3, type Ray, type Vec3 } from "./geometry.ts";

export interface Orbit {
  yaw: number;
  pitch: number; // above the horizon; clamped above zero so the eye stays over the table
  dist: number;
  centre: Vec3;
}

export interface OrbitLimits {
  minPitch: number;
  maxPitch: number;
  minDist: number;
  maxDist: number;
}

export const LIMITS: OrbitLimits = { minPitch: 0.18, maxPitch: 1.4, minDist: 1.0, maxDist: 4.6 };

export function clampOrbit(o: Orbit, l: OrbitLimits = LIMITS): Orbit {
  return {
    ...o,
    pitch: Math.min(Math.max(o.pitch, l.minPitch), l.maxPitch),
    dist: Math.min(Math.max(o.dist, l.minDist), l.maxDist),
  };
}

export function eyeOf(o: Orbit): Vec3 {
  const cp = Math.cos(o.pitch);
  return v3.add(o.centre, v3.mul([cp * Math.cos(o.yaw), Math.sin(o.pitch), cp * Math.sin(o.yaw)], o.dist));
}

function basis(o: Orbit) {
  const eye = eyeOf(o);
  const f = v3.norm(v3.sub(o.centre, eye));
  const r = v3.norm(v3.cross(f, [0, 1, 0]));
  const u = v3.cross(r, f);
  return { eye, f, r, u };
}

// A ray from the eye through normalised device coordinates (x right, y up, both -1..1).
// fovDeg is the vertical field of view; aspect is width / height.
export function rayThrough(o: Orbit, fovDeg: number, aspect: number, nx: number, ny: number): Ray {
  const { eye, f, r, u } = basis(o);
  const th = Math.tan((fovDeg * Math.PI) / 360);
  const dir = v3.norm(v3.add(f, v3.add(v3.mul(r, nx * th * aspect), v3.mul(u, ny * th))));
  return { origin: eye, dir };
}

// A room point to normalised device coordinates, or null behind the eye.
export function project(o: Orbit, fovDeg: number, aspect: number, p: Vec3): [number, number] | null {
  const { eye, f, r, u } = basis(o);
  const d = v3.sub(p, eye);
  const z = v3.dot(d, f);
  if (z <= 1e-6) return null;
  const th = Math.tan((fovDeg * Math.PI) / 360);
  return [v3.dot(d, r) / (z * th * aspect), v3.dot(d, u) / (z * th)];
}

// The vertical field of view that keeps at least minHfovDeg across a narrow (portrait) screen.
export function fitFov(baseFovDeg: number, minHfovDeg: number, aspect: number, maxFovDeg = 80): number {
  const need = (2 * Math.atan(Math.tan((minHfovDeg * Math.PI) / 360) / Math.max(aspect, 1e-3)) * 180) / Math.PI;
  return Math.min(maxFovDeg, Math.max(baseFovDeg, need));
}
