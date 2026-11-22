// Mesh building in plain arrays, in the shape the engine's tangle_mesh call takes:
// {positions, normals, colors, uvs, indices}. Pure: no DOM, no engine.
//
// Adapted from Tangle's src/geom.js (Preponderous-Software/tangle, MIT). Strata refuses a WHOLE
// mesh if any vertex normal has zero length, and says so only in a console warning, so every
// normal here is either analytic (curved shapes) or Newell's (flat polygons), and polygons with no
// area are skipped.

import { v3, type Shape, type Vec3 } from "./geometry.ts";

export type Rgb = readonly [number, number, number];

export class MeshBuilder {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];
  uvs: number[] = [];
  indices: number[] = [];

  get count(): number {
    return this.positions.length / 3;
  }

  vert(p: Vec3, n: Vec3, c: Rgb): number {
    this.positions.push(p[0], p[1], p[2]);
    this.normals.push(n[0], n[1], n[2]);
    this.colors.push(c[0], c[1], c[2]);
    return this.count - 1;
  }

  // A flat convex polygon, counter-clockwise seen from the front, fan-triangulated.
  poly(pts: readonly Vec3[], color: Rgb): void {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
      x += (a[1] - b[1]) * (a[2] + b[2]);
      y += (a[2] - b[2]) * (a[0] + b[0]);
      z += (a[0] - b[0]) * (a[1] + b[1]);
    }
    if (Math.hypot(x, y, z) < 1e-12) return; // no area: Strata would refuse the mesh
    const n = v3.norm([x, y, z]);
    const base = this.count;
    for (const p of pts) this.vert(p, n, color);
    for (let i = 1; i + 1 < pts.length; i++) this.indices.push(base, base + i, base + i + 1);
  }

  box(lo: Vec3, hi: Vec3, color: Rgb): void {
    const [x0, y0, z0] = lo, [x1, y1, z1] = hi;
    this.poly([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], color);
    this.poly([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], color);
    this.poly([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], color);
    this.poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], color);
    this.poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], color);
    this.poly([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], color);
  }

  // A sphere or capsule (optionally scaled per axis) with smooth analytic normals. colorAt picks
  // each vertex's colour from its final position, so one mesh can show several regions.
  rounded(s: Extract<Shape, { kind: "sphere" | "capsule" }>, colorAt: (p: Vec3) => Rgb, seg = 20, rings = 8): void {
    const a = s.kind === "sphere" ? s.c : s.a, b = s.kind === "sphere" ? s.c : s.b, r = s.r;
    const k = s.scale ?? [1, 1, 1];
    const axisRaw = v3.sub(b, a);
    const u = v3.len(axisRaw) > 1e-9 ? v3.norm(axisRaw) : ([1, 0, 0] as Vec3);
    const helper: Vec3 = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const v = v3.norm(v3.cross(u, helper)), w = v3.cross(u, v);
    // Latitudes from the a-pole to the b-pole; the equator appears once per cap, so the middle is
    // a straight cylinder.
    const lats: { phi: number; c: Vec3 }[] = [];
    for (let i = 0; i <= rings; i++) lats.push({ phi: -Math.PI / 2 + (Math.PI / 2) * (i / rings), c: a });
    for (let i = 0; i <= rings; i++) lats.push({ phi: (Math.PI / 2) * (i / rings), c: b });
    const base = this.count;
    for (const { phi, c } of lats) {
      for (let j = 0; j <= seg; j++) {
        const th = (2 * Math.PI * j) / seg;
        const dir = v3.add(v3.mul(u, Math.sin(phi)), v3.mul(v3.add(v3.mul(v, Math.cos(th)), v3.mul(w, Math.sin(th))), Math.cos(phi)));
        const p = v3.mulv(v3.add(c, v3.mul(dir, r)), k);
        const n = v3.norm(v3.divv(dir, k)); // the gradient of the scaled surface
        this.vert(p, n, colorAt(p));
      }
    }
    const row = seg + 1;
    for (let i = 0; i + 1 < lats.length; i++) {
      for (let j = 0; j < seg; j++) {
        const p0 = base + i * row + j, p1 = p0 + 1, p2 = p0 + row, p3 = p2 + 1;
        this.indices.push(p0, p1, p2, p1, p3, p2); // counter-clockwise seen from outside
      }
    }
  }

  // Maps every vertex (and normal) through a rigid transform, e.g. the body's turn on the table.
  transform(point: (p: Vec3) => Vec3, dir: (d: Vec3) => Vec3): void {
    for (let i = 0; i < this.positions.length; i += 3) {
      const p = point([this.positions[i]!, this.positions[i + 1]!, this.positions[i + 2]!]);
      const n = dir([this.normals[i]!, this.normals[i + 1]!, this.normals[i + 2]!]);
      for (let k = 0; k < 3; k++) {
        this.positions[i + k] = p[k]!;
        this.normals[i + k] = n[k]!;
      }
    }
  }

  // The vertices whose normal has zero (or non-finite) length: these make Strata refuse the mesh.
  badNormals(): number[] {
    const bad: number[] = [];
    for (let i = 0; i < this.normals.length; i += 3) {
      const l = Math.hypot(this.normals[i]!, this.normals[i + 1]!, this.normals[i + 2]!);
      if (!(l > 1e-6) || !Number.isFinite(l)) bad.push(i / 3);
    }
    return bad;
  }
}
