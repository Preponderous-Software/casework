// The time-of-death drill: a generated body with the classic early postmortem signs, the evidence a
// player can draw from each sign given their skills, and the score for the window they set.
//
// The ranges are TEACHING APPROXIMATIONS drawn from standard texts (see the lessons' sources). Real
// estimates use corrected methods such as Henssge's nomogram and carry wide uncertainty.
import { PRECISION, isKnown, type Mastery, type SkillId } from "../kernel/skills.ts";

export const SKILL = {
  algor: "forensics.algor-mortis",
  rigor: "forensics.rigor-mortis",
  livor: "forensics.livor-mortis",
  gastric: "forensics.gastric-contents",
  scene: "forensics.scene-conditions",
} as const satisfies Record<string, SkillId>;

/** A source of numbers in [0, 1). Passed in so drills are reproducible from a seed. */
export type Rng = () => number;

export type Room = "normal" | "cold" | "warm";
export type RigorStage = "absent" | "jaw" | "upper" | "full";
export type LivorStage = "faint" | "blanching" | "fixed";
export type StomachState = "full" | "partial" | "empty";

/** Everything the game knows about one drill body. `hoursDead` is the hidden truth. */
export interface DrillBody {
  seed: number;
  /** Clock hour (0–24, fractional) when the body was found. */
  foundAt: number;
  hoursDead: number;
  room: Room;
  roomTempF: number;
  bodyTempF: number;
  rigor: RigorStage;
  livor: LivorStage;
  /** Hours before death the last meal was eaten, and what the stomach shows. */
  mealHoursBeforeDeath: number;
  stomach: StomachState;
}

/** Cooling rate in °F per hour by room. 1.5 is the textbook rule of thumb. */
export const COOLING: Readonly<Record<Room, number>> = { normal: 1.5, cold: 2.0, warm: 1.0 };

/** Typical hours-since-death ranges for each stage (overlapping on purpose: biology varies). */
export const RIGOR_RANGE: Readonly<Record<RigorStage, [number, number]>> = {
  absent: [0, 3],
  jaw: [2, 4.5],
  upper: [3.5, 8.5],
  full: [7.5, 24],
};
export const LIVOR_RANGE: Readonly<Record<LivorStage, [number, number]>> = {
  faint: [0.5, 3],
  blanching: [2, 10],
  fixed: [8, 24],
};
/** Hours after the meal for each stomach state. */
export const STOMACH_RANGE: Readonly<Record<StomachState, [number, number]>> = {
  full: [0, 2],
  partial: [1, 6],
  empty: [4, 12],
};

/** Mulberry32: tiny, seedable, good enough for game content. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateBody(seed: number): DrillBody {
  const rng = seeded(seed);
  const between = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)] as T;

  const hoursDead = round(between(2, 14), 0.25);
  const room = pick<Room>(["normal", "normal", "normal", "cold", "warm"]);
  const roomTempF = room === "cold" ? round(between(45, 58), 1) : room === "warm" ? round(between(78, 86), 1) : round(between(66, 74), 1);
  const cooled = COOLING[room] * hoursDead + between(-0.4, 0.4);
  const bodyTempF = round(Math.max(roomTempF + 1, 98.6 - cooled), 0.1);
  const rigor = stageFor(hoursDead, rng, [
    ["absent", 0, 2.5],
    ["jaw", 2.5, 4],
    ["upper", 4, 8],
    ["full", 8, 99],
  ]);
  const livor = stageFor(hoursDead, rng, [
    ["faint", 0, 2.5],
    ["blanching", 2.5, 9],
    ["fixed", 9, 99],
  ]);
  const mealHoursBeforeDeath = round(between(0.5, 7), 0.5);
  const stomach: StomachState = mealHoursBeforeDeath < 1.5 ? "full" : mealHoursBeforeDeath < 5 ? "partial" : "empty";
  const foundAt = round(between(6, 10), 0.25);
  return { seed, foundAt, hoursDead, room, roomTempF, bodyTempF, rigor, livor, mealHoursBeforeDeath, stomach };
}

/** Pick the stage for `h`, blurring each boundary by up to half an hour so stages aren't a lookup
 * table the player can memorise to the minute. */
function stageFor<S extends string>(h: number, rng: Rng, bands: [S, number, number][]): S {
  const jitter = (rng() - 0.5);
  const x = h + jitter;
  for (const [s, lo, hi] of bands) if (x >= lo && x < hi) return s;
  return (bands[bands.length - 1] as [S, number, number])[0];
}

