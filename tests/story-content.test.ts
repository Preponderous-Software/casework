// The story pack agrees with the cases: same people, places and times, every id resolves, and
// nothing said before a certificate is signed gives the answer away.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseDef } from "../src/casework/case/model.ts";
import { toClock } from "../src/casework/case/clock.ts";
import { NPCS, readText, WEEK_CASES, storyProblems, useStory, type StoryContent } from "../src/casework/story/index.ts";

const pack = resolve(import.meta.dirname, "..", "packs", "forensics-core");
const json = (p: string) => JSON.parse(readFileSync(resolve(pack, p), "utf8"));
const content: StoryContent = { week: json("story/week.json"), texts: json("story/texts.json") };
useStory(content);
const cases: Record<string, CaseDef> = Object.fromEntries(
  (json("manifest.json").cases as string[]).map((p) => json(p) as CaseDef).map((c) => [c.id, c]),
);
const { week, texts } = content;
const SPEAKERS = new Set([...Object.keys(NPCS), "you", "narrator"]);

/** Everything a player can see or hear before the week's certificates are reviewed. */
function preSigningLines(): { key: string; caseId: string | null; text: string }[] {
  const out: { key: string; caseId: string | null; text: string }[] = [];
  for (const [id, t] of Object.entries(texts)) out.push({ key: `text ${id}`, caseId: t.caseId ?? null, text: `${t.title}\n${t.body}` });
  for (const [key, lines] of Object.entries(week.say)) {
    if (key.startsWith("signed:")) continue;
    const caseId = WEEK_CASES.find((c) => key.includes(c)) ?? null;
    for (const [, text] of lines) out.push({ key: `say ${key}`, caseId, text });
  }
  for (const [npc, byKey] of Object.entries(week.dialogue)) {
    for (const [key, lines] of Object.entries(byKey)) {
      const caseId = WEEK_CASES.find((c) => key.includes(c)) ?? (key === "case" ? WEEK_CASES.find((c) => week.cases[c]?.witness === npc) ?? null : null);
      for (const [, text] of lines) out.push({ key: `dialogue ${npc}.${key}`, caseId, text });
    }
  }
  return out;
}

test("the story pack is well formed", () => {
  assert.deepEqual(storyProblems(content), []);
});

test("the week runs the three cases in pack order, one per day", () => {
  assert.deepEqual(week.days.map((d) => d.caseId), [null, ...WEEK_CASES, null]);
  assert.deepEqual([...WEEK_CASES], Object.values(cases).sort((a, b) => a.order - b.order).map((c) => c.id));
});

test("each story case matches its case file: findings, witness, name", () => {
  for (const id of WEEK_CASES) {
    const c = cases[id]!, sc = week.cases[id]!;
    const byProc: Record<string, string[]> = {};
    for (const f of c.findings) (byProc[f.procedure] ??= []).push(f.id);
    assert.deepEqual(sc.procedures, byProc, `${id} findings`);
    assert.ok(NPCS[sc.witness], `${id} witness ${sc.witness} is an NPC`);
    assert.equal(c.findings.find((f) => f.id === sc.witnessFinding)?.procedure, "scene", `${id} witness finding`);
    assert.ok(c.person.startsWith(`${sc.name}, `), `${id}: ${c.person} vs ${sc.name}`);
    assert.ok(NPCS[sc.witness]!.role.includes(sc.name.split(" ")[0]!), `${id}: witness role names the person`);
  }
  assert.deepEqual(WEEK_CASES.map((id) => week.cases[id]!.witness), ["neighbor", "daughter", "caller"]);
});

test("every text and npc id referenced resolves", () => {
  const required = [
    "welcome-letter", "intake-board", "poster-time-of-death", "van-logbook",
    "desk-note", "voicemail", "case-folder", "effects",
    ...[1, 2, 3, 4].map((d) => `desk-note-day${d}`),
    ...[2, 3, 4].map((d) => `voicemail-day${d}`),
    ...WEEK_CASES.flatMap((id) => [`case-${id}`, `effects-${id}`]),
  ];
  for (const id of required) assert.ok(readText(id), `missing text ${id}`);
  for (const key of Object.keys(week.say)) {
    const m = /^read:(.+)$/.exec(key);
    if (m) assert.ok(readText(m[1]!), `say key ${key} names a missing text`);
  }
  for (const npc of Object.keys(week.dialogue)) assert.ok(NPCS[npc], `dialogue for unknown npc ${npc}`);
  for (const npc of Object.keys(NPCS)) assert.ok(week.dialogue[npc], `${npc} has no dialogue`);
  const all = [
    ...Object.values(week.say).flat(), ...Object.values(week.dialogue).flatMap((d) => Object.values(d).flat()),
    ...week.review.intro, ...week.review.close, ...week.review.replay, ...week.review.tiers.flatMap((t) => t.lines),
    ...Object.values(week.review.cases).flat(), ...week.endOfWeek,
  ];
  for (const [who] of all) assert.ok(SPEAKERS.has(who), `unknown speaker ${who}`);
});

