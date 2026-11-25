// Meshes for a Location: the shell (floor, walls, ceiling), every prop as a small recognisable
// group of boxes, glowing faces (screens, ceiling panels), standing witness figures and covered
// bodies. Pure: plain arrays through the exam room's MeshBuilder, no DOM and no engine.
import { buildBody } from "../exam3d/scene.ts";
import { TABLE, TABLE_TOP } from "../exam3d/body.ts";
import { MeshBuilder, type Rgb } from "../exam3d/mesh.ts";
import { rotateXZ } from "../../casework/world/location.ts";
import type { Location, Prop, Vec3 } from "../../casework/world/types.ts";

export const COLORS: Record<string, Rgb> = {
  steel: [0.7, 0.73, 0.76],
  wood: [0.56, 0.41, 0.28],
  tile: [0.74, 0.77, 0.76],
  paper: [0.93, 0.92, 0.86],
  fabric: [0.38, 0.44, 0.53],
  glass: [0.6, 0.76, 0.82],
  accent: [0.25, 0.68, 0.74],
  dark: [0.22, 0.24, 0.26],
  light: [0.88, 0.89, 0.88],
  warm: [0.88, 0.66, 0.38],
};
const LEAF: Rgb = [0.3, 0.52, 0.32];
const SHEET: Rgb = [0.78, 0.82, 0.86];
const SCREEN: Rgb = [0.42, 0.78, 0.86];
const PANEL: Rgb = [1.0, 0.98, 0.92];
const HAIR: Rgb = [0.24, 0.2, 0.17];

export const color = (key: string | undefined, fallback: Rgb = COLORS.light!): Rgb => (key && COLORS[key]) || fallback;
const shade = (c: Rgb, k: number): Rgb => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];

/** Append one builder's geometry to another. */
export function append(dst: MeshBuilder, src: MeshBuilder): void {
  const base = dst.count;
  dst.positions.push(...src.positions);
  dst.normals.push(...src.normals);
  dst.colors.push(...src.colors);
  for (const i of src.indices) dst.indices.push(base + i);
}

/** Rotate a builder by yaw about Y and move it to `at`. */
export function place(m: MeshBuilder, at: readonly number[], yaw: number): void {
  m.transform(
    (p) => {
      const [x, z] = rotateXZ(p[0], p[2], yaw);
      return [x + at[0]!, p[1] + at[1]!, z + at[2]!];
    },
    (d) => {
      const [x, z] = rotateXZ(d[0], d[2], yaw);
      return [x, d[1], z];
    },
  );
}

// A box in the prop's local frame: x across, y up from the prop's bottom, z depth (front is +Z).
type B = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Rgb) => void;

