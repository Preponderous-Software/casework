import { test } from "node:test";
import assert from "node:assert/strict";
import { axes, deadzone, lookDir, resolve, RADIUS, step, stick, stride, strideStart, WALK } from "../src/casework/world/walk.ts";
import type { Box } from "../src/casework/world/types.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("yaw 0 walks along −Z, and right is +X", () => {
  const a = axes(0);
  near(a.fx, 0);
  near(a.fz, -1);
  near(a.rx, 1);
  near(a.rz, 0);
  const d = lookDir(0, 0);
  near(d[2], -1);
  assert.ok(lookDir(0, 0.5)[1] > 0, "positive pitch looks up");
});

test("walking forward for a second reaches close to walking speed", () => {
  let me = { x: 0, z: 0, yaw: 0, vx: 0, vz: 0 };
  for (let i = 0; i < 60; i++) me = step(me, { forward: 1 }, 1 / 60, []);
  assert.ok(me.z < -1.5 && me.z > -WALK, `moved ${me.z}`);
  near(me.x, 0);
});

test("walls stop you and you slide along them", () => {
  const wall: Box = [-5, -1.1, 5, -1];
  let me = { x: 0, z: 0, yaw: 0.3, vx: 0, vz: 0 };
  for (let i = 0; i < 180; i++) me = step(me, { forward: 1 }, 1 / 60, [wall]);
  assert.ok(me.z >= -1 + RADIUS - 1e-6, `stayed out of the wall (${me.z})`);
  assert.ok(me.x < -0.5, "slid sideways along the wall");
});

test("resolve pushes a point out of a box", () => {
  const p = resolve(0, 0, [[-1, -1, 1, 1]]);
  assert.ok(Math.abs(p.x) >= 1 + RADIUS - 1e-9 || Math.abs(p.z) >= 1 + RADIUS - 1e-9);
});

test("stick and dead zones", () => {
  assert.deepEqual(stick(2, 2, 56), { forward: 0, right: 0, run: false });
  const s = stick(0, -56, 56);
  near(s.forward, 1);
  assert.equal(s.run, true);
  assert.deepEqual(deadzone(0.1, 0.1), [0, 0]);
});

test("stride takes a step per stride length", () => {
  let st = strideStart();
  let steps = 0;
  for (let i = 0; i < 100; i++) {
    const r = stride(st, WALK / 60, WALK, false, 1 / 60);
    st = r.st;
    if (r.step) steps++;
  }
  assert.ok(steps >= 4 && steps <= 6, `${steps} steps over ${(WALK * 100) / 60} m`);
});
