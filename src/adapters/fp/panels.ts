// The overlays the world opens: the intake board, the notebook, the desk terminal (findings,
// certificate, sign), the reference shelf, read-outs and the debrief. They reuse the classic
// page's pieces (evidence chart, lesson sheet, DOM helpers, icons) and send every change through
// the case reducer, so scoring is exactly the classic game's.
import { toClock } from "../../casework/case/clock.ts";
import { MANNERS, type CaseDef, type Line, type Manner } from "../../casework/case/model.ts";
import { agreement, bars, linkHolds, MAX_SCORE, signBlockers, type CaseState, type Command, type Event, type Score } from "../../casework/case/play.ts";
import type { Profile } from "../../kernel/profile.ts";
import { isKnown, type SkillId } from "../../kernel/skills.ts";
import { evidenceChart } from "../web/chart.ts";
import type { Pack } from "../web/content.ts";
import { button, el, masteryLabel, scoreRing } from "../web/dom.ts";
import { ICONS } from "../web/icons.ts";

const SPAN = 16;
const STEP = 0.25;
const LINE_NAME: Record<Line, string> = { time: "Time", cause: "Cause", manner: "Manner" };

export interface Panel {
  body: HTMLElement;
  close(): void;
}

let current: { back: HTMLElement; onClose: () => void } | null = null;

export const panelOpen = () => current !== null;

/** Open a panel over the world. Esc or the close button closes it. */
export function openPanel(root: HTMLElement, title: string, eyebrow: string, onClose: () => void, id = "fp-panel"): Panel {
  closePanel();
  const back = el("div", { class: "fp-panel-back" });
  const panel = el("section", { class: "fp-panel", role: "dialog", "aria-modal": "true", "aria-label": title, id });
  const head = el("header", { class: "fp-panel-head" });
  const t = el("div", {});
  t.append(el("p", { class: "eyebrow" }, eyebrow), el("h2", {}, title));
  const x = button("Close", () => closePanel(), "btn ghost", "fp-close");
  head.append(t, x);
  const body = el("div", { class: "fp-panel-body" });
  panel.append(head, body);
  back.append(panel);
  back.addEventListener("click", (e) => {
    if (e.target === back) closePanel();
  });
  root.append(back);
  current = { back, onClose };
  queueMicrotask(() => x.focus({ preventScroll: true }));
  return { body, close: closePanel };
}

export function closePanel(): void {
  if (!current) return;
  const c = current;
  current = null;
  c.back.remove();
  c.onClose();
}

// ---------------------------------------------------------------- case context

export interface CaseCtx {
  pack: Pack;
  def: CaseDef;
  state(): CaseState;
  profile(): Profile;
  /** Findings the notebook may show (scene findings only once looked at). */
  visible(): string[];
  apply(cmd: Command): Event[];
  /** Interpret a finding, running a lesson first if the skill is missing; then `after`. */
  interpret(fid: string, after: () => void): void;
}

export const skillName = (pack: Pack, k: SkillId) => pack.skills.find((s) => s.id === k)?.name ?? k;
const skillIcon = (pack: Pack, k: SkillId | null) => (k ? ICONS[pack.skills.find((s) => s.id === k)?.icon ?? ""] : ICONS.scale) ?? "";

function meters(c: CaseCtx): HTMLElement {
  const s = c.state();
  const box = el("div", { class: "meters" });
  const meter = (label: string, value: string, frac: number) => {
    const m = el("div", { class: "meter-box" });
    const bar = el("div", { class: "meter-bar" });
    bar.append(el("span", { style: `width:${Math.round(frac * 100)}%` }));
    m.append(el("span", {}, label), el("b", {}, value), bar);
    return m;
  };
  box.append(meter("Shift left", `${s.hoursLeft} h`, s.hoursLeft / c.def.shift.hours), meter("Lab budget", `$${s.budget}`, c.def.shift.budget ? s.budget / c.def.shift.budget : 0));
  return box;
}

