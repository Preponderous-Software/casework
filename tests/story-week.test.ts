// Playing the whole "First week" through storyStep, the way the first-person engine will.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseDef } from "../src/casework/case/model.ts";
import {
  availableCases, NPCS, newStory, objective, readText, resolveText, storyStep, talk, useStory, weekScores,
  type Line, type StoryEvent, type StoryState,
} from "../src/casework/story/index.ts";

const pack = resolve(import.meta.dirname, "..", "packs", "forensics-core");
const json = (p: string) => JSON.parse(readFileSync(resolve(pack, p), "utf8"));
assert.deepEqual(useStory({ week: json("story/week.json"), texts: json("story/texts.json") }), []);
const cases: Record<string, CaseDef> = Object.fromEntries(
  (json("manifest.json").cases as string[]).map((p) => json(p) as CaseDef).map((c) => [c.id, c]),
);

const WHO = new Set([...Object.keys(NPCS), "you", "narrator"]);

/** Run events, checking every step's NEXT line and every spoken line. */
function play(s: StoryState, events: StoryEvent[], active: string | null = null, log: string[] = [], said: Line[] = []): StoryState {
  for (const e of events) {
    const r = storyStep(s, e);
    for (const l of r.say) {
      assert.ok(WHO.has(l.who), `unknown speaker ${l.who}`);
      assert.ok(l.text.trim() && !/\{\w+\}/.test(l.text), `bad line: ${l.text}`);
    }
    said.push(...r.say);
    s = r.state;
    if (e.kind === "case-started") active = e.caseId;
    if (e.kind === "signed") active = null;
    const next = objective(s, active);
    assert.ok(next.trim().length > 0, `empty objective after ${JSON.stringify(e)}`);
    log.push(next);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(s)));
  }
  return s;
}

function caseEvents(id: string, score: number): StoryEvent[] {
  const c = cases[id]!;
  const by = (p: string) => c.findings.filter((f) => f.procedure === p).map((f): StoryEvent => ({ kind: "finding", caseId: id, finding: f.id }));
  const witness = { "night-shift": "neighbor", "kitchen-floor": "daughter", "basement-stairs": "caller" }[id]!;
  return [
    { kind: "read", text: "voicemail" },
    { kind: "read", text: "case-folder" },
    { kind: "case-started", caseId: id },
    { kind: "procedure", caseId: id, procedure: "scene" },
    { kind: "enter", location: `scene-${id}` },
    { kind: "talk", npc: witness },
    ...by("scene"),
    { kind: "enter", location: "office" },
    { kind: "read", text: "effects" },
    { kind: "procedure", caseId: id, procedure: "external" },
    ...by("external"),
    { kind: "procedure", caseId: id, procedure: "autopsy" },
    ...by("autopsy"),
    { kind: "procedure", caseId: id, procedure: "tox" },
    ...by("tox"),
    { kind: "signed", caseId: id, score },
    { kind: "talk", npc: "mentor" },
    { kind: "read", text: "desk-note" },
  ];
}

test("the whole week plays from arrival to Friday", () => {
  const log: string[] = [];
  const said: Line[] = [];
  let s = newStory();
  assert.equal(objective(s, null), "Read the welcome letter at the front desk");
  assert.deepEqual(availableCases(s), []);
  s = play(s, [
    { kind: "enter", location: "office" },
    { kind: "read", text: "welcome-letter" },
    { kind: "talk", npc: "mentor" },
    { kind: "talk", npc: "investigator" },
    { kind: "talk", npc: "tech" },
    { kind: "read", text: "poster-time-of-death" },
  ], null, log, said);
  assert.equal(s.beat, "evening");
  assert.equal(resolveText(s, "desk-note"), "desk-note-day1");
  s = play(s, [{ kind: "read", text: "desk-note" }], null, log, said);
  assert.equal(s.day, 2);
  assert.equal(s.beat, "morning");
  assert.equal(objective(s, null), "Play the voicemail on your desk phone");

  const scores = { "night-shift": 12, "kitchen-floor": 9, "basement-stairs": 6 } as const;
  for (const [i, id] of (["night-shift", "kitchen-floor", "basement-stairs"] as const).entries()) {
    assert.equal(s.day, i + 2);
    assert.deepEqual(availableCases(s), [id]);
    s = play(s, caseEvents(id, scores[id]), null, log, said);
  }
  assert.equal(s.day, 5);
  assert.equal(s.beat, "end");
  assert.deepEqual(availableCases(s), ["night-shift", "kitchen-floor", "basement-stairs"]);
  assert.deepEqual(weekScores(s), scores);
  const end = talk(s, "mentor", null).map((l) => l.text).join(" ");
  assert.match(end, /3 certificates, 27 out of 36/);
  assert.match(objective(s, null), /first week is done/);

  // The NEXT line walks through the work of a case in order.
  for (const step of [
    "Pick up today's case folder at the intake board",
    "Ride out with Ray: the van is in the garage",
    "Talk to Walt Brennan, the neighbor",
    "Look around the scene (1 of 3 noted)",
    "Head back to the van",
    "Examine him at the exam table",
    "Examine him region by region (0 of 4 noted)",
    "Do the autopsy at the autopsy station",
    "Take a blood sample to Priya in the lab for toxicology",
    "Sign the certificate at your desk terminal",
    "Talk to Dr. Achterberg about your certificate",
    "Read the note on your desk, then head home",
  ]) assert.ok(log.includes(step), `never saw objective: ${step}`);

  // Story beats happened: the day cards, the mentor's review, and the week's turn.
  const text = said.map((l) => l.text).join("\n");
  for (const want of [/Monday, 08:00/, /Tuesday, 07:55/, /Wednesday/, /Thursday/, /Friday/, /12 out of 12/, /9 out of 12/, /6 out of 12/, /What time did Mrs\. Ortiz say he fell\?/]) {
    assert.match(text, want);
  }
});

