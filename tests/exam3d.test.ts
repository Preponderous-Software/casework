// The exam room's pure parts: ray hit tests, region lookup on the mannequin, the orbit camera's
// rays, DPR pointer scaling, mesh normals (Strata refuses a mesh with a zero normal), and the event
// API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rayBox, rayCapsule, raySphere, rayShape, v3, type Vec3 } from "../src/adapters/exam3d/geometry.ts";
import { bodyTransform, pickRegion, poseOf, REGION_ANCHORS, TABLE_TOP, torsoRegion } from "../src/adapters/exam3d/body.ts";
import { clampOrbit, eyeOf, LIMITS, project, rayThrough, type Orbit } from "../src/adapters/exam3d/camera.ts";
import { cssToDrawable, cssToNdc, drawableSize, drawableToNdc, effectiveDpr, ndcToCss, pointerScale } from "../src/adapters/exam3d/pointer.ts";
import { MeshBuilder } from "../src/adapters/exam3d/mesh.ts";
import { buildBody, buildFurniture, buildLampFace, buildRoom } from "../src/adapters/exam3d/scene.ts";
import { REGIONS, RegionEvents, isRegion, type Region, type RegionEvent } from "../src/adapters/exam3d/events.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

// ------------------------------------------------------------------ hit tests

test("raySphere: hits the near side, misses beside, and starts inside at t=0", () => {
  near(raySphere([0, 0, -5], [0, 0, 1], [0, 0, 0], 1)!, 4);
  assert.equal(raySphere([0, 2, -5], [0, 0, 1], [0, 0, 0], 1), null);
  assert.equal(raySphere([0, 0, 5], [0, 0, 1], [0, 0, 0], 1), null); // behind the origin
  assert.equal(raySphere([0, 0, 0], [0, 0, 1], [0, 0, 0], 1), 0);
});

test("rayCapsule: the side, the round ends, and a miss past the end", () => {
  const a: Vec3 = [-1, 0, 0], b: Vec3 = [1, 0, 0];
  near(rayCapsule([0, 5, 0], [0, -1, 0], a, b, 0.5)!, 4.5); // side
  near(rayCapsule([5, 0, 0], [-1, 0, 0], a, b, 0.5)!, 3.5); // cap at b
  near(rayCapsule([-1.3, 5, 0], [0, -1, 0], a, b, 0.5)!, 5 - Math.sqrt(0.25 - 0.09)); // over the a cap
  assert.equal(rayCapsule([1.6, 5, 0], [0, -1, 0], a, b, 0.5), null);
});

test("rayBox: faces from each side and parallel misses", () => {
  near(rayBox([0, 5, 0], [0, -1, 0], [-1, -1, -1], [1, 1, 1])!, 4);
  near(rayBox([-3, 0, 0], [1, 0, 0], [-1, -1, -1], [1, 1, 1])!, 2);
  assert.equal(rayBox([0, 5, 2], [0, -1, 0], [-1, -1, -1], [1, 1, 1]), null);
});

test("a scaled capsule is hit at its scaled surface", () => {
  // a torso-like capsule, 1.75x wider in z than its radius
  const s = { kind: "capsule" as const, a: [-0.2, 0, 0] as Vec3, b: [0.4, 0, 0] as Vec3, r: 0.11, scale: [1, 1, 1.75] as Vec3 };
  near(rayShape({ origin: [0, 0, 5], dir: [0, 0, -1] }, s)!, 5 - 0.11 * 1.75);
  near(rayShape({ origin: [0, 5, 0], dir: [0, -1, 0] }, s)!, 5 - 0.11);
});

// ------------------------------------------------------------------ the body

const straightDown = (x: number, z: number) => ({ origin: [x, 3, z] as Vec3, dir: [0, -1, 0] as Vec3 });

test("torso surface splits into chest, abdomen and back", () => {
  assert.equal(torsoRegion([0.3, 0.1, 0]), "chest");
  assert.equal(torsoRegion([-0.1, 0.1, 0]), "abdomen");
  assert.equal(torsoRegion([0.3, -0.1, 0]), "back");
});

