// Metres, Y up. yaw = 0 looks along −Z; positive pitch looks up (Frozen Star convention).
export type Vec3 = [number, number, number];
/** A solid footprint on the floor: [x0, z0, x1, z1], x0 < x1, z0 < z1. */
export type Box = [number, number, number, number];
export interface Spawn { x: number; z: number; yaw: number }

/** Mesh kinds the renderer knows. Unknown kinds render as a plain box. */
export type PropKind =
  | "box" | "desk" | "chair" | "table" | "exam-table" | "shelf" | "cabinet" | "counter"
  | "fridge" | "stove" | "sink" | "bed" | "sofa" | "rug" | "stairs" | "rail" | "door"
  | "window" | "lamp" | "terminal" | "board" | "plant" | "tray" | "bottle" | "phone"
  | "paper" | "body";

export interface Prop {
  id: string;
  kind: PropKind;
  /** Centre of the prop's footprint on the floor (y = bottom). */
  at: Vec3;
  /** Width (x), height (y), depth (z) before yaw. */
  size: Vec3;
  yaw?: number;
  /** A palette key: "steel", "wood", "tile", "paper", "fabric", "glass", "accent", "dark", "light", "warm". */
  color?: string;
  /** Blocks walking (adds its footprint as a Box). Default true for size[1] > 0.3. */
  solid?: boolean;
}

export type Action =
  | { kind: "door"; to: string; spawn: string }            // go to another location
  | { kind: "read"; text: string }                         // story text id (story lane)
  | { kind: "talk"; npc: string }                          // npc id (story lane)
  | { kind: "procedure"; procedure: string }               // run a case procedure (scene, autopsy, tox, xray...)
  | { kind: "finding"; finding: string }                   // a scene evidence spot; reveals that case finding
  | { kind: "exam" }                                       // step up to the exam table: region picking
  | { kind: "certificate" }                                // desk terminal: certificate, link evidence, sign
  | { kind: "lesson"; skill: string }                      // reference shelf: open a lesson for a skill
  | { kind: "cases" }                                      // intake board: choose / start a case
  | { kind: "notebook" };                                  // findings notebook (also always on a HUD key)

export interface Interactable {
  id: string;
  /** Point the player looks at / walks near. */
  at: Vec3;
  /** Reach in metres (default 1.6). */
  reach?: number;
  /** Verb phrase on the prompt, e.g. "Read the intake board". */
  label: string;
  action: Action;
  /** Only available while this case is active (scene locations) — optional. */
  caseId?: string;
}

export interface Location {
  id: string;            // "office", "scene-night-shift", ...
  name: string;          // shown on arrival: "County Medical Examiner — ground floor"
  /** Extra solid boxes beyond prop footprints (walls). */
  walls: Box[];
  /** Interior bounds for floor/ceiling: [x0, z0, x1, z1] and ceiling height. */
  bounds: Box;
  ceiling: number;
  floor: string;         // palette key
  wall: string;          // palette key
  props: Prop[];
  interactables: Interactable[];
  spawns: Record<string, Spawn>;   // must include "start"
  /** Point lights: [x, y, z, intensity 0..1]. */
  lights: [number, number, number, number][];
  /** Audio ambience key for the feel lane: "office", "morgue", "house-night", "house-day", "basement". */
  ambience?: string;
  /** The case this location belongs to (scenes). */
  caseId?: string;
}
