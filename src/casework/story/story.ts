// The first-person campaign, "First week": a pure reducer over story events. No DOM, no storage.
//
// Day 1 (Monday) is arrival and orientation; days 2–4 each bring one case, in the order
// night-shift → kitchen-floor → basement-stairs; day 5 (Friday) is the end of the week, when every
// case is open to replay. Each day runs through beats:
//
//   day 1:    arrive → meet-mentor → tour → evening
//   days 2–4: morning → case → debrief → evening
//   day 5:    end
//
// "evening" ends when the player reads that evening's note on their desk, which starts the next day.
// The engine drives it: call storyStep() for every event and show the returned `say` lines; call
// objective() for the HUD's NEXT line; readText(resolveText(state, id)) for readable props.
import { MAX_SCORE } from "../case/play.ts";
import { storyContent, toLines, type Line } from "./content.ts";

export type { Line } from "./content.ts";

export interface StoryState {
  version: 1;
  day: number;
  beat: string;
  /** Things that have happened, as prefixed keys: "read:<text>", "talk:<npc>", "proc:<case>:<procedure>",
   * "find:<case>:<finding>", "said:<say key>", "signed:<case>:<score>", "started:<case>". */
  seen: string[];
  /** "met:<npc>", "active:<case>", "at:<location>", "timelineFlagged". */
  flags: Record<string, boolean>;
}

export type StoryEvent =
  | { kind: "enter"; location: string }
  | { kind: "read"; text: string }
  | { kind: "talk"; npc: string }
  | { kind: "case-started"; caseId: string }
  | { kind: "procedure"; caseId: string; procedure: string }
  | { kind: "finding"; caseId: string; finding: string }
  | { kind: "signed"; caseId: string; score: number };

export const NPCS: Record<string, { name: string; role: string }> = {
  mentor: { name: "Dr. Miriam Achterberg", role: "Senior forensic pathologist, and your mentor this week" },
  investigator: { name: "Ray Delgado", role: "Medicolegal death investigator; drives the van and runs scenes" },
  tech: { name: "Priya Natarajan", role: "Lab technician; runs toxicology" },
  neighbor: { name: "Walt Brennan", role: "Marcus Hale's neighbor, who found him" },
  daughter: { name: "Ruth Alder", role: "Eleanor Voss's daughter, who found her" },
  caller: { name: "Lena Ortiz", role: "Tomás Ortiz's wife, who called for help" },
};

/** How a witness is named in an objective ("Talk to Walt Brennan, the neighbor"). */
const WITNESS_AS: Record<string, string> = { neighbor: "the neighbor", daughter: "her daughter", caller: "his wife" };

/** The week's cases, one per day from day 2. */
export const WEEK_CASES = ["night-shift", "kitchen-floor", "basement-stairs"] as const;
export const LAST_DAY = 5;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
export const BEATS = ["arrive", "meet-mentor", "tour", "morning", "case", "debrief", "evening", "end"] as const;
export type Beat = (typeof BEATS)[number];

/** Findings that make the mentor stop you and ask about the timeline. */
const TURN: Record<string, string[]> = { "basement-stairs": ["temp", "rigor", "livor"] };

export function newStory(): StoryState {
  return { version: 1, day: 1, beat: "arrive", seen: [], flags: {} };
}

export function todayCase(s: StoryState): string | null {
  return WEEK_CASES[s.day - 2] ?? null;
}

export function dayName(s: StoryState): string {
  return storyContent()?.week.days.find((d) => d.day === s.day)?.name ?? DAY_NAMES[s.day - 1] ?? "";
}

export function isWeekDone(s: StoryState): boolean {
  return s.beat === "end";
}

/** The case the story believes is open (set by case-started, cleared by signed). */
export function storyActiveCase(s: StoryState): string | null {
  for (const [k, v] of Object.entries(s.flags)) if (v && k.startsWith("active:")) return k.slice(7);
  return null;
}

/** Which cases are open to pick from the intake board right now. */
export function availableCases(s: StoryState): string[] {
  const st = loadStory(s);
  if (st.beat === "end") return [...WEEK_CASES];
  const today = todayCase(st);
  return today && (st.beat === "morning" || st.beat === "case") ? [today] : [];
}

/** The first score signed for each case (the week's certificate; replays don't overwrite it). */
export function weekScores(s: StoryState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of s.seen) {
    const m = /^signed:(.+):(\d+)$/.exec(k);
    if (m && m[1] && !(m[1] in out)) out[m[1]] = Number(m[2]);
  }
  return out;
}