test("case folders carry the case file's intake, context and found time", () => {
  for (const id of WEEK_CASES) {
    const c = cases[id]!;
    const body = readText(`case-${id}`)!.body;
    assert.ok(body.includes(c.intake), `${id} intake`);
    assert.ok(body.includes(c.context), `${id} context`);
    assert.ok(body.includes(`Found: ${toClock(c.foundAt, 0)}`), `${id} found time`);
    assert.ok(body.includes(c.person.split(", a")[0]!), `${id} name and age`);
    if (c.note) assert.ok(body.includes(c.note), `${id} note`);
  }
});

test("witnesses say what the scene findings record", () => {
  const said = (npc: string) => week.dialogue[npc]!.case!.map(([, t]) => t).join(" ");
  const finding = (c: string, f: string) => cases[c]!.findings.find((x) => x.id === f)!.text;
  // night-shift: dinner around 22:00, home at 22:45, found 07:40
  assert.match(finding("night-shift", "neighbor"), /22:00.*22:45/);
  assert.match(said("neighbor"), /around ten.*quarter to eleven.*a little tired.*twenty to eight/s);
  // kitchen-floor: spoke at 20:30, sounded well; found at 09:00
  assert.match(finding("kitchen-floor", "phone"), /20:30.*sounded well/);
  assert.match(said("daughter"), /half past eight.*sounded well.*at nine/s);
  // basement-stairs: fell about an hour before she called at 23:05
  assert.match(finding("basement-stairs", "call"), /about an hour before she called, at 23:05/);
  assert.match(said("caller"), /About an hour before I called.*five past eleven/s);
});

test("no case text names a time the case file doesn't, or anything before discovery", () => {
  for (const { key, caseId, text } of preSigningLines()) {
    if (!caseId) continue;
    const c = cases[caseId]!;
    const allowed = new Set<string>([toClock(c.foundAt, 0)]);
    for (const f of c.findings) {
      if (f.interp.kind === "alive-at") allowed.add(toClock(c.foundAt, f.interp.hoursBeforeFound));
      if (f.interp.kind === "after-meal") allowed.add(toClock(c.foundAt, f.interp.mealHoursBeforeFound));
      for (const m of `${f.text} ${f.meaning}`.matchAll(/\b\d{2}:\d{2}\b/g)) allowed.add(m[0]);
    }
    for (const m of text.matchAll(/\b(\d{2}):(\d{2})\b/g)) {
      const t = Number(m[1]) + Number(m[2]) / 60;
      const after = (((t - c.foundAt) % 24) + 24) % 24;
      assert.ok(allowed.has(m[0]) || after <= 11, `${key}: ${m[0]} is before ${caseId} was found and not in the case file`);
    }
  }
});

test("nothing before signing gives away a cause, manner or the time of death", () => {
  const banned = /homicide|murder|kill|\bblows?\b|struck|subdural|hematoma|heart attack|coronary|heart disease|overdose|warfarin|blood thinner/i;
  const truthTimes = WEEK_CASES.map((id) => toClock(cases[id]!.foundAt, cases[id]!.truth.hoursDead));
  for (const { key, text } of preSigningLines()) {
    // the kitchen daughter may point at the medicine cabinet, but not name what's in it
    assert.doesNotMatch(text, banned, `${key} gives the answer away: ${text}`);
    for (const t of truthTimes) assert.ok(!text.includes(t), `${key} names the time of death ${t}`);
  }
});

test("the reviews after signing tell the same story as the case files", () => {
  const review = (id: string) => week.review.cases[id]!.map(([, t]) => t).join(" ");
  assert.match(review("night-shift"), /window/);
  assert.match(review("night-shift"), /natural/);
  assert.match(review("kitchen-floor"), /warfarin/i);
  assert.match(review("kitchen-floor"), /accident/i);
  assert.match(review("basement-stairs"), /Homicide/);
  assert.match(review("basement-stairs"), /not a verdict/);
  for (const id of WEEK_CASES) assert.equal(cases[id]!.truth.manner, { "night-shift": "natural", "kitchen-floor": "accident", "basement-stairs": "homicide" }[id]);
});
