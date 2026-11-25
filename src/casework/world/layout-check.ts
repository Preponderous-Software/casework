// Pure layout validation for first-person locations (no DOM). A location passes when its boxes are
// well formed, every spawn stands clear of solid geometry, and a player of radius PLAYER_RADIUS who
// walks from spawn "start" can get within reach of every interactable without looking through a
// wall. renderTopDown() draws an ASCII plan for eyeballing layouts while authoring them.
import type { Box, Location, Prop, PropKind } from "./types.ts";

export const PLAYER_RADIUS = 0.28;
export const GRID = 0.1;
export const DEFAULT_REACH = 1.6;

export const PROP_KINDS: readonly PropKind[] = [
  "box", "desk", "chair", "table", "exam-table", "shelf", "cabinet", "counter",
  "fridge", "stove", "sink", "bed", "sofa", "rug", "stairs", "rail", "door",
  "window", "lamp", "terminal", "board", "plant", "tray", "bottle", "phone",
  "paper", "body",
];

const EPS = 1e-9;
const finite = (...n: number[]) => n.every((v) => typeof v === "number" && Number.isFinite(v));

/** Whether a prop blocks walking (contract default: taller than 0.3 m). */
export function isSolid(p: Prop): boolean {
  return p.solid ?? p.size[1] > 0.3;
}

/** The axis-aligned floor footprint of a prop, accounting for yaw. */
export function propFootprint(p: Prop): Box {
  const [x, , z] = p.at;
  const [w, , d] = p.size;
  const yaw = p.yaw ?? 0;
  const c = Math.abs(Math.cos(yaw));
  const s = Math.abs(Math.sin(yaw));
  const hw = (w * c + d * s) / 2;
  const hd = (w * s + d * c) / 2;
  return [x - hw, z - hd, x + hw, z + hd];
}

/** Walls plus the footprints of solid props. */
export function solidBoxes(loc: Location): Box[] {
  return [...loc.walls, ...loc.props.filter(isSolid).map(propFootprint)];
}

function boxOk(b: unknown): b is Box {
  return Array.isArray(b) && b.length === 4 && finite(...(b as number[])) && b[0] < b[2] && b[1] < b[3];
}

/** Distance from a point to a box on the floor (0 inside). */
function distToBox(x: number, z: number, b: Box): number {
  const dx = Math.max(b[0] - x, 0, x - b[2]);
  const dz = Math.max(b[1] - z, 0, z - b[3]);
  return Math.hypot(dx, dz);
}

/** Can a circle of radius r stand at (x, z)? */
export function standable(loc: Location, solids: Box[], x: number, z: number, r = PLAYER_RADIUS): boolean {
  const [bx0, bz0, bx1, bz1] = loc.bounds;
  if (x - r < bx0 - EPS || x + r > bx1 + EPS || z - r < bz0 - EPS || z + r > bz1 + EPS) return false;
  return solids.every((b) => distToBox(x, z, b) >= r - EPS);
}

/** Does the segment (ax,az)→(bx,bz) pass through the interior of box b? (2D slab test) */
function segmentHitsBox(ax: number, az: number, bx: number, bz: number, b: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const d = [bx - ax, bz - az];
  const o = [ax, az];
  const lo = [b[0], b[1]];
  const hi = [b[2], b[3]];
  for (let i = 0; i < 2; i++) {
    const di = d[i]!;
    const oi = o[i]!;
    if (Math.abs(di) < EPS) {
      if (oi <= lo[i]! || oi >= hi[i]!) return false;
      continue;
    }
    let ta = (lo[i]! - oi) / di;
    let tb = (hi[i]! - oi) / di;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 >= t1) return false;
  }
  return true;
}

function inside(x: number, z: number, b: Box): boolean {
  return x > b[0] && x < b[2] && z > b[1] && z < b[3];
}

