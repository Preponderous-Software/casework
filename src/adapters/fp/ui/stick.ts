// Stick and look maths shared by touch, gamepad and mouse (pure: no DOM), so every input turns the
// view by the same rules. Ported from Frozen Star's walk.js / controls.js (MIT, same owner).

/** Radians of view turn per CSS pixel of mouse movement, at sensitivity 1. */
export const LOOK_MOUSE = 0.0022;
/** Radians per CSS pixel of finger drag on the right half of the screen, at sensitivity 1. */
export const LOOK_TOUCH = 0.0055;
/** Radians per second at full right-stick deflection, at sensitivity 1. */
export const LOOK_PAD = 2.4;
/** Pixels from the stick's centre to its rim. */
export const STICK_RADIUS = 56;
/** Share of the stick radius that does nothing (so a resting thumb doesn't creep). */
export const STICK_DEAD = 0.12;

export interface StickOut { forward: number; right: number; run: boolean }

/** Joystick offset in CSS px (screen y grows down) → walk vector in −1..1. Dead zone in the middle,
 * rescaled so movement starts smoothly at its edge, and run when pushed to the rim. */
export function stick(dx: number, dy: number, radius = STICK_RADIUS): StickOut {
  if (!(radius > 0) || !Number.isFinite(dx) || !Number.isFinite(dy)) return { forward: 0, right: 0, run: false };
  const m = Math.hypot(dx, dy) / radius;
  if (m < STICK_DEAD) return { forward: 0, right: 0, run: false };
  const k = Math.min(1, (m - STICK_DEAD) / (1 - STICK_DEAD)) / m;
  return { forward: clean((-dy / radius) * k), right: clean((dx / radius) * k), run: m > 0.95 };
}

/** Where to draw the stick's knob: the offset clamped to the rim. */
export function knob(dx: number, dy: number, radius = STICK_RADIUS): [number, number] {
  const m = Math.hypot(dx, dy);
  const k = m > radius ? radius / m : 1;
  return [dx * k, dy * k];
}

/** A gamepad axis pair with a radial dead zone, rescaled to start at 0 just past it. */
export function deadzone(x: number, y: number, dead = 0.18): [number, number] {
  const m = Math.hypot(x, y);
  if (!(m > dead)) return [0, 0];
  const k = Math.min(1, (m - dead) / (1 - dead)) / m;
  return [clean(x * k), clean(y * k)];
}

export interface LookSettings { sensitivity: number; invertY: boolean }

/** Turn raw look input (radians at sensitivity 1, +x = drag/move right, +y = drag/move down) into a
 * change of yaw and pitch. Yaw grows to the left and pitch grows looking up (Frozen Star
 * convention), so moving right turns right and moving down looks down unless Y is inverted. */
export function lookDelta(dx: number, dy: number, s: LookSettings): { yaw: number; pitch: number } {
  return { yaw: clean(-dx * s.sensitivity), pitch: clean(-dy * s.sensitivity * (s.invertY ? -1 : 1)) };
}

/** Pitch limit, so the view never flips over the top. */
export const PITCH_LIMIT = 1.45;
export const clampPitch = (p: number): number => Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p));

// −0 and float dust become plain numbers so tests and saves stay tidy.
function clean(v: number): number {
  return Math.abs(v) < 1e-12 ? 0 : v;
}
