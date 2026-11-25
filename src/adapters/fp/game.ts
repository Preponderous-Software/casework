// The first-person game: walk the county ME office, take a case at the intake board, drive the
// van to the scene, examine the body at the table, run procedures at their stations, and sign the
// certificate at your desk terminal. Every rule comes from the case reducer
// (src/casework/case/play.ts); this file turns the world into reducer commands.
import type { CaseDef } from "../../casework/case/model.ts";
import { caseSkills, startCase, step as reduce, type CaseState, type Command, type Event, type Score } from "../../casework/case/play.ts";
import { aimAt, available, nearest, occluded } from "../../casework/world/interact.ts";
import { parseLocation, placeholderScene, rotateXZ, solidBoxes } from "../../casework/world/location.ts";
import type { Box, Interactable, Location, Prop, Vec3 } from "../../casework/world/types.ts";
import { EYE, lookDir, step as walkStep, stride, strideStart, type Stride } from "../../casework/world/walk.ts";
import { recordResult, type Profile } from "../../kernel/profile.ts";
import { enqueue } from "../../kernel/review.ts";
import { afterLesson, type SkillId } from "../../kernel/skills.ts";
import { anchorAt, pickRegion, poseOf } from "../exam3d/body.ts";
import { fitFov } from "../exam3d/camera.ts";
import { REGION_LABELS, REGIONS, type Region } from "../exam3d/events.ts";
import { v3 } from "../exam3d/geometry.ts";
import type { Pack } from "../web/content.ts";
import { button, el } from "../web/dom.ts";
import { openLesson } from "../web/lesson-sheet.ts";
import { createControls } from "./controls.ts";
import { closePanel, openPanel, panelOpen, renderBoard, renderDebrief, renderDesk, renderNotebook, renderShelf, skillName, type CaseCtx } from "./panels.ts";
import { promptFor, SCENE_PROCEDURE, sceneLocationId, unlookedSceneFindings, visibleFindings } from "./rules.ts";
import { newSave, storeSave, type FpSave, type KeyValue } from "./save.ts";
import { createHud } from "./ui/hud.ts";
import { createMenu } from "./ui/menu.ts";
import { loadSettings, onSettingsChange } from "./ui/settings.ts";
import { createTouchControls } from "./ui/touch.ts";
import { createPadReader } from "./ui/pad.ts";
import { clampPitch, lookDelta } from "./ui/stick.ts";
import { createAudio } from "./audio/audio.ts";
import * as story from "../../casework/story/index.ts";
import type { View } from "./view.ts";
import { inputMode } from "./ui/input-mode.ts";

const TURN_SECONDS = 0.9;
const FADE_MS = 320;

export interface GamePorts {
  root: HTMLElement;
  /** Transparent layer over the canvas that takes pointer input. */
  surface: HTMLElement;
  view: View;
  pack: Pack;
  profile: Profile;
  saveProfile(p: Profile): void;
  save: FpSave | null;
  store: KeyValue | null;
  today(): number;
  fetchJson(url: string): Promise<unknown | null>;
  packBase: string;
  warning?: string;
}

type Mode = "title" | "walk" | "exam" | "panel" | "say" | "fade" | "pause";

interface ExamState {
  table: Prop;
  turnNow: number;
  turnTarget: number;
  aim: Region | null;
  shownAim: Region | null;
  returnTo: { x: number; z: number; yaw: number; pitch: number };
  baseYaw: number;
  /** Where along the table side you stand (table-local x). */
  slide: number;
}

