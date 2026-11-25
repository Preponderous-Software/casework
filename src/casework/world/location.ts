// Locations as data: validating a Location's JSON, turning prop footprints into solid boxes, and a
// simple generated scene for cases that have no hand-made one yet. Pure: no DOM, no engine.
import { resolve, RADIUS } from "./walk.ts";
import type { Action, Box, Interactable, Location, Prop, PropKind, Vec3 } from "./types.ts";

export const PROP_KINDS: readonly PropKind[] = [
  "box", "desk", "chair", "table", "exam-table", "shelf", "cabinet", "counter", "fridge", "stove", "sink", "bed", "sofa",
  "rug", "stairs", "rail", "door", "window", "lamp", "terminal", "board", "plant", "tray", "bottle", "phone", "paper", "body",
];

export const PALETTE_KEYS = ["steel", "wood", "tile", "paper", "fabric", "glass", "accent", "dark", "light", "warm"] as const;

const ACTION_KINDS: readonly Action["kind"][] = ["door", "read", "talk", "procedure", "finding", "exam", "certificate", "lesson", "cases", "notebook"];

/** Rotate a floor offset (x, z) by yaw about Y: local −Z turns to the yaw's forward. */
export function rotateXZ(x: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

/** The axis-aligned footprint of a prop on the floor (its rotated rectangle's bounds). */
export function propBox(p: Prop): Box {
  const hw = p.size[0] / 2, hd = p.size[2] / 2, yaw = p.yaw ?? 0;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [cx, cz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as const) {
    const [rx, rz] = rotateXZ(cx, cz, yaw);
    x0 = Math.min(x0, p.at[0] + rx);
    x1 = Math.max(x1, p.at[0] + rx);
    z0 = Math.min(z0, p.at[2] + rz);
    z1 = Math.max(z1, p.at[2] + rz);
  }
  return [x0, z0, x1, z1];
}

export function isSolid(p: Prop): boolean {
  return p.solid ?? p.size[1] > 0.3;
}

/** Everything the walker collides with: the walls, solid props, and the outer bounds. */
export function solidBoxes(loc: Location): Box[] {
  const [bx0, bz0, bx1, bz1] = loc.bounds;
  const t = 1;
  const edges: Box[] = [
    [bx0 - t, bz0 - t, bx1 + t, bz0],
    [bx0 - t, bz1, bx1 + t, bz1 + t],
    [bx0 - t, bz0, bx0, bz1],
    [bx1, bz0, bx1 + t, bz1],
  ];
  return [...loc.walls, ...loc.props.filter(isSolid).map(propBox), ...edges];
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isVec = (x: unknown): x is Vec3 => Array.isArray(x) && x.length === 3 && x.every(isNum);
const isBox = (x: unknown): x is Box => Array.isArray(x) && x.length === 4 && x.every(isNum) && (x as number[])[0]! < (x as number[])[2]! && (x as number[])[1]! < (x as number[])[3]!;

function actionProblem(a: unknown): string | null {
  if (!a || typeof a !== "object") return "has no action";
  const k = (a as { kind?: unknown }).kind;
  if (!ACTION_KINDS.includes(k as Action["kind"])) return `has unknown action kind ${String(k)}`;
  const need: Partial<Record<Action["kind"], string[]>> = {
    door: ["to", "spawn"], read: ["text"], talk: ["npc"], procedure: ["procedure"], finding: ["finding"], lesson: ["skill"],
  };
  for (const f of need[k as Action["kind"]] ?? []) {
    if (typeof (a as Record<string, unknown>)[f] !== "string" || !(a as Record<string, string>)[f]) return `${String(k)} action needs a "${f}"`;
  }
  return null;
}

/** Problems with a location's data, as readable strings (empty when valid). */
export function locationProblems(raw: unknown): string[] {
  const p: string[] = [];
  if (!raw || typeof raw !== "object") return ["location is not an object"];
  const loc = raw as Location;
  const id = typeof loc.id === "string" && loc.id ? loc.id : "?";
  const at = (m: string) => p.push(`${id}: ${m}`);
  if (id === "?") p.push("location has no id");
  if (typeof loc.name !== "string" || !loc.name) at("has no name");
  if (!isBox(loc.bounds)) return [...p, `${id}: bounds must be [x0, z0, x1, z1] with x0 < x1 and z0 < z1`];
  if (!isNum(loc.ceiling) || loc.ceiling <= 1.8) at("ceiling must be a number above 1.8 m");
  if (typeof loc.floor !== "string" || typeof loc.wall !== "string") at("needs floor and wall palette keys");
  if (!Array.isArray(loc.walls) || !loc.walls.every(isBox)) at("walls must be a list of boxes [x0, z0, x1, z1]");
  if (!Array.isArray(loc.props)) at("props must be a list");
  if (!Array.isArray(loc.interactables)) at("interactables must be a list");
  if (!Array.isArray(loc.lights) || !loc.lights.every((l) => Array.isArray(l) && l.length === 4 && l.every(isNum))) at("lights must be rows of [x, y, z, intensity]");
  if (!loc.spawns || typeof loc.spawns !== "object" || !loc.spawns.start) at('needs a "start" spawn');
  if (p.length) return p;

  const [bx0, bz0, bx1, bz1] = loc.bounds;
  const inside = (x: number, z: number) => x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1;
  const ids = new Set<string>();
  for (const pr of loc.props) {
    if (!pr || typeof pr.id !== "string") {
      at("a prop has no id");
      continue;
    }
    if (ids.has(pr.id)) at(`duplicate prop ${pr.id}`);
    ids.add(pr.id);
    if (!PROP_KINDS.includes(pr.kind)) at(`prop ${pr.id} has unknown kind ${String(pr.kind)}`);
    if (!isVec(pr.at) || !isVec(pr.size) || pr.size.some((s) => s <= 0)) at(`prop ${pr.id} needs at [x, y, z] and a positive size`);
    else if (!inside(pr.at[0], pr.at[2])) at(`prop ${pr.id} is outside the bounds`);
    if (pr.yaw !== undefined && !isNum(pr.yaw)) at(`prop ${pr.id} has a bad yaw`);
    if (pr.color !== undefined && !(PALETTE_KEYS as readonly string[]).includes(pr.color)) at(`prop ${pr.id} has unknown colour ${pr.color}`);
  }
  const iids = new Set<string>();
  for (const it of loc.interactables) {
    if (!it || typeof it.id !== "string") {
      at("an interactable has no id");
      continue;
    }
    if (iids.has(it.id)) at(`duplicate interactable ${it.id}`);
    iids.add(it.id);
    if (!isVec(it.at)) at(`interactable ${it.id} needs at [x, y, z]`);
    else if (!inside(it.at[0], it.at[2])) at(`interactable ${it.id} is outside the bounds`);
    if (typeof it.label !== "string" || !it.label) at(`interactable ${it.id} has no label`);
    const ap = actionProblem(it.action);
    if (ap) at(`interactable ${it.id} ${ap}`);
    if (it.action?.kind === "door" && it.action.to === loc.id && !loc.spawns[it.action.spawn]) at(`door ${it.id} goes to unknown spawn ${it.action.spawn}`);
  }
  const boxes = solidBoxes(loc);
  for (const [name, s] of Object.entries(loc.spawns)) {
    if (!s || !isNum(s.x) || !isNum(s.z) || !isNum(s.yaw)) {
      at(`spawn ${name} needs x, z and yaw`);
      continue;
    }
    if (!inside(s.x, s.z)) at(`spawn ${name} is outside the bounds`);
    const r = resolve(s.x, s.z, boxes, RADIUS);
    if (Math.hypot(r.x - s.x, r.z - s.z) > 0.01) at(`spawn ${name} is inside something solid`);
  }
  return p;
}

export class LocationError extends Error {}

/** A validated Location, or a LocationError listing what's wrong. */
export function parseLocation(raw: unknown): Location {
  const problems = locationProblems(raw);
  if (problems.length) throw new LocationError(problems.join("; "));
  return raw as Location;
}

/** The location a door leads to and where it lands, for every door in a location. */
export function doors(loc: Location): { id: string; to: string; spawn: string }[] {
  return loc.interactables.flatMap((i) => (i.action.kind === "door" ? [{ id: i.id, to: i.action.to, spawn: i.action.spawn }] : []));
}

// ---------- a generated scene ----------

export interface SceneSeed {
  caseId: string;
  title: string;
  /** Scene findings (from the case's "scene" procedure): id and short label. */
  findings: { id: string; label: string }[];
}

/** A plain room for a case with no hand-made scene: the body's outline on a rug in the middle,
 * each scene finding on its own small table around the walls, and the door back to the van. */
export function placeholderScene(seed: SceneSeed): Location {
  const W = 8, D = 7;
  const x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2;
  const props: Prop[] = [
    { id: "rug", kind: "rug", at: [0, 0, -0.4], size: [2.4, 0.02, 1.6], color: "fabric" },
    { id: "body", kind: "body", at: [0, 0, -0.4], size: [1.8, 0.25, 0.5], yaw: 0.3, color: "light", solid: true },
    { id: "door", kind: "door", at: [0, 0, z1 - 0.05], size: [1.0, 2.1, 0.1], color: "wood", solid: false },
    { id: "sofa", kind: "sofa", at: [-2.6, 0, -2.7], size: [2.0, 0.85, 0.8], color: "fabric" },
    { id: "lamp", kind: "lamp", at: [-3.5, 0, -2.9], size: [0.35, 1.6, 0.35], color: "warm" },
    { id: "window", kind: "window", at: [1.5, 0.9, z0 + 0.05], size: [1.6, 1.2, 0.08], color: "glass", solid: false },
  ];
  const interactables: Interactable[] = [
    { id: "door", at: [0, 1.1, z1 - 0.2], reach: 1.8, label: "Head back to the van", action: { kind: "door", to: "office", spawn: "garage" } },
  ];
  const slots: [number, number][] = [[-3.2, -0.4], [3.2, -0.4], [-3.2, 1.8], [3.2, 1.8], [2.6, -2.6], [-1.0, -2.8], [-3.2, 2.9], [3.2, 2.9]];
  seed.findings.forEach((f, i) => {
    const [x, z] = slots[i % slots.length]!;
    props.push({ id: `table-${f.id}`, kind: "table", at: [x, 0, z], size: [0.7, 0.72, 0.6], color: "wood" });
    props.push({ id: `item-${f.id}`, kind: "paper", at: [x, 0.72, z], size: [0.3, 0.02, 0.22], color: "paper", solid: false });
    interactables.push({ id: `finding-${f.id}`, at: [x, 0.8, z], reach: 1.7, label: `Look at: ${f.label}`, action: { kind: "finding", finding: f.id }, caseId: seed.caseId });
  });
  return {
    id: `scene-${seed.caseId}`,
    name: `${seed.title}: the scene`,
    walls: [],
    bounds: [x0, z0, x1, z1],
    ceiling: 2.6,
    floor: "wood",
    wall: "warm",
    props,
    interactables,
    spawns: { start: { x: 0, z: z1 - 0.9, yaw: 0 } },
    lights: [[0, 2.4, 0, 0.9], [-2.5, 2.4, -2, 0.6], [2.5, 2.4, 2, 0.6]],
    ambience: "house-day",
    caseId: seed.caseId,
  };
}