/** One prop as solid geometry (into `m`) and glowing faces (into `glow`). */
export function propMesh(p: Prop, m: MeshBuilder, glow: MeshBuilder): void {
  const local = new MeshBuilder();
  const lglow = new MeshBuilder();
  const [w, h, d] = p.size;
  const hw = w / 2, hd = d / 2;
  const c = color(p.color);
  const dark = shade(c, 0.6);
  const box: B = (x0, y0, z0, x1, y1, z1, col) => {
    if (x1 - x0 > 1e-4 && y1 - y0 > 1e-4 && z1 - z0 > 1e-4) local.box([x0, y0, z0], [x1, y1, z1], col);
  };
  const legs = (top: number, t: number, col: Rgb) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * hw - (sx > 0 ? t : 0), 0, sz * hd - (sz > 0 ? t : 0), sx * hw + (sx < 0 ? t : 0), top, sz * hd + (sz < 0 ? t : 0), col);
  };
  switch (p.kind) {
    case "desk":
      box(-hw, h - 0.04, -hd, hw, h, hd, c);
      box(-hw, 0, -hd, -hw + 0.05, h - 0.04, hd, dark);
      box(hw - 0.45, 0, -hd, hw, h - 0.04, hd - 0.02, dark);
      box(-hw, 0.3, -hd, hw, h - 0.04, -hd + 0.03, dark);
      for (const y of [0.12, 0.36, 0.58]) box(hw - 0.42, y, hd - 0.02, hw - 0.03, y + 0.16, hd, shade(c, 1.15));
      break;
    case "chair": {
      const seat = Math.min(0.47, h * 0.5);
      box(-hw, seat - 0.06, -hd, hw, seat, hd, c);
      legs(seat - 0.06, 0.04, COLORS.dark!);
      box(-hw, seat, -hd, hw, h, -hd + 0.06, c);
      break;
    }
    case "table":
      box(-hw, h - 0.05, -hd, hw, h, hd, c);
      legs(h - 0.05, 0.05, shade(c, 0.7));
      break;
    case "exam-table": {
      // the exam room's table, so the body's picking frame matches what is drawn
      const [lx, , lz] = TABLE.lo, [hx, , hz] = TABLE.hi;
      box(lx, TABLE_TOP - 0.05, lz, hx, TABLE_TOP, hz, c);
      box(lx, TABLE_TOP, lz, hx, TABLE_TOP + 0.025, lz + 0.025, c);
      box(lx, TABLE_TOP, hz - 0.025, hx, TABLE_TOP + 0.025, hz, c);
      box(-0.18, 0.06, -0.14, 0.18, TABLE_TOP - 0.05, 0.14, COLORS.dark!);
      box(-0.6, 0, -0.32, 0.6, 0.06, 0.32, COLORS.dark!);
      break;
    }
    case "shelf": {
      box(-hw, 0, -hd, hw, h, -hd + 0.03, dark);
      box(-hw, 0, -hd, -hw + 0.04, h, hd, c);
      box(hw - 0.04, 0, -hd, hw, h, hd, c);
      const n = Math.max(2, Math.round(h / 0.4));
      const spines: Rgb[] = [COLORS.accent!, COLORS.warm!, [0.55, 0.25, 0.25], COLORS.fabric!, COLORS.paper!, [0.3, 0.45, 0.32]];
      for (let i = 0; i <= n; i++) {
        const y = (h - 0.03) * (i / n);
        box(-hw + 0.04, y, -hd, hw - 0.04, y + 0.03, hd, c);
        if (i === n) continue;
        // a row of books, not quite full
        let x = -hw + 0.06, k = i * 3;
        while (x < hw - 0.12) {
          const bw = 0.035 + ((k * 37) % 5) * 0.008, bh = 0.2 + ((k * 13) % 7) * 0.018;
          if ((k * 7) % 11 !== 0) box(x, y + 0.03, -hd + 0.05, x + bw, Math.min(y + 0.03 + bh, y + (h / n) - 0.02), hd - 0.04, spines[k % spines.length]!);
          x += bw + 0.006;
          k++;
        }
      }
      break;
    }
    case "cabinet": {
      box(-hw, 0, -hd, hw, h, hd, c);
      const n = Math.max(1, Math.round(h / 0.35));
      for (let i = 0; i < n; i++) {
        const y0 = (h / n) * i + 0.02, y1 = (h / n) * (i + 1) - 0.02;
        box(-hw + 0.03, y0, hd, hw - 0.03, y1, hd + 0.01, shade(c, 1.08));
        box(-0.08, (y0 + y1) / 2 + 0.03, hd + 0.01, 0.08, (y0 + y1) / 2 + 0.05, hd + 0.03, COLORS.dark!);
      }
      break;
    }
    case "counter":
    case "sink":
      box(-hw, 0.08, -hd, hw, h - 0.04, hd - 0.03, shade(c, p.kind === "sink" ? 0.9 : 1));
      box(-hw, 0, -hd, hw, 0.08, hd - 0.08, COLORS.dark!);
      box(-hw - 0.01, h - 0.04, -hd, hw + 0.01, h, hd + 0.02, p.kind === "sink" ? COLORS.steel! : shade(c, 0.85));
      if (p.kind === "sink") {
        box(-Math.min(hw, 0.3) + 0.04, h - 0.039, -hd + 0.1, Math.min(hw, 0.3) - 0.04, h + 0.002, hd - 0.12, COLORS.dark!);
        box(-0.02, h, -hd + 0.03, 0.02, h + 0.3, -hd + 0.07, COLORS.steel!);
        box(-0.02, h + 0.26, -hd + 0.07, 0.02, h + 0.3, -hd + 0.22, COLORS.steel!);
      } else {
        for (let x = -hw + 0.05; x < hw - 0.3; x += 0.6) box(x, 0.12, hd - 0.03, x + 0.55, h - 0.08, hd - 0.02, shade(c, 1.08));
      }
      break;
    case "fridge":
      box(-hw, 0, -hd, hw, h, hd, c);
      box(-hw + 0.02, h * 0.62, hd, hw - 0.02, h * 0.625, hd + 0.005, COLORS.dark!);
      box(hw - 0.1, h * 0.35, hd, hw - 0.07, h * 0.58, hd + 0.04, COLORS.steel!);
      box(hw - 0.1, h * 0.66, hd, hw - 0.07, h * 0.85, hd + 0.04, COLORS.steel!);
      break;
    case "stove":
      box(-hw, 0, -hd, hw, h, hd, c);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * hw * 0.5 - 0.09, h, sz * hd * 0.5 - 0.09, sx * hw * 0.5 + 0.09, h + 0.01, sz * hd * 0.5 + 0.09, COLORS.dark!);
      box(-hw + 0.06, h * 0.15, hd, hw - 0.06, h * 0.7, hd + 0.01, COLORS.dark!);
      break;
    case "bed":
      box(-hw, 0, -hd, hw, 0.28, hd, COLORS.wood!);
      box(-hw + 0.04, 0.28, -hd + 0.03, hw - 0.02, h, hd - 0.03, COLORS.paper!);
      box(-hw + 0.04, h - 0.02, -hd + 0.03, hw * 0.55, h + 0.03, hd - 0.03, c);
      box(-hw, 0, -hd, -hw + 0.06, h + 0.45, hd, COLORS.wood!); // headboard at −X
      box(-hw + 0.1, h, -hd + 0.15, -hw + 0.45, h + 0.1, hd - 0.15, COLORS.light!);
      break;
    case "sofa":
      box(-hw, 0, -hd, hw, h * 0.5, hd, c);
      box(-hw, 0, -hd, hw, h, -hd + Math.min(0.2, d * 0.3), shade(c, 0.9));
      box(-hw, 0, -hd, -hw + 0.14, h * 0.72, hd, shade(c, 0.9));
      box(hw - 0.14, 0, -hd, hw, h * 0.72, hd, shade(c, 0.9));
      break;
    case "rug":
      box(-hw, 0, -hd, hw, Math.max(h, 0.008), hd, c);
      break;
    case "stairs": {
      const n = Math.max(3, Math.round(h / 0.18));
      for (let i = 0; i < n; i++) {
        const z1 = hd - (d / n) * i;
        box(-hw, 0, -hd, hw, (h / n) * (i + 1), z1, i % 2 ? c : shade(c, 0.92));
      }
      break;
    }
    case "rail":
      box(-hw, h - 0.05, -0.03, hw, h, 0.03, c);
      for (let x = -hw; x <= hw + 1e-6; x += Math.max(0.5, w / Math.ceil(w / 1.2))) box(x - 0.025, 0, -0.025, x + 0.025, h, 0.025, c);
      break;
    case "door":
      box(-hw, 0, -hd, -hw + 0.07, h, hd, COLORS.dark!);
      box(hw - 0.07, 0, -hd, hw, h, hd, COLORS.dark!);
      box(-hw, h - 0.07, -hd, hw, h, hd, COLORS.dark!);
      box(-hw + 0.07, 0, -hd * 0.5, hw - 0.07, h - 0.07, hd * 0.5, c);
      box(hw - 0.22, h * 0.45, hd * 0.5, hw - 0.12, h * 0.48, hd * 0.5 + 0.05, COLORS.steel!);
      break;
    case "window":
      box(-hw, 0, -hd, hw, 0.06, hd, COLORS.light!);
      box(-hw, h - 0.06, -hd, hw, h, hd, COLORS.light!);
      box(-hw, 0, -hd, -hw + 0.06, h, hd, COLORS.light!);
      box(hw - 0.06, 0, -hd, hw, h, hd, COLORS.light!);
      box(-0.03, 0, -hd, 0.03, h, hd, COLORS.light!);
      lglow.box([-hw + 0.06, 0.06, -hd * 0.3], [hw - 0.06, h - 0.06, hd * 0.3], shade(c, 1.15));
      break;
    case "lamp":
      if (h < 0.3) {
        // a ceiling or exam lamp: a flat disc with a glowing underside
        box(-hw, h * 0.4, -hd, hw, h, hd, c);
        lglow.box([-hw * 0.85, h * 0.35, -hd * 0.85], [hw * 0.85, h * 0.4, hd * 0.85], PANEL);
      } else {
        box(-hw * 0.6, 0, -hd * 0.6, hw * 0.6, 0.04, hd * 0.6, COLORS.dark!);
        box(-0.015, 0.04, -0.015, 0.015, h * 0.78, 0.015, COLORS.dark!);
        lglow.box([-hw, h * 0.72, -hd], [hw, h, hd], c);
      }
      break;
    case "terminal":
      box(-0.05, 0, -0.08, 0.05, h * 0.25, 0.02, COLORS.dark!);
      box(-hw * 0.45, 0, -0.12, hw * 0.45, 0.02, 0.06, COLORS.dark!);
      box(-hw, h * 0.22, -hd, hw, h, hd, COLORS.dark!);
      lglow.box([-hw + 0.025, h * 0.22 + 0.025, hd], [hw - 0.025, h - 0.025, hd + 0.004], SCREEN);
      break;
    case "board": {
      box(-hw, 0, -hd, hw, h, hd, COLORS.dark!);
      box(-hw + 0.03, 0.03, hd, hw - 0.03, h - 0.03, hd + 0.005, c);
      if (w > 0.8 && h > 0.6) {
        // pinned notes
        const notes: Rgb[] = [COLORS.paper!, [0.96, 0.9, 0.55], [0.7, 0.86, 0.9], COLORS.light!];
        let k = 0;
        for (let y = 0.12; y < h - 0.25; y += 0.3) {
          for (let x = -hw + 0.12; x < hw - 0.3; x += 0.34) {
            if ((k * 5) % 7 !== 3) box(x, y, hd + 0.005, x + 0.22, y + 0.2 + (k % 3) * 0.03, hd + 0.01, notes[k % notes.length]!);
            k++;
          }
        }
      }
      break;
    }
    case "plant":
      box(-hw * 0.55, 0, -hd * 0.55, hw * 0.55, Math.min(0.35, h * 0.3), hd * 0.55, c);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2, r = hw * 0.35;
        const y0 = h * (0.3 + 0.1 * (i % 3));
        box(Math.cos(a) * r - hw * 0.35, y0, Math.sin(a) * r - hd * 0.35, Math.cos(a) * r + hw * 0.35, Math.min(h, y0 + h * 0.45), Math.sin(a) * r + hd * 0.35, shade(LEAF, 0.85 + 0.08 * (i % 3)));
      }
      break;
    case "tray":
      box(-hw, 0, -hd, hw, Math.max(0.02, h * 0.4), hd, c);
      box(-hw, 0, -hd, hw, h, -hd + 0.015, c);
      box(-hw, 0, hd - 0.015, hw, h, hd, c);
      for (let i = 0; i < 4; i++) box(-hw + 0.06 + i * 0.07, h * 0.4, -hd * 0.6, -hw + 0.08 + i * 0.07, h * 0.4 + 0.01, hd * 0.6, COLORS.steel!);
      break;
    case "bottle":
      box(-hw, 0, -hd, hw, h * 0.78, hd, c);
      box(-hw * 0.45, h * 0.78, -hd * 0.45, hw * 0.45, h, hd * 0.45, w < 0.2 ? COLORS.light! : COLORS.accent!);
      break;
    case "phone":
      box(-hw, 0, -hd, hw, h * 0.6, hd, c);
      box(-hw, h * 0.6, -hd, hw, h, -hd + d * 0.3, shade(c, 1.2));
      break;
    case "paper":
      box(-hw, 0, -hd, hw, Math.max(h, 0.006), hd, c);
      break;
    case "body":
      coveredBody(local, w, h, d);
      break;
    default:
      box(-hw, 0, -hd, hw, h, hd, c);
  }
  place(local, p.at, p.yaw ?? 0);
  place(lglow, p.at, p.yaw ?? 0);
  append(m, local);
  append(glow, lglow);
}