function procedureList(c: CaseCtx): HTMLElement {
  const s = c.state();
  const ul = el("ul", { class: "fp-procs" });
  for (const p of c.def.procedures) {
    const done = s.done.includes(p.id);
    ul.append(el("li", { class: done ? "done" : "" }, `${done ? "✓" : "○"} ${p.name} · ${p.hours} h${p.cost ? ` · $${p.cost}` : ""}`));
  }
  return ul;
}

/** The findings list with Interpret / Learn and the Time, Cause, Manner link chips. */
export function findingsList(c: CaseCtx, rerender: () => void): HTMLElement {
  const s = c.state();
  const sec = el("section", { class: "card", id: "findings" });
  const vis = c.visible();
  sec.append(el("p", { class: "eyebrow" }, `Findings (${vis.length})`));
  if (!vis.length) {
    sec.append(el("p", { class: "fine" }, "Nothing yet. Look around the scene, examine the body, and run procedures to find evidence."));
    return sec;
  }
  sec.append(el("p", { class: "fine" }, "Interpret a finding to learn what it means, then tap Time, Cause or Manner to use it as evidence on the certificate."));
  const list = el("div", { class: "findings" });
  for (const fid of [...vis].reverse()) {
    const f = c.def.findings.find((x) => x.id === fid)!;
    const card = el("div", { class: "finding", id: `finding-${fid}` });
    const ic = el("span", { class: "ic" });
    ic.innerHTML = skillIcon(c.pack, f.skill);
    card.append(ic, el("span", { class: "lbl" }, f.label), el("p", {}, f.text));
    if (!s.interpreted.includes(fid)) {
      const known = !f.skill || isKnown(c.profile().skills[f.skill]);
      const b = button(known ? "Interpret" : `Learn: ${skillName(c.pack, f.skill!)}`, () => c.interpret(fid, rerender), known ? "btn go" : "btn ghost", `interpret-${fid}`);
      b.disabled = s.signed;
      card.append(b);
    } else {
      const m = f.skill ? c.profile().skills[f.skill] : undefined;
      card.append(el("p", { class: "meaning" }, `${f.meaning}${f.skill && m ? ` (${skillName(c.pack, f.skill)}: ${masteryLabel(m)})` : ""}`));
      const chips = el("div", { class: "link-chips", role: "group", "aria-label": `Use ${f.label} as evidence for` });
      for (const line of ["time", "cause", "manner"] as Line[]) {
        const on = s.links.some((l) => l.finding === fid && l.line === line);
        const cls = s.signed && on ? (linkHolds(c.def, s, { finding: fid, line }) ? "link-chip held" : "link-chip broke") : "link-chip";
        const chip = el("button", { type: "button", class: cls, "aria-pressed": String(on), id: `link-${fid}-${line}` }, on ? `${LINE_NAME[line]} ✓` : LINE_NAME[line]) as HTMLButtonElement;
        chip.disabled = s.signed;
        chip.addEventListener("click", () => {
          c.apply({ type: on ? "unlink" : "link", finding: fid, line });
          rerender();
        });
        chips.append(chip);
      }
      card.append(chips);
    }
    list.append(card);
  }
  sec.append(list);
  return sec;
}

/** The notebook: the case at a glance and the findings. */
export function renderNotebook(body: HTMLElement, c: CaseCtx | null, objective: string): void {
  body.innerHTML = "";
  if (!c) {
    body.append(el("p", {}, "No case on your desk yet."), el("p", { class: "fine" }, objective));
    return;
  }
  const rerender = () => renderNotebook(body, c, objective);
  const intro = el("section", { class: "card" });
  intro.append(el("p", { class: "eyebrow" }, `Found at ${toClock(c.def.foundAt, 0)}`), el("p", {}, c.def.intake), el("p", { class: "fine" }, c.def.context), meters(c), procedureList(c));
  body.append(intro, findingsList(c, rerender));
}

/** The desk terminal: findings and the certificate. */
export function renderDesk(body: HTMLElement, c: CaseCtx, onSigned: () => void): void {
  body.innerHTML = "";
  const rerender = () => renderDesk(body, c, onSigned);
  body.append(meters(c), findingsList(c, rerender), certificate(c, rerender, onSigned));
}

