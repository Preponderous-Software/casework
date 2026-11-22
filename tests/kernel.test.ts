import { test } from "node:test";
import assert from "node:assert/strict";
import { afterLesson, afterReview } from "../src/kernel/skills.ts";
import { dueCards, enqueue, grade, newCard } from "../src/kernel/review.ts";
import { emptyProfile, exportProfile, importProfile, migrate, ProfileError, PROFILE_VERSION, recordResult } from "../src/kernel/profile.ts";

test("a just-in-time lesson grants practiced when right and novice when wrong, and never lowers a skill", () => {
  assert.equal(afterLesson("unknown", true), "practiced");
  assert.equal(afterLesson("unknown", false), "novice");
  assert.equal(afterLesson("mastered", false), "mastered");
});

test("review moves a skill up one level when right and down to novice when wrong", () => {
  assert.equal(afterReview("novice", true), "practiced");
  assert.equal(afterReview("practiced", true), "mastered");
  assert.equal(afterReview("mastered", true), "mastered");
  assert.equal(afterReview("mastered", false), "novice");
  assert.equal(afterReview("unknown", false), "unknown");
});

test("review intervals grow 1, 3, then by ease, and a miss resets to tomorrow", () => {
  let c = newCard("forensics.algor-mortis", 100);
  assert.equal(c.due, 101);
  c = grade(c, true, 101);
  assert.deepEqual([c.intervalDays, c.due], [1, 102]);
  c = grade(c, true, 102);
  assert.deepEqual([c.intervalDays, c.due], [3, 105]);
  c = grade(c, true, 105);
  assert.equal(c.intervalDays, Math.round(3 * 2.7));
  const missed = grade(c, false, 113);
  assert.deepEqual([missed.intervalDays, missed.due, missed.reps], [1, 114, 0]);
  assert.ok(missed.ease < c.ease);
});

test("due cards come oldest first, and enqueue never duplicates a skill", () => {
  let cards = enqueue([], "forensics.rigor-mortis", 10);
  cards = enqueue(cards, "forensics.algor-mortis", 8);
  cards = enqueue(cards, "forensics.rigor-mortis", 12);
  assert.equal(cards.length, 2);
  assert.deepEqual(dueCards(cards, 20).map((c) => c.skill), ["forensics.algor-mortis", "forensics.rigor-mortis"]);
  assert.deepEqual(dueCards(cards, 8), []);
});

test("profiles round-trip through an export file", () => {
  const p = { ...emptyProfile(), skills: { "forensics.livor-mortis": "novice" as const } };
  assert.deepEqual(importProfile(exportProfile(p)), p);
});

test("a missing save starts fresh, but a damaged or newer save is refused, never replaced", () => {
  assert.deepEqual(migrate(null), emptyProfile());
  assert.throws(() => migrate("nope"), ProfileError);
  assert.throws(() => migrate({ skills: {} }), ProfileError);
  assert.throws(() => migrate({ version: PROFILE_VERSION + 1, skills: {}, cards: [], stats: {} }), ProfileError);
  assert.throws(() => importProfile('{"app":"other","version":1}'), ProfileError);
});

test("a version 1 save migrates to version 2 and keeps everything the player earned", () => {
  const v1 = { version: 1, skills: { "forensics.rigor-mortis": "mastered" }, cards: [{ skill: "forensics.rigor-mortis", due: 5, intervalDays: 3, ease: 2.6, reps: 2 }], stats: { drills: 9, drillsHit: 7, bestStreak: 4, streak: 2 } };
  const p = migrate(v1);
  assert.equal(p.version, PROFILE_VERSION);
  assert.deepEqual(p.skills, v1.skills);
  assert.deepEqual(p.cards, v1.cards);
  assert.deepEqual(p.stats, v1.stats);
  assert.deepEqual(p.records, {});
});

test("results keep the best score and count plays", () => {
  let p = recordResult(emptyProfile(), "case:night-shift", 9);
  p = recordResult(p, "case:night-shift", 7);
  assert.deepEqual(p.records["case:night-shift"], { best: 9, plays: 2 });
});
