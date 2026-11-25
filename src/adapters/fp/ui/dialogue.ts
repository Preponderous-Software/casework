// The dialogue queue behind the HUD's dialogue box (pure: no DOM, no timers). Lines type out at a
// steady pace; the first press shows the whole line, the next press moves on, and the queue is done
// after the last line. With reduced motion every line appears whole at once.

export interface DialogueLine { who: string; name: string; text: string }

export interface DialogueState {
  lines: DialogueLine[];
  index: number;
  /** Characters of the current line on screen. */
  shown: number;
  done: boolean;
}

/** Characters per second for the type-out. */
export const TYPE_CPS = 55;

export function startDialogue(lines: DialogueLine[], instant = false): DialogueState {
  const ls = lines.filter((l) => l && typeof l.text === "string" && l.text.length > 0);
  const first = ls[0];
  return { lines: ls, index: 0, shown: first && instant ? first.text.length : 0, done: ls.length === 0 };
}

export function current(s: DialogueState): DialogueLine | null {
  return s.done ? null : (s.lines[s.index] ?? null);
}

/** Is the current line fully on screen? */
export function lineComplete(s: DialogueState): boolean {
  const l = current(s);
  return !l || s.shown >= l.text.length;
}

/** Advance the type-out by dt seconds. */
export function tickDialogue(s: DialogueState, dt: number, cps = TYPE_CPS): DialogueState {
  const l = current(s);
  if (!l || !(dt > 0)) return s;
  return { ...s, shown: Math.min(l.text.length, s.shown + dt * cps) };
}

/** The player pressed advance (tap, E, Enter, Space, gamepad A).
 * - "reveal": the line was still typing; it is now whole.
 * - "next": moved to the next line.
 * - "done": that was the last line. */
export function advance(s: DialogueState, instant = false): { state: DialogueState; did: "reveal" | "next" | "done" } {
  const l = current(s);
  if (!l) return { state: { ...s, done: true }, did: "done" };
  if (s.shown < l.text.length) return { state: { ...s, shown: l.text.length }, did: "reveal" };
  const index = s.index + 1;
  const next = s.lines[index];
  if (!next) return { state: { ...s, index, shown: 0, done: true }, did: "done" };
  return { state: { ...s, index, shown: instant ? next.text.length : 0 }, did: "next" };
}

/** The visible part of the current line, cut at a whole character. */
export function visibleText(s: DialogueState): string {
  const l = current(s);
  return l ? Array.from(l.text).slice(0, Math.floor(s.shown)).join("") : "";
}

/** A short monogram for a speaker tile: "Dr. Ana Ruiz" → "AR", "you" → "You". */
export function monogram(name: string): string {
  const words = name.replace(/^(dr|mr|mrs|ms|det|sgt|officer)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) {
    const w = words[0] as string;
    return w.length <= 3 ? w : w.slice(0, 1).toUpperCase();
  }
  return ((words[0] as string)[0]! + (words[words.length - 1] as string)[0]!).toUpperCase();
}

/** A stable hue (0..359) for a speaker id, so each person keeps one colour. */
export function speakerHue(who: string): number {
  if (who === "you") return 174; // the accent teal
  let h = 2166136261;
  for (const c of who) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 360 + 360) % 360;
}