test("face up, rays from above find each front region and the body's left is +z", () => {
  const cases: [number, number, Region][] = [
    [0.8, 0, "head"], [0.67, 0, "jaw"], [0.26, 0, "chest"], [-0.05, 0, "abdomen"],
    [0.1, 0.27, "left-arm"], [0.1, -0.27, "right-arm"], [-0.6, 0.105, "left-leg"], [-0.6, -0.105, "right-leg"],
  ];
  for (const [x, z, want] of cases) assert.equal(pickRegion(straightDown(x, z), 0)?.region, want, `at x=${x} z=${z}`);
});

test("face up, the back cannot be reached: the table blocks a ray from below", () => {
  const up = { origin: [0.1, 0.2, 0] as Vec3, dir: [0, 1, 0] as Vec3 };
  assert.equal(pickRegion(up, 0), null);
});

test("face down, the back is on top and left and right swap sides", () => {
  assert.equal(pickRegion(straightDown(0.1, 0), Math.PI)?.region, "back");
  assert.equal(pickRegion(straightDown(0.26, 0), Math.PI)?.region, "back");
  assert.equal(pickRegion(straightDown(0.1, -0.27), Math.PI)?.region, "left-arm");
  assert.equal(pickRegion(straightDown(-0.6, 0.105), Math.PI)?.region, "right-leg");
});

test("empty table and empty air pick nothing", () => {
  assert.equal(pickRegion(straightDown(1.0, 0.35), 0), null);
  assert.equal(pickRegion(straightDown(3, 3), 0), null);
});

test("the body rests on the table in both poses and its transform round-trips", () => {
  for (const turn of [0, Math.PI]) {
    const tf = bodyTransform(turn);
    const p: Vec3 = [0.2, 0.05, -0.1];
    const back = tf.toLocal(tf.toWorld(p));
    for (let i = 0; i < 3; i++) near(back[i]!, p[i]!);
    // the torso's lowest point touches the top
    near(tf.toWorld([0, turn ? 0.11 : -0.11, 0])[1], TABLE_TOP, 1e-9);
  }
  assert.equal(poseOf(0), "supine");
  assert.equal(poseOf(Math.PI), "prone");
});

test("every region anchor picks its own region when tapped from a camera above it", () => {
  for (const region of REGIONS) {
    const turn = region === "back" ? Math.PI : 0;
    const p = bodyTransform(turn).toWorld(REGION_ANCHORS[region]);
    const orbit: Orbit = { yaw: -1.25, pitch: 1.2, dist: 2.2, centre: p };
    const ray = rayThrough(orbit, 45, 1.6, 0, 0);
    assert.equal(pickRegion(ray, turn)?.region, region, region);
  }
});

// ------------------------------------------------------------------ the camera

test("the orbit eye sits at dist from the centre and the centre projects to the middle", () => {
  const o: Orbit = { yaw: 0.7, pitch: 0.5, dist: 3, centre: [0.1, 1, -0.2] };
  near(v3.len(v3.sub(eyeOf(o), o.centre)), 3);
  const q = project(o, 45, 1.5, o.centre)!;
  near(q[0], 0);
  near(q[1], 0);
});

test("rayThrough and project are inverses across the screen", () => {
  const o: Orbit = { yaw: -1.25, pitch: 0.7, dist: 2.45, centre: [-0.1, 0.98, 0] };
  for (const [nx, ny] of [[0.5, -0.3], [-0.9, 0.8], [0, 0]] as const) {
    const r = rayThrough(o, 50, 0.47, nx, ny);
    const q = project(o, 50, 0.47, v3.add(r.origin, v3.mul(r.dir, 2)))!;
    near(q[0], nx);
    near(q[1], ny);
  }
});

test("clampOrbit keeps the eye above the table and within zoom limits", () => {
  const c = clampOrbit({ yaw: 0, pitch: -1, dist: 99, centre: [-0.1, 0.98, 0] });
  assert.equal(c.pitch, LIMITS.minPitch);
  assert.equal(c.dist, LIMITS.maxDist);
  const low = clampOrbit({ yaw: 0, pitch: -1, dist: 0, centre: [-0.1, 0.98, 0] });
  assert.ok(eyeOf(low)[1] > TABLE_TOP, "eye stays over the table top");
});

// ------------------------------------------------------------------ pointers and DPR

