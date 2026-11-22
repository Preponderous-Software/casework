// Playing a case: a pure reducer. step(def, state, command, ctx) returns the next state and the
// events it produced; nothing here reads a clock, the DOM or storage. The player's skills come in
// through ctx, because they live in the learning kernel's profile, not in the case.
import { PRECISION, isKnown, type Mastery, type SkillId } from "../../kernel/skills.ts";
import type { CaseDef, Finding, Line, Manner } from "./model.ts";

export type Skills = Partial<Record<SkillId, Mastery>>;
export interface Ctx {
  skills: Skills;
}

export interface Link {
  finding: string;
  line: Line;
}

export interface CaseState {
  caseId: string;
  hoursLeft: number;
  budget: number;
  done: string[];
  revealed: string[];
  interpreted: string[];
  links: Link[];
  /** Time-of-death window in hours before found: from ≤ to. */
  window: { from: number; to: number } | null;
  cause: string | null;
  manner: Manner | null;
  signed: boolean;
}

export type Command =
  | { type: "run"; procedure: string }
  | { type: "examine"; region: string; pose: "supine" | "prone" }
  | { type: "interpret"; finding: string }
  | { type: "link"; finding: string; line: Line }
  | { type: "unlink"; finding: string; line: Line }
  | { type: "window"; from: number; to: number }
  | { type: "cause"; value: string }
  | { type: "manner"; value: Manner }
  | { type: "sign" };

export type Event =
  | { type: "ran"; procedure: string; revealed: string[] }
  | { type: "revealed"; finding: string }
  | { type: "nothing-new"; region: string }
  | { type: "interpreted"; finding: string }
  | { type: "needs-skill"; finding: string; skill: SkillId }
  | { type: "linked"; finding: string; line: Line }
  | { type: "unlinked"; finding: string; line: Line }
  | { type: "updated"; field: "window" | "cause" | "manner" }
  | { type: "signed"; score: Score }
  | { type: "rejected"; reason: string };

export interface Step {
  state: CaseState;
  events: Event[];
}

export function startCase(def: CaseDef): CaseState {
  return {
    caseId: def.id,
    hoursLeft: def.shift.hours,
    budget: def.shift.budget,
    done: [],
    revealed: [],
    interpreted: [],
    links: [],
    window: null,
    cause: null,
    manner: null,
    signed: false,
  };
}

const reject = (state: CaseState, reason: string): Step => ({ state, events: [{ type: "rejected", reason }] });

