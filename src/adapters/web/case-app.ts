// A case, in the browser. The rules all come from src/casework/case/play.ts; this file renders the
// state, turns taps into commands, runs lessons through the learning kernel, and hosts the 3D exam
// room (or its list fallback) as the way to examine the body.
import { toClock } from "../../casework/case/clock.ts";
import { MANNERS, type CaseDef, type Line, type Manner } from "../../casework/case/model.ts";
import { agreement, bars, linkHolds, MAX_SCORE, signBlockers, startCase, step, type CaseState, type Command, type Event, type Score } from "../../casework/case/play.ts";
import { recordResult, type Profile } from "../../kernel/profile.ts";
import { enqueue } from "../../kernel/review.ts";
import { afterLesson, isKnown, type SkillId } from "../../kernel/skills.ts";
import type { ExamView } from "../exam3d/exam-room.ts";
import { evidenceChart } from "./chart.ts";
import type { Pack } from "./content.ts";
import { button, el, masteryLabel, toast } from "./dom.ts";
import { ICONS } from "./icons.ts";
import { openLesson } from "./lesson-sheet.ts";

const SPAN = 16;
const STEP = 0.25;
const LINE_NAME: Record<Line, string> = { time: "Time", cause: "Cause", manner: "Manner" };

export interface CasePorts {
  pack: Pack;
  def: CaseDef;
  profile: Profile;
  saveProfile(p: Profile): void;
  loadProgress(): CaseState | null;
  saveProgress(s: CaseState | null): void;
  today(): number;
  /** Build the exam view once its panel is visible. */
  createExam(): ExamView;
}