test("the pixel ratio is capped and the pointer scale is drawable / CSS, not devicePixelRatio", () => {
  assert.equal(effectiveDpr(3, 2), 2);
  assert.equal(effectiveDpr(1, 2), 1);
  const [dw, dh] = drawableSize(400, 860, 3, 2);
  assert.deepEqual([dw, dh], [800, 1720]);
  assert.deepEqual(pointerScale(dw, dh, 400, 860), [2, 2]);
});

test("a tap maps to the same screen point at DPR 1, 2 and 3 (cap 2)", () => {
  const cssW = 400, cssH = 860, tap = [123, 456] as const;
  const want = cssToNdc(tap[0], tap[1], cssW, cssH);
  for (const dpr of [1, 2, 3]) {
    const [dw, dh] = drawableSize(cssW, cssH, dpr, 2);
    const [px, py] = cssToDrawable(tap[0], tap[1], dw, dh, cssW, cssH);
    const got = drawableToNdc(px, py, dw, dh);
    near(got[0], want[0]);
    near(got[1], want[1]);
    // the trap: scaling by devicePixelRatio (3) instead of the drawable ratio (2) lands elsewhere
    if (dpr === 3) {
      const wrong = drawableToNdc(tap[0] * dpr, tap[1] * dpr, dw, dh);
      assert.ok(Math.abs(wrong[0] - want[0]) > 0.1);
    }
  }
  const back = ndcToCss(want[0], want[1], cssW, cssH);
  near(back[0], tap[0]);
  near(back[1], tap[1]);
});

// ------------------------------------------------------------------ meshes

function windingAgreesWithNormals(m: MeshBuilder): boolean {
  for (let i = 0; i < m.indices.length; i += 3) {
    const P = (k: number): Vec3 => [m.positions[k * 3]!, m.positions[k * 3 + 1]!, m.positions[k * 3 + 2]!];
    const [a, b, c] = [m.indices[i]!, m.indices[i + 1]!, m.indices[i + 2]!];
    const face = v3.cross(v3.sub(P(b), P(a)), v3.sub(P(c), P(a)));
    if (v3.len(face) < 1e-10) continue; // a pole's sliver
    const n: Vec3 = [m.normals[a * 3]!, m.normals[a * 3 + 1]!, m.normals[a * 3 + 2]!];
    if (v3.dot(face, n) < 0) return false;
  }
  return true;
}

test("every exam-room mesh has non-zero normals and outward winding", () => {
  const meshes = { room: buildRoom(), furniture: buildFurniture(), lamp: buildLampFace(), up: buildBody(0, "chest"), down: buildBody(Math.PI, null), mid: buildBody(1.1, "back") };
  for (const [name, m] of Object.entries(meshes)) {
    assert.ok(m.count > 0, `${name} is empty`);
    assert.deepEqual(m.badNormals(), [], `${name} has zero normals`);
    assert.ok(windingAgreesWithNormals(m), `${name} winding disagrees with its normals`);
    assert.ok(m.indices.every((i) => i < m.count), `${name} index out of range`);
  }
});

test("a polygon with no area is skipped rather than given a zero normal", () => {
  const m = new MeshBuilder();
  m.poly([[0, 0, 0], [1, 0, 0], [2, 0, 0]], [1, 1, 1]);
  assert.equal(m.count, 0);
});

test("highlighting a region recolours only that region's vertices", () => {
  const plain = buildBody(0, null), lit = buildBody(0, "abdomen");
  let changed = 0;
  for (let i = 0; i < plain.colors.length; i++) if (plain.colors[i] !== lit.colors[i]) changed++;
  assert.ok(changed > 0 && changed < plain.colors.length / 4);
});

// ------------------------------------------------------------------ events

test("RegionEvents delivers to every listener until unsubscribed and remembers the last", () => {
  const ev = new RegionEvents();
  const got: RegionEvent[] = [];
  const off = ev.onRegion((e) => got.push(e));
  ev.emit({ region: "jaw", pose: "supine", via: "tap" });
  off();
  ev.emit({ region: "back", pose: "prone", via: "list" });
  assert.deepEqual(got.map((e) => e.region), ["jaw"]);
  assert.equal(ev.last?.region, "back");
  assert.ok(isRegion("left-leg"));
  assert.ok(!isRegion("face"));
});
