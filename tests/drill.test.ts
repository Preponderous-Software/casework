import { test } from "node:test";
import assert from "node:assert/strict";
import { COOLING, SKILL, evidenceFor, generateBody, overlap, scoreWindow, type DrillBody } from "../src/casework/drill.ts";

const SEEDS = Array.from({ length: 500 }, (_, i) => i + 1);
const all = { [SKILL.algor]: "practiced", [SKILL.rigor]: "practiced", [SKILL.livor]: "practiced", [SKILL.gastric]: "practiced", [SKILL.scene]: "practiced" } as const;

test("the same seed always makes the same body", () => {
  assert.deepEqual(generateBody(42), generateBody(42));
  assert.notDeepEqual(generateBody(42), generateBody(43));
});

test("generated bodies are physically sensible", () => {
  for (const s of SEEDS) {
    const b = generateBody(s);
    assert.ok(b.hoursDead >= 2 && b.hoursDead <= 14, `seed ${s}: hours ${b.hoursDead}`);
    assert.ok(b.bodyTempF < 98.6 && b.bodyTempF > b.roomTempF, `seed ${s}: temps ${b.bodyTempF} / ${b.roomTempF}`);
  }
});

test("with every skill known, each bar contains the truth for nearly all bodies", () => {
  const misses: Record<string, number> = {};
  for (const s of SEEDS) {
    const b = generateBody(s);
    for (const e of evidenceFor(b, all)) {
      if (b.hoursDead < e.from || b.hoursDead > e.to) misses[e.label] = (misses[e.label] ?? 0) + 1;
    }
  }
  for (const [label, n] of Object.entries(misses)) assert.ok(n / SEEDS.length < 0.05, `${label} misses ${n}/${SEEDS.length}`);
});

test("the bars overlap on the truth for nearly all bodies, so a careful player can always win", () => {
  let ok = 0;
  for (const s of SEEDS) {
    const b = generateBody(s);
    const o = overlap(evidenceFor(b, all));
    if (o && b.hoursDead >= o.from && b.hoursDead <= o.to) ok++;
  }
  assert.ok(ok / SEEDS.length > 0.9, `overlap holds the truth ${ok}/${SEEDS.length}`);
});

test("unknown skills give no bar, and novice bars are wider than practiced ones", () => {
  const b = generateBody(7);
  assert.equal(evidenceFor(b, {}).length, 0);
  const novice = evidenceFor(b, { [SKILL.rigor]: "novice" })[0]!;
  const practiced = evidenceFor(b, { [SKILL.rigor]: "practiced" })[0]!;
  const mastered = evidenceFor(b, { [SKILL.rigor]: "mastered" })[0]!;
  const w = (e: { from: number; to: number }) => e.to - e.from;
  assert.ok(w(novice) > w(practiced) && w(practiced) > w(mastered));
});

test("without the scene skill, a cold room makes the cooling bar point too early", () => {
  const cold = SEEDS.map(generateBody).find((b) => b.room === "cold") as DrillBody;
  const naive = evidenceFor(cold, { [SKILL.algor]: "practiced" })[0]!;
  const adjusted = evidenceFor(cold, { [SKILL.algor]: "practiced", [SKILL.scene]: "practiced" })[0]!;
  assert.ok(naive.from > adjusted.from, "naive estimate thinks more time has passed");
  assert.equal(COOLING.cold > COOLING.normal, true);
});

test("windows score 3 when right and tight, less when wide, 0 when they miss", () => {
  const b = { ...generateBody(1), hoursDead: 5 };
  assert.deepEqual(scoreWindow(b, 4, 6), { hit: true, widthHours: 2, points: 3 });
  assert.equal(scoreWindow(b, 3, 8).points, 2);
  assert.equal(scoreWindow(b, 1, 12).points, 1);
  assert.equal(scoreWindow(b, 6, 9).points, 0);
  assert.equal(scoreWindow(b, 6, 4).points, 3, "reversed ends still work");
});