export interface Reach {
  /** Grid columns/rows and walkable-and-reachable flags (row-major, z rows). */
  cols: number;
  rows: number;
  reached: Uint8Array;
  cellX(i: number): number;
  cellZ(j: number): number;
}

/** Flood fill the walkable grid from (x, z). */
export function floodFill(loc: Location, from: { x: number; z: number }, step = GRID, r = PLAYER_RADIUS): Reach {
  const [bx0, bz0, bx1, bz1] = loc.bounds;
  const cols = Math.max(1, Math.floor((bx1 - bx0) / step));
  const rows = Math.max(1, Math.floor((bz1 - bz0) / step));
  const cellX = (i: number) => bx0 + (i + 0.5) * step;
  const cellZ = (j: number) => bz0 + (j + 0.5) * step;
  const solids = solidBoxes(loc);
  const reached = new Uint8Array(cols * rows);
  const open = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) open[j * cols + i] = standable(loc, solids, cellX(i), cellZ(j), r) ? 1 : 0;
  // Start from the open cell nearest the spawn (the spawn itself is checked separately).
  let best = -1;
  let bestD = Infinity;
  for (let k = 0; k < open.length; k++) {
    if (!open[k]) continue;
    const dd = Math.hypot(cellX(k % cols) - from.x, cellZ(Math.floor(k / cols)) - from.z);
    if (dd < bestD) { bestD = dd; best = k; }
  }
  if (best < 0 || bestD > step * 1.5) return { cols, rows, reached, cellX, cellZ };
  const queue = [best];
  reached[best] = 1;
  while (queue.length) {
    const k = queue.pop()!;
    const i = k % cols;
    const j = Math.floor(k / cols);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      const nk = nj * cols + ni;
      if (open[nk] && !reached[nk]) { reached[nk] = 1; queue.push(nk); }
    }
  }
  return { cols, rows, reached, cellX, cellZ };
}

/** Can the player, somewhere in the reached area, get within reach of (x, z) with no wall between? */
function reachable(loc: Location, grid: Reach, x: number, z: number, reach: number): boolean {
  const walls = loc.walls.filter((b) => !inside(x, z, b)); // a window or phone mounted in a wall is fine
  for (let k = 0; k < grid.reached.length; k++) {
    if (!grid.reached[k]) continue;
    const cx = grid.cellX(k % grid.cols);
    const cz = grid.cellZ(Math.floor(k / grid.cols));
    if (Math.hypot(cx - x, cz - z) > reach) continue;
    if (walls.every((b) => !segmentHitsBox(cx, cz, x, z, b))) return true;
  }
  return false;
}

const PALETTE = new Set(["steel", "wood", "tile", "paper", "fabric", "glass", "accent", "dark", "light", "warm"]);

