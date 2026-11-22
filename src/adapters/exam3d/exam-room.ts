// The exam room page (spike/exam-room.html): a Strata 3D view of the table and mannequin, orbit
// and zoom from the web kit, tap-to-region picking done here in TypeScript, and a list of region
// buttons that drives the same event API when the 3D view cannot start.
//
// Game code only needs createExamView(...).events.onRegion(cb).

import { anchorAt, pickRegion, poseOf, type Hit } from "./body.ts";
import { clampOrbit, eyeOf, fitFov, LIMITS, project, rayThrough, type Orbit } from "./camera.ts";
import { Engine, BACKGROUND, MESH_UNLIT, type Kit } from "./engine.ts";
import { REGION_LABELS, REGIONS, RegionEvents, type Pose, type Region, type RegionEvent } from "./events.ts";
import { cssToNdc, ndcToCss } from "./pointer.ts";
import { buildBody, buildFurniture, buildLampFace, buildRoom, lights } from "./scene.ts";

const SLOT = { room: 1, furniture: 2, lamp: 3, body: 10 } as const;
const TURN_SECONDS = 0.9;
const FLASH_MS = Number(new URLSearchParams(location.search).get("flashms")) || 900; // tools hold it longer
const CENTRE = [-0.1, 0.98, 0] as const;

export interface ExamView {
  events: RegionEvents;
  readonly mode: "3d" | "list" | "loading";
  readonly pose: Pose;
  turn(): void;
}

interface Dom {
  canvas: HTMLCanvasElement;
  last: HTMLElement;
  turn: HTMLButtonElement;
  regions: HTMLElement;
  fallback: HTMLElement;
  status: HTMLElement;
}

function describe(e: RegionEvent): string {
  return `{ region: "${e.region}", pose: "${e.pose}", via: "${e.via}" }`;
}