export async function startGame(p: GamePorts): Promise<void> {
  const { root, surface, view, pack } = p;
  let profile = p.profile;
  let settings = loadSettings();
  onSettingsChange((s) => {
    settings = s;
    audio.setVolume(s.volume);
    audio.setMuted(s.muted);
  });
  const hud = createHud(root);
  const audio = createAudio();
  audio.setVolume(settings.volume);
  audio.setMuted(settings.muted);
  const touch = createTouchControls(root);
  const pad = createPadReader();
  let save: FpSave = p.save ?? newSave(story.newStory());
  let storyState: story.StoryState = story.loadStory(save.story);
  let mode: Mode = "title";
  let loc!: Location;
  let boxes: Box[] = [];
  let figures: { at: Vec3; yaw: number; id: string }[] = [];
  let me = { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0 };
  let pitch = 0;
  let st: Stride = strideStart();
  let bob = { x: 0, y: 0 };
  let aim: Interactable | null = null;
  let exam: ExamState | null = null;
  let lastScore: Score | null = null;
  let saveTimer = 0;
  let pendingSigned: story.StoryEvent | null = null;
  const locations = new Map<string, Location>();
  const isTouch = () => matchMedia("(hover: none)").matches || "ontouchstart" in window;

  // ------------------------------------------------------------------ case plumbing

  const defOf = (id: string | null): CaseDef | null => (id ? (pack.cases.find((c) => c.id === id) ?? null) : null);
  const activeDef = () => defOf(save.active);
  const activeState = (): CaseState | null => (save.active ? (save.cases[save.active] ?? null) : null);
  const looked = () => (save.active ? (save.looked[save.active] ?? []) : []);
  const ctx = () => ({ skills: profile.skills });

  function persist(): void {
    save = { ...save, at: { location: loc?.id ?? "office", x: me.x, z: me.z, yaw: me.yaw }, story: storyState };
    storeSave(p.store, save);
  }
  function commitProfile(np: Profile): void {
    profile = np;
    p.saveProfile(np);
  }

  async function tell(e: story.StoryEvent): Promise<void> {
    const r = story.storyStep(storyState, e);
    storyState = r.state;
    refreshObjective();
    if (r.say.length) await say(r.say);
  }
  function say(lines: story.Line[]): Promise<void> {
    if (!lines.length) return Promise.resolve();
    mode = "say";
    controls.unlock();
    const named = lines.map((l) => ({ who: l.who, name: l.who === "you" ? "You" : l.who === "narrator" ? "" : (story.NPCS[l.who]?.name ?? l.who), text: l.text }));
    return hud.say(named).then(() => {
      if (mode === "say") mode = restMode();
    });
  }
  /** Where play goes back to when a dialogue, panel or fade ends. */
  function restMode(): Mode {
    if (panelOpen()) return "panel";
    if (menu?.showing) return "pause";
    return exam ? "exam" : "walk";
  }
  function refreshObjective(): void {
    hud.objective(story.objective(storyState, save.active));
  }

  /** Run a reducer command on the active case, with toasts and story events. */
  function apply(cmd: Command): Event[] {
    const def = activeDef(), s = activeState();
    if (!def || !s) return [];
    const r = reduce(def, s, cmd, ctx());
    save = { ...save, cases: { ...save.cases, [def.id]: r.state } };
    for (const e of r.events) {
      if (e.type === "rejected") {
        hud.toast(e.reason);
        audio.sfx("fail");
      }
      if (e.type === "revealed") {
        const f = def.findings.find((x) => x.id === e.finding);
        hud.toast(`New finding: ${f?.label}. ${f?.text ?? ""}`);
        audio.sfx("paper");
        // Scene findings tell the story when they are looked at; exam and lab findings tell it here,
        // which is what lets the mentor flag the basement-stairs timeline.
        if (f && f.procedure !== SCENE_PROCEDURE) void tell({ kind: "finding", caseId: def.id, finding: f.id });
      }
      if (e.type === "nothing-new") hud.toast(`Nothing more to find at the ${e.region.replace("-", " ")}.`);
      if (e.type === "ran") {
        const pr = def.procedures.find((x) => x.id === e.procedure);
        if (e.procedure !== SCENE_PROCEDURE) hud.toast(`${pr?.name} done.${e.revealed.length ? ` ${e.revealed.length} new finding${e.revealed.length > 1 ? "s" : ""} in your notebook.` : ""}`);
        audio.sfx("beep");
        void tell({ kind: "procedure", caseId: def.id, procedure: e.procedure });
        if (e.procedure !== SCENE_PROCEDURE) for (const id of e.revealed) void tell({ kind: "finding", caseId: def.id, finding: id });
      }
      if (e.type === "signed") finishCase(def, e.score);
    }
    persist();
    return r.events;
  }

  function finishCase(def: CaseDef, s: Score): void {
    lastScore = s;
    let np = recordResult(profile, `case:${def.id}`, s.total);
    for (const k of s.review) np = { ...np, cards: enqueue(np.cards, k, p.today()) };
    commitProfile(np);
    audio.sfx("sign");
    // the story hears about it once the debrief is closed, so its lines don't talk over the score
    pendingSigned = { kind: "signed", caseId: def.id, score: s.total };
  }

  function learn(skill: SkillId, after: (answered: boolean) => void): void {
    const lesson = pack.lessons.find((l) => l.skill === skill);
    if (!lesson) {
      hud.toast("This skill has no lesson yet.");
      return after(false);
    }
    openLesson(
      lesson,
      (right) => commitProfile({ ...profile, skills: { ...profile.skills, [skill]: afterLesson(profile.skills[skill] ?? "unknown", right) }, cards: enqueue(profile.cards, skill, p.today()) }),
      after,
    );
  }

  function caseCtx(): CaseCtx | null {
    const def = activeDef(), s = activeState();
    if (!def || !s) return null;
    return {
      pack,
      def,
      state: () => activeState() ?? s,
      profile: () => profile,
      visible: () => visibleFindings(def, activeState() ?? s, looked()),
      apply,
      interpret(fid, after) {
        const ev = apply({ type: "interpret", finding: fid });
        const need = ev.find((e) => e.type === "needs-skill");
        if (need?.type !== "needs-skill") return after();
        learn(need.skill, (answered) => {
          if (answered) apply({ type: "interpret", finding: fid });
          after();
        });
      },
    };
  }

  // ------------------------------------------------------------------ panels

  function panel(title: string, eyebrow: string, id: string) {
    mode = "panel";
    controls.unlock();
    controls.clear();
    audio.sfx("click");
    view.pause(true);
    return openPanel(root, title, eyebrow, () => {
      view.pause(false);
      if (mode === "panel") mode = restMode();
      if (pendingSigned && !panelOpen()) {
        const e = pendingSigned;
        pendingSigned = null;
        audio.sfx("success");
        void tell(e);
      }
      refreshObjective();
      persist();
    }, id);
  }

  function openBoard(): void {
    const pn = panel("Intake board", "Lobby", "fp-board");
    const draw = () =>
      renderBoard(pn.body, pack, story.availableCases(storyState), profile, save.active, save.cases, (id, fresh) => {
        const def = defOf(id)!;
        const cases = { ...save.cases };
        const lookedNow = { ...save.looked };
        if (fresh || !cases[id]) {
          cases[id] = startCase(def);
          lookedNow[id] = [];
        }
        save = { ...save, active: id, cases, looked: lookedNow };
        void tell({ kind: "case-started", caseId: id });
        if (!fresh) for (const pr of cases[id]!.done) void tell({ kind: "procedure", caseId: id, procedure: pr });
        persist();
        closePanel();
        updateBody();
        hud.toast(`${def.title}: on your desk. ${def.intake}`);
        audio.sfx("paper");
      });
    draw();
  }

  function openNotebook(): void {
    const def = activeDef();
    const pn = panel(def ? def.title : "Notebook", "Case notebook", "fp-notebook");
    renderNotebook(pn.body, caseCtx(), story.objective(storyState, save.active));
  }

  function openDesk(): void {
    const c = caseCtx();
    if (!c) {
      hud.toast("No case on your desk. The intake board is in the lobby.");
      return;
    }
    if (c.state().signed) return openNotebook();
    const pn = panel(c.def.title, "Desk terminal · certificate", "fp-desk");
    renderDesk(pn.body, c, () => {
      const def = c.def;
      // the debrief replaces the certificate in the same panel; closing it tells the story
      pn.body.closest(".fp-panel")?.setAttribute("id", "fp-debrief");
      const eb = pn.body.closest(".fp-panel")?.querySelector(".eyebrow");
      if (eb) eb.textContent = "Signed";
      renderDebrief(pn.body, pack, def, lastScore!, () => closePanel());
      pn.body.closest(".fp-panel")?.scrollTo({ top: 0 });
      save = { ...save, active: null };
      updateBody();
      persist();
    });
  }

  function openShelf(skill: string): void {
    if (skill !== "*") {
      learn(skill as SkillId, () => {});
      return;
    }
    const pn = panel("Reference shelf", "Your office", "fp-shelf");
    const draw = () => {
      const def = activeDef();
      renderShelf(pn.body, pack, profile, def ? caseSkills(def) : [], (k) => learn(k, () => draw()));
    };
    draw();
  }

  // ------------------------------------------------------------------ locations

  async function getLocation(id: string): Promise<Location> {
    const hit = locations.get(id);
    if (hit) return hit;
    let raw: unknown | null;
    if (id === "office") raw = await p.fetchJson(`${p.packBase}/world/office.json`);
    else raw = await p.fetchJson(`${p.packBase}/world/scenes/${id}.json`);
    let l: Location | null = null;
    if (raw) {
      try {
        l = parseLocation(raw);
      } catch (e) {
        console.warn(`casework fp: ${id} is not a valid location (${(e as Error).message}); using a placeholder`);
      }
    }
    if (!l) {
      const caseId = id.replace(/^scene-/, "");
      const def = defOf(caseId);
      if (!def) throw new Error(`no location ${id}`);
      l = placeholderScene({ caseId, title: def.title, findings: def.findings.filter((f) => f.procedure === SCENE_PROCEDURE).map((f) => ({ id: f.id, label: f.label })) });
    }
    locations.set(id, l);
    return l;
  }

  function figureFor(it: Interactable, l: Location): { at: Vec3; yaw: number; id: string } {
    const cx = (l.bounds[0] + l.bounds[2]) / 2, cz = (l.bounds[1] + l.bounds[3]) / 2;
    const spawn = l.spawns.start!;
    const tx = Number.isFinite(spawn.x) ? spawn.x : cx, tz = Number.isFinite(spawn.z) ? spawn.z : cz;
    return { at: [it.at[0], 0, it.at[2]], yaw: Math.atan2(tx - it.at[0], tz - it.at[2]), id: it.id };
  }

  async function enter(id: string, spawnName: string, at?: { x: number; z: number; yaw: number }): Promise<void> {
    loc = await getLocation(id);
    figures = loc.interactables.filter((i) => i.action.kind === "talk" && (!i.caseId || i.caseId === save.active)).map((i) => figureFor(i, loc));
    boxes = [...solidBoxes(loc), ...figures.map((f): Box => [f.at[0] - 0.22, f.at[2] - 0.22, f.at[0] + 0.22, f.at[2] + 0.22])];
    const sp = at && Number.isFinite(at.x) ? at : (loc.spawns[spawnName] ?? loc.spawns.start!);
    me = { x: sp.x, z: sp.z, yaw: sp.yaw, vx: 0, vz: 0, speed: 0 };
    pitch = 0;
    view.setLocation(loc, figures);
    updateBody();
    audio.ambience(loc.ambience ?? null);
    hud.arrive(loc.name);
    persist();
  }

  async function travel(to: string, spawn: string): Promise<void> {
    mode = "fade";
    audio.sfx("door");
    await fade(true);
    try {
      await enter(to, spawn);
    } catch (e) {
      hud.toast(`That way is closed (${(e as Error).message}).`);
    }
    await fade(false);
    mode = restMode();
    await tell({ kind: "enter", location: loc.id });
    if (loc.caseId && save.active === loc.caseId) {
      const left = unlookedSceneFindings(activeDef()!, looked());
      if (left.length) hud.toast(`${left.length} thing${left.length > 1 ? "s" : ""} here worth a close look.`);
    }
  }

  const fadeEl = el("div", { class: "fp-fade" });
  root.append(fadeEl);
  function fade(dark: boolean): Promise<void> {
    fadeEl.classList.toggle("on", dark);
    return new Promise((r) => setTimeout(r, settings.reducedMotion ? 0 : FADE_MS));
  }

  // ------------------------------------------------------------------ the body on the table

  function tableProp(): Prop | null {
    return loc?.props.find((x) => x.kind === "exam-table") ?? null;
  }
  function updateBody(): void {
    const t = tableProp();
    const def = activeDef(), s = activeState();
    if (!t || !def || !s || s.signed) {
      view.setBody(null);
      return;
    }
    const turn = exam ? eased(exam.turnNow) : 0;
    view.setBody({ at: t.at, yaw: t.yaw ?? 0, turn, highlight: exam?.aim ?? null });
  }
  const eased = (x: number) => Math.PI * (0.5 - 0.5 * Math.cos(x));

  /** A room ray → the table's own frame (the exam room's coordinates). */
  function toTable(t: Prop, origin: Vec3, dir: Vec3): { origin: [number, number, number]; dir: [number, number, number] } {
    const yaw = t.yaw ?? 0;
    const [ox, oz] = rotateXZ(origin[0] - t.at[0], origin[2] - t.at[2], -yaw);
    const [dx, dz] = rotateXZ(dir[0], dir[2], -yaw);
    return { origin: [ox, origin[1], oz], dir: [dx, dir[1], dz] };
  }

  function examEye(e: ExamState): Vec3 {
    const t = e.table;
    // a narrow (portrait) screen stands at the foot of the table, looking along the body, so all of
    // it fits; a wide one stands at the side
    const narrow = aspect() < 0.8;
    const [ox, oz] = narrow ? rotateXZ(-1.75, e.slide * 0.4, t.yaw ?? 0) : rotateXZ(e.slide, 0.95, t.yaw ?? 0);
    return [t.at[0] + ox, EYE + (narrow ? 0.3 : 0.05), t.at[2] + oz];
  }

  function enterExam(): void {
    const t = tableProp();
    const def = activeDef(), s = activeState();
    if (!t) return;
    if (!def || !s) {
      hud.toast("The table is empty. Take a case from the intake board first.");
      return;
    }
    if (s.signed) {
      hud.toast("This case is signed.");
      return;
    }
    const ex = def.procedures.find((x) => x.exam);
    if (ex && !s.done.includes(ex.id)) {
      const ev = apply({ type: "run", procedure: ex.id });
      if (!ev.some((e) => e.type === "ran")) return;
      hud.toast(`${ex.name} started. ${examHint()}`);
    }
    const yaw = t.yaw ?? 0;
    exam = { table: t, turnNow: 0, turnTarget: 0, aim: null, shownAim: null, returnTo: { x: me.x, z: me.z, yaw: me.yaw, pitch }, baseYaw: yaw, slide: 0 };
    const eye = examEye(exam);
    const target: Vec3 = [t.at[0], 1.0, t.at[2]];
    const d = v3.sub(target, eye);
    me.yaw = Math.atan2(-d[0], -d[2]);
    exam.baseYaw = me.yaw;
    pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    mode = "exam";
    examBar.hidden = false;
    renderExamBar();
    updateBody();
  }

  function leaveExam(): void {
    if (!exam) return;
    const r = exam.returnTo;
    me = { ...me, x: r.x, z: r.z, yaw: r.yaw, vx: 0, vz: 0 };
    pitch = 0;
    exam = null;
    examBar.hidden = true;
    mode = "walk";
    view.marker(null);
    updateBody();
  }

  function turnBody(): void {
    if (!exam) return;
    exam.turnTarget = exam.turnTarget < Math.PI / 2 ? Math.PI : 0;
    if (settings.reducedMotion) exam.turnNow = exam.turnTarget;
    audio.sfx("click");
    renderExamBar();
  }
  const pose = () => (exam ? poseOf(exam.turnTarget) : "supine");

  function examine(region: Region): void {
    if (!exam) return;
    if (exam.turnNow !== exam.turnTarget) return;
    apply({ type: "examine", region, pose: pose() });
    renderExamBar();
  }

  const examBar = el("div", { class: "fp-exambar", id: "fp-exambar" });
  examBar.hidden = true;
  root.append(examBar);
  function renderExamBar(): void {
    examBar.innerHTML = "";
    const def = activeDef(), s = activeState();
    const row = el("div", { class: "row" });
    row.append(
      el("span", { class: "pill", id: "fp-pose" }, pose() === "prone" ? "Face down · back up" : "Face up"),
      button(pose() === "supine" ? "Turn over (T)" : "Turn face up (T)", turnBody, "btn ghost", "fp-turn"),
      button("Step back (Q)", leaveExam, "btn ghost", "fp-leave"),
    );
    const regions = el("div", { class: "fp-regions", role: "group", "aria-label": "Body regions" });
    for (const r of REGIONS) {
      const here = def && s ? def.findings.filter((f) => f.region === r && s.done.includes(f.procedure)) : [];
      const found = here.length > 0 && here.every((f) => s!.revealed.includes(f.id));
      const b = button(REGION_LABELS[r], () => examine(r), `fp-region${found ? " found" : ""}`, `fp-region-${r}`);
      regions.append(b);
    }
    examBar.append(row, regions);
  }

  // ------------------------------------------------------------------ using things

  async function use(it: Interactable): Promise<void> {
    const a = it.action;
    const def = activeDef(), s = activeState();
    switch (a.kind) {
      case "door":
        return travel(a.to, a.spawn);
      case "cases":
        if (!story.availableCases(storyState).length) return readThing("intake-board");
        return openBoard();
      case "notebook":
        return openNotebook();
      case "certificate":
        return openDesk();
      case "lesson":
        return openShelf(a.skill);
      case "exam":
        return enterExam();
      case "read":
        return readThing(a.text);
      case "talk": {
        // the person turns to face you
        const f = figures.find((x) => x.id === it.id);
        if (f) {
          f.yaw = Math.atan2(me.x - f.at[0], me.z - f.at[2]);
          view.setFigures(figures);
        }
        audio.sfx("click");
        return tell({ kind: "talk", npc: a.npc });
      }
      case "finding": {
        if (!def || !s) return;
        const f = def.findings.find((x) => x.id === a.finding);
        if (!f) return;
        if (!s.revealed.includes(f.id)) {
          hud.toast("Not yet.");
          return;
        }
        const was = looked().includes(f.id);
        if (!was) save = { ...save, looked: { ...save.looked, [def.id]: [...looked(), f.id] } };
        persist();
        audio.sfx("paper");
        await say([{ who: "you", text: `${f.label}. ${f.text}` }]);
        if (!was) {
          hud.toast(`Noted: ${f.label}. It's in your notebook.`);
          await tell({ kind: "finding", caseId: def.id, finding: f.id });
        }
        return;
      }
      case "procedure": {
        if (!def || !s) {
          hud.toast("No case on your desk yet. The intake board is in the lobby.");
          return;
        }
        if (s.signed) return;
        const pr = def.procedures.find((x) => x.id === a.procedure);
        if (!pr) {
          hud.toast(`This case doesn't need ${it.label.replace(/^\w/, (c) => c.toLowerCase())}.`);
          return;
        }
        if (a.procedure === SCENE_PROCEDURE) {
          if (!s.done.includes(pr.id)) {
            const ev = apply({ type: "run", procedure: pr.id });
            if (!ev.some((e) => e.type === "ran")) return;
          }
          return travel(sceneLocationId(def.id), "start");
        }
        if (s.done.includes(pr.id)) {
          hud.toast(`${pr.name} is done. The results are in your notebook.`);
          return;
        }
        apply({ type: "run", procedure: pr.id });
        return;
      }
    }
  }

  /** Read a text prop: resolve the stable id against the story, show it, then tell the story. */
  async function readThing(id: string): Promise<void> {
    const resolved = story.resolveText(storyState, id, save.active);
    const t = story.readText(resolved);
    audio.sfx("paper");
    if (t) await say([{ who: "narrator", text: `${t.title}\n\n${t.body}` }]);
    else hud.toast(id === "front-door" ? "Not yet. The shift isn't over." : "Nothing you need right now.");
    await tell({ kind: "read", text: id });
  }

  function examHint(): string {
    const m = inputMode();
    if (m === "touch") return "Tap a part of the body to examine it. Turn over and Step back are below.";
    if (m === "pad") return "Aim at a part of the body and press A. Turn over and Step back are below.";
    return "Look at a part of the body and press E. T turns the body; Q steps back.";
  }

  function interact(): void {
    if (hud.speaking) return;
    if (mode === "exam") {
      if (exam?.aim) examine(exam.aim);
      else hud.toast(examHint());
      return;
    }
    if (mode !== "walk") return;
    if (aim) void use(aim);
  }

  // ------------------------------------------------------------------ input

  const controls = createControls(surface, {
    onPress(action) {
      if (action === "back") {
        if (document.querySelector(".sheet-back")) return;
        if (panelOpen()) return closePanel();
        if (mode === "exam") return leaveExam();
        if (mode === "walk") return pause();
        if (mode === "pause") return resume();
        return;
      }
      if (action === "interact") interact();
      if (action === "notebook" && (mode === "walk" || mode === "exam")) openNotebook();
      if (action === "turn" && mode === "exam") turnBody();
      if (action === "leave" && mode === "exam") leaveExam();
    },
    onTap(x, y) {
      if (mode === "exam") {
        const hit = pickAtClient(x, y);
        if (hit) examine(hit);
        return;
      }
      if (mode === "walk" && !isTouch()) controls.lock();
    },
    active: () => mode === "walk" || mode === "exam",
  });

  const menu = createMenu(root, {
    onStart: () => begin(),
    onResume: () => resume(),
    hasSave: !!p.save,
    onNew: () => {
      if (!p.save) return void begin();
      storeSave(p.store, newSave(story.newStory()));
      location.reload();
    },
    onQuit: () => {
      mode = "title";
      controls.unlock();
      menu.open("title");
    },
  });
  document.addEventListener("pointerlockchange", () => {
    if (!document.pointerLockElement && (mode === "walk" || mode === "exam") && !hud.speaking && !panelOpen()) pause();
  });
  function pause(): void {
    mode = "pause";
    controls.unlock();
    menu.open("pause");
  }
  function resume(): void {
    if (menu.showing) menu.close();
    mode = exam ? "exam" : "walk";
    if (!isTouch()) controls.lock();
  }
  let begun = false;
  async function begin(): Promise<void> {
    menu.close();
    if (!isTouch()) controls.lock();
    mode = "walk";
    if (!begun) {
      begun = true;
      await tell({ kind: "enter", location: loc.id });
    }
  }

  // ------------------------------------------------------------------ camera and picking

  function eye(): Vec3 {
    if (exam) return examEye(exam);
    const [rx, rz] = [Math.cos(me.yaw), -Math.sin(me.yaw)];
    return [me.x + rx * bob.x, EYE + bob.y, me.z + rz * bob.x];
  }

  function aspect(): number {
    const c = view.kit.canvas;
    return c.clientWidth / Math.max(1, c.clientHeight);
  }

  /** A ray through normalised device coordinates. */
  function rayAt(nx: number, ny: number): { origin: Vec3; dir: Vec3 } {
    const f = lookDir(me.yaw, pitch);
    const r = v3.norm(v3.cross(f, [0, 1, 0]));
    const u = v3.cross(r, f);
    const th = Math.tan((view.fov * Math.PI) / 360);
    const d = v3.norm(v3.add(f, v3.add(v3.mul(r, nx * th * aspect()), v3.mul(u, ny * th))));
    return { origin: eye(), dir: [d[0], d[1], d[2]] };
  }

  function pickRay(origin: Vec3, dir: Vec3): Region | null {
    if (!exam) return null;
    const r = toTable(exam.table, origin, dir);
    return pickRegion(r, eased(exam.turnNow))?.region ?? null;
  }
  function pickAtClient(x: number, y: number): Region | null {
    const c = view.kit.canvas.getBoundingClientRect();
    const nx = ((x - c.left) / Math.max(1, c.width)) * 2 - 1, ny = 1 - ((y - c.top) / Math.max(1, c.height)) * 2;
    const r = rayAt(nx, ny);
    return pickRay(r.origin, r.dir);
  }

  // ------------------------------------------------------------------ the frame

  function frame(dt: number): void {
    if (!loc) return;
    const t = touch.read();
    const g = pad.read(dt);
    const active = (mode === "walk" || mode === "exam") && !hud.speaking;
    if (active) {
      if (t.interact || g.interact) interact();
      if (t.notebook || g.notebook) openNotebook();
      if (t.pause || g.pause) pause();
      if (g.back && mode === "exam") leaveExam();
    } else if (g.back && panelOpen()) closePanel();
    const intent = controls.read(dt);
    const ld = active ? lookDelta(intent.lookX + t.lookDx + g.lookDx, intent.lookY + t.lookDy + g.lookDy, settings) : { yaw: 0, pitch: 0 };
    const fwd = active ? (t.forward || g.forward || intent.forward) : 0, rgt = active ? (t.right || g.right || intent.right) : 0;
    const running = intent.run || t.run || g.run;

    if (mode === "walk") {
      me.yaw += ld.yaw;
      pitch = clampPitch(pitch + ld.pitch);
      const before = { x: me.x, z: me.z };
      const next = walkStep(me, { forward: fwd, right: rgt, run: running }, dt, boxes);
      me = { ...me, ...next };
      const sr = stride(st, Math.hypot(me.x - before.x, me.z - before.z), me.speed, running, dt);
      st = sr.st;
      bob = settings.reducedMotion ? { x: 0, y: 0 } : { x: sr.x, y: sr.y };
      if (sr.step) audio.sfx("step");
      const e = eye();
      const list = available(loc, save.active);
      const hit = aimAt(e, lookDir(me.yaw, pitch), list, save.active, loc.walls)?.target ?? (isTouch() ? nearest(e, list, save.active, 0.3, loc.walls) : null);
      aim = hit;
      hud.prompt(hit ? promptFor(hit, activeDef(), activeState(), looked()) : null);
      hud.crosshair(!!hit);
      saveTimer += dt;
      if (saveTimer > 3) {
        saveTimer = 0;
        persist();
      }
    } else if (mode === "exam" && exam) {
      const lk = { yaw: me.yaw + ld.yaw, pitch: pitch + ld.pitch };
      let dy = lk.yaw - exam.baseYaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      me.yaw = exam.baseYaw + Math.max(-1.2, Math.min(1.2, dy));
      pitch = Math.max(-1.4, Math.min(0.2, lk.pitch));
      exam.slide = Math.max(-0.95, Math.min(0.85, exam.slide + rgt * dt * 1.2 * Math.cos(me.yaw - exam.baseYaw)));
      if (exam.turnNow !== exam.turnTarget) {
        const stp = (Math.PI / TURN_SECONDS) * dt;
        exam.turnNow = Math.abs(exam.turnTarget - exam.turnNow) <= stp ? exam.turnTarget : exam.turnNow + Math.sign(exam.turnTarget - exam.turnNow) * stp;
        updateBody();
      }
      const r = rayAt(0, 0);
      exam.aim = exam.turnNow === exam.turnTarget ? pickRay(r.origin, r.dir) : null;
      if (exam.aim !== exam.shownAim) {
        exam.shownAim = exam.aim;
        updateBody();
      }
      hud.prompt(exam.aim ? `Examine the ${REGION_LABELS[exam.aim].toLowerCase()}` : null);
      hud.crosshair(!!exam.aim);
    } else {
      hud.prompt(null);
      hud.crosshair(false);
    }
    view.setFov(fitFov(settings.fov, 62, aspect(), 95));
    view.camera(eye(), me.yaw, pitch);
  }

  // ------------------------------------------------------------------ boot

  view.kit.canvas.dataset.fp = "1";
  (window as unknown as { __fpFrame: (dt: number) => void }).__fpFrame = frame;
  const start = save.at;
  await enter(start.location === "office" || start.location.startsWith("scene-") ? start.location : "office", "start", start).catch(() => enter("office", "start"));
  refreshObjective();
  if (p.warning) hud.toast(p.warning);
  menu.open("title");

  // For tools (Playwright) and the console.
  (window as unknown as { __fp: unknown }).__fp = {
    get state() {
      return {
        location: loc.id,
        x: me.x,
        z: me.z,
        yaw: me.yaw,
        pitch,
        mode,
        active: save.active,
        aim: aim?.id ?? null,
        examAim: exam?.aim ?? null,
        pose: pose(),
        case: activeState(),
        looked: looked(),
        objective: story.objective(storyState, save.active),
      };
    },
    teleport(x: number, z: number, yaw: number, pt = 0) {
      me = { ...me, x, z, yaw, vx: 0, vz: 0 };
      pitch = pt;
    },
    /** Turn to look at a point. */
    face(x: number, y: number, z: number) {
      const e = eye();
      const d = [x - e[0], y - e[1], z - e[2]] as const;
      me.yaw = Math.atan2(-d[0], -d[2]);
      pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    },
    /** Walk up to an interactable (teleport to a point within reach) and face it. */
    approach(id: string) {
      const it = loc.interactables.find((i) => i.id === id);
      if (!it) return false;
      const reach = (it.reach ?? 1.6) * 0.92;
      let best: { x: number; z: number } | null = null;
      for (let k = 0; k < 24 && !best; k++) {
        const a = (k / 24) * Math.PI * 2 + me.yaw;
        for (const r of [reach, reach * 0.8, reach * 0.6]) {
          const x = it.at[0] + Math.sin(a) * r, z = it.at[2] + Math.cos(a) * r;
          const ok = boxes.every(([x0, z0, x1, z1]) => x < x0 - 0.3 || x > x1 + 0.3 || z < z0 - 0.3 || z > z1 + 0.3);
          if (ok && Math.hypot(x - it.at[0], z - it.at[2]) <= (it.reach ?? 1.6) && !occluded([x, EYE, z], it.at, loc.walls)) {
            best = { x, z };
            break;
          }
        }
      }
      if (!best) return false;
      me = { ...me, x: best.x, z: best.z, vx: 0, vz: 0 };
      const e = eye();
      me.yaw = Math.atan2(-(it.at[0] - e[0]), -(it.at[2] - e[2]));
      pitch = Math.atan2(it.at[1] - e[1], Math.hypot(it.at[0] - e[0], it.at[2] - e[2]));
      return true;
    },
    interact,
    /** Where a body region's anchor is on screen now (client px), for tap tests. */
    regionClient(region: Region) {
      if (!exam) return null;
      const t = exam.table;
      const local = anchorAt(region, eased(exam.turnNow));
      const [wx, wz] = rotateXZ(local[0], local[2], t.yaw ?? 0);
      const w: Vec3 = [wx + t.at[0], local[1], wz + t.at[2]];
      const e = eye();
      const f = lookDir(me.yaw, pitch);
      const r = v3.norm(v3.cross(f, [0, 1, 0]));
      const u = v3.cross(r, f);
      const d = v3.sub(w, e);
      const z = v3.dot(d, f);
      if (z <= 0) return null;
      const th = Math.tan((view.fov * Math.PI) / 360);
      const nx = v3.dot(d, r) / (z * th * aspect()), ny = v3.dot(d, u) / (z * th);
      const c = view.kit.canvas.getBoundingClientRect();
      return { x: c.left + ((nx + 1) / 2) * c.width, y: c.top + ((1 - ny) / 2) * c.height };
    },
    lookAtRegion(region: Region) {
      if (!exam) return;
      const t = exam.table;
      const local = anchorAt(region, eased(exam.turnNow));
      const [wx, wz] = rotateXZ(local[0], local[2], t.yaw ?? 0);
      const e = eye();
      const d = [wx + t.at[0] - e[0], local[1] - e[1], wz + t.at[2] - e[2]] as const;
      me.yaw = Math.atan2(-d[0], -d[2]);
      pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    },
    skillName: (k: SkillId) => skillName(pack, k),
  };
}
