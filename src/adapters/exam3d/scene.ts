// The exam room's geometry and lights as plain data. Pure: no DOM, no engine.
// Clinical and non-graphic: a faceless mannequin in a soft neutral palette.

import { bodyTransform, PARTS, TABLE, TABLE_TOP } from "./body.ts";
import type { Region } from "./events.ts";
import { MeshBuilder, type Rgb } from "./mesh.ts";

export const PALETTE = {
  skin: [0.8, 0.77, 0.73] as Rgb,
  highlight: [0.36, 0.74, 0.8] as Rgb,
  steel: [0.72, 0.75, 0.78] as Rgb,
  steelDark: [0.42, 0.45, 0.48] as Rgb,
  floor: [0.62, 0.66, 0.66] as Rgb,
  wall: [0.84, 0.87, 0.86] as Rgb,
  wallLow: [0.6, 0.7, 0.7] as Rgb,
  cabinet: [0.9, 0.91, 0.9] as Rgb,
  lamp: [1.0, 0.98, 0.92] as Rgb,
};

const ROOM = 5; // half size of the room's floor, metres
const WALL_H = 3;

// Floor and walls: big surfaces the host draws last (background).
export function buildRoom(): MeshBuilder {
  const m = new MeshBuilder();
  m.box([-ROOM, -0.05, -ROOM], [ROOM, 0, ROOM], PALETTE.floor);
  for (const [lo, hi] of [
    [[-ROOM - 0.1, 0, -ROOM], [-ROOM, WALL_H, ROOM]],
    [[ROOM, 0, -ROOM], [ROOM + 0.1, WALL_H, ROOM]],
    [[-ROOM, 0, -ROOM - 0.1], [ROOM, WALL_H, -ROOM]],
    [[-ROOM, 0, ROOM], [ROOM, WALL_H, ROOM + 0.1]],
  ] as const) {
    m.box(lo, hi, PALETTE.wall);
  }
  return m;
}

// The table, a counter with cabinets along one wall, and the exam lamp overhead.
export function buildFurniture(): MeshBuilder {
  const m = new MeshBuilder();
  m.box(TABLE.lo, TABLE.hi, PALETTE.steel);
  // a drain lip around the top
  m.box([TABLE.lo[0], TABLE_TOP, TABLE.lo[2]], [TABLE.hi[0], TABLE_TOP + 0.025, TABLE.lo[2] + 0.025], PALETTE.steel);
  m.box([TABLE.lo[0], TABLE_TOP, TABLE.hi[2] - 0.025], [TABLE.hi[0], TABLE_TOP + 0.025, TABLE.hi[2]], PALETTE.steel);
  m.box([-0.18, 0.06, -0.14], [0.18, TABLE.lo[1], 0.14], PALETTE.steelDark); // pedestal
  m.box([-0.6, 0, -0.32], [0.6, 0.06, 0.32], PALETTE.steelDark); // foot
  // counter and cabinets against the far wall
  m.box([-2.6, 0, -ROOM], [2.6, 0.88, -ROOM + 0.6], PALETTE.cabinet);
  m.box([-2.62, 0.88, -ROOM], [2.62, 0.92, -ROOM + 0.64], PALETTE.steel);
  m.box([-2.6, 1.6, -ROOM], [2.6, 2.3, -ROOM + 0.35], PALETTE.cabinet);
  m.box([-ROOM, 0, -ROOM], [ROOM, 0.12, -ROOM + 0.02], PALETTE.wallLow);
  // exam lamp: a stem and a flattened disc
  m.box([-0.02, 2.45, -0.02], [0.02, WALL_H, 0.02], PALETTE.steelDark);
  m.rounded({ kind: "sphere", c: [0, 2.42 / 0.25, 0], r: 0.3, scale: [1, 0.25, 1] }, () => PALETTE.steel, 24, 6);
  return m;
}

// The underside of the lamp, unlit so it reads as the light source.
export function buildLampFace(): MeshBuilder {
  const m = new MeshBuilder();
  const n = 24, y = 2.38, r = 0.24;
  const ring = Array.from({ length: n }, (_, i) => {
    const a = (-2 * Math.PI * i) / n;
    return [r * Math.cos(a), y, r * Math.sin(a)] as const;
  });
  m.poly(ring.slice().reverse(), PALETTE.lamp);
  return m;
}

// The mannequin, turned by `turn` (0 face up, PI face down), with one region optionally lit.
export function buildBody(turn: number, highlight: Region | null): MeshBuilder {
  const m = new MeshBuilder();
  for (const part of PARTS) {
    const color = (p: readonly [number, number, number]) => (highlight && part.region(p) === highlight ? PALETTE.highlight : PALETTE.skin);
    if (part.shape.kind === "box") {
      const c = color(part.shape.lo);
      m.box(part.shape.lo, part.shape.hi, c);
    } else {
      m.rounded(part.shape, color, part.name === "torso" ? 32 : 20, part.name === "torso" ? 10 : 8);
    }
  }
  const tf = bodyTransform(turn);
  m.transform(tf.toWorld, tf.dirToWorld);
  return m;
}

// Point lights: rows of x, y, z, range, r, g, b, intensity. The first two fill the room.
export function lights(): number[][] {
  return [
    [-2.2, 2.8, -1.8, 9, 1.0, 0.98, 0.95, 0.75],
    [2.2, 2.8, 1.8, 9, 0.95, 0.97, 1.0, 0.7],
    [0, 2.3, 0, 3.5, 1.0, 0.99, 0.96, 1.1],
  ];
}
