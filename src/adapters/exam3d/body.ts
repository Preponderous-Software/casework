// The mannequin on the table: its parts as simple shapes, which region each surface point belongs
// to, how it is turned, and picking a region with a ray. Pure: no DOM, no engine.
//
// Body frame (metres): x runs from the feet (-) to the head (+), y is anterior (the front faces +y
// when the body lies face up), and z is the body's own left. Turning the body rolls it 180 degrees
// about the long (x) axis, so face down the back faces +y and the left side moves to -z.

import { at, rayShape, v3, type Ray, type Shape, type Vec3 } from "./geometry.ts";
import type { Pose, Region } from "./events.ts";

export interface Part {
  name: string;
  shape: Extract<Shape, { kind: "sphere" | "capsule" }> | Extract<Shape, { kind: "box" }>;
  region: (p: Vec3) => Region; // p in the body frame, on the part's surface
}

const fixed = (r: Region) => () => r;
const side = (z: number, left: Region, right: Region) => (z > 0 ? left : right);

// The torso is one shape; its surface splits into chest, abdomen and back.
export function torsoRegion(p: Vec3): Region {
  if (p[1] < 0) return "back";
  return p[0] > 0.12 ? "chest" : "abdomen";
}

export const PARTS: readonly Part[] = [
  { name: "head", shape: { kind: "sphere", c: [0.75, -0.005, 0], r: 0.1, scale: [1.05, 1, 0.9] }, region: fixed("head") },
  { name: "jaw", shape: { kind: "capsule", a: [0.69, 0.02, -0.035], b: [0.69, 0.02, 0.035], r: 0.05 }, region: fixed("jaw") },
  { name: "neck", shape: { kind: "capsule", a: [0.52, -0.02, 0], b: [0.66, -0.02, 0], r: 0.05 }, region: fixed("neck") },
  { name: "torso", shape: { kind: "capsule", a: [-0.2, 0, 0], b: [0.4, 0, 0], r: 0.11, scale: [1, 1, 1.75] }, region: torsoRegion },
  ...[1, -1].flatMap((s): Part[] => [
    {
      name: s > 0 ? "left upper arm" : "right upper arm",
      shape: { kind: "capsule", a: [0.38, -0.04, 0.245 * s], b: [-0.17, -0.045, 0.285 * s], r: 0.043 },
      region: (p) => side(p[2], "left-arm", "right-arm"),
    },
    {
      name: s > 0 ? "left hand" : "right hand",
      shape: { kind: "sphere", c: [-0.21 / 1.3, -0.05 / 0.7, 0.29 * s], r: 0.05, scale: [1.3, 0.7, 1] },
      region: (p) => side(p[2], "left-arm", "right-arm"),
    },
    {
      name: s > 0 ? "left leg" : "right leg",
      shape: { kind: "capsule", a: [-0.28, -0.03, 0.095 * s], b: [-0.93, -0.04, 0.115 * s], r: 0.063 },
      region: (p) => side(p[2], "left-leg", "right-leg"),
    },
    {
      name: s > 0 ? "left foot" : "right foot",
      shape: { kind: "box", lo: [-1.0, -0.09, 0.115 * s - 0.04], hi: [-0.95, 0.07, 0.115 * s + 0.04] },
      region: (p) => side(p[2], "left-leg", "right-leg"),
    },
  ]),
];

// A point on each region's surface (body frame), facing the camera in the pose that shows it.
export const REGION_ANCHORS: Record<Region, Vec3> = {
  head: [0.79, 0.09, 0],
  jaw: [0.69, 0.07, 0],
  neck: [0.58, 0.028, 0],
  chest: [0.26, 0.11, 0],
  abdomen: [-0.05, 0.11, 0],
  back: [0.1, -0.11, 0],
  "left-arm": [0.12, 0.0, 0.265],
  "right-arm": [0.12, 0.0, -0.265],
  "left-leg": [-0.6, 0.03, 0.105],
  "right-leg": [-0.6, 0.03, -0.105],
};

// ------------------------------------------------------------------ the table and the turn

export const TABLE_TOP = 0.9; // metres above the floor
export const TABLE = { lo: [-1.15, TABLE_TOP - 0.05, -0.4] as Vec3, hi: [1.05, TABLE_TOP, 0.4] as Vec3 };
const REST = 0.11; // the torso's half thickness: the body frame's origin sits this far above the top
const LIFT = 0.24; // how far the body rises mid-turn so the arms clear the table

export function poseOf(turn: number): Pose {
  return turn < Math.PI / 2 ? "supine" : "prone";
}

// The rigid transform from the body frame to the room for a turn angle (0 face up, PI face down).
export function bodyTransform(turn: number) {
  const lift = LIFT * Math.sin(Math.max(0, Math.min(Math.PI, turn)));
  const origin: Vec3 = [0, TABLE_TOP + REST + lift, 0];
  return {
    toWorld: (p: Vec3): Vec3 => v3.add(v3.rotX(p, turn), origin),
    dirToWorld: (d: Vec3): Vec3 => v3.rotX(d, turn),
    toLocal: (p: Vec3): Vec3 => v3.rotX(v3.sub(p, origin), -turn),
    dirToLocal: (d: Vec3): Vec3 => v3.rotX(d, -turn),
  };
}

export interface Hit {
  region: Region;
  part: string;
  point: Vec3; // in the room
  t: number;
}

// The region a room-space ray touches first, or null. The table top blocks the ray, so the back
// cannot be tapped through the table while the body lies face up.
export function pickRegion(ray: Ray, turn: number, parts: readonly Part[] = PARTS): Hit | null {
  const tf = bodyTransform(turn);
  const local: Ray = { origin: tf.toLocal(ray.origin), dir: tf.dirToLocal(ray.dir) };
  let best: { t: number; part: Part } | null = null;
  for (const part of parts) {
    const t = rayShape(local, part.shape);
    if (t != null && (best == null || t < best.t)) best = { t, part };
  }
  if (!best) return null;
  const tableT = rayShape(ray, { kind: "box", lo: TABLE.lo, hi: TABLE.hi });
  if (tableT != null && tableT < best.t) return null;
  const p = at(local, best.t);
  return { region: best.part.region(p), part: best.part.name, point: at(ray, best.t), t: best.t };
}
