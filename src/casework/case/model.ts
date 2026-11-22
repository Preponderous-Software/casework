// A case, as data. Cases live in content packs (packs/<pack>/cases/*.json) and are validated by
// caseProblems() before play. Times are in HOURS BEFORE THE BODY WAS FOUND unless a field says
// otherwise, so a time-of-death window is a range of hours before "found".
import type { SkillId } from "../../kernel/skills.ts";

export type Line = "time" | "cause" | "manner";
export const LINES: readonly Line[] = ["time", "cause", "manner"];

export type Manner = "natural" | "accident" | "suicide" | "homicide" | "undetermined" | "pending";
export const MANNERS: readonly Manner[] = ["natural", "accident", "suicide", "homicide", "undetermined", "pending"];

export interface Procedure {
  id: string;
  name: string;
  /** Shift hours it takes. */
  hours: number;
  /** Lab budget it costs, in dollars. */
  cost: number;
  /** Procedures that must be done first. */
  requires?: string[];
  /** True when findings are revealed by examining body regions rather than all at once. */
  exam?: boolean;
  /** One line shown on the button, e.g. what it can and can't tell you. */
  blurb?: string;
}

/** How a finding becomes evidence once interpreted. */
export type Interp =
  /** A range of hours since death (rigor, livor, ...). */
  | { kind: "range"; from: number; to: number }
  /** Body cooling: hours = (98.6 − body) ÷ rate, ±1.5 h. The rate is 1.5 °F/h unless an
   * interpreted scene finding sets another (coolingRate). */
  | { kind: "cooling"; bodyTempF: number; roomTempF: number }
  /** Stomach contents: death was `from`–`to` hours after a meal eaten this long before found. */
  | { kind: "after-meal"; mealHoursBeforeFound: number; from: number; to: number }
  /** Someone saw or spoke to the person this long before found: death came after that. */
  | { kind: "alive-at"; hoursBeforeFound: number }
  /** Not timing evidence; may support cause or manner (see `supports`). */
  | { kind: "claim" };

export interface Support {
  line: "cause" | "manner";
  value: string;
}

export interface Finding {
  id: string;
  /** Procedure that reveals it. */
  procedure: string;
  /** For exam procedures: the body region to examine (head, jaw, neck, chest, abdomen, back,
   * left-arm, right-arm, left-leg, right-leg) and, optionally, the pose it needs. */
  region?: string;
  pose?: "supine" | "prone";
  /** Short name for chips and chart rows. */
  label: string;
  /** What is observed. */
  text: string;
  /** Skill needed to interpret it, or null when anyone can (e.g. a witness's statement). */
  skill: SkillId | null;
  /** What it means once interpreted. */
  meaning: string;
  interp: Interp;
  supports?: Support[];
  /** For scene findings: once interpreted, cooling evidence uses this rate (°F per hour). */
  coolingRate?: number;
}

export interface CaseDef {
  id: string;
  /** Order in the case list. */
  order: number;
  title: string;
  /** One line: who, where, when found. */
  intake: string;
  /** What the person who called it in said, and anything else known at the start. */
  context: string;
  /** Clock time the body was found, in hours (7.5 = 07:30). */
  foundAt: number;
  shift: { hours: number; budget: number };
  procedures: Procedure[];
  findings: Finding[];
  causes: { id: string; label: string }[];
  truth: {
    hoursDead: number;
    cause: string;
    manner: Manner;
    /** Partial credit (0–3) for other manners, e.g. { "pending": 1 }. */
    partialManner?: Partial<Record<Manner, number>>;
    /** The procedures a careful examiner needs. Doing others costs the efficiency point. */
    par: string[];
  };
  /** Shown in the debrief: who they were, and what happened. */
  person: string;
  story: string;
  /** Short content note shown before the case starts. */
  note?: string;
}

/** Problems with a case's data, as readable strings (empty when valid). */
export function caseProblems(c: CaseDef): string[] {
  const p: string[] = [];
  const at = (m: string) => p.push(`${c.id}: ${m}`);
  const procIds = new Set(c.procedures.map((x) => x.id));
  const findIds = new Set<string>();
  for (const pr of c.procedures) for (const r of pr.requires ?? []) if (!procIds.has(r)) at(`procedure ${pr.id} requires unknown ${r}`);
  for (const f of c.findings) {
    if (findIds.has(f.id)) at(`duplicate finding ${f.id}`);
    findIds.add(f.id);
    const pr = c.procedures.find((x) => x.id === f.procedure);
    if (!pr) at(`finding ${f.id} has unknown procedure ${f.procedure}`);
    else if (pr.exam && !f.region) at(`finding ${f.id} is in exam procedure ${pr.id} but has no region`);
    else if (!pr.exam && f.region) at(`finding ${f.id} has a region but ${pr.id} is not an exam`);
    for (const s of f.supports ?? []) {
      if (s.line === "cause" && !c.causes.some((x) => x.id === s.value)) at(`finding ${f.id} supports unknown cause ${s.value}`);
      if (s.line === "manner" && !MANNERS.includes(s.value as Manner)) at(`finding ${f.id} supports unknown manner ${s.value}`);
    }
  }
  if (!c.causes.some((x) => x.id === c.truth.cause)) at(`true cause ${c.truth.cause} is not in the cause list`);
  if (c.causes.length < 3) at("needs at least three causes to choose from");
  for (const id of c.truth.par) if (!procIds.has(id)) at(`par has unknown procedure ${id}`);
  const parHours = c.truth.par.reduce((h, id) => h + (c.procedures.find((x) => x.id === id)?.hours ?? 0), 0);
  const parCost = c.truth.par.reduce((h, id) => h + (c.procedures.find((x) => x.id === id)?.cost ?? 0), 0);
  if (parHours > c.shift.hours) at(`par needs ${parHours} h but the shift has ${c.shift.hours}`);
  if (parCost > c.shift.budget) at(`par costs $${parCost} but the budget is $${c.shift.budget}`);
  if (!c.findings.some((f) => f.supports?.some((s) => s.line === "cause" && s.value === c.truth.cause))) at("no finding supports the true cause");
  if (!c.findings.some((f) => f.supports?.some((s) => s.line === "manner" && s.value === c.truth.manner))) at("no finding supports the true manner");
  return p;
}