/** Every problem with a location's layout; [] when it is good. */
export function layoutProblems(loc: Location, opts: { findings?: string[] } = {}): string[] {
  const out: string[] = [];
  const where = loc.id || "(no id)";
  const say = (s: string) => out.push(`${where}: ${s}`);

  if (!loc.id) say("location has no id");
  if (!loc.name) say("location has no name");
  if (!boxOk(loc.bounds)) { say(`bounds ${JSON.stringify(loc.bounds)} is not a well-formed box`); return out; }
  if (!finite(loc.ceiling) || loc.ceiling < 2 || loc.ceiling > 6) say(`ceiling ${loc.ceiling} m is not believable (2–6 m)`);
  for (const [key, v] of [["floor", loc.floor], ["wall", loc.wall]] as const) if (!PALETTE.has(v)) say(`${key} colour "${v}" is not a palette key`);

  loc.walls.forEach((b, i) => { if (!boxOk(b)) say(`wall ${i} ${JSON.stringify(b)} is not a well-formed box`); });

  const kinds = new Set<string>(PROP_KINDS);
  const propIds = new Set<string>();
  for (const p of loc.props) {
    if (!p.id) say("a prop has no id");
    else if (propIds.has(p.id)) say(`prop id "${p.id}" is used twice`);
    propIds.add(p.id);
    if (!kinds.has(p.kind)) say(`prop ${p.id} has unknown kind "${p.kind}"`);
    if (!Array.isArray(p.at) || p.at.length !== 3 || !finite(...p.at)) say(`prop ${p.id} has a bad position`);
    if (!Array.isArray(p.size) || p.size.length !== 3 || !finite(...p.size) || p.size.some((s) => s <= 0)) say(`prop ${p.id} has a bad size`);
    else if (p.at[1] + p.size[1] > loc.ceiling + EPS) say(`prop ${p.id} pokes through the ceiling`);
    if (p.color !== undefined && !PALETTE.has(p.color)) say(`prop ${p.id} colour "${p.color}" is not a palette key`);
    const [fx0, fz0, fx1, fz1] = propFootprint(p);
    const [bx0, bz0, bx1, bz1] = loc.bounds;
    if (fx0 < bx0 - EPS || fz0 < bz0 - EPS || fx1 > bx1 + EPS || fz1 > bz1 + EPS) say(`prop ${p.id} sits outside the bounds`);
  }
  if (out.length) return out; // geometry is broken; reachability would only add noise

  const solids = solidBoxes(loc);
  if (!loc.spawns.start) say('no spawn "start"');
  for (const [name, s] of Object.entries(loc.spawns)) {
    if (!finite(s.x, s.z, s.yaw)) { say(`spawn ${name} has a bad position`); continue; }
    if (!standable(loc, solids, s.x, s.z)) say(`spawn ${name} (${s.x}, ${s.z}) is outside the bounds or inside something solid`);
  }

  for (const [x, y, z, k] of loc.lights) {
    if (!finite(x, y, z, k) || k < 0 || k > 1) say(`light ${JSON.stringify([x, y, z, k])} is malformed`);
    else if (y > loc.ceiling || !inside(x, z, loc.bounds)) say(`light ${JSON.stringify([x, y, z, k])} is outside the room`);
  }

  const ids = new Set<string>();
  for (const it of loc.interactables) {
    if (!it.id) say("an interactable has no id");
    else if (ids.has(it.id)) say(`interactable id "${it.id}" is used twice`);
    ids.add(it.id);
    if (!it.label) say(`interactable ${it.id} has no label`);
    if (!Array.isArray(it.at) || it.at.length !== 3 || !finite(...it.at)) say(`interactable ${it.id} has a bad position`);
    else if (it.at[1] < 0 || it.at[1] > loc.ceiling) say(`interactable ${it.id} is below the floor or above the ceiling`);
    const a = it.action;
    if (a.kind === "door" && (!a.to || !a.spawn)) say(`door ${it.id} needs a destination and a spawn`);
    if (a.kind === "finding" && !a.finding) say(`finding ${it.id} names no finding`);
    if (a.kind === "talk" && !a.npc) say(`talk ${it.id} names no npc`);
    if (loc.caseId && it.caseId !== undefined && it.caseId !== loc.caseId) say(`interactable ${it.id} belongs to case ${it.caseId}, not ${loc.caseId}`);
    if (a.kind === "finding" && loc.caseId && it.caseId !== loc.caseId) say(`finding ${it.id} must carry caseId ${loc.caseId}`);
  }

  const doors = loc.interactables.filter((i) => i.action.kind === "door");
  if (!doors.length) say("no door out");
  if (loc.caseId && !doors.some((d) => d.action.kind === "door" && d.action.to === "office" && d.action.spawn === "garage")) {
    say('no door back to the office (to "office", spawn "garage")');
  }

  if (opts.findings) {
    const placed = loc.interactables.flatMap((i) => (i.action.kind === "finding" ? [i.action.finding] : []));
    for (const f of opts.findings) {
      const n = placed.filter((p) => p === f).length;
      if (n === 0) say(`scene finding "${f}" has no finding interactable`);
      if (n > 1) say(`scene finding "${f}" has ${n} finding interactables`);
    }
    for (const p of new Set(placed)) if (!opts.findings.includes(p)) say(`finding interactable for "${p}" is not a scene finding of this case`);
  }

  const start = loc.spawns.start;
  if (start && finite(start.x, start.z)) {
    const grid = floodFill(loc, start);
    for (const it of loc.interactables) {
      if (!finite(...it.at)) continue;
      if (!reachable(loc, grid, it.at[0], it.at[2], it.reach ?? DEFAULT_REACH)) say(`interactable ${it.id} can't be reached from spawn start`);
    }
    for (const [name, s] of Object.entries(loc.spawns)) {
      if (name === "start" || !finite(s.x, s.z)) continue;
      const i = Math.floor((s.x - loc.bounds[0]) / GRID);
      const j = Math.floor((s.z - loc.bounds[1]) / GRID);
      const near = [0, 1, -1].some((dj) => [0, 1, -1].some((di) => grid.reached[(j + dj) * grid.cols + (i + di)]));
      if (!near) say(`spawn ${name} can't be walked to from spawn start`);
    }
  }
  return out;
}