function lastScore(s: StoryState, caseId: string): number | null {
  let out: number | null = null;
  for (const k of s.seen) if (k.startsWith(`signed:${caseId}:`)) out = Number(k.slice(`signed:${caseId}:`.length));
  return out;
}

// ---------- readables ----------

/** Readable props that show different texts as the week goes on. Engines place these ids on props
 * and resolve them before reading: readText(resolveText(state, "desk-note")). */
export const STABLE_TEXTS = ["desk-note", "voicemail", "case-folder", "effects"] as const;

export function resolveText(s: StoryState, id: string, activeCaseId: string | null = null): string {
  const st = loadStory(s);
  const active = activeCaseId ?? storyActiveCase(st);
  const today = todayCase(st);
  switch (id) {
    case "desk-note":
      return st.beat === "evening" ? `desk-note-day${st.day}` : id;
    case "voicemail":
    case "desk-phone":
      return today && st.beat !== "end" ? `voicemail-day${st.day}` : "voicemail";
    case "case-folder":
      if (active) return `case-${active}`;
      return today && (st.beat === "morning" || st.beat === "case") ? `case-${today}` : id;
    case "effects":
      return active ? `effects-${active}` : id;
    default:
      return id;
  }
}

export function readText(id: string): { title: string; body: string } | null {
  const t = storyContent()?.texts[id];
  return t ? { title: t.title, body: t.body } : null;
}

// ---------- dialogue ----------

function witnessCase(npc: string): string | null {
  const cases = storyContent()?.week.cases ?? {};
  for (const [id, c] of Object.entries(cases)) if (c.witness === npc) return id;
  return null;
}

function reviewLines(s: StoryState, caseId: string): Line[] {
  const w = storyContent()?.week;
  if (!w) return [];
  const score = lastScore(s, caseId) ?? 0;
  const vars = { name: w.cases[caseId]?.name ?? "this case", score, max: MAX_SCORE };
  const tier = [...w.review.tiers].sort((a, b) => b.min - a.min).find((t) => score >= t.min);
  return [...toLines(w.review.intro, vars), ...toLines(tier?.lines, vars), ...toLines(w.review.cases[caseId], vars), ...toLines(w.review.close, vars)];
}

function endOfWeekLines(s: StoryState): Line[] {
  const w = storyContent()?.week;
  if (!w) return [];
  const scores = Object.entries(weekScores(s)).filter(([id]) => (WEEK_CASES as readonly string[]).includes(id));
  const total = scores.reduce((a, [, v]) => a + v, 0);
  return toLines(w.endOfWeek, { count: scores.length, total, max: scores.length * MAX_SCORE });
}

/** What an NPC says right now. Pure: it doesn't advance the story (storyStep's talk event does). */
export function talk(s: StoryState, npc: string, activeCaseId: string | null): Line[] {
  const w = storyContent()?.week;
  if (!w) return [];
  const st = loadStory(s);
  const active = activeCaseId ?? storyActiveCase(st);
  const byKey = w.dialogue[npc];
  if (!byKey) return [];
  const theirs = witnessCase(npc);
  if (theirs) return toLines(theirs === active ? byKey.case : byKey.default);
  if (npc === "mentor" && st.beat === "debrief" && todayCase(st)) return reviewLines(st, todayCase(st)!);
  if (npc === "mentor" && st.beat === "end" && !active) return endOfWeekLines(st);
  const keys = [
    `day${st.day}:${st.beat}`,
    `day${st.day}`,
    active && st.flags.timelineFlagged ? `case:${active}:flagged` : null,
    active ? `case:${active}` : null,
    st.beat,
    "default",
  ];
  for (const k of keys) if (k && byKey[k]) return toLines(byKey[k]);
  return [];
}

// ---------- the reducer ----------

const has = (s: StoryState, key: string) => s.seen.includes(key);
const mark = (s: StoryState, key: string) => {
  if (!s.seen.includes(key)) s.seen.push(key);
};

function setActive(s: StoryState, caseId: string | null) {
  for (const k of Object.keys(s.flags)) if (k.startsWith("active:")) delete s.flags[k];
  if (caseId) s.flags[`active:${caseId}`] = true;
}