function evidenceFor(c: CaseCtx, line: Line): HTMLElement {
  const s = c.state();
  const box = el("div", { class: "evid" });
  const ls = s.links.filter((l) => l.line === line);
  if (!ls.length) box.append(el("span", { class: "none" }, "No evidence linked yet."));
  for (const l of ls) {
    const f = c.def.findings.find((x) => x.id === l.finding)!;
    const cls = s.signed ? (linkHolds(c.def, s, l) ? "pill ok" : "pill bad") : "pill";
    box.append(el("span", { class: cls }, f.label));
  }
  return box;
}

function certificate(c: CaseCtx, rerender: () => void, onSigned: () => void): HTMLElement {
  const def = c.def;
  const s = c.state();
  const clock = (h: number) => toClock(def.foundAt, h);
  const cert = el("section", { class: "cert", id: "certificate" });
  cert.append(el("p", { class: "cert-title" }, "Certificate of death · medical examiner"));
  const bs = bars(def, s, { skills: c.profile().skills });
  const agree = agreement(bs);

  const t = el("div", { class: "cert-line" });
  t.append(el("h3", {}, "Time of death"));
  const chart = el("div", { class: "chart" });
  const draw = () => (chart.innerHTML = evidenceChart({ bars: bs, span: SPAN, clock, agree, window: c.state().window, truth: c.state().signed ? def.truth.hoursDead : undefined }));
  draw();
  t.append(chart);
  const w = s.window ?? { from: 0, to: SPAN };
  let early = w.to, late = w.from;
  const push = () => {
    c.apply({ type: "window", from: Math.min(early, late), to: Math.max(early, late) });
    draw();
  };
  const slider = (id: string, label: string, hours: number, set: (h: number) => void) => {
    const r = el("div", { class: "slider" });
    const input = el("input", { type: "range", id, min: "0", max: String(SPAN), step: String(STEP), value: String(SPAN - hours) }) as HTMLInputElement;
    input.disabled = s.signed;
    const out = el("output", { for: id }, s.window ? clock(hours) : "--:--");
    input.addEventListener("input", () => {
      set(SPAN - Number(input.value));
      out.textContent = clock(SPAN - Number(input.value));
    });
    input.addEventListener("change", rerender);
    r.append(el("label", { for: id }, label), input, out);
    return r;
  };
  t.append(slider("win-early", "Earliest", early, (h) => ((early = h), push())), slider("win-late", "Latest", late, (h) => ((late = h), push())), evidenceFor(c, "time"));
  cert.append(t);

  const ca = el("div", { class: "cert-line" });
  ca.append(el("h3", {}, "Cause of death"));
  const choices = el("div", { class: "choices", role: "radiogroup", "aria-label": "Cause of death" });
  for (const opt of def.causes) {
    const lab = el("label", { class: "choice" });
    const r = el("input", { type: "radio", name: "cause", value: opt.id, id: `cause-${opt.id}` }) as HTMLInputElement;
    r.checked = s.cause === opt.id;
    r.disabled = s.signed;
    r.addEventListener("change", () => {
      c.apply({ type: "cause", value: opt.id });
      rerender();
    });
    lab.append(r, el("span", {}, opt.label));
    choices.append(lab);
  }
  ca.append(choices, evidenceFor(c, "cause"));
  cert.append(ca);

  const ma = el("div", { class: "cert-line" });
  ma.append(el("h3", {}, "Manner of death"));
  const mrow = el("div", { class: "manners", role: "radiogroup", "aria-label": "Manner of death" });
  for (const m of MANNERS) {
    const lab = el("label", { class: "choice" });
    const r = el("input", { type: "radio", name: "manner", value: m, id: `manner-${m}` }) as HTMLInputElement;
    r.checked = s.manner === m;
    r.disabled = s.signed;
    r.addEventListener("change", () => {
      c.apply({ type: "manner", value: m as Manner });
      rerender();
    });
    lab.append(r, el("span", {}, m[0]!.toUpperCase() + m.slice(1)));
    mrow.append(lab);
  }
  ma.append(mrow, evidenceFor(c, "manner"));
  cert.append(ma);

  if (!s.signed) {
    const blockers = signBlockers(s);
    if (blockers.length) {
      const ul = el("ul", { class: "blockers" });
      blockers.forEach((b) => ul.append(el("li", {}, b)));
      cert.append(ul);
    }
    const sign = button("Sign the certificate", () => {
      const ev = c.apply({ type: "sign" });
      if (ev.some((e) => e.type === "signed")) onSigned();
      else rerender();
    }, "btn go", "sign");
    sign.disabled = blockers.length > 0;
    cert.append(sign);
  }
  return cert;
}

