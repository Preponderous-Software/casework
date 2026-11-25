// Story content, as data. The words live in the content pack (packs/<pack>/story/week.json and
// texts.json) so they can be edited and licensed with the cases; an adapter loads the two files and
// hands them to useStory() once at start-up. Until then the story still runs: objectives come from
// code, and readText/talk return null/[] rather than throwing.

export interface Line {
  /** An NPC id (see NPCS), "you", or "narrator". */
  who: string;
  text: string;
}

/** Lines in the pack are written compactly as [who, text]. */
export type RawLine = [string, string];

export interface StoryCase {
  /** The person's name, as it appears on the folder. */
  name: string;
  /** "him" / "her", for objectives such as "Examine him at the exam table". */
  object: string;
  /** NPC id of the witness at the scene. */
  witness: string;
  /** The scene finding that records the witness's statement. */
  witnessFinding: string;
  /** Finding ids by the procedure that reveals them (must match the case JSON). */
  procedures: Record<string, string[]>;
}

export interface WeekDay {
  day: number;
  name: string;
  caseId: string | null;
}

export interface Week {
  id: string;
  version: number;
  title: string;
  office: string;
  days: WeekDay[];
  cases: Record<string, StoryCase>;
  /** One-shot lines keyed by event, e.g. "procedure:night-shift:scene", "day:2", "turn:basement-stairs". */
  say: Record<string, RawLine[]>;
  /** Per NPC: lines keyed by context ("day1:tour", "case:night-shift", "morning", "default"...). */
  dialogue: Record<string, Record<string, RawLine[]>>;
  review: {
    intro: RawLine[];
    tiers: { min: number; lines: RawLine[] }[];
    cases: Record<string, RawLine[]>;
    close: RawLine[];
    replay: RawLine[];
  };
  endOfWeek: RawLine[];
}

export interface Readable {
  title: string;
  body: string;
  /** The case this text belongs to, if any (used by the consistency tests). */
  caseId?: string;
}

export interface StoryContent {
  week: Week;
  texts: Record<string, Readable>;
}

/** The pack files an adapter should load, relative to the pack root. */
export const STORY_FILES = { week: "story/week.json", texts: "story/texts.json" } as const;

let current: StoryContent | null = null;

/** Install the story content (call once after loading the pack). Returns any problems found. */
export function useStory(content: StoryContent): string[] {
  const problems = storyProblems(content);
  current = content;
  return problems;
}

export function storyContent(): StoryContent | null {
  return current;
}

export const toLines = (raw: readonly RawLine[] | undefined, vars: Record<string, string | number> = {}): Line[] =>
  (raw ?? []).map(([who, text]) => ({ who, text: text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) }));

/** Shape checks for a story pack. Empty when well formed. */
export function storyProblems(c: StoryContent): string[] {
  const out: string[] = [];
  const w = c?.week;
  if (!w || typeof w !== "object") return ["week: missing"];
  if (!c.texts || typeof c.texts !== "object") out.push("texts: missing");
  if (!Array.isArray(w.days) || w.days.length === 0) out.push("week.days: empty");
  for (const d of w.days ?? []) if (d.caseId && !w.cases?.[d.caseId]) out.push(`day ${d.day}: unknown case ${d.caseId}`);
  const lineLists: [string, unknown][] = [
    ...Object.entries(w.say ?? {}),
    ...Object.entries(w.dialogue ?? {}).flatMap(([npc, byKey]) => Object.entries(byKey).map(([k, v]) => [`dialogue.${npc}.${k}`, v] as [string, unknown])),
    ["review.intro", w.review?.intro],
    ["review.close", w.review?.close],
    ["review.replay", w.review?.replay],
    ...(w.review?.tiers ?? []).map((t, i) => [`review.tiers.${i}`, t.lines] as [string, unknown]),
    ...Object.entries(w.review?.cases ?? {}),
    ["endOfWeek", w.endOfWeek],
  ];
  for (const [key, list] of lineLists) {
    if (!Array.isArray(list) || list.length === 0) { out.push(`${key}: no lines`); continue; }
    for (const l of list) if (!Array.isArray(l) || l.length !== 2 || typeof l[0] !== "string" || typeof l[1] !== "string" || !l[1].trim()) out.push(`${key}: malformed line`);
  }
  for (const [id, t] of Object.entries(c.texts ?? {})) {
    if (!t || typeof t.title !== "string" || !t.title.trim() || typeof t.body !== "string" || !t.body.trim()) out.push(`text ${id}: needs a title and body`);
  }
  return out;
}