test("the mentor flags the timeline exactly once, on the first timing finding in the homicide case", () => {
  let s = loadToDay(4);
  s = play(s, [{ kind: "case-started", caseId: "basement-stairs" }], "basement-stairs");
  const first = storyStep(s, { kind: "finding", caseId: "basement-stairs", finding: "rigor" });
  assert.ok(first.say.some((l) => l.who === "mentor" && /what time/i.test(l.text)));
  assert.equal(first.state.flags.timelineFlagged, true);
  const again = storyStep(first.state, { kind: "finding", caseId: "basement-stairs", finding: "temp" });
  assert.deepEqual(again.say, []);
  assert.match(talk(again.state, "mentor", "basement-stairs").map((l) => l.text).join(" "), /window/);
  // other cases' timing findings never trigger it
  const t = loadToDay(2);
  const r = storyStep(storyStep(t, { kind: "case-started", caseId: "night-shift" }).state, { kind: "finding", caseId: "night-shift", finding: "rigor" });
  assert.ok(!r.state.flags.timelineFlagged);
});

test("witnesses give their statement only at their own case", () => {
  assert.match(talk(newStory(), "neighbor", "night-shift").map((l) => l.text).join(" "), /quarter to eleven/);
  assert.match(talk(newStory(), "daughter", "kitchen-floor").map((l) => l.text).join(" "), /half past eight/);
  assert.match(talk(newStory(), "caller", "basement-stairs").map((l) => l.text).join(" "), /five past eleven/);
  assert.doesNotMatch(talk(newStory(), "caller", null).map((l) => l.text).join(" "), /five past eleven/);
});

test("every NPC has something to say in every beat of the week", () => {
  for (const day of [1, 2, 3, 4, 5]) {
    let s = loadToDay(day);
    const states = [s];
    if (day > 1 && day < 5) {
      const id = ["night-shift", "kitchen-floor", "basement-stairs"][day - 2]!;
      s = storyStep(s, { kind: "case-started", caseId: id }).state; states.push(s);
      s = storyStep(s, { kind: "signed", caseId: id, score: 8 }).state; states.push(s);
      s = storyStep(s, { kind: "talk", npc: "mentor" }).state; states.push(s);
    }
    for (const st of states) for (const npc of ["mentor", "investigator", "tech"]) {
      assert.ok(talk(st, npc, null).length > 0, `${npc} silent on day ${day} beat ${st.beat}`);
    }
  }
});

test("replaying a case at the end of the week keeps the week's score and gives a short review", () => {
  let s = loadToDay(5);
  s = storyStep(s, { kind: "case-started", caseId: "kitchen-floor" }).state;
  assert.equal(objective(s, "kitchen-floor"), "Ride out with Ray: the van is in the garage");
  const r = storyStep(s, { kind: "signed", caseId: "kitchen-floor", score: 12 });
  assert.equal(r.state.beat, "end");
  assert.ok(r.say.some((l) => /12 out of 12/.test(l.text)));
  assert.equal(weekScores(r.state)["kitchen-floor"], 5);
});

test("every stable readable id resolves to a real text in every beat", () => {
  for (const day of [1, 2, 3, 4, 5]) {
    for (const beat of ["arrive", "meet-mentor", "tour", "morning", "case", "debrief", "evening", "end"]) {
      const s: StoryState = { version: 1, day, beat, seen: [], flags: {} };
      for (const active of [null, "night-shift", "kitchen-floor", "basement-stairs"]) {
        for (const id of ["desk-note", "voicemail", "desk-phone", "case-folder", "effects"]) {
          const resolved = resolveText(s, id, active);
          assert.ok(readText(resolved), `${id} → ${resolved} (day ${day}, ${beat}, ${active}) has no text`);
        }
      }
    }
  }
});

/** A story at the start of `day`, with the earlier days played (each case scored 5). */
function loadToDay(day: number): StoryState {
  let s = newStory();
  if (day === 1) return s;
  s = play(s, [{ kind: "talk", npc: "mentor" }, { kind: "talk", npc: "investigator" }, { kind: "talk", npc: "tech" }, { kind: "read", text: "desk-note" }]);
  for (const id of ["night-shift", "kitchen-floor", "basement-stairs"].slice(0, Math.max(0, day - 2))) {
    s = play(s, [{ kind: "case-started", caseId: id }, { kind: "signed", caseId: id, score: 5 }, { kind: "talk", npc: "mentor" }, { kind: "read", text: "desk-note" }]);
  }
  assert.equal(s.day, day);
  return s;
}
