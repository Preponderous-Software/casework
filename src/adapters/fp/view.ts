// The first-person renderer: Tangle's Strata "static room" host (the same engine as the exam
// room), fed a Location's meshes and moved every frame from the game's eye, yaw and pitch.
//
// The host is first person already: the eye sits at the kit camera's target and looks along
// -(cos p cos y, sin p, cos p sin y). Our yaw = 0 looks along −Z with positive pitch up, so the
// host's yaw is π/2 − yaw and its pitch is −pitch.
import type { Region } from "../exam3d/events.ts";
import { BACKGROUND, Engine, MESH_UNLIT, type Kit } from "../exam3d/engine.ts";
import { MeshBuilder } from "../exam3d/mesh.ts";
import type { Location, Vec3 } from "../../casework/world/types.ts";
import { append, examBodyMesh, figureMesh, lightPanels, lightRows, propMesh, shellMesh } from "./props.ts";

const SLOT = { shell: 1, props: 2, glow: 3, panels: 4, figures: 5, body: 10 } as const;

export interface View {
  readonly kit: Kit;
  setLocation(loc: Location, figures: { at: Vec3; yaw: number }[]): void;
  /** Redraw the standing figures (e.g. one turned to face you). */
  setFigures(figures: { at: Vec3; yaw: number }[]): void;
  setBody(b: { at: Vec3; yaw: number; turn: number; highlight: Region | null } | null): void;
  /** Place the eye. */
  camera(eye: Vec3, yaw: number, pitch: number): void;
  setFov(deg: number): void;
  /** Stop drawing while a full panel covers the view (saves the battery), and start again. */
  pause(on: boolean): void;
  readonly fov: number;
  marker(p: Vec3 | null): void;
}

export interface ViewOptions {
  canvas: HTMLCanvasElement;
  engineBase: string;
  frame(dt: number, now: number): void;
  onFatal(message: string): void;
}

/** Start the engine, or say why it can't (the caller shows a fallback). */
export async function createView(o: ViewOptions): Promise<View | string> {
  const L = window.StrataLoader, K = window.StrataKit;
  if (!L || !K) return "The 3D engine's scripts did not load.";
  if (!L.hasWebGL2()) return "This browser has no WebGL 2, so the first-person view cannot start.";
  let mod;
  try {
    mod = await L.load({ script: `${o.engineBase}/tangle-engine.js`, factory: "createTangleEngine", wasm: `${o.engineBase}/tangle-engine.wasm`, title: "the office" });
  } catch (e) {
    return `The 3D engine could not start (${(e as { code?: string }).code ?? String(e)}).`;
  }
  const software = (() => {
    try {
      const g = document.createElement("canvas").getContext("webgl2");
      const x = g?.getExtension("WEBGL_debug_renderer_info");
      return /swiftshader|llvmpipe|software/i.test(String(g?.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : (g?.RENDERER ?? 0)) ?? ""));
    } catch {
      return false;
    }
  })();
  mod._tangle_configure(software ? 0 : 1, 0);
  const engine = new Engine(mod);
  let fov = 70;
  const cam = { yaw: Math.PI / 2, pitch: 0, dist: 1, tx: 0, ty: 1.6, tz: 0 };
  let kit: Kit;
  try {
    kit = K.create({
      module: mod,
      canvas: o.canvas,
      camera: cam,
      limits: { minPitch: -1.55, maxPitch: 1.55, minDist: 0.5, maxDist: 2 },
      idleOrbit: false,
      dprCap: software ? 1 : 2,
      quality: software ? 0 : undefined,
      frame: (_t, now, dt) => o.frame(dt, now),
      onFatal: (_c, msg) => o.onFatal(msg),
    });
  } catch (e) {
    return `The 3D view could not start (${(e as { code?: string }).code ?? String(e)}).`;
  }
  engine.view(0.42, fov);
  const view: View = {
    kit,
    setLocation(loc, figures) {
      const props = new MeshBuilder(), glow = new MeshBuilder();
      for (const p of loc.props) propMesh(p, props, glow);
      engine.mesh(SLOT.shell, shellMesh(loc), BACKGROUND);
      engine.mesh(SLOT.props, props);
      engine.mesh(SLOT.glow, glow, MESH_UNLIT);
      engine.mesh(SLOT.panels, lightPanels(loc), MESH_UNLIT);
      view.setFigures(figures);
      engine.lights(lightRows(loc));
      engine.points([]);
    },
    setFigures(figures) {
      const figs = new MeshBuilder();
      for (const f of figures) append(figs, figureMesh(f.at, f.yaw));
      engine.mesh(SLOT.figures, figs);
    },
    setBody(b) {
      engine.mesh(SLOT.body, b ? examBodyMesh(b.at, b.yaw, b.turn, b.highlight) : new MeshBuilder());
    },
    camera(eye, yaw, pitch) {
      cam.tx = eye[0];
      cam.ty = eye[1];
      cam.tz = eye[2];
      cam.yaw = Math.PI / 2 - yaw;
      cam.pitch = -pitch;
      cam.dist = 1;
    },
    setFov(deg) {
      if (Math.abs(deg - fov) < 0.05) return;
      fov = deg;
      engine.view(0.42, fov);
    },
    pause(on) {
      if (on) (kit as Kit & { running: boolean }).running = false;
      else kit.start();
    },
    get fov() {
      return fov;
    },
    marker(p) {
      engine.points(p ? [[p[0], p[1], p[2], 18, 0, 0.36, 0.86, 0.92, 0.95]] : []);
    },
  };
  kit.start();
  L.done();
  for (const l of Array.from(document.querySelectorAll<HTMLElement>(".sk-loader"))) if (L.state === "done") l.hidden = true;
  return view;
}
