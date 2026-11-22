// The Strata engine as the exam room uses it: typings for the web kit's page scripts
// (engine/strata-loader.js and engine/strata-kit.js, classic scripts that define window globals)
// and thin wrappers over the host's calls (engine/host.cpp: tangle_mesh, tangle_lights, ...).
//
// The engine is Tangle's prebuilt "static room" host (Preponderous-Software/tangle, MIT), used
// unchanged: Strata 0.7.0 with web kit 1.1.

import type { MeshBuilder } from "./mesh.ts";

export interface EngineModule {
  HEAPF32: Float32Array;
  _malloc(bytes: number): number;
  _free(ptr: number): void;
  _tangle_configure(antialias: number, preserve: number): void;
  _tangle_view(ambient: number, fovDeg: number): void;
  _tangle_mesh(slot: number, p: number, n: number, c: number, uv: number, nv: number, idx: number, ni: number, tex: number, flags: number): number;
  _tangle_items(rows: number, n: number): void;
  _tangle_points(rows: number, n: number): void;
  _tangle_lights(rows: number, n: number): void;
}

export interface KitCamera {
  yaw: number;
  pitch: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
}

export interface Kit {
  cam: KitCamera;
  canvas: HTMLCanvasElement;
  dpr: number;
  dprCap: number;
  quality: number;
  frameMs?: number;
  start(): Kit;
  stats(): Record<string, number>;
}

export interface KitOptions {
  module: EngineModule;
  canvas: HTMLCanvasElement;
  camera: KitCamera;
  limits: { minPitch: number; maxPitch: number; minDist: number; maxDist: number };
  idleOrbit?: false;
  dprCap?: number;
  quality?: number;
  frame?: (t: number, now: number, dt: number) => void;
  pick?: (x: number, y: number, radius: number) => unknown;
  idOf?: (hit: unknown) => string;
  onTap?: (hit: unknown, clientX: number, clientY: number) => void;
  onKey?: (e: KeyboardEvent) => boolean;
  onSlow?: (info: { frameMs: number }) => void;
  onFatal?: (code: string, message: string) => void;
}

export interface LoaderOptions {
  script: string;
  factory: string;
  wasm: string;
  title?: string;
  fallback?: { href: string; text: string };
}

declare global {
  interface Window {
    StrataLoader?: {
      load(o: LoaderOptions): Promise<EngineModule>;
      done(): void;
      hasWebGL2(): boolean;
      readonly state: string;
    };
    StrataKit?: { version: string; create(o: KitOptions): Kit };
  }
}

export const MESH_UNLIT = 1;
export const BACKGROUND = 0x10000; // the host draws these meshes after the others

export class Engine {
  readonly mod: EngineModule;
  constructor(mod: EngineModule) {
    this.mod = mod;
  }

  #put(typed: Float32Array | Uint32Array): number {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const ptr = this.mod._malloc(Math.max(bytes.length, 4));
    new Uint8Array(this.mod.HEAPF32.buffer).set(bytes, ptr); // the heap may have grown: re-read it
    return ptr;
  }

  // Replaces the mesh in a slot. Returns false (and says so loudly) when Strata refused it.
  mesh(slot: number, mb: MeshBuilder, flags = 0): boolean {
    const bad = mb.badNormals();
    if (bad.length) console.error(`exam3d: mesh slot ${slot} has ${bad.length} zero-length normals; Strata will refuse it`);
    const p = this.#put(new Float32Array(mb.positions)), n = this.#put(new Float32Array(mb.normals));
    const c = this.#put(new Float32Array(mb.colors)), i = this.#put(new Uint32Array(mb.indices));
    try {
      const refused = this.mod._tangle_mesh(slot, p, n, c, 0, mb.count, i, mb.indices.length, -1, flags);
      if (refused && mb.count) console.error(`exam3d: the engine refused mesh slot ${slot}`);
      return !refused;
    } finally {
      for (const x of [p, n, c, i]) this.mod._free(x);
    }
  }

  #rows(fn: (ptr: number, n: number) => void, list: number[][]): void {
    const flat = new Float32Array(list.flat());
    const ptr = this.#put(flat.length ? flat : new Float32Array(1));
    try {
      fn.call(this.mod, ptr, list.length);
    } finally {
      this.mod._free(ptr);
    }
  }

  lights(rows: number[][]): void {
    this.#rows(this.mod._tangle_lights, rows);
  }

  // Glow points: rows of x, y, z, size in pixels, world diameter, r, g, b, a.
  points(rows: number[][]): void {
    this.#rows(this.mod._tangle_points, rows);
  }

  view(ambient: number, fovDeg: number): void {
    this.mod._tangle_view(ambient, fovDeg);
  }
}
