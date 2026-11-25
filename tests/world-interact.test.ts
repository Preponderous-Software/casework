import { test } from "node:test";
import assert from "node:assert/strict";
import { aimAt, available, nearest } from "../src/casework/world/interact.ts";
import type { Interactable, Location } from "../src/casework/world/types.ts";

const board: Interactable = { id: "board", at: [0, 1.6, -1.2], label: "Read the board", action: { kind: "cases" } };
const pills: Interactable = { id: "pills", at: [1, 0.8, -1], label: "Pills", action: { kind: "finding", finding: "pills" }, caseId: "night-shift" };
const far: Interactable = { id: "far", at: [0, 1.6, -5], label: "Far", action: { kind: "notebook" } };

test("the thing in front of you, within reach, is the target", () => {
  const a = aimAt([0, 1.64, 0], [0, 0, -1], [board, far]);
  assert.equal(a?.target.id, "board");
});

test("nothing is targeted when looking away or out of reach", () => {
  assert.equal(aimAt([0, 1.64, 0], [0, 0, 1], [board]), null);
  assert.equal(aimAt([0, 1.64, 0], [0, 0, -1], [far]), null);
});

test("case interactables only count while their case is active", () => {
  const eye = [0.2, 1.4, 0] as [number, number, number];
  const dir = [0.8, -0.6, -1] as [number, number, number];
  assert.equal(aimAt(eye, dir, [pills], null), null);
  assert.equal(aimAt(eye, dir, [pills], "kitchen-floor"), null);
  assert.equal(aimAt(eye, dir, [pills], "night-shift")?.target.id, "pills");
  const loc = { interactables: [board, pills] } as Location;
  assert.deepEqual(available(loc, null).map((i) => i.id), ["board"]);
  assert.deepEqual(available(loc, "night-shift").map((i) => i.id), ["board", "pills"]);
});

test("the nearer of two aligned targets wins", () => {
  const near1: Interactable = { ...board, id: "near", at: [0, 1.6, -0.8] };
  assert.equal(aimAt([0, 1.64, 0], [0, 0, -1], [board, near1])?.target.id, "near");
});

test("nearest ignores aim (touch players)", () => {
  assert.equal(nearest([0, 1.64, 0], [board, far], null)?.id, "board");
});

test("walls hide what's behind them, but not what's mounted in them", () => {
  const wall: [number, number, number, number] = [-2, -0.7, 2, -0.6];
  assert.equal(aimAt([0, 1.64, 0], [0, 0, -1], [board], null, [wall]), null);
  const mounted: Interactable = { ...board, id: "phone", at: [0, 1.4, -0.65] };
  assert.equal(aimAt([0, 1.64, 0], [0, -0.3, -1], [mounted], null, [wall])?.target.id, "phone");
  assert.equal(nearest([0, 1.64, 0], [board], null, 0.3, [wall]), null);
});
