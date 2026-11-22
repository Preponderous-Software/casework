// Spaced review. A small SM-2-style scheduler working in whole days. The kernel never reads a clock:
// callers pass `today` as a day number (days since any fixed epoch).
import type { SkillId } from "./skills.ts";

export interface Card {
  skill: SkillId;
  /** Day number when the card is next due. */
  due: number;
  intervalDays: number;
  /** Growth factor for the interval, 1.3 to 2.8. */
  ease: number;
  reps: number;
}

export const MIN_EASE = 1.3;
export const MAX_EASE = 2.8;

/** A new card is due the day after it was created. */
export function newCard(skill: SkillId, today: number): Card {
  return { skill, due: today + 1, intervalDays: 1, ease: 2.5, reps: 0 };
}

/** Grade a card. Right: the interval grows (1 → 3 → interval × ease). Wrong: back to tomorrow and
 * the ease drops. */
export function grade(card: Card, correct: boolean, today: number): Card {
  if (!correct) {
    return { ...card, due: today + 1, intervalDays: 1, reps: 0, ease: Math.max(MIN_EASE, round2(card.ease - 0.2)) };
  }
  const reps = card.reps + 1;
  const intervalDays = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(card.intervalDays * card.ease);
  return { ...card, reps, intervalDays, due: today + intervalDays, ease: Math.min(MAX_EASE, round2(card.ease + 0.1)) };
}

/** Cards due on or before `today`, oldest first. */
export function dueCards(cards: readonly Card[], today: number): Card[] {
  return cards.filter((c) => c.due <= today).sort((a, b) => a.due - b.due || a.skill.localeCompare(b.skill));
}

/** Add a card for `skill` unless one already exists; if it exists, bring it due tomorrow. */
export function enqueue(cards: readonly Card[], skill: SkillId, today: number): Card[] {
  const existing = cards.find((c) => c.skill === skill);
  if (!existing) return [...cards, newCard(skill, today)];
  return cards.map((c) => (c.skill === skill ? { ...c, due: Math.min(c.due, today + 1) } : c));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