export function createExamView(dom: Dom): ExamView {
  const events = new RegionEvents();
  const log: RegionEvent[] = [];
  let mode: "3d" | "list" | "loading" = "loading";
  let turnNow = 0, turnTarget = 0, bodyDirty = true;
  let flash: { region: Region; until: number; point: Hit["point"] | null } | null = null;
  let tapPoint: Hit["point"] | null = null; // where the last tap landed, for the marker
  let engine: Engine | null = null, kit: Kit | null = null;
  let fov = 45, frames = 0, ms = 0;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pose = (): Pose => poseOf(turnTarget);
  // the roll as drawn: eased so it starts and stops softly
  const eased = () => Math.PI * (0.5 - 0.5 * Math.cos(turnNow));

  function orbit(): Orbit {
    if (!kit) return { yaw: 0, pitch: 0.7, dist: 2.5, centre: CENTRE };
    return clampOrbit({ yaw: kit.cam.yaw, pitch: kit.cam.pitch, dist: kit.cam.dist, centre: CENTRE });
  }
  const aspect = () => dom.canvas.clientWidth / Math.max(1, dom.canvas.clientHeight);

  events.onRegion((e) => {
    log.push(e);
    dom.last.textContent = describe(e);
    flash = { region: e.region, until: performance.now() + FLASH_MS, point: tapPoint };
    tapPoint = null;
    bodyDirty = true;
    for (const b of Array.from(dom.regions.querySelectorAll<HTMLButtonElement>("button"))) b.classList.toggle("lit", b.dataset.region === e.region);
  });

  // The region buttons: the 2D fallback's seed, and a plain list for screen readers in 3D.
  for (const r of REGIONS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = REGION_LABELS[r];
    b.dataset.region = r;
    b.addEventListener("click", () => {
      if (r === "back" && pose() === "supine" && mode === "3d") {
        dom.status.textContent = "The back faces the table: turn the body first.";
      }
      events.emit({ region: r, pose: pose(), via: "list" });
    });
    dom.regions.appendChild(b);
  }

  function setTurnLabel(): void {
    dom.turn.textContent = pose() === "supine" ? "Turn the body (face down)" : "Turn the body (face up)";
    dom.turn.setAttribute("aria-pressed", String(pose() === "prone"));
  }
  function turn(): void {
    turnTarget = turnTarget < Math.PI / 2 ? Math.PI : 0;
    if (reducedMotion || mode !== "3d") turnNow = turnTarget;
    bodyDirty = true;
    setTurnLabel();
    dom.status.textContent = pose() === "prone" ? "Face down: the back is up." : "Face up.";
  }
  dom.turn.addEventListener("click", turn);
  setTurnLabel();

  function showFallback(reason: string): void {
    mode = "list";
    for (const l of Array.from(document.querySelectorAll<HTMLElement>(".sk-loader"))) l.hidden = true;
    dom.canvas.hidden = true;
    dom.fallback.hidden = false;
    dom.fallback.querySelector(".why")!.textContent = reason;
    document.body.classList.add("list-mode");
  }

  function pick(x: number, y: number): Hit | null {
    const [nx, ny] = cssToNdc(x, y, dom.canvas.clientWidth, dom.canvas.clientHeight);
    return pickRegion(rayThrough(orbit(), fov, aspect(), nx, ny), eased());
  }

  function frame(_t: number, now: number, dt: number): void {
    if (!kit || !engine) return;
    frames++;
    ms += dt;
    if (turnNow !== turnTarget) {
      const step = (Math.PI / TURN_SECONDS) * dt;
      turnNow = Math.abs(turnTarget - turnNow) <= step ? turnTarget : turnNow + Math.sign(turnTarget - turnNow) * step;
      bodyDirty = true;
    }
    if (flash && now > flash.until) {
      flash = null;
      bodyDirty = true;
      engine.points([]);
      for (const b of Array.from(dom.regions.querySelectorAll("button.lit"))) b.classList.remove("lit");
    }
    if (bodyDirty) {
      engine.mesh(SLOT.body, buildBody(eased(), flash?.region ?? null));
      if (flash?.point) engine.points([[...flash.point, 22, 0, 0.36, 0.86, 0.92, 0.95]]);
      bodyDirty = false;
    }
    const f = fitFov(45, 36, aspect(), 72);
    if (Math.abs(f - fov) > 0.05) {
      fov = f;
      engine.view(0.5, fov);
    }
    // The host is first person: hand it the orbit's eye, keep the kit's yaw/pitch/dist as the orbit.
    const o = orbit();
    kit.cam.pitch = o.pitch;
    kit.cam.dist = o.dist;
    const eye = eyeOf(o);
    kit.cam.tx = eye[0];
    kit.cam.ty = eye[1];
    kit.cam.tz = eye[2];
  }

  // Where a region's anchor is on screen right now, in client pixels (for tools and tests).
  function anchorClient(region: Region): { x: number; y: number } | null {
    const q = project(orbit(), fov, aspect(), anchorAt(region, eased()));
    if (!q) return null;
    const [x, y] = ndcToCss(q[0], q[1], dom.canvas.clientWidth, dom.canvas.clientHeight);
    const r = dom.canvas.getBoundingClientRect();
    return { x: r.left + x, y: r.top + y };
  }

  async function boot(): Promise<void> {
    const q = new URLSearchParams(location.search);
    if (q.get("fallback") === "1") return showFallback("The 3D view is switched off (fallback=1).");
    const L = window.StrataLoader, K = window.StrataKit;
    if (!L || !K) return showFallback("The 3D engine's scripts did not load.");
    if (!L.hasWebGL2()) return showFallback("This browser has no WebGL 2, so the 3D exam room cannot start.");
    let mod;
    try {
      mod = await L.load({ script: "../engine/tangle-engine.js", factory: "createTangleEngine", wasm: "../engine/tangle-engine.wasm", title: "the exam room" });
    } catch (e) {
      return showFallback(`The 3D engine could not start (${(e as { code?: string }).code ?? String(e)}).`);
    }
    const renderer = (() => {
      try {
        const g = document.createElement("canvas").getContext("webgl2");
        const x = g?.getExtension("WEBGL_debug_renderer_info");
        return String(g?.getParameter(x ? x.UNMASKED_RENDERER_WEBGL : (g?.RENDERER ?? 0)) ?? "");
      } catch {
        return "";
      }
    })();
    const software = /swiftshader|llvmpipe|software/i.test(renderer);
    mod._tangle_configure(software ? 0 : 1, 0);
    engine = new Engine(mod);
    const portrait = aspect() < 0.8;
    try {
      kit = K.create({
        module: mod,
        canvas: dom.canvas,
        camera: portrait
          ? { yaw: Math.PI + 0.45, pitch: 0.82, dist: 2.75, tx: 0, ty: 0, tz: 0 }
          : { yaw: -1.25, pitch: 0.7, dist: 2.45, tx: 0, ty: 0, tz: 0 },
        limits: LIMITS,
        idleOrbit: false,
        dprCap: 2,
        frame,
        pick: (x, y) => pick(x, y),
        idOf: (hit) => (hit as Hit).region,
        onTap: (hit) => {
          const h = hit as Hit | null;
          if (!h) return;
          tapPoint = h.point;
          events.emit({ region: h.region, pose: poseOf(turnNow), via: "tap" });
        },
        onFatal: (_code, msg) => showFallback(msg),
      });
    } catch (e) {
      return showFallback(`The 3D view could not start (${(e as { code?: string }).code ?? String(e)}).`);
    }
    engine.view(0.5, fov);
    engine.lights(lights());
    engine.mesh(SLOT.room, buildRoom(), BACKGROUND);
    engine.mesh(SLOT.furniture, buildFurniture());
    engine.mesh(SLOT.lamp, buildLampFace(), MESH_UNLIT);
    mode = "3d";
    kit.start();
    L.done();
    for (const l of Array.from(document.querySelectorAll<HTMLElement>(".sk-loader"))) if (L.state === "done") l.hidden = true;
  }

  const view: ExamView = {
    events,
    get mode() {
      return mode;
    },
    get pose() {
      return pose();
    },
    turn,
  };

  // For tools (Playwright) and the console.
  (window as unknown as { __exam: unknown }).__exam = {
    view,
    log,
    get mode() {
      return mode;
    },
    get flashing() {
      return flash != null;
    },
    get turning() {
      return turnNow !== turnTarget;
    },
    get fps() {
      return ms > 0 ? frames / ms : 0;
    },
    get stats() {
      return kit ? { ...kit.stats(), frameMs: kit.frameMs ?? null } : null;
    },
    anchorClient,
    pickClient(x: number, y: number) {
      const r = dom.canvas.getBoundingClientRect();
      return pick(x - r.left, y - r.top)?.region ?? null;
    },
  };

  boot().catch((e) => {
    console.error(e);
    showFallback(`The 3D view failed: ${String(e)}`);
  });
  return view;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
createExamView({
  canvas: $<HTMLCanvasElement>("view"),
  last: $("last"),
  turn: $<HTMLButtonElement>("turn"),
  regions: $("regions"),
  fallback: $("fallback"),
  status: $("status"),
});
