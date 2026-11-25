// Unit tests of the layout validator: a small good room passes, and each kind of broken layout is caught.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Location } from "../src/casework/world/types.ts";
import { layoutProblems, propFootprint, renderTopDown, standable, solidBoxes } from "../src/casework/world/layout-check.ts";

/** A 6 × 4 m room split by a wall at x = 3 with a 0.9 m doorway; door out at the south. */
function room(): Location {
  return {
    id: "scene-test", name: "Test house", caseId: "test",
    bounds: [0, 0, 6, 4], ceiling: 2.5, floor: "wood", wall: "light",
    walls: [[2.94, 0, 3.06, 1.5], [2.94, 2.4, 3.06, 4]],
    props: [
      { id: "bed", kind: "bed", at: [4.5, 0, 1], size: [2, 0.55, 1.4] },
      { id: "rug", kind: "rug", at: [1.5, 0, 2], size: [1.5, 0.01, 1] },
    ],
    interactables: [
      { id: "door", at: [1, 1.1, 3.95], label: "Leave", action: { kind: "door", to: "office", spawn: "garage" } },
      { id: "clue", at: [5.5, 0.6, 3.5], label: "Look", action: { kind: "finding", finding: "clue" }, caseId: "test" },
    ],
    spawns: { start: { x: 1, z: 3.4, yaw: 0 } },
    lights: [[1.5, 2.4, 2, 0.5]],
  };
}
const has = (ps: string[], re: RegExp) => assert.ok(ps.some((p) => re.test(p)), `expected ${re} in ${JSON.stringify(ps)}`);

test("a good room passes", () => {
  assert.deepEqual(layoutProblems(room(), { findings: ["clue"] }), []);
});

test("malformed boxes are caught", () => {
  const r = room();
  r.walls.push([2, 2, 1, 3]);
  has(layoutProblems(r), /wall 2 .* not a well-formed box/);
  const b = room();
  b.bounds = [0, 0, 0, 4];
  has(layoutProblems(b), /bounds/);
});

test("a spawn inside furniture or too close to a wall is caught", () => {
  const r = room();
  r.spawns.start = { x: 4.5, z: 1, yaw: 0 };
  has(layoutProblems(r), /spawn start .* inside something solid/);
  const w = room();
  w.spawns.start = { x: 2.8, z: 0.5, yaw: 0 };
  has(layoutProblems(w), /spawn start/);
  const m = room();
  delete (m.spawns as Record<string, unknown>).start;
  has(layoutProblems(m), /no spawn "start"/);
});

test("closing the doorway makes the far side unreachable", () => {
  const r = room();
  r.walls = [[2.94, 0, 3.06, 4]];
  has(layoutProblems(r), /clue can't be reached/);
});

test("a doorway narrower than the player is a wall", () => {
  const r = room();
  r.walls = [[2.94, 0, 3.06, 1.8], [2.94, 2.3, 3.06, 4]]; // 0.5 m < 2 × 0.28
  has(layoutProblems(r), /clue can't be reached/);
});

test("being within reach through a wall doesn't count", () => {
  const r = room();
  r.walls = [[2.94, 0, 3.06, 4]];
  r.interactables[1]!.at = [3.3, 1, 2]; // 0.3 m past the wall, unreachable side
  has(layoutProblems(r), /clue can't be reached/);
  // …but a thing mounted in the wall itself (a window) is fine from the open side.
  r.interactables[1]!.at = [3, 1.4, 2];
  assert.deepEqual(layoutProblems(r, { findings: ["clue"] }), []);
});

test("missing, doubled and stray scene findings are caught", () => {
  has(layoutProblems(room(), { findings: ["clue", "pills"] }), /"pills" has no finding interactable/);
  const r = room();
  r.interactables.push({ id: "clue-2", at: [5, 0.6, 3.5], label: "Look", action: { kind: "finding", finding: "clue" }, caseId: "test" });
  has(layoutProblems(r, { findings: ["clue"] }), /"clue" has 2 finding interactables/);
  has(layoutProblems(room(), { findings: [] }), /"clue" is not a scene finding/);
  const c = room();
  delete c.interactables[1]!.caseId;
  has(layoutProblems(c), /must carry caseId test/);
});

test("door rules: a door out, and scenes lead back to the garage", () => {
  const r = room();
  r.interactables[0]!.action = { kind: "door", to: "office", spawn: "start" };
  has(layoutProblems(r), /no door back to the office/);
  r.interactables.shift();
  has(layoutProblems(r), /no door out/);
});

test("duplicate ids and unknown prop kinds are caught", () => {
  const r = room();
  r.props.push({ ...r.props[1]!, at: [1, 0, 1] });
  r.interactables.push({ ...r.interactables[0]! });
  (r.props[0] as { kind: string }).kind = "piano";
  const ps = layoutProblems(r);
  has(ps, /prop id "rug" is used twice/);
  has(ps, /unknown kind "piano"/);
  const s = room();
  s.interactables.push({ ...s.interactables[0]! });
  has(layoutProblems(s), /interactable id "door" is used twice/);
});

test("props through the ceiling or outside the bounds are caught", () => {
  const r = room();
  r.props.push({ id: "tall", kind: "shelf", at: [1, 0, 1], size: [1, 3, 0.4] });
  r.props.push({ id: "out", kind: "box", at: [-1, 0, 1], size: [0.5, 0.5, 0.5] });
  const ps = layoutProblems(r);
  has(ps, /tall pokes through the ceiling/);
  has(ps, /out sits outside the bounds/);
});

test("yawed props turn their footprint; short props don't block", () => {
  const fp = propFootprint({ id: "b", kind: "bed", at: [0, 0, 0], size: [2, 0.5, 1], yaw: Math.PI / 2 });
  assert.ok(Math.abs(fp[2] - fp[0] - 1) < 1e-9 && Math.abs(fp[3] - fp[1] - 2) < 1e-9);
  const r = room();
  assert.equal(solidBoxes(r).length, r.walls.length + 1); // bed yes, rug no
  assert.ok(standable(r, solidBoxes(r), 1.5, 2)); // standing on the rug
});

test("the ASCII render shows walls, props, spawn and door", () => {
  const art = renderTopDown(room(), 0.25);
  assert.match(art, /#/);
  assert.match(art, /B/);
  assert.match(art, /\*/);
  assert.match(art, />/);
  assert.equal(art.split("\n").length, 16);
});
