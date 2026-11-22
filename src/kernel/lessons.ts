// Lessons: one question each, attached to a skill, with an explanation and the sources it rests on.
import type { SkillId } from "./skills.ts";

export interface Source {
  /** Human-readable citation. */
  cite: string;
  url?: string;
}

export interface Lesson {
  id: string;
  skill: SkillId;
  /** Short name of the skill, shown on the lesson card. */
  title: string;
  prompt: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
  explain: string;
  sources: Source[];
}

export function isCorrect(lesson: Lesson, choice: number): boolean {
  return choice === lesson.answer;
}

/** Problems with a lesson's shape, as readable strings (empty when valid). Used by the pack
 * validator and the tests. */
export function lessonProblems(l: Lesson): string[] {
  const p: string[] = [];
  if (!/^[a-z0-9-]+\.[a-z0-9-]+$/.test(l.skill)) p.push(`${l.id}: skill "${l.skill}" is not namespace.name`);
  if (l.options.length < 2) p.push(`${l.id}: needs at least two options`);
  if (!Number.isInteger(l.answer) || l.answer < 0 || l.answer >= l.options.length) p.push(`${l.id}: answer out of range`);
  if (!l.explain.trim()) p.push(`${l.id}: explanation is empty`);
  if (l.sources.length === 0) p.push(`${l.id}: cites no sources`);
  return p;
}
