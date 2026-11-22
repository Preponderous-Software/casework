// The time-of-death drill, as a phone-first web page. All rules come from the cores; this file only
// renders state and turns taps into calls.
import { evidenceFor, generateBody, overlap, roomText, rigorText, livorText, scoreWindow, stomachText, SKILL, type DrillBody, type Evidence } from "../../casework/drill.ts";
import { isCorrect, type Lesson } from "../../kernel/lessons.ts";
import type { Profile } from "../../kernel/profile.ts";
import { dueCards, enqueue, grade } from "../../kernel/review.ts";
import { afterLesson, afterReview, isKnown, type Mastery, type SkillId } from "../../kernel/skills.ts";
import type { Pack } from "./content.ts";
import { ICONS } from "./icons.ts";

/** Axis: hours before the body was found, from SPAN (left) to 0 (right). */
const SPAN = 16;
const STEP = 0.25;

export interface Ports {
  pack: Pack;
  profile: Profile;
  save(p: Profile): void;
  today(): number;
  seed(): number;
}

type Phase = { kind: "warmup"; queue: SkillId[]; i: number; answered: number | null } | { kind: "round" } | { kind: "debrief" };

export function startDrill(root: HTMLElement, ports: Ports, notice?: string): void {
  let profile = ports.profile;
  let body: DrillBody = generateBody(ports.seed());
  let windowFrom = 4; // slider positions on the axis (0 = SPAN hours before found)
  let windowTo = 14;
  let lesson: { lesson: Lesson; choice: number | null } | null = null;
  let phase: Phase = startPhase();

  function startPhase(): Phase {
    const due = dueCards(profile.cards, ports.today()).slice(0, 3).map((c) => c.skill);
    return due.length ? { kind: "warmup", queue: due, i: 0, answered: null } : { kind: "round" };
  }

  function commit(p: Profile) {
    profile = p;
    ports.save(p);
  }

  const lessonsFor = (skill: SkillId) => ports.pack.lessons.filter((l) => l.skill === skill);
  const skillName = (skill: SkillId) => ports.pack.skills.find((s) => s.id === skill)?.name ?? skill;
  const mastery = (skill: SkillId): Mastery => profile.skills[skill] ?? "unknown";
  const clock = (hoursBeforeFound: number) => fmt(body.foundAt - hoursBeforeFound);
  const toHours = (pos: number) => SPAN - pos;

  function render() {
    root.innerHTML = "";
    root.append(header());
    if (notice) {
      root.append(el("p", { class: "notice", role: "status" }, notice));
    }
    if (phase.kind === "warmup") root.append(warmup(phase));
    else root.append(round());
    if (lesson) root.append(lessonSheet());
  }

  // ---------- header: skill badges ----------
  function header(): HTMLElement {
    const h = el("header", { class: "top" });
    h.append(el("h1", {}, "Casework"), el("p", { class: "sub" }, "Time-of-death drill"));
    const badges = el("div", { class: "badges", "aria-label": "Your skills" });
    for (const s of ports.pack.skills) {
      const m = mastery(s.id);
      const b = el("span", { class: `badge m-${m}`, title: `${s.name}: ${label(m)}`, "aria-label": `${s.name}: ${label(m)}` });
      b.innerHTML = ICONS[s.icon] ?? "";
      badges.append(b);
    }
    const st = profile.stats;
    h.append(badges, el("p", { class: "stats" }, `${st.drills} drills · ${st.drillsHit} right · streak ${st.streak}`));
    return h;
  }

  // ---------- warm-up review ----------
  function warmup(p: Extract<Phase, { kind: "warmup" }>): HTMLElement {
    const skill = p.queue[p.i] as SkillId;
    const pool = lessonsFor(skill);
    const q = pool[1 + (profile.stats.drills % Math.max(1, pool.length - 1))] ?? pool[0];
    const sec = el("section", { class: "card" });
    sec.append(el("p", { class: "eyebrow" }, `Warm-up ${p.i + 1} of ${p.queue.length} · ${skillName(skill)}`));
    if (!q) {
      p.i++;
      return sec;
    }
    sec.append(el("p", { class: "prompt" }, q.prompt));
    sec.append(options(q, p.answered, (choice) => {
      const right = isCorrect(q, choice);
      const card = profile.cards.find((c) => c.skill === skill);
      commit({
        ...profile,
        skills: { ...profile.skills, [skill]: afterReview(mastery(skill), right) },
        cards: profile.cards.map((c) => (c === card ? grade(c, right, ports.today()) : c)),
      });
      phase = { ...p, answered: choice };
      render();
    }));
    if (p.answered !== null) {
      sec.append(explain(q, p.answered));
      const last = p.i + 1 >= p.queue.length;
      sec.append(button(last ? "Start the drill" : "Next", () => {
        phase = last ? { kind: "round" } : { ...p, i: p.i + 1, answered: null };
        render();
      }, "go"));
    }
    return sec;
  }

  // ---------- the round ----------
  function round(): HTMLElement {
    const wrap = el("div", { class: "round" });
    const intro = el("section", { class: "card" });
    intro.append(
      el("p", { class: "eyebrow" }, `Body found at ${fmt(body.foundAt)}`),
      el("p", {}, "Tap a finding to learn what it tells you. Each skill you know adds an evidence bar to the chart. Then set your time-of-death window and sign."),
    );
    wrap.append(intro);

    const mealClock = fmt(body.foundAt - (body.hoursDead + body.mealHoursBeforeDeath));
    const tiles: [SkillId, string, string][] = [
      [SKILL.algor, "thermometer", `Body ${body.bodyTempF.toFixed(1)} °F`],
      [SKILL.scene, "window", roomText(body)],
      [SKILL.rigor, "joint", rigorText(body.rigor)],
      [SKILL.livor, "drop", livorText(body.livor)],
      [SKILL.gastric, "clock", `${stomachText(body.stomach)}. Last meal at ${mealClock}, a friend says.`],
    ];
    const grid = el("div", { class: "tiles" });
    for (const [skill, icon, text] of tiles) {
      const m = mastery(skill);
      const known = isKnown(m);
      const t = el("button", { type: "button", class: `tile${known ? " known" : ""}`, id: `tile-${skill.split(".")[1]}`, disabled: phase.kind === "debrief" ? "" : null });
      const ic = el("span", { class: "ic" });
      ic.innerHTML = ICONS[icon] ?? "";
      t.append(ic, el("span", { class: "tx" }, text), el("span", { class: "st" }, known ? `${skillName(skill)} · ${label(m)}` : `Learn: ${skillName(skill)}`));
      t.addEventListener("click", () => {
        const l = lessonsFor(skill)[0];
        if (!l) return;
        lesson = { lesson: l, choice: null };
        render();
      });
      grid.append(t);
    }
    wrap.append(grid);
    wrap.append(chartCard());
    return wrap;
  }

  function chartCard(): HTMLElement {
    const ev = evidenceFor(body, profile.skills);
    const sec = el("section", { class: "card" });
    sec.append(el("p", { class: "eyebrow" }, "Evidence"));
    const holder = el("div", { class: "chart" });
    holder.innerHTML = chartSvg(ev);
    sec.append(holder);

    const done = phase.kind === "debrief";
    const row = (id: string, text: string, val: number, set: (v: number) => void) => {
      const r = el("div", { class: "slider" });
      const lab = el("label", { for: id }, text);
      const input = el("input", { type: "range", id, min: "0", max: String(SPAN), step: String(STEP), value: String(val), disabled: done ? "" : null }) as HTMLInputElement;
      const out = el("output", { for: id }, clock(toHours(val)));
      input.addEventListener("input", () => {
        set(Number(input.value));
        out.textContent = clock(toHours(Number(input.value)));
        holder.innerHTML = chartSvg(ev);
      });
      r.append(lab, input, out);
      return r;
    };
    sec.append(row("win-from", "Earliest", windowFrom, (v) => (windowFrom = v)), row("win-to", "Latest", windowTo, (v) => (windowTo = v)));

    if (!done) {
      sec.append(button("Sign the estimate", sign, "go", "sign"));
    } else {
      sec.append(debrief(ev));
    }
    return sec;
  }

  function sign() {
    const a = toHours(Math.max(windowFrom, windowTo));
    const b = toHours(Math.min(windowFrom, windowTo));
    const s = scoreWindow(body, a, b);
    const st = profile.stats;
    const streak = s.hit ? st.streak + 1 : 0;
    commit({ ...profile, stats: { drills: st.drills + 1, drillsHit: st.drillsHit + (s.hit ? 1 : 0), streak, bestStreak: Math.max(st.bestStreak, streak) } });
    phase = { kind: "debrief" };
    render();
    document.getElementById("debrief")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function debrief(ev: Evidence[]): HTMLElement {
    const a = toHours(Math.max(windowFrom, windowTo));
    const b = toHours(Math.min(windowFrom, windowTo));
    const s = scoreWindow(body, a, b);
    const d = el("div", { class: `debrief ${s.hit ? "hit" : "miss"}`, id: "debrief" });
    d.append(el("p", { class: "verdict" }, s.hit ? (s.points === 3 ? "Right, and tight." : "Right.") : "Missed."));
    d.append(el("p", {}, `Death was at ${clock(body.hoursDead)}, ${body.hoursDead} h before the body was found. Your window was ${clock(b)}–${clock(a)} (${s.widthHours} h): ${s.points} of 3 points.`));
    const ul = el("ul", { class: "why" });
    for (const e of ev) {
      const inside = body.hoursDead >= e.from && body.hoursDead <= e.to;
      ul.append(el("li", { class: inside ? "ok" : "off" }, `${e.label}: ${e.note}.${inside ? "" : " This bar missed the real time."}`));
    }
    const unknown = Object.values(SKILL).filter((k) => !isKnown(mastery(k)));
    if (unknown.length) ul.append(el("li", {}, `Not used yet: ${unknown.map(skillName).join(", ")}. Learning them adds evidence.`));
    if (body.room !== "normal" && !isKnown(mastery(SKILL.scene))) ul.append(el("li", { class: "off" }, `The room was ${body.room}, which changes how fast a body cools. The Scene conditions skill accounts for that.`));
    d.append(ul);
    d.append(el("p", { class: "fine" }, "Teaching approximations. Real estimates use corrected methods and give wide ranges."));
    d.append(button("Next body", () => {
      body = generateBody(ports.seed());
      windowFrom = 4;
      windowTo = 14;
      phase = startPhase();
      notice = undefined;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, "go", "next"));
    return d;
  }

  // ---------- lesson sheet ----------
  function lessonSheet(): HTMLElement {
    const cur = lesson!;
    const l = cur.lesson;
    const back = el("div", { class: "sheet-back" });
    const sheet = el("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": `Lesson: ${l.title}` });
    sheet.append(el("p", { class: "eyebrow" }, `Lesson · ${l.title}`), el("p", { class: "prompt" }, l.prompt));
    sheet.append(options(l, cur.choice, (choice) => {
      const right = isCorrect(l, choice);
      commit({ ...profile, skills: { ...profile.skills, [l.skill]: afterLesson(mastery(l.skill), right) }, cards: enqueue(profile.cards, l.skill, ports.today()) });
      lesson = { lesson: l, choice };
      render();
    }));
    if (cur.choice !== null) {
      sheet.append(explain(l, cur.choice));
      const right = isCorrect(l, cur.choice);
      sheet.append(el("p", { class: "fine" }, right ? "Skill learned. It comes back tomorrow as a review card." : "You learn this skill at novice level, so its evidence bar is wider. Pass its review card to narrow it."));
      sheet.append(button("Back to the body", () => {
        lesson = null;
        render();
      }, "go", "lesson-done"));
    } else {
      sheet.append(button("Not now", () => {
        lesson = null;
        render();
      }, "ghost"));
    }
    back.append(sheet);
    queueMicrotask(() => (sheet.querySelector("button") as HTMLButtonElement | null)?.focus({ preventScroll: true }));
    return back;
  }

  // ---------- shared bits ----------
  function options(l: Lesson, answered: number | null, pick: (i: number) => void): HTMLElement {
    const box = el("div", { class: "opts" });
    l.options.forEach((o, i) => {
      const cls = answered === null ? "opt" : i === l.answer ? "opt right" : i === answered ? "opt wrong" : "opt";
      const b = el("button", { type: "button", class: cls, id: `opt-${l.id}-${i}`, disabled: answered === null ? null : "" }, o);
      b.addEventListener("click", () => pick(i));
      box.append(b);
    });
    return box;
  }

  function explain(l: Lesson, choice: number): HTMLElement {
    const box = el("div", { class: "explain" });
    box.append(el("p", {}, `${isCorrect(l, choice) ? "Correct." : "Not quite."} ${l.explain}`));
    const src = el("details", { class: "src" });
    src.append(el("summary", {}, "Sources"), ...l.sources.map((s) => el("p", {}, s.cite)));
    box.append(src);
    return box;
  }

  function chartSvg(ev: Evidence[]): string {
    const W = 360, left = 76, right = 24, top = 14, rowH = 26;
    const rows = Math.max(ev.length, 1);
    const H = top + rows * rowH + 50;
    const x = (hoursBefore: number) => left + ((SPAN - hoursBefore) / SPAN) * (W - left - right);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evidence bars and your window">`;
    for (let h = SPAN; h >= 0; h -= 4) {
      s += `<line x1="${x(h)}" y1="${top - 6}" x2="${x(h)}" y2="${H - 30}" class="grid"/><text x="${x(h)}" y="${H - 14}" text-anchor="middle" class="axis">${clock(h)}</text>`;
    }
    if (!ev.length) s += `<text x="${left}" y="${top + 16}" class="axis">Learn a skill to add evidence.</text>`;
    ev.forEach((e, i) => {
      const y = top + i * rowH;
      const a = Math.min(SPAN, e.to), b = Math.max(0, e.from);
      s += `<text x="${left - 6}" y="${y + 14}" text-anchor="end" class="lab">${esc(e.label)}</text><rect x="${x(a)}" y="${y + 3}" width="${Math.max(2, x(b) - x(a))}" height="15" rx="4" class="bar m-${e.mastery}"/>`;
    });
    const o = overlap(ev);
    const yb = top + rows * rowH;
    if (ev.length >= 2 && o) {
      s += `<rect x="${x(Math.min(SPAN, o.to))}" y="${top - 2}" width="${Math.max(2, x(Math.max(0, o.from)) - x(Math.min(SPAN, o.to)))}" height="${yb - top}" class="overlap"/>`;
    }
    const wa = x(toHours(Math.min(windowFrom, windowTo))), wb = x(toHours(Math.max(windowFrom, windowTo)));
    s += `<rect x="${wa}" y="${yb + 2}" width="${Math.max(2, wb - wa)}" height="7" rx="3.5" class="win"/><text x="${left - 6}" y="${yb + 10}" text-anchor="end" class="lab">Yours</text>`;
    if (phase.kind === "debrief") s += `<line x1="${x(body.hoursDead)}" y1="${top - 8}" x2="${x(body.hoursDead)}" y2="${yb + 12}" class="truth"/>`;
    return s + "</svg>";
  }

  render();
}

// ---------- helpers ----------
function label(m: Mastery): string {
  return { unknown: "not learned", novice: "novice", practiced: "practiced", mastered: "mastered" }[m];
}

function fmt(clockHours: number): string {
  const t = ((clockHours % 24) + 24) % 24;
  let hh = Math.floor(t);
  let mm = Math.round((t - hh) * 60);
  if (mm === 60) {
    hh = (hh + 1) % 24;
    mm = 0;
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

function el(tag: string, attrs: Record<string, string | null> = {}, text?: string): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(text: string, onClick: () => void, kind: "go" | "ghost" = "go", id?: string): HTMLElement {
  const b = el("button", { type: "button", class: `btn ${kind}`, id: id ?? null }, text);
  b.addEventListener("click", onClick);
  return b;
}