export function step(def: CaseDef, s: CaseState, cmd: Command, ctx: Ctx): Step {
  if (s.signed) return reject(s, "The certificate is already signed.");
  const finding = (id: string) => def.findings.find((f) => f.id === id);

  switch (cmd.type) {
    case "run": {
      const p = def.procedures.find((x) => x.id === cmd.procedure);
      if (!p) return reject(s, `There is no procedure called ${cmd.procedure}.`);
      if (s.done.includes(p.id)) return reject(s, `${p.name} is already done.`);
      const missing = (p.requires ?? []).filter((r) => !s.done.includes(r));
      if (missing.length) return reject(s, `${p.name} needs ${missing.map((m) => def.procedures.find((x) => x.id === m)?.name ?? m).join(" and ")} first.`);
      if (s.hoursLeft < p.hours) return reject(s, `${p.name} takes ${p.hours} h and only ${s.hoursLeft} h are left in the shift.`);
      if (s.budget < p.cost) return reject(s, `${p.name} costs $${p.cost} and only $${s.budget} is left.`);
      const revealed = def.findings.filter((f) => f.procedure === p.id && !f.region).map((f) => f.id);
      return {
        state: { ...s, done: [...s.done, p.id], hoursLeft: s.hoursLeft - p.hours, budget: s.budget - p.cost, revealed: [...s.revealed, ...revealed] },
        events: [{ type: "ran", procedure: p.id, revealed }],
      };
    }

    case "examine": {
      const exams = def.procedures.filter((p) => p.exam && s.done.includes(p.id)).map((p) => p.id);
      if (!exams.length) return reject(s, "Run the external exam before examining the body.");
      const here = def.findings.filter((f) => exams.includes(f.procedure) && f.region === cmd.region);
      const fresh = here.filter((f) => !s.revealed.includes(f.id) && (!f.pose || f.pose === cmd.pose));
      if (!fresh.length) {
        const turned = here.find((f) => !s.revealed.includes(f.id) && f.pose && f.pose !== cmd.pose);
        if (turned) return reject(s, turned.pose === "prone" ? "Turn the body over to examine that." : "Turn the body face up to examine that.");
        return { state: s, events: [{ type: "nothing-new", region: cmd.region }] };
      }
      return { state: { ...s, revealed: [...s.revealed, ...fresh.map((f) => f.id)] }, events: fresh.map((f) => ({ type: "revealed", finding: f.id }) as Event) };
    }

    case "interpret": {
      const f = finding(cmd.finding);
      if (!f || !s.revealed.includes(f.id)) return reject(s, "That finding hasn't been found yet.");
      if (s.interpreted.includes(f.id)) return reject(s, "Already interpreted.");
      if (f.skill && !isKnown(ctx.skills[f.skill])) return { state: s, events: [{ type: "needs-skill", finding: f.id, skill: f.skill }] };
      return { state: { ...s, interpreted: [...s.interpreted, f.id] }, events: [{ type: "interpreted", finding: f.id }] };
    }

    case "link": {
      if (!s.interpreted.includes(cmd.finding)) return reject(s, "Interpret a finding before using it as evidence.");
      if (s.links.some((l) => l.finding === cmd.finding && l.line === cmd.line)) return reject(s, "Already linked.");
      return { state: { ...s, links: [...s.links, { finding: cmd.finding, line: cmd.line }] }, events: [{ type: "linked", finding: cmd.finding, line: cmd.line }] };
    }

    case "unlink": {
      const links = s.links.filter((l) => !(l.finding === cmd.finding && l.line === cmd.line));
      if (links.length === s.links.length) return reject(s, "That link doesn't exist.");
      return { state: { ...s, links }, events: [{ type: "unlinked", finding: cmd.finding, line: cmd.line }] };
    }

    case "window": {
      if (![cmd.from, cmd.to].every(Number.isFinite)) return reject(s, "The window needs two times.");
      const from = Math.max(0, Math.min(cmd.from, cmd.to));
      const to = Math.max(cmd.from, cmd.to);
      return { state: { ...s, window: { from, to } }, events: [{ type: "updated", field: "window" }] };
    }

    case "cause": {
      if (!def.causes.some((c) => c.id === cmd.value)) return reject(s, `${cmd.value} is not one of this case's causes.`);
      return { state: { ...s, cause: cmd.value }, events: [{ type: "updated", field: "cause" }] };
    }

    case "manner": {
      return { state: { ...s, manner: cmd.value }, events: [{ type: "updated", field: "manner" }] };
    }

    case "sign": {
      const missing = signBlockers(s);
      if (missing.length) return reject(s, missing.join(" "));
      const signed = { ...s, signed: true };
      return { state: signed, events: [{ type: "signed", score: score(def, signed, ctx) }] };
    }
  }
}

/** What still stops the certificate being signed, as sentences (empty when it can be). */
export function signBlockers(s: CaseState): string[] {
  const out: string[] = [];
  if (!s.window) out.push("Set a time-of-death window.");
  if (!s.cause) out.push("Choose a cause of death.");
  if (!s.manner) out.push("Choose a manner of death.");
  for (const line of ["time", "cause", "manner"] as const) {
    if (!s.links.some((l) => l.line === line)) out.push(`Link at least one finding to the ${line === "time" ? "time of death" : line} line.`);
  }
  return out;
}

// ---------- evidence ----------

export interface Bar {
  finding: string;
  label: string;
  /** Hours before found. */
  from: number;
  to: number;
  note: string;
  mastery: Exclude<Mastery, "unknown"> | "given";
}

/** Timing evidence from every interpreted finding, widened or narrowed by skill level. */
export function bars(def: CaseDef, s: CaseState, ctx: Ctx): Bar[] {
  const rate = def.findings.find((f) => f.coolingRate !== undefined && s.interpreted.includes(f.id))?.coolingRate ?? 1.5;
  const out: Bar[] = [];
  for (const f of def.findings) {
    if (!s.interpreted.includes(f.id)) continue;
    const r = rawInterval(f, rate);
    if (!r) continue;
    const m = f.skill ? ctx.skills[f.skill] : undefined;
    const mastery = f.skill && isKnown(m) ? m : "given";
    const k = mastery === "given" ? 1 : PRECISION[mastery];
    const mid = (r.from + r.to) / 2;
    const half = ((r.to - r.from) / 2) * k;
    out.push({ finding: f.id, label: f.label, from: Math.max(0, mid - half), to: mid + half, note: r.note, mastery });
  }
  return out;
}

