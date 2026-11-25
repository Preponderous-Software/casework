// Story saves: versioned, tolerant of old or damaged shapes, and the reducer never throws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  availableCases, loadStory, newStory, objective, storyStep, talk, useStory, BEATS, NPCS, WEEK_CASES,
  type StoryEvent, type StoryState,
} from "../src/casework/story/index.ts";

const pack = resolve(import.meta.dirname, "..", "packs", "forensics-core");
const json = (p: string) => JSON.parse(readFileSync(resolve(pack, p), "utf8"));
useStory({ week: json("story/week.json"), texts: json("story/texts.json") });

test("a new story is version 1, Monday, arriving", () => {
  assert.deepEqual(newStory(), { version: 1, day: 1, beat: "arrive", seen: [], flags: {} });
});

test("loadStory survives anything", () => {
  for (const raw of [null, undefined, 0, "x", [], [1, 2], { version: 99 }, { day: "3" }, { day: NaN }, { day: -4, beat: 7 }, { seen: "a", flags: [] }]) {
    const s = loadStory(raw);
    assert.equal(s.version, 1);
    assert.ok(s.day >= 1 && s.day <= 5);
    assert.ok((BEATS as readonly string[]).includes(s.beat));
    assert.ok(objective(s, null).length > 0);
  }
});

test("loadStory keeps what it can from old or odd shapes", () => {
  // an unversioned early save with seen as an object of booleans
  const s = loadStory({ day: 3, beat: "debrief", seen: { "read:welcome-letter": true, junk: false }, flags: { "met:tech": true, n: 3 } });
  assert.equal(s.day, 3);
  assert.equal(s.beat, "debrief");
  assert.deepEqual(s.seen, ["read:welcome-letter"]);
  assert.deepEqual(s.flags, { "met:tech": true });
  // a beat that doesn't belong to the day falls back to that day's first beat
  assert.equal(loadStory({ day: 1, beat: "debrief" }).beat, "arrive");
  assert.equal(loadStory({ day: 3, beat: "arrive" }).beat, "morning");
  assert.equal(loadStory({ day: 9, beat: "morning" }).beat, "end");
  // "case" with no open case is a morning
  assert.equal(loadStory({ day: 2, beat: "case", seen: [], flags: {} }).beat, "morning");
  assert.equal(loadStory({ day: 2, beat: "case", seen: [], flags: { "active:night-shift": true } }).beat, "case");
});

test("a save round-trips through JSON", () => {
  let s = newStory();
  for (const e of [{ kind: "read", text: "welcome-letter" }, { kind: "talk", npc: "mentor" }, { kind: "talk", npc: "tech" }] as StoryEvent[]) s = storyStep(s, e).state;
  assert.deepEqual(loadStory(JSON.parse(JSON.stringify(s))), s);
});

test("storyStep is pure: the input state is never changed", () => {
  const s = newStory();
  const before = JSON.stringify(s);
  storyStep(s, { kind: "read", text: "welcome-letter" });
  storyStep(s, { kind: "talk", npc: "mentor" });
  assert.equal(JSON.stringify(s), before);
});

test("random event storms never throw, never empty the objective, never leave the week", () => {
  let seed = 7;
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
  const pick = <T,>(xs: readonly T[]): T => xs[rnd(xs.length)]!;
  const ids = ["welcome-letter", "desk-note", "voicemail", "case-folder", "effects", "nope", "desk-note-day1", "desk-note-day2", "desk-note-day3", "desk-note-day4"];
  const npcs = [...Object.keys(NPCS), "ghost"];
  const caseIds = [...WEEK_CASES, "unknown"];
  for (let run = 0; run < 40; run++) {
    let s: StoryState = newStory();
    let active: string | null = null;
    for (let i = 0; i < 300; i++) {
      const c = pick(caseIds);
      const e: StoryEvent = pick<StoryEvent>([
        { kind: "enter", location: pick(["office", `scene-${c}`]) },
        { kind: "read", text: pick(ids) },
        { kind: "talk", npc: pick(npcs) },
        { kind: "case-started", caseId: c },
        { kind: "procedure", caseId: c, procedure: pick(["scene", "external", "autopsy", "tox", "xray"]) },
        { kind: "finding", caseId: c, finding: pick(["temp", "rigor", "call", "neighbor", "phone", "x"]) },
        { kind: "signed", caseId: c, score: rnd(20) - 3 },
      ]);
      if (e.kind === "case-started") active = e.caseId;
      if (e.kind === "signed") active = null;
      s = storyStep(s, e).state;
      assert.ok(s.day >= 1 && s.day <= 5);
      assert.ok(objective(s, active).trim().length > 0);
      assert.ok(objective(s, null).trim().length > 0);
      for (const n of npcs) talk(s, n, active);
      availableCases(s);
    }
    assert.deepEqual(loadStory(JSON.parse(JSON.stringify(s))), s);
  }
  // malformed events are ignored
  const s = newStory();
  for (const bad of [null, {}, { kind: "warp" }, { kind: "read" }, { kind: "signed", caseId: 3 }] as unknown as StoryEvent[]) {
    assert.doesNotThrow(() => storyStep(s, bad));
  }
});