/** One evidence bar: a range of hours-since-death a finding supports. */
export interface Evidence {
  skill: SkillId;
  label: string;
  /** Hours since death (not clock time). */
  from: number;
  to: number;
  note: string;
  mastery: Exclude<Mastery, "unknown">;
}

/** The evidence a player draws from each finding. Findings whose skill the player doesn't know
 * yet give no bar. Mastery widens or narrows each bar around its centre. */
export function evidenceFor(body: DrillBody, skills: Partial<Record<SkillId, Mastery>>, mealKnownAt?: number): Evidence[] {
  const out: Evidence[] = [];
  const add = (skill: SkillId, label: string, lo: number, hi: number, note: string) => {
    const m = skills[skill];
    if (!isKnown(m)) return;
    const [a, b] = scale(lo, hi, PRECISION[m]);
    out.push({ skill, label, from: Math.max(0, a), to: b, note, mastery: m });
  };

  // Cooling. Without the scene skill the player uses the 1.5 °F/h rule whatever the room.
  const knowsScene = isKnown(skills[SKILL.scene]);
  const rate = knowsScene ? COOLING[body.room] : COOLING.normal;
  const est = (98.6 - body.bodyTempF) / rate;
  add(SKILL.algor, "Cooling", est - 1.5, est + 1.5, `${(98.6 - body.bodyTempF).toFixed(1)} °F lost at ${rate} °F/h ≈ ${est.toFixed(1)} h${knowsScene && body.room !== "normal" ? ` (rate adjusted for a ${body.room} room)` : ""}`);

  const [rl, rh] = RIGOR_RANGE[body.rigor];
  add(SKILL.rigor, "Rigor", rl, rh, `${rigorText(body.rigor)}: about ${rl}–${rh} h`);

  const [ll, lh] = LIVOR_RANGE[body.livor];
  add(SKILL.livor, "Livor", ll, lh, `${livorText(body.livor)}: about ${ll}–${lh} h`);

  // Stomach: hours after the meal, shifted by when the meal was eaten relative to finding the body.
  const mealBeforeFound = mealKnownAt ?? body.hoursDead + body.mealHoursBeforeDeath;
  const [sl, sh] = STOMACH_RANGE[body.stomach];
  add(SKILL.gastric, "Stomach", mealBeforeFound - sh, mealBeforeFound - sl, `${stomachText(body.stomach)}, meal ${mealBeforeFound.toFixed(1)} h before the body was found: rough at best`);

  return out;
}

function scale(lo: number, hi: number, k: number): [number, number] {
  const mid = (lo + hi) / 2;
  const half = ((hi - lo) / 2) * k;
  return [mid - half, mid + half];
}

/** Where all bars agree, or null if they don't overlap. */
export function overlap(ev: readonly Evidence[]): { from: number; to: number } | null {
  if (ev.length === 0) return null;
  const from = Math.max(...ev.map((e) => e.from));
  const to = Math.min(...ev.map((e) => e.to));
  return to > from ? { from, to } : null;
}

export interface DrillScore {
  hit: boolean;
  widthHours: number;
  /** 0–3: 3 = right and within 3 h, 2 = right within 6 h, 1 = right but wider, 0 = missed. */
  points: number;
}

/** Score a window given as hours-since-death [from, to]. */
export function scoreWindow(body: DrillBody, from: number, to: number): DrillScore {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const hit = body.hoursDead >= a && body.hoursDead <= b;
  const widthHours = round(b - a, 0.25);
  const points = !hit ? 0 : widthHours <= 3 ? 3 : widthHours <= 6 ? 2 : 1;
  return { hit, widthHours, points };
}

export function rigorText(s: RigorStage): string {
  return { absent: "No stiffness yet", jaw: "Stiff jaw and neck only", upper: "Stiff jaw and arms, legs still loose", full: "Fully stiff in all major joints" }[s];
}
export function livorText(s: LivorStage): string {
  return { faint: "Faint pink patches on the back", blanching: "Purple-red on the back, blanches under pressure", fixed: "Purple-red on the back, does not blanch" }[s];
}
export function stomachText(s: StomachState): string {
  return { full: "Stomach full, food barely digested", partial: "Stomach partly emptied, food partly digested", empty: "Stomach empty" }[s];
}
export function roomText(body: DrillBody): string {
  const extra = body.room === "cold" ? ", window open on a cold night" : body.room === "warm" ? ", heating turned up high" : "";
  return `Room ${body.roomTempF.toFixed(0)} °F${extra}`;
}

function round(n: number, step: number): number {
  return Math.round(n / step) * step;
}