export function startCaseApp(ports: CasePorts): void {
  const { def, pack } = ports;
  let profile = ports.profile;
  let state: CaseState = ports.loadProgress() ?? startCase(def);
  let lastScore: Score | null = null;
  let exam: ExamView | null = null;
  let fresh = new Set<string>();
  const top = document.getElementById("top")!;
  const rest = document.getElementById("rest")!;
  const examPanel = document.getElementById("examPanel")!;
  const ctx = () => ({ skills: profile.skills });
  const clock = (h: number) => toClock(def.foundAt, h);
  const skillName = (k: SkillId) => pack.skills.find((s) => s.id === k)?.name ?? k;
  const skillIcon = (k: SkillId | null) => (k ? ICONS[pack.skills.find((s) => s.id === k)?.icon ?? ""] : ICONS.scale) ?? "";

  document.title = `Casework: ${def.title}`;

  function commit(p: Profile) {
    profile = p;
    ports.saveProfile(p);
  }

  function apply(cmd: Command): Event[] {
    const r = step(def, state, cmd, ctx());
    state = r.state;
    ports.saveProgress(state.signed ? null : state);
    for (const e of r.events) {
      if (e.type === "rejected") toast(e.reason);
      if (e.type === "revealed") {
        fresh.add(e.finding);
        toast(`New finding: ${def.findings.find((f) => f.id === e.finding)?.label}`);
      }
      if (e.type === "ran") e.revealed.forEach((f) => fresh.add(f));
      if (e.type === "nothing-new") toast(`Nothing more to find at the ${e.region.replace("-", " ")}.`);
      if (e.type === "signed") finish(e.score);
    }
    render();
    return r.events;
  }

  function finish(s: Score) {
    lastScore = s;
    let p = recordResult(profile, `case:${def.id}`, s.total);
    for (const k of s.review) p = { ...p, cards: enqueue(p.cards, k, ports.today()) };
    commit(p);
  }

  function interpret(fid: string) {
    const events = apply({ type: "interpret", finding: fid });
    const need = events.find((e) => e.type === "needs-skill");
    if (need?.type !== "needs-skill") return;
    const lesson = pack.lessons.find((l) => l.skill === need.skill);
    if (!lesson) return toast("This skill has no lesson yet.");
    openLesson(
      lesson,
      (right) => commit({ ...profile, skills: { ...profile.skills, [need.skill]: afterLesson(profile.skills[need.skill] ?? "unknown", right) }, cards: enqueue(profile.cards, need.skill, ports.today()) }),
      (answered) => {
        if (answered) apply({ type: "interpret", finding: fid });
        else render();
      },
    );
  }

  // ---------- exam room ----------
  function ensureExam() {
    const examDone = def.procedures.some((p) => p.exam && state.done.includes(p.id));
    examPanel.hidden = !examDone;
    if (!examDone || exam) return;
    exam = ports.createExam();
    const chip = document.getElementById("poseChip");
    const showPose = () => {
      if (chip && exam) chip.textContent = exam.pose === "prone" ? "Face down · back up" : "Face up";
    };
    document.getElementById("turn")?.addEventListener("click", () => setTimeout(showPose, 0));
    showPose();
    exam.events.onRegion((e) => {
      if (state.signed) return;
      apply({ type: "examine", region: e.region, pose: e.pose });
    });
  }

  function markRegions() {
    for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>("#regions button"))) {
      const here = def.findings.filter((f) => f.region === b.dataset.region && state.done.includes(f.procedure));
      b.classList.toggle("found", here.length > 0 && here.every((f) => state.revealed.includes(f.id)));
    }
  }

  // ---------- render ----------
  function render() {
    renderTop();
    ensureExam();
    markRegions();
    renderRest();
    fresh = new Set();
  }

  function renderTop() {
    top.innerHTML = "";
    const head = document.getElementById("head");
    if (head && !head.firstChild) {
      const h = el("header", { class: "top" });
      h.append(el("a", { href: "./", class: "back" }, "← All cases"), el("h1", {}, def.title), el("p", { class: "sub" }, def.intake));
      head.append(h);
    }

    const intro = el("section", { class: "card" });
    intro.append(el("p", { class: "eyebrow" }, `Found at ${clock(0)}`), el("p", {}, def.context));
    if (def.note) intro.append(el("p", { class: "notice" }, def.note));
    const meters = el("div", { class: "meters" });
    const meter = (label: string, value: string, frac: number) => {
      const m = el("div", { class: "meter-box" });
      const bar = el("div", { class: "meter-bar" });
      const fill = el("span", { style: `width:${Math.round(frac * 100)}%` });
      bar.append(fill);
      m.append(el("span", {}, label), el("b", {}, value), bar);
      return m;
    };
    meters.append(meter("Shift left", `${state.hoursLeft} h`, state.hoursLeft / def.shift.hours), meter("Lab budget", `$${state.budget}`, def.shift.budget ? state.budget / def.shift.budget : 0));
    intro.append(meters);
    top.append(intro);

    const procs = el("section", { class: "card" });
    procs.append(el("p", { class: "eyebrow" }, "Procedures"));
    const grid = el("div", { class: "procs" });
    for (const p of def.procedures) {
      const done = state.done.includes(p.id);
      const missing = (p.requires ?? []).filter((r) => !state.done.includes(r));
      const b = el("button", { type: "button", class: `proc${done ? " done" : ""}`, id: `proc-${p.id}` }) as HTMLButtonElement;
      b.disabled = state.signed || done || missing.length > 0 || p.hours > state.hoursLeft || p.cost > state.budget;
      b.append(
        el("b", {}, done ? `${p.name} ✓` : p.name),
        el("span", { class: "cost" }, `${p.hours} h${p.cost ? ` · $${p.cost}` : ""}`),
        el("small", {}, missing.length ? `Needs ${missing.map((m) => def.procedures.find((x) => x.id === m)?.name).join(", ")} first.` : (p.blurb ?? "")),
      );
      b.addEventListener("click", () => apply({ type: "run", procedure: p.id }));
      grid.append(b);
    }
    procs.append(grid);
    top.append(procs);
  }

  function renderRest() {
    rest.innerHTML = "";
    rest.append(findingsCard(), certificate());
    if (state.signed && lastScore) rest.append(debrief(lastScore));
  }

  function findingsCard(): HTMLElement {
    const sec = el("section", { class: "card", id: "findings" });
    sec.append(el("p", { class: "eyebrow" }, `Findings (${state.revealed.length})`));
    if (!state.revealed.length) {
      sec.append(el("p", { class: "fine" }, "Run a procedure to start. The external exam opens the exam room, where you tap the body to examine it."));
      return sec;
    }
    sec.append(el("p", { class: "fine" }, "Interpret a finding to learn what it means, then tap Time, Cause or Manner to use it as evidence on the certificate."));
    const list = el("div", { class: "findings" });
    for (const fid of [...state.revealed].reverse()) {
      const f = def.findings.find((x) => x.id === fid)!;
      const card = el("div", { class: `finding${fresh.has(fid) ? " new" : ""}`, id: `finding-${fid}` });
      const ic = el("span", { class: "ic" });
      ic.innerHTML = skillIcon(f.skill);
      card.append(ic, el("span", { class: "lbl" }, f.label), el("p", {}, f.text));
      if (!state.interpreted.includes(fid)) {
        const known = !f.skill || isKnown(profile.skills[f.skill]);
        const b = button(known ? "Interpret" : `Learn: ${skillName(f.skill!)}`, () => interpret(fid), known ? "btn go" : "btn ghost", `interpret-${fid}`);
        b.disabled = state.signed;
        card.append(b);
      } else {
        const m = f.skill ? profile.skills[f.skill] : undefined;
        card.append(el("p", { class: "meaning" }, `${f.meaning}${f.skill && m ? ` (${skillName(f.skill)}: ${masteryLabel(m)})` : ""}`));
        const chips = el("div", { class: "link-chips", role: "group", "aria-label": `Use ${f.label} as evidence for` });
        for (const line of ["time", "cause", "manner"] as Line[]) {
          const on = state.links.some((l) => l.finding === fid && l.line === line);
          const cls = state.signed && on ? (linkHolds(def, state, { finding: fid, line }) ? "link-chip held" : "link-chip broke") : "link-chip";
          const c = el("button", { type: "button", class: cls, "aria-pressed": String(on), id: `link-${fid}-${line}` }, on ? `${LINE_NAME[line]} ✓` : LINE_NAME[line]) as HTMLButtonElement;
          c.disabled = state.signed;
          c.addEventListener("click", () => apply({ type: on ? "unlink" : "link", finding: fid, line }));
          chips.append(c);
        }
        card.append(chips);
      }
      list.append(card);
    }
    sec.append(list);
    return sec;
  }

  function evidenceFor(line: Line): HTMLElement {
    const box = el("div", { class: "evid" });
    const ls = state.links.filter((l) => l.line === line);
    if (!ls.length) box.append(el("span", { class: "none" }, "No evidence linked yet."));
    for (const l of ls) {
      const f = def.findings.find((x) => x.id === l.finding)!;
      const cls = state.signed ? (linkHolds(def, state, l) ? "pill ok" : "pill bad") : "pill";
      box.append(el("span", { class: cls }, f.label));
    }
    return box;
  }

  function certificate(): HTMLElement {
    const c = el("section", { class: "cert", id: "certificate" });
    c.append(el("p", { class: "cert-title" }, "Certificate of death · medical examiner"));
    const bs = bars(def, state, ctx());
    const agree = agreement(bs);

    // Time
    const t = el("div", { class: "cert-line" });
    t.append(el("h3", {}, "Time of death"));
    const chart = el("div", { class: "chart" });
    const draw = () =>
      (chart.innerHTML = evidenceChart({ bars: bs, span: SPAN, clock, agree, window: state.window, truth: state.signed ? def.truth.hoursDead : undefined }));
    draw();
    t.append(chart);
    const w = state.window ?? { from: 0, to: SPAN };
    const slider = (id: string, label: string, hours: number, set: (h: number) => void) => {
      const r = el("div", { class: "slider" });
      const input = el("input", { type: "range", id, min: "0", max: String(SPAN), step: String(STEP), value: String(SPAN - hours) }) as HTMLInputElement;
      input.disabled = state.signed;
      const out = el("output", { for: id }, state.window ? clock(hours) : "--:--");
      input.addEventListener("input", () => {
        set(SPAN - Number(input.value));
        out.textContent = clock(SPAN - Number(input.value));
      });
      input.addEventListener("change", () => render());
      r.append(el("label", { for: id }, label), input, out);
      return r;
    };
    let early = w.to, late = w.from;
    const push = () => {
      const r = step(def, state, { type: "window", from: Math.min(early, late), to: Math.max(early, late) }, ctx());
      state = r.state;
      ports.saveProgress(state);
      draw();
    };
    t.append(
      slider("win-early", "Earliest", early, (h) => ((early = h), push())),
      slider("win-late", "Latest", late, (h) => ((late = h), push())),
    );
    t.append(evidenceFor("time"));
    c.append(t);

    // Cause
    const ca = el("div", { class: "cert-line" });
    ca.append(el("h3", {}, "Cause of death"));
    const choices = el("div", { class: "choices", role: "radiogroup", "aria-label": "Cause of death" });
    for (const opt of def.causes) {
      const lab = el("label", { class: "choice" });
      const r = el("input", { type: "radio", name: "cause", value: opt.id, id: `cause-${opt.id}` }) as HTMLInputElement;
      r.checked = state.cause === opt.id;
      r.disabled = state.signed;
      r.addEventListener("change", () => apply({ type: "cause", value: opt.id }));
      lab.append(r, el("span", {}, opt.label));
      choices.append(lab);
    }
    ca.append(choices, evidenceFor("cause"));
    c.append(ca);

    // Manner
    const ma = el("div", { class: "cert-line" });
    ma.append(el("h3", {}, "Manner of death"));
    const mrow = el("div", { class: "manners", role: "radiogroup", "aria-label": "Manner of death" });
    for (const m of MANNERS) {
      const lab = el("label", { class: "choice" });
      const r = el("input", { type: "radio", name: "manner", value: m, id: `manner-${m}` }) as HTMLInputElement;
      r.checked = state.manner === m;
      r.disabled = state.signed;
      r.addEventListener("change", () => apply({ type: "manner", value: m as Manner }));
      lab.append(r, el("span", {}, m[0]!.toUpperCase() + m.slice(1)));
      mrow.append(lab);
    }
    ma.append(mrow, evidenceFor("manner"));
    c.append(ma);

    if (!state.signed) {
      const blockers = signBlockers(state);
      if (blockers.length) {
        const ul = el("ul", { class: "blockers" });
        blockers.forEach((b) => ul.append(el("li", {}, b)));
        c.append(ul);
      }
      const sign = button("Sign the certificate", () => apply({ type: "sign" }), "btn go", "sign");
      sign.disabled = blockers.length > 0;
      c.append(sign);
    }
    return c;
  }

  function debrief(s: Score): HTMLElement {
    const d = el("section", { class: `card debrief ${s.total >= 9 ? "hit" : "miss"}`, id: "debrief" });
    d.append(el("p", { class: "eyebrow" }, "Debrief"), el("p", { class: "total" }, `${s.total} / ${MAX_SCORE}`));
    const tiles = el("div", { class: "scores" });
    const tile = (name: string, v: number, max: number) => {
      const x = el("div", {});
      x.append(el("b", {}, `${v}/${max}`), el("span", {}, name));
      tiles.append(x);
    };
    tile("time", s.time, 3);
    tile("cause", s.cause, 3);
    tile("manner", s.manner, 3);
    tile("reasoning", s.reasoning, 2);
    tile("efficiency", s.efficiency, 1);
    d.append(tiles);
    const truthCause = def.causes.find((c) => c.id === def.truth.cause)?.label;
    const ul = el("ul", { class: "why" });
    ul.append(el("li", { class: s.hit ? "" : "off" }, `Death was at ${clock(def.truth.hoursDead)}. ${s.hit ? `Your window held it and was ${s.widthHours} h wide.` : "Your window missed it."}`));
    ul.append(el("li", { class: s.cause ? "" : "off" }, `Cause: ${truthCause}.`));
    ul.append(el("li", { class: s.manner === 3 ? "" : "off" }, `Manner: ${def.truth.manner}.`));
    for (const l of s.badLinks) ul.append(el("li", { class: "off" }, `${def.findings.find((f) => f.id === l.finding)?.label} doesn't support the ${l.line === "time" ? "time of death" : l.line} line.`));
    if (s.extra.length) ul.append(el("li", { class: "off" }, `Not needed for this case: ${s.extra.map((p) => def.procedures.find((x) => x.id === p)?.name).join(", ")}.`));
    if (s.review.length) ul.append(el("li", {}, `Review cards added: ${s.review.map(skillName).join(", ")}.`));
    d.append(ul, el("p", { class: "person" }, def.person), el("p", {}, def.story));
    const row = el("div", { class: "row" });
    const idx = pack.cases.findIndex((c) => c.id === def.id);
    const next = pack.cases[idx + 1];
    if (next) {
      const a = el("a", { class: "btn go", href: `case.html?case=${encodeURIComponent(next.id)}`, id: "next-case" }, `Next case: ${next.title}`);
      row.append(a);
    }
    row.append(el("a", { class: "btn ghost", href: "./" }, "All cases"));
    row.append(
      button("Play again", () => {
        state = startCase(def);
        lastScore = null;
        ports.saveProgress(null);
        location.reload();
      }, "btn ghost", "replay"),
    );
    d.append(row);
    queueMicrotask(() => d.scrollIntoView({ behavior: "smooth", block: "start" }));
    return d;
  }

  render();
}
