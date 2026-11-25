// Stick and look maths: dead zones, rescaling, run at the rim, and one look rule for every input.
import { test } from "node:test";
import assert from "node:assert/strict";
import { STICK_RADIUS as R, clampPitch, deadzone, knob, lookDelta, stick, PITCH_LIMIT } from "../src/adapters/fp/ui/stick.ts";

test("a resting thumb inside the dead zone does nothing", () => {
  assert.deepEqual(stick(0, 0), { forward: 0, right: 0, run: false });
  assert.deepEqual(stick(R * 0.1, -R * 0.05), { forward: 0, right: 0, run: false });
});

test("up on the screen walks forward, right strafes right", () => {
  const up = stick(0, -R * 0.6);
  assert.ok(up.forward > 0 && up.right === 0 && !up.run);
  const right = stick(R * 0.6, 0);
  assert.ok(right.right > 0 && right.forward === 0);
  assert.ok(stick(0, R * 0.6).forward < 0);
});

test("output never exceeds 1, starts near 0 past the dead zone, and runs at the rim", () => {
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    for (const m of [0.13, 0.5, 1, 2, 10]) {
      const s = stick(Math.cos(a) * R * m, Math.sin(a) * R * m);
      assert.ok(Math.hypot(s.forward, s.right) <= 1 + 1e-9);
    }
  }
  assert.ok(Math.hypot(stick(0, -R * 0.13).forward) < 0.02);
  assert.equal(stick(0, -R).run, true);
  assert.equal(stick(0, -R * 0.8).run, false);
});

test("bad input is ignored", () => {
  assert.deepEqual(stick(NaN, 3), { forward: 0, right: 0, run: false });
  assert.deepEqual(stick(3, 3, 0), { forward: 0, right: 0, run: false });
});

test("the knob stays on the rim when the thumb goes past it", () => {
  const [x, y] = knob(300, 400);
  assert.ok(Math.abs(Math.hypot(x, y) - R) < 1e-9);
  assert.deepEqual(knob(10, 5), [10, 5]);
});

test("gamepad dead zone is radial and rescaled", () => {
  assert.deepEqual(deadzone(0.1, 0.1), [0, 0]);
  assert.deepEqual(deadzone(0, 0), [0, 0]);
  const [x] = deadzone(1, 0);
  assert.ok(Math.abs(x - 1) < 1e-9);
  const [hx] = deadzone(0.19, 0);
  assert.ok(hx > 0 && hx < 0.02);
});

test("look: right turns right (yaw down), down looks down, invert flips only pitch, sensitivity scales", () => {
  const n = lookDelta(0.1, 0.1, { sensitivity: 1, invertY: false });
  assert.ok(n.yaw < 0 && n.pitch < 0);
  const inv = lookDelta(0.1, 0.1, { sensitivity: 1, invertY: true });
  assert.equal(inv.yaw, n.yaw);
  assert.equal(inv.pitch, -n.pitch);
  const fast = lookDelta(0.1, 0, { sensitivity: 2, invertY: false });
  assert.ok(Math.abs(fast.yaw - 2 * n.yaw) < 1e-12);
  assert.deepEqual(lookDelta(0, 0, { sensitivity: 1, invertY: true }), { yaw: 0, pitch: 0 });
});

test("pitch is clamped short of straight up or down", () => {
  assert.equal(clampPitch(9), PITCH_LIMIT);
  assert.equal(clampPitch(-9), -PITCH_LIMIT);
  assert.equal(clampPitch(0.3), 0.3);
});