/** The debrief after signing. */
export function renderDebrief(body: HTMLElement, pack: Pack, def: CaseDef, s: Score, onDone: () => void): void {
  body.innerHTML = "";
  const clock = (h: number) => toClock(def.foundAt, h);
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
  if (s.review.length) ul.append(el("li", {}, `Review cards added: ${s.review.map((k) => skillName(pack, k)).join(", ")}.`));
  d.append(ul, el("p", { class: "person" }, def.person), el("p", {}, def.story));
  const row = el("div", { class: "row" });
  row.append(button("Back to work", onDone, "btn go", "fp-debrief-done"));
  d.append(row);
  body.append(d);
}

/** The intake board: cases to take, with best scores. */
export function renderBoard(
  body: HTMLElement,
  pack: Pack,
  open: string[],
  profile: Profile,
  active: string | null,
  states: Record<string, CaseState>,
  onTake: (id: string, fresh: boolean) => void,
): void {
  body.innerHTML = "";
  body.append(el("p", { class: "fine" }, "Content note: these cases describe deaths, including a violent one, in clinical words. There are no graphic images."));
  const list = el("div", { class: "cases" });
  for (const id of open) {
    const c = pack.cases.find((x) => x.id === id);
    if (!c) continue;
    const rec = profile.records[`case:${c.id}`];
    const s = states[c.id];
    const card = el("div", { class: "card fp-case", id: `board-${c.id}` });
    const head = el("div", { class: "fp-case-head" });
    const txt = el("div", {});
    txt.append(el("p", { class: "eyebrow" }, c.id === active ? "On your desk" : s && !s.signed ? "In progress" : rec ? "Signed" : "New"), el("h3", {}, c.title), el("p", {}, c.intake));
    const ring = el("span", {});
    if (rec) ring.innerHTML = scoreRing(rec.best, MAX_SCORE);
    head.append(txt, ring);
    card.append(head);
    if (c.note) card.append(el("p", { class: "notice" }, c.note));
    const row = el("div", { class: "row" });
    if (c.id === active) row.append(el("span", { class: "pill" }, "Your current case"));
    else if (s && !s.signed) row.append(button("Pick it back up", () => onTake(c.id, false), "btn go", `take-${c.id}`));
    else row.append(button(rec ? "Work it again" : "Take this case", () => onTake(c.id, true), "btn go", `take-${c.id}`));
    card.append(row);
    list.append(card);
  }
  body.append(list);
}

/** The reference shelf: one book per skill; the active case's skills first. */
export function renderShelf(body: HTMLElement, pack: Pack, profile: Profile, caseSkills: SkillId[], onOpen: (skill: SkillId) => void): void {
  body.innerHTML = "";
  body.append(el("p", { class: "fine" }, "Each book is a one-question lesson. Learning a skill lets you interpret findings that need it, and better skills give tighter time-of-death evidence."));
  const grid = el("div", { class: "fp-shelf" });
  const order = [...pack.skills].sort((a, b) => Number(caseSkills.includes(b.id)) - Number(caseSkills.includes(a.id)));
  for (const s of order) {
    const m = profile.skills[s.id] ?? "unknown";
    const b = el("button", { type: "button", class: "tile", id: `book-${s.id.split(".")[1]}` }) as HTMLButtonElement;
    const ic = el("span", { class: "ic" });
    ic.innerHTML = ICONS[s.icon] ?? "";
    b.append(ic, el("b", {}, s.name), el("span", { class: "st" }, `${masteryLabel(m)}${caseSkills.includes(s.id) ? " · this case" : ""}`));
    b.addEventListener("click", () => onOpen(s.id));
    grid.append(b);
  }
  body.append(grid);
}
