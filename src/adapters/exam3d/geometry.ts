// Vector maths and ray hit tests for the exam room. Pure: no DOM, no engine.
//
// Shapes are simple on purpose (spheres, capsules, boxes), each with an optional per-axis scale so
// a capsule can be wider than it is thick (a torso). A scaled shape is tested by moving the ray into
// the shape's unscaled space: dividing origin and direction by the scale keeps the ray parameter t,
// so the nearest hit is still the nearest hit.

export type Vec3 = readonly [number, number, number];

export const v3 = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  mulv: (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]],
  divv: (a: Vec3, b: Vec3): Vec3 => [a[0] / b[0], a[1] / b[1], a[2] / b[2]],
  dot: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a: Vec3): number => Math.hypot(a[0], a[1], a[2]),
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  // Rotation about the x axis by angle a (right-handed: y turns towards z).
  rotX: (p: Vec3, a: number): Vec3 => {
    const c = Math.cos(a), s = Math.sin(a);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  },
};

export interface Ray {
  origin: Vec3;
  dir: Vec3; // need not be unit length; t is in units of dir
}

export type Shape =
  | { kind: "sphere"; c: Vec3; r: number; scale?: Vec3 }
  | { kind: "capsule"; a: Vec3; b: Vec3; r: number; scale?: Vec3 }
  | { kind: "box"; lo: Vec3; hi: Vec3 };

const EPS = 1e-9;

// Smallest t >= 0 where the ray meets the sphere, or null.
export function raySphere(o: Vec3, d: Vec3, c: Vec3, r: number): number | null {
  const m = v3.sub(o, c);
  const a = v3.dot(d, d), b = v3.dot(m, d), cc = v3.dot(m, m) - r * r;
  if (a < EPS) return null;
  if (cc > 0 && b > 0) return null; // outside and pointing away
  const disc = b * b - a * cc;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  return t >= 0 ? t : 0; // inside: hits at once
}

// Smallest t >= 0 where the ray meets the capsule (segment a-b, radius r), or null.
export function rayCapsule(o: Vec3, d: Vec3, a: Vec3, b: Vec3, r: number): number | null {
  const ab = v3.sub(b, a), ao = v3.sub(o, a);
  const abab = v3.dot(ab, ab);
  if (abab < EPS) return raySphere(o, d, a, r);
  const abd = v3.dot(ab, d), abao = v3.dot(ab, ao);
  // The infinite cylinder, then the end caps.
  const A = abab * v3.dot(d, d) - abd * abd;
  const B = abab * v3.dot(ao, d) - abao * abd;
  const C = abab * v3.dot(ao, ao) - abao * abao - r * r * abab;
  let best: number | null = null;
  if (Math.abs(A) > EPS) {
    const disc = B * B - A * C;
    if (disc >= 0) {
      const t = (-B - Math.sqrt(disc)) / A;
      const y = abao + t * abd;
      if (t >= 0 && y > 0 && y < abab) best = t;
    }
  }
  for (const c of [a, b]) {
    const t = raySphere(o, d, c, r);
    if (t != null && (best == null || t < best)) best = t;
  }
  return best;
}

// Slab test: smallest t >= 0 where the ray meets the axis-aligned box, or null.
export function rayBox(o: Vec3, d: Vec3, lo: Vec3, hi: Vec3): number | null {
  let t0 = 0, t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    const oi = o[i]!, di = d[i]!, l = lo[i]!, h = hi[i]!;
    if (Math.abs(di) < EPS) {
      if (oi < l || oi > h) return null;
      continue;
    }
    let ta = (l - oi) / di, tb = (h - oi) / di;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

export function rayShape(ray: Ray, s: Shape): number | null {
  if (s.kind === "box") return rayBox(ray.origin, ray.dir, s.lo, s.hi);
  const k = s.scale ?? [1, 1, 1];
  const o = v3.divv(ray.origin, k), d = v3.divv(ray.dir, k);
  return s.kind === "sphere" ? raySphere(o, d, s.c, s.r) : rayCapsule(o, d, s.a, s.b, s.r);
}

export function at(ray: Ray, t: number): Vec3 {
  return v3.add(ray.origin, v3.mul(ray.dir, t));
}