function setAt(s: StoryState, location: string) {
  for (const k of Object.keys(s.flags)) if (k.startsWith("at:")) delete s.flags[k];
  s.flags[`at:${location}`] = true;
}

export function storyStep(s0: StoryState, e: StoryEvent): { state: StoryState; say: Line[] } {
  const s = loadStory(s0);
  const say: Line[] = [];
  const week = storyContent()?.week;
  /** Say the first of `keys` that has lines, once per `onceKey`. */
  const once = (onceKey: string, keys: string[] = [onceKey], vars: Record<string, string | number> = {}) => {
    if (!week || has(s, `said:${onceKey}`)) return;
    const k = keys.find((x) => week.say[x]);
    if (!k) return;
    mark(s, `said:${onceKey}`);
    say.push(...toLines(week.say[k], vars));
  };
  const nextDay = () => {
    s.day = Math.min(LAST_DAY, s.day + 1);
    s.beat = s.day >= LAST_DAY ? "end" : "morning";
    setActive(s, null);
    once(`day:${s.day}`);
  };

  if (!e || typeof e !== "object") return { state: s, say };
  switch (e.kind) {
    case "enter": {
      if (typeof e.location !== "string") break;
      setAt(s, e.location);
      once(`enter:${e.location}@${s.day}`);
      once(`enter:${e.location}`);
      break;
    }
    case "read": {
      if (typeof e.text !== "string") break;
      const id = resolveText(s, e.text);
      mark(s, `read:${id}`);
      if (s.beat === "arrive" && id === "welcome-letter") s.beat = "meet-mentor";
      if (s.beat === "evening" && id === `desk-note-day${s.day}`) {
        once(`read:${id}`);
        nextDay();
      }
      break;
    }
    case "talk": {
      if (typeof e.npc !== "string") break;
      say.push(...talk(s, e.npc, null));
      mark(s, `talk:${e.npc}`);
      if (s.day === 1) s.flags[`met:${e.npc}`] = true;
      if (e.npc === "mentor" && (s.beat === "arrive" || s.beat === "meet-mentor")) s.beat = "tour";
      else if (e.npc === "mentor" && s.beat === "debrief") s.beat = "evening";
      break;
    }
    case "case-started": {
      if (typeof e.caseId !== "string") break;
      setActive(s, e.caseId);
      // A fresh start: forget this case's earlier procedures and findings (replays), keep what was said.
      s.seen = s.seen.filter((k) => !k.startsWith(`proc:${e.caseId}:`) && !k.startsWith(`find:${e.caseId}:`));
      mark(s, `started:${e.caseId}`);
      if (e.caseId === todayCase(s) && s.beat === "morning") s.beat = "case";
      once(`case-started:${e.caseId}`);
      break;
    }
    case "procedure": {
      if (typeof e.caseId !== "string" || typeof e.procedure !== "string") break;
      mark(s, `proc:${e.caseId}:${e.procedure}`);
      once(`procedure:${e.caseId}:${e.procedure}`, [`procedure:${e.caseId}:${e.procedure}`, `procedure:*:${e.procedure}`]);
      break;
    }
    case "finding": {
      if (typeof e.caseId !== "string" || typeof e.finding !== "string") break;
      mark(s, `find:${e.caseId}:${e.finding}`);
      if (TURN[e.caseId]?.includes(e.finding) && !s.flags.timelineFlagged) {
        s.flags.timelineFlagged = true;
        once(`turn:${e.caseId}`);
      }
      break;
    }
    case "signed": {
      if (typeof e.caseId !== "string") break;
      const score = Math.max(0, Math.min(MAX_SCORE, Math.round(Number(e.score) || 0)));
      s.seen.push(`signed:${e.caseId}:${score}`);
      setActive(s, null);
      if (e.caseId === todayCase(s) && (s.beat === "case" || s.beat === "morning")) {
        once(`signed:${e.caseId}`);
        s.beat = "debrief";
      } else if (s.beat === "end" && week) {
        once(`signed:${e.caseId}`);
        say.push(...toLines(week.review.replay, { score, max: MAX_SCORE }));
      }
      break;
    }
    default:
      break;
  }
  // Day 1: once you've met the mentor and said hello to Ray and Priya, the day winds down.
  if (s.day === 1 && s.beat === "tour" && s.flags["met:investigator"] && s.flags["met:tech"]) s.beat = "evening";
  return { state: s, say };
}

// ---------- the NEXT line ----------