function rawInterval(f: Finding, rate: number): { from: number; to: number; note: string } | null {
  const i = f.interp;
  switch (i.kind) {
    case "range":
      return { from: i.from, to: i.to, note: `about ${i.from}–${i.to} h` };
    case "cooling": {
      const lost = 98.6 - i.bodyTempF;
      const h = lost / rate;
      return { from: h - 1.5, to: h + 1.5, note: `${lost.toFixed(1)} °F lost at ${rate} °F/h ≈ ${h.toFixed(1)} h` };
    }
    case "after-meal":
      return { from: i.mealHoursBeforeFound - i.to, to: i.mealHoursBeforeFound - i.from, note: `${i.from}–${i.to} h after a meal ${i.mealHoursBeforeFound} h before found` };
    case "alive-at":
      return { from: 0, to: i.hoursBeforeFound, note: `alive ${i.hoursBeforeFound} h before found` };
    case "claim":
      return null;
  }
}

/** Where all bars agree, or null. */
export function agreement(bs: readonly Bar[]): { from: number; to: number } | null {
  if (!bs.length) return null;
  const from = Math.max(...bs.map((b) => b.from));
  const to = Math.min(...bs.map((b) => b.to));
  return to > from ? { from, to } : null;
}

// ---------- scoring ----------

export interface Score {
  time: number; // 0–3
  cause: number; // 0–3
  manner: number; // 0–3
  reasoning: number; // 0–2
  efficiency: number; // 0–1
  total: number; // 0–12
  hit: boolean;
  widthHours: number;
  /** Links that didn't support what they were linked to. */
  badLinks: Link[];
  /** Skills to review because of a mistake. */
  review: SkillId[];
  /** Procedures done beyond par. */
  extra: string[];
}

export const MAX_SCORE = 12;

/** Does this link support the line it's on, given what the player chose? */
export function linkHolds(def: CaseDef, s: CaseState, l: Link): boolean {
  const f = def.findings.find((x) => x.id === l.finding);
  if (!f) return false;
  if (l.line === "time") return f.interp.kind !== "claim";
  const chosen = l.line === "cause" ? s.cause : s.manner;
  return !!chosen && !!f.supports?.some((x) => x.line === l.line && x.value === chosen);
}

export function score(def: CaseDef, s: CaseState, _ctx: Ctx): Score {
  const t = def.truth;
  const w = s.window ?? { from: 0, to: 0 };
  const hit = t.hoursDead >= w.from && t.hoursDead <= w.to;
  const widthHours = Math.round((w.to - w.from) * 4) / 4;
  const time = !hit ? 0 : widthHours <= 3 ? 3 : widthHours <= 6 ? 2 : 1;
  const cause = s.cause === t.cause ? 3 : 0;
  const manner = s.manner === t.manner ? 3 : (s.manner && t.partialManner?.[s.manner]) || 0;

  const badLinks = s.links.filter((l) => !linkHolds(def, s, l));
  const everyLineHeld = (["time", "cause", "manner"] as const).every((line) => s.links.some((l) => l.line === line && linkHolds(def, s, l)));
  const reasoning = everyLineHeld ? (badLinks.length ? 1 : 2) : 0;

  const extra = s.done.filter((p) => !t.par.includes(p));
  const efficiency = extra.length ? 0 : 1;

  const review = new Set<SkillId>();
  const skillFor = (line: "cause" | "manner", value: string) => def.findings.find((f) => f.skill && f.supports?.some((x) => x.line === line && x.value === value))?.skill;
  if (!cause) {
    const k = skillFor("cause", t.cause);
    if (k) review.add(k);
  }
  if (manner < 3) {
    const k = skillFor("manner", t.manner);
    if (k) review.add(k);
  }
  for (const l of badLinks) {
    const k = def.findings.find((f) => f.id === l.finding)?.skill;
    if (k) review.add(k);
  }
  if (!hit) for (const f of def.findings) if (f.interp.kind !== "claim" && f.skill && s.interpreted.includes(f.id)) review.add(f.skill);

  const total = time + cause + manner + reasoning + efficiency;
  return { time, cause, manner, reasoning, efficiency, total, hit, widthHours, badLinks, review: [...review], extra };
}

/** All skills a case can use, in finding order. */
export function caseSkills(def: CaseDef): SkillId[] {
  return [...new Set(def.findings.map((f) => f.skill).filter((k): k is SkillId => !!k))];
}