/** A covered body: a long, softly stepped shape under a pale sheet (never examined in place). */
function coveredBody(m: MeshBuilder, w: number, h: number, d: number): void {
  const hw = w / 2, hd = d / 2;
  m.box([-hw, 0, -hd * 0.9], [hw, h * 0.55, hd * 0.9], SHEET);
  m.box([-hw * 0.75, h * 0.55, -hd * 0.75], [hw * 0.5, h, hd * 0.75], SHEET); // torso and legs
  m.rounded({ kind: "sphere", c: [hw * 0.8, h * 0.6, 0], r: Math.min(hd * 0.7, h * 0.65), scale: [1.1, 1, 1] }, () => SHEET, 14, 6); // head
}

/** A standing witness: a plain, faceless figure (non-graphic), feet at `at` (y ignored). */
export function figureMesh(at: Vec3, yaw: number, tint: Rgb = COLORS.fabric!): MeshBuilder {
  const m = new MeshBuilder();
  const skin: Rgb = [0.8, 0.77, 0.73];
  m.box([-0.17, 0, -0.1], [-0.03, 0.85, 0.1], COLORS.dark!);
  m.box([0.03, 0, -0.1], [0.17, 0.85, 0.1], COLORS.dark!);
  m.rounded({ kind: "capsule", a: [0, 0.98, 0], b: [0, 1.32, 0], r: 0.19, scale: [1, 1, 0.65] }, () => tint, 16, 5);
  m.rounded({ kind: "capsule", a: [-0.25, 0.85, 0], b: [-0.25, 1.35, 0], r: 0.055 }, () => tint, 10, 4);
  m.rounded({ kind: "capsule", a: [0.25, 0.85, 0], b: [0.25, 1.35, 0], r: 0.055 }, () => tint, 10, 4);
  m.rounded({ kind: "capsule", a: [0, 1.4, 0], b: [0, 1.52, 0], r: 0.055 }, () => skin, 10, 4);
  m.rounded({ kind: "sphere", c: [0, 1.63 / 1.15, 0], r: 0.115, scale: [1, 1.15, 1] }, () => skin, 16, 6);
  // hair over the back of the head, so which way a faceless figure faces still reads
  m.rounded({ kind: "sphere", c: [0, 1.665 / 1.1, -0.025], r: 0.118, scale: [1, 1.1, 1] }, (p) => (p[2] < 0.02 || p[1] > 1.72 ? HAIR : skin), 16, 6);
  place(m, [at[0], 0, at[2]], yaw);
  return m;
}