const KIND_CHAR: Partial<Record<PropKind, string>> = {
  bed: "B", body: "@", sofa: "S", chair: "h", table: "T", desk: "D", cabinet: "c", counter: "=",
  fridge: "F", stove: "o", sink: "~", shelf: "|", rug: ".", stairs: "^", rail: ":", lamp: "l",
  window: "w", door: "d", plant: "p", box: "x", phone: "t", bottle: "b", paper: "_", tray: "y",
  terminal: "M", board: "Q", "exam-table": "E",
};

/**
 * An ASCII plan of a location, −Z at the top. '#' wall, letters props (see KIND_CHAR; later props
 * draw over earlier ones), '!' interactables, '>' door interactables, '*' spawns.
 */
export function renderTopDown(loc: Location, cell = 0.2): string {
  const [bx0, bz0, bx1, bz1] = loc.bounds;
  const cols = Math.ceil((bx1 - bx0) / cell);
  const rows = Math.ceil((bz1 - bz0) / cell);
  const g: string[][] = Array.from({ length: rows }, () => Array<string>(cols).fill(" "));
  const fill = (b: Box, ch: string) => {
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = bx0 + (i + 0.5) * cell;
      const z = bz0 + (j + 0.5) * cell;
      if (x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3]) g[j]![i] = ch;
    }
  };
  const put = (x: number, z: number, ch: string) => {
    const i = Math.min(cols - 1, Math.max(0, Math.floor((x - bx0) / cell)));
    const j = Math.min(rows - 1, Math.max(0, Math.floor((z - bz0) / cell)));
    g[j]![i] = ch;
  };
  const flat = loc.props.filter((p) => p.kind === "rug");
  for (const p of flat) fill(propFootprint(p), KIND_CHAR[p.kind] ?? "?");
  for (const p of loc.props.filter((q) => q.kind !== "rug")) fill(propFootprint(p), KIND_CHAR[p.kind] ?? "?");
  for (const w of loc.walls) {
    // Thin walls still show: widen them to at least one cell.
    const cx = (w[0] + w[2]) / 2;
    const cz = (w[1] + w[3]) / 2;
    fill([Math.min(w[0], cx - cell / 2), Math.min(w[1], cz - cell / 2), Math.max(w[2], cx + cell / 2), Math.max(w[3], cz + cell / 2)], "#");
  }
  for (const it of loc.interactables) put(it.at[0], it.at[2], it.action.kind === "door" ? ">" : "!");
  for (const s of Object.values(loc.spawns)) put(s.x, s.z, "*");
  return g.map((r) => r.join("").replace(/\s+$/, "")).join("\n");
}
