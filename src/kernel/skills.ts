// Skills and mastery. A skill is the learnable unit: knowing it lets a player turn a finding into
// evidence, and how well they know it sets how precise that evidence is.

/** Namespaced skill id, e.g. "forensics.algor-mortis". The namespace lets a future transcript
 * collect skills from more than one game. */
export type SkillId = `${string}.${string}`;

export type Mastery = "unknown" | "novice" | "practiced" | "mastered";

/** How much wider (>1) or narrower (<1) evidence from a skill is at each mastery level. */
export const PRECISION: Readonly<Record<Exclude<Mastery, "unknown">, number>> = {
  novice: 1.5,
  practiced: 1,
  mastered: 0.75,
};

/** After answering the just-in-time lesson: right → practiced, wrong → novice (you still learn it,
 * just not well). A lesson never lowers a skill you already had. */
export function afterLesson(current: Mastery, correct: boolean): Mastery {
  const next: Mastery = correct ? "practiced" : "novice";
  return rank(next) > rank(current) ? next : current;
}

/** After a spaced review card: right moves up one level (to at most mastered), wrong drops to
 * novice. */
export function afterReview(current: Mastery, correct: boolean): Mastery {
  if (!correct) return current === "unknown" ? "unknown" : "novice";
  if (current === "novice") return "practiced";
  if (current === "practiced") return "mastered";
  return current;
}

export function isKnown(m: Mastery | undefined): m is Exclude<Mastery, "unknown"> {
  return m !== undefined && m !== "unknown";
}

function rank(m: Mastery): number {
  return ["unknown", "novice", "practiced", "mastered"].indexOf(m);
}