function caseObjective(s: StoryState, id: string): string {
  const sc = storyContent()?.week.cases[id];
  const done = (p: string) => has(s, `proc:${id}:${p}`);
  const count = (list: string[]) => list.filter((f) => has(s, `find:${id}:${f}`)).length;
  const who = sc?.object ?? "the body";
  const atScene = !!s.flags[`at:scene-${id}`];
  if (atScene) {
    const scene = sc?.procedures.scene ?? [];
    if (sc && !has(s, `talk:${sc.witness}`) && !has(s, `find:${id}:${sc.witnessFinding}`)) {
      return `Talk to ${NPCS[sc.witness]?.name ?? "the witness"}, ${WITNESS_AS[sc.witness] ?? "who found " + who}`;
    }
    const n = count(scene);
    if (n < scene.length) return `Look around the scene (${n} of ${scene.length} noted)`;
    return "Head back to the van";
  }
  if (!done("scene")) return "Ride out with Ray: the van is in the garage";
  if (!done("external")) return `Examine ${who} at the exam table`;
  const ext = sc?.procedures.external ?? [];
  if (!done("autopsy") && count(ext) < ext.length) return `Examine ${who} region by region (${count(ext)} of ${ext.length} noted)`;
  if (!done("autopsy")) return "Do the autopsy at the autopsy station";
  if (!done("tox")) return "Take a blood sample to Priya in the lab for toxicology";
  return "Sign the certificate at your desk terminal";
}

/** The NEXT line for the HUD. Never empty. */
export function objective(s: StoryState, activeCaseId: string | null): string {
  const st = loadStory(s);
  const active = activeCaseId ?? storyActiveCase(st);
  if (active) return caseObjective(st, active);
  switch (st.beat as Beat) {
    case "arrive":
      return has(st, "read:welcome-letter") ? "Find Dr. Achterberg in the exam room" : "Read the welcome letter at the front desk";
    case "meet-mentor":
      return "Find Dr. Achterberg in the exam room";
    case "tour":
      if (!st.flags["met:investigator"]) return "Say hello to Ray Delgado in the garage";
      if (!st.flags["met:tech"]) return "Say hello to Priya Natarajan in the lab";
      return "Read the note on your desk, then head home";
    case "morning":
      return has(st, `read:voicemail-day${st.day}`) ? "Pick up today's case folder at the intake board" : "Play the voicemail on your desk phone";
    case "case":
      return "Pick up today's case folder at the intake board";
    case "debrief":
      return "Talk to Dr. Achterberg about your certificate";
    case "evening":
      return "Read the note on your desk, then head home";
    case "end":
      return "Your first week is done: replay any case from the intake board";
    default:
      return "Look around the office";
  }
}

// ---------- saves ----------

const DAY_BEATS: Record<string, readonly string[]> = {
  first: ["arrive", "meet-mentor", "tour", "evening"],
  middle: ["morning", "case", "debrief", "evening"],
  last: ["end"],
};

/** Read a saved story of any shape. Unknown or damaged fields fall back to a sensible state, never a throw. */
export function loadStory(raw: unknown): StoryState {
  if (!raw || typeof raw !== "object") return newStory();
  const r = raw as Record<string, unknown>;
  const dayNum = typeof r.day === "number" && Number.isFinite(r.day) ? Math.round(r.day) : 1;
  const day = Math.max(1, Math.min(LAST_DAY, dayNum));
  const seen: string[] = Array.isArray(r.seen)
    ? r.seen.filter((x): x is string => typeof x === "string")
    : r.seen && typeof r.seen === "object"
      ? Object.entries(r.seen as Record<string, unknown>).filter(([, v]) => !!v).map(([k]) => k)
      : [];
  const flags: Record<string, boolean> = {};
  if (r.flags && typeof r.flags === "object" && !Array.isArray(r.flags)) {
    for (const [k, v] of Object.entries(r.flags as Record<string, unknown>)) if (typeof v === "boolean") flags[k] = v;
  }
  const allowed = day === 1 ? DAY_BEATS.first! : day >= LAST_DAY ? DAY_BEATS.last! : DAY_BEATS.middle!;
  let beat = typeof r.beat === "string" && allowed.includes(r.beat) ? r.beat : allowed[0]!;
  const st: StoryState = { version: 1, day, beat, seen, flags };
  if (beat === "case" && !storyActiveCase(st)) beat = "morning";
  st.beat = beat;
  return st;
}