/** The mannequin on the office exam table at a turn angle, with an optional lit region. */
export function examBodyMesh(at: Vec3, yaw: number, turn: number, highlight: Parameters<typeof buildBody>[1]): MeshBuilder {
  const m = buildBody(turn, highlight);
  place(m, [at[0], 0, at[2]], yaw);
  return m;
}

/** Floor, ceiling, wall boxes and the outer walls (just outside the bounds). */
export function shellMesh(loc: Location): MeshBuilder {
  const m = new MeshBuilder();
  const [x0, z0, x1, z1] = loc.bounds, H = loc.ceiling;
  const floor = color(loc.floor, COLORS.tile!), wall = color(loc.wall, COLORS.light!);
  // the floor in a gentle two-tone checker so movement reads, even on flat colours
  const tile = 1;
  for (let x = x0; x < x1 - 1e-6; x += tile) {
    for (let z = z0; z < z1 - 1e-6; z += tile) {
      const odd = (Math.floor(x - x0) + Math.floor(z - z0)) % 2 === 1;
      m.poly([[x, 0, z], [x, 0, Math.min(z1, z + tile)], [Math.min(x1, x + tile), 0, Math.min(z1, z + tile)], [Math.min(x1, x + tile), 0, z]], odd ? shade(floor, 0.94) : floor);
    }
  }
  m.poly([[x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1]], shade(wall, 0.92));
  const wallBox = (bx0: number, bz0: number, bx1: number, bz1: number) => {
    m.box([bx0, 0, bz0], [bx1, H, bz1], wall);
    // a darker skirting band, so walls meet the floor visibly
    m.box([bx0 - 0.005, 0, bz0 - 0.005], [bx1 + 0.005, 0.12, bz1 + 0.005], shade(wall, 0.6));
  };
  const t = 0.1;
  wallBox(x0 - t, z0 - t, x1 + t, z0);
  wallBox(x0 - t, z1, x1 + t, z1 + t);
  wallBox(x0 - t, z0, x0, z1);
  wallBox(x1, z0, x1 + t, z1);
  for (const [a, b, c, d] of loc.walls) wallBox(a, b, c, d);
  return m;
}

/** Flat glowing ceiling panels above each light. */
export function lightPanels(loc: Location): MeshBuilder {
  const m = new MeshBuilder();
  const y = loc.ceiling - 0.005;
  for (const [x, , z] of loc.lights) m.poly([[x - 0.45, y, z - 0.25], [x + 0.45, y, z - 0.25], [x + 0.45, y, z + 0.25], [x - 0.45, y, z + 0.25]], PANEL);
  return m;
}

/** Engine light rows (x, y, z, range, r, g, b, intensity) from a location's lights. */
export function lightRows(loc: Location): number[][] {
  const warm = loc.ambience?.startsWith("house") || loc.ambience === "basement";
  return loc.lights.map(([x, y, z, k]) => [x, Math.min(y, loc.ceiling - 0.15), z, 7.5, 1.0, warm ? 0.9 : 0.98, warm ? 0.78 : 0.95, 0.35 + k * 0.6]);
}

