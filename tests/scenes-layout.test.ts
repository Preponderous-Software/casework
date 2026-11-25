// The three walkable scene locations: each passes the layout validator with its case's scene
// findings, and its dressing agrees with what those findings say.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Location } from "../src/casework/world/types.ts";
import { layoutProblems, propFootprint, renderTopDown } from "../src/casework/world/layout-check.ts";

const pack = resolve(import.meta.dirname, "..", "packs", "forensics-core");
const CASES = ["night-shift", "kitchen-floor", "basement-stairs"] as const;
const WITNESS: Record<(typeof CASES)[number], string> = { "night-shift": "neighbor", "kitchen-floor": "daughter", "basement-stairs": "caller" };

function load(caseId: string) {
  const loc: Location = JSON.parse(readFileSync(resolve(pack, "world", "scenes", `scene-${caseId}.json`), "utf8"));
  const kase = JSON.parse(readFileSync(resolve(pack, "cases", `${caseId}.json`), "utf8"));
  const sceneFindings: string[] = kase.findings.filter((f: { procedure: string }) => f.procedure === "scene").map((f: { id: string }) => f.id);
  return { loc, sceneFindings };
}

for (const caseId of CASES) {
  test(`scene-${caseId} passes the layout check with its scene findings`, () => {
    const { loc, sceneFindings } = load(caseId);
    assert.ok(sceneFindings.length >= 2);
    assert.deepEqual(layoutProblems(loc, { findings: sceneFindings }), [], "\n" + renderTopDown(loc));
  });

  test(`scene-${caseId} belongs to its case, starts at the door and leads back to the garage`, () => {
    const { loc } = load(caseId);
    assert.equal(loc.id, `scene-${caseId}`);
    assert.equal(loc.caseId, caseId);
    assert.ok(loc.spawns.start);
    assert.ok(loc.ambience);
    const door = loc.interactables.find((i) => i.action.kind === "door");
    assert.deepEqual(door?.action, { kind: "door", to: "office", spawn: "garage" });
    // The spawn is by that door, facing into the house.
    assert.ok(Math.hypot(loc.spawns.start!.x - door!.at[0], loc.spawns.start!.z - door!.at[2]) < 1.2);
    for (const i of loc.interactables.filter((i) => i.action.kind !== "door")) assert.equal(i.caseId, caseId, i.id);
  });

  test(`scene-${caseId} has its witness and exactly one covered body`, () => {
    const { loc } = load(caseId);
    const talks = loc.interactables.flatMap((i) => (i.action.kind === "talk" ? [i.action.npc] : []));
    assert.deepEqual(talks, [WITNESS[caseId]]);
    assert.equal(loc.props.filter((p) => p.kind === "body").length, 1);
  });
}

const prop = (loc: Location, id: string) => {
  const p = loc.props.find((q) => q.id === id);
  assert.ok(p, `missing prop ${id}`);
  return p;
};
const near = (a: readonly number[], b: readonly number[], d: number) => Math.hypot(a[0]! - b[0]!, a[2]! - b[2]!) <= d;
const finding = (loc: Location, id: string) => {
  const i = loc.interactables.find((q) => q.action.kind === "finding" && q.action.finding === id);
  assert.ok(i, `no finding ${id}`);
  return i;
};

test("night shift: he lies on the bed, pills on the nightstand, the window in an outside wall", () => {
  const { loc } = load("night-shift");
  const bed = propFootprint(prop(loc, "bed"));
  const body = prop(loc, "body");
  assert.ok(body.at[0] > bed[0] && body.at[0] < bed[2] && body.at[2] > bed[1] && body.at[2] < bed[3]);
  assert.equal(body.at[1], prop(loc, "bed").size[1]); // on the mattress
  assert.ok(near(finding(loc, "pills").at, prop(loc, "nightstand").at, 0.3));
  const win = prop(loc, "bedroom-window");
  assert.equal(win.kind, "window");
  assert.ok(win.at[2] <= loc.bounds[1] + 0.12, "window sits in the north exterior wall");
  assert.ok(near(finding(loc, "window").at, win.at, 0.1));
});

test("kitchen floor: she lies on the kitchen floor, the rug rucked at her feet, warfarin in the cabinet", () => {
  const { loc } = load("kitchen-floor");
  const body = prop(loc, "body");
  assert.equal(body.at[1], 0);
  const feet = body.at[2] + body.size[2] / 2;
  const rug = prop(loc, "kitchen-rug");
  assert.ok(rug.at[2] > feet && rug.at[2] - feet < 0.8, "rug lies just past her feet");
  assert.ok(near(finding(loc, "rug").at, rug.at, 0.4));
  assert.ok(near(finding(loc, "warfarin").at, prop(loc, "medicine-cabinet").at, 0.2));
  assert.ok(near(finding(loc, "phone").at, prop(loc, "wall-phone").at, 0.1));
});

test("basement stairs: eleven steps, and he lies at their foot", () => {
  const { loc } = load("basement-stairs");
  const stairs = prop(loc, "stairs");
  assert.ok(Math.abs(stairs.size[2] / 11 - 0.26) < 0.01, "eleven treads of ~26 cm");
  assert.ok(Math.abs(stairs.size[1] / 11 - 0.2) < 0.01, "eleven risers of ~20 cm");
  const foot = propFootprint(stairs)[3];
  const body = prop(loc, "body");
  const head = body.at[2] - body.size[2] / 2;
  assert.ok(head >= foot && head - foot < 0.4, "head lies just off the bottom step");
  assert.ok(near(finding(loc, "steps").at, stairs.at, 1.5));
  assert.ok(near(finding(loc, "call").at, prop(loc, "cordless-phone").at, 0.1));
  assert.ok(loc.ceiling <= 2.4, "a basement ceiling");
});
