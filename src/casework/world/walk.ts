// Walking maths with no DOM and no engine, ported from Frozen Star's src/game/walk.js (same owner,
// MIT). Velocity eases toward what the input asks for, walls take away only the part of the
// velocity that goes into them, and nothing here ever turns the view.
//
// Metres, Y up. yaw = 0 looks along −Z; positive pitch looks up.
import type { Box } from "./types.ts";

export const EYE = 1.64;
export const RADIUS = 0.28;
export const WALK = 2.2;
export const RUN = 4.0; // m/s
export const PITCH_LIMIT = 1.45;
const ACCEL = 9, DAMP = 12, STOP = 0.02, SUBSTEP = 0.03;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export interface Walker {
  x: number;
  z: number;
  yaw: number;
  vx?: number;
  vz?: number;
  speed?: number;
}

export interface WalkInput {
  forward?: number;
  right?: number;
  run?: boolean;
}

/** Push (x, z) out of every solid box [x0, z0, x1, z1]. */
export function resolve(x: number, z: number, boxes: readonly Box[], r = RADIUS): { x: number; z: number } {
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const [x0, z0, x1, z1] of boxes) {
      if (x < x0 - r || x > x1 + r || z < z0 - r || z > z1 + r) continue;
      const cx = clamp(x, x0, x1), cz = clamp(z, z0, z1);
      const ex = x - cx, ez = z - cz, d = Math.hypot(ex, ez);
      if (d >= r) continue;
      if (d > 1e-6) {
        x = cx + (ex / d) * r;
        z = cz + (ez / d) * r;
      } else {
        const pl = x - x0, pr = x1 - x, pb = z - z0, pf = z1 - z, m = Math.min(pl, pr, pb, pf);
        if (m === pl) x = x0 - r;
        else if (m === pr) x = x1 + r;
        else if (m === pb) z = z0 - r;
        else z = z1 + r;
      }
      moved = true;
    }
    if (!moved) break;
  }
  return { x, z };
}

/** Forward and right unit vectors on the floor for a yaw. */
export function axes(yaw: number): { fx: number; fz: number; rx: number; rz: number } {
  return { fx: -Math.sin(yaw), fz: -Math.cos(yaw), rx: Math.cos(yaw), rz: -Math.sin(yaw) };
}

/** The unit look direction for a yaw and pitch. */
export function lookDir(yaw: number, pitch: number): [number, number, number] {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

/** The walker after dt seconds of input. */
export function step<W extends Walker>(me: W, input: WalkInput, dt: number, boxes: readonly Box[]): W & { vx: number; vz: number; speed: number } {
  dt = clamp(dt, 0, 0.25);
  let f = input.forward || 0, s = input.right || 0;
  const mag = Math.hypot(f, s);
  if (mag > 1) {
    f /= mag;
    s /= mag;
  }
  let { x, z } = me;
  let vx = me.vx || 0, vz = me.vz || 0;
  const { fx, fz, rx, rz } = axes(me.yaw);
  const speed = input.run ? RUN : WALK, on = mag > 0.02;
  const wx = on ? (fx * f + rx * s) * speed : 0, wz = on ? (fz * f + rz * s) * speed : 0;
  for (let left = dt; left > 1e-6; left -= SUBSTEP) {
    const h = Math.min(SUBSTEP, left), k = 1 - Math.exp(-(on ? ACCEL : DAMP) * h);
    vx += (wx - vx) * k;
    vz += (wz - vz) * k;
    if (!on && Math.hypot(vx, vz) < STOP) {
      vx = 0;
      vz = 0;
      break;
    }
    const ix = x + vx * h, iz = z + vz * h, p = resolve(ix, iz, boxes);
    const px = p.x - ix, pz = p.z - iz, pl = Math.hypot(px, pz);
    if (pl > 1e-9) {
      const nx = px / pl, nz = pz / pl, vn = vx * nx + vz * nz;
      if (vn < 0) {
        vx -= vn * nx;
        vz -= vn * nz;
      }
    }
    x = p.x;
    z = p.z;
  }
  return { ...me, x, z, vx, vz, speed: Math.hypot(vx, vz) };
}

/** Turn the view by a look delta (radians); pitch is clamped. Positive dy looks down (mouse). */
export function look(yaw: number, pitch: number, dx: number, dy: number, invertY = false): { yaw: number; pitch: number } {
  return { yaw: yaw - dx, pitch: clamp(pitch - (invertY ? -dy : dy), -PITCH_LIMIT, PITCH_LIMIT) };
}

/** Joystick offset (CSS px) → input. Dead zone in the middle, run near the rim. */
export function stick(dx: number, dy: number, radius: number): { forward: number; right: number; run: boolean } {
  const m = Math.hypot(dx, dy) / radius;
  if (m < 0.12) return { forward: 0, right: 0, run: false };
  const k = Math.min(1, (m - 0.12) / 0.88) / m;
  return { forward: (-dy / radius) * k, right: (dx / radius) * k, run: m > 0.95 };
}

/** Gamepad axis pair with a radial dead zone, rescaled. */
export function deadzone(x: number, y: number, dead = 0.18): [number, number] {
  const m = Math.hypot(x, y);
  if (m <= dead) return [0, 0];
  const k = Math.min(1, (m - dead) / (1 - dead)) / m;
  return [x * k, y * k];
}

// ---- stride: footsteps and head bob from the same phase ----
export const STRIDE = { walk: 0.75, run: 0.95 }; // metres per step
const BOB = { walk: 0.022, run: 0.034 }; // eye rise mid-stride, metres

export interface Stride {
  phase: number;
  amp: number;
  moving: boolean;
  sinceStep: number;
}

export const strideStart = (): Stride => ({ phase: 0, amp: 0, moving: false, sinceStep: 0 });

/** Advance the stride by `dist` metres at `speed` m/s over dt seconds. `step` is a footfall's
 * loudness (0 for none); y (up) and x (right) are the eye's offset in metres. */
export function stride(st: Stride, dist: number, speed: number, run: boolean, dt: number): { st: Stride; step: number; settle: boolean; y: number; x: number } {
  const len = run ? STRIDE.run : STRIDE.walk;
  let { phase, amp, moving, sinceStep } = st;
  let stepped = 0, settle = false;
  sinceStep += dist;
  const going = speed > 0.35;
  if (going && !moving) phase = Math.floor(phase / Math.PI) * Math.PI + 0.55 * Math.PI;
  const before = Math.floor(phase / Math.PI);
  phase += (dist / len) * Math.PI;
  if (Math.floor(phase / Math.PI) > before) {
    stepped = run ? 1.2 : Math.min(1, 0.45 + 0.55 * (speed / WALK));
    sinceStep = 0;
  }
  if (moving && speed < 0.15) {
    settle = sinceStep > 0.25 * len;
    moving = false;
  } else if (going) moving = true;
  const want = Math.min(1, speed / WALK) * (run ? BOB.run : BOB.walk);
  amp += (want - amp) * (1 - Math.exp(-8 * Math.max(0, dt)));
  const y = amp * (Math.abs(Math.sin(phase)) - 0.35);
  const x = amp * 0.45 * Math.sin(phase);
  return { st: { phase, amp, moving, sinceStep }, step: stepped, settle, y, x };
}
