import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { doors, LocationError, locationProblems, parseLocation, placeholderScene, propBox, solidBoxes } from "../src/casework/world/location.ts";
import { layoutProblems } from "../src/casework/world/layout-check.ts";
import type { CaseDef } from "../src/casework/case/model.ts";
import type { Location } from "../src/casework/world/types.ts";

const PACK = resolve(import.meta.dirname, "..", "packs", "forensics-core");
const json = (p: string) => JSON.parse(readFileSync(resolve(PACK, p), "utf8"));
const office = json("world/office.json") as Location;
const cases = (json("manifest.json").cases as string[]).map((p) => json(p) as CaseDef);

test("the office is a valid location", () => {
  assert.deepEqual(locationProblems(office), []);
  // the office has no way "out" (the front door is a read): every other layout rule holds
  assert.deepEqual(layoutProblems(office).filter((p) => !p.endsWith("no door out")), []);
  for (const s of ["start", "garage", "desk"]) assert.ok(office.spawns[s], `spawn ${s}`);
});

test("the office has every station the contract names", () => {
  const kinds = office.interactables.map((i) => (i.action.kind === "procedure" ? `procedure:${i.action.procedure}` : i.action.kind));
  for (const k of ["cases", "certificate", "lesson", "exam", "procedure:autopsy", "procedure:xray", "procedure:tox", "procedure:scene"]) assert.ok(kinds.includes(k), k);
  assert.ok(office.props.some((p) => p.kind === "exam-table"));
});

test("the office places the story's readables and people", () => {
  const reads = office.interactables.flatMap((i) => (i.action.kind === "read" ? [i.action.text] : []));
  for (const t of ["welcome-letter", "poster-time-of-death", "van-logbook", "desk-note", "voicemail", "case-folder", "effects"]) assert.ok(reads.includes(t), t);
  const talks = office.interactables.flatMap((i) => (i.action.kind === "talk" ? [i.action.npc] : []));
  for (const n of ["mentor", "investigator", "tech"]) assert.ok(talks.includes(n), n);
  const texts = json("story/texts.json") as Record<string, unknown>;
  for (const t of reads) if (t !== "front-door") assert.ok(t in texts || ["desk-note", "voicemail", "case-folder", "effects"].includes(t), `text ${t}`);
});

test("every case has a scene that returns to the garage and places its scene findings", () => {
  for (const c of cases) {
    const scene = json(`world/scenes/scene-${c.id}.json`) as Location;
    assert.deepEqual(locationProblems(scene), [], c.id);
    assert.ok(doors(scene).some((d) => d.to === "office" && d.spawn === "garage"), c.id);
    const placed = scene.interactables.flatMap((i) => (i.action.kind === "finding" ? [i.action.finding] : []));
    for (const f of c.findings.filter((f) => f.procedure === "scene")) assert.ok(placed.includes(f.id), `${c.id}: ${f.id}`);
  }
});

test("a generated placeholder scene is valid", () => {
  for (const c of cases) {
    const l = placeholderScene({ caseId: c.id, title: c.title, findings: c.findings.filter((f) => f.procedure === "scene").map((f) => ({ id: f.id, label: f.label })) });
    assert.deepEqual(locationProblems(l), [], c.id);
    assert.equal(l.id, `scene-${c.id}`);
  }
});

test("prop footprints follow yaw", () => {
  const b = propBox({ id: "x", kind: "box", at: [0, 0, 0], size: [2, 1, 1], yaw: Math.PI / 2 });
  assert.ok(Math.abs(b[2] - b[0] - 1) < 1e-9 && Math.abs(b[3] - b[1] - 2) < 1e-9);
  assert.ok(solidBoxes(office).length > office.walls.length);
});

test("bad locations are refused with reasons", () => {
  assert.throws(() => parseLocation({ id: "x" }), LocationError);
  const bad = { ...office, spawns: { start: { x: -11.7, z: -5.2, yaw: 0 } } };
  assert.ok(locationProblems(bad).some((p) => p.includes("inside something solid")));
  const badAction = { ...office, interactables: [{ id: "q", at: [0, 1, 1], label: "Q", action: { kind: "fly" } }] };
  assert.ok(locationProblems(badAction).some((p) => p.includes("unknown action")));
});
