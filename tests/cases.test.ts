import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { caseProblems, type CaseDef } from "../src/casework/case/model.ts";
import { agreement, bars, caseSkills, MAX_SCORE, signBlockers, startCase, step, type CaseState, type Command, type Ctx, type Event } from "../src/casework/case/play.ts";
import type { Lesson } from "../src/kernel/lessons.ts";
import type { SkillId } from "../src/kernel/skills.ts";

const dir = resolve(import.meta.dirname, "..", "packs", "forensics-core");
const manifest = JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8"));
const lessons: Lesson[] = JSON.parse(readFileSync(resolve(dir, manifest.lessons), "utf8"));
const cases: CaseDef[] = manifest.cases.map((p: string) => JSON.parse(readFileSync(resolve(dir, p), "utf8")));
const declared = new Set<string>(manifest.skills.map((s: { id: string }) => s.id));

function allSkills(def: CaseDef, level: "novice" | "practiced" | "mastered" = "practiced"): Ctx {
  return { skills: Object.fromEntries(caseSkills(def).map((k) => [k, level])) as Ctx["skills"] };
}

/** Play a list of commands, failing on any rejection. */
function play(def: CaseDef, cmds: Command[], ctx: Ctx, s: CaseState = startCase(def)): { state: CaseState; events: Event[] } {
  const events: Event[] = [];
  for (const c of cmds) {
    const r = step(def, s, c, ctx);
    const bad = r.events.find((e) => e.type === "rejected" || e.type === "needs-skill");
    assert.equal(bad, undefined, `${def.id}: ${JSON.stringify(c)} → ${JSON.stringify(bad)}`);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

/** An expert's play, built only from the case data: par procedures, every region in the right
 * pose, every finding interpreted, every link that holds, the window where the bars agree. */
function expert(def: CaseDef, ctx: Ctx): { state: CaseState; events: Event[] } {
  const order: string[] = [];
  const add = (id: string) => {
    if (order.includes(id)) return;
    for (const r of def.procedures.find((p) => p.id === id)?.requires ?? []) add(r);
    order.push(id);
  };
  def.truth.par.forEach(add);
  const cmds: Command[] = [];
  for (const id of order) {
    cmds.push({ type: "run", procedure: id });
    for (const f of def.findings.filter((x) => x.procedure === id && x.region)) cmds.push({ type: "examine", region: f.region!, pose: f.pose ?? "supine" });
  }
  let r = play(def, cmds, ctx);
  const revealed = r.state.revealed;
  r = play(def, revealed.map((f) => ({ type: "interpret", finding: f }) as Command), ctx, r.state);
  const bs = bars(def, r.state, ctx);
  const agree = agreement(bs);
  assert.ok(agree, `${def.id}: bars don't agree`);
  const links: Command[] = [];
  for (const b of bs) links.push({ type: "link", finding: b.finding, line: "time" });
  for (const f of def.findings.filter((x) => revealed.includes(x.id))) {
    if (f.supports?.some((s) => s.line === "cause" && s.value === def.truth.cause)) links.push({ type: "link", finding: f.id, line: "cause" });
    if (f.supports?.some((s) => s.line === "manner" && s.value === def.truth.manner)) links.push({ type: "link", finding: f.id, line: "manner" });
  }
  return play(
    def,
    [...links, { type: "window", from: agree!.from, to: agree!.to }, { type: "cause", value: def.truth.cause }, { type: "manner", value: def.truth.manner }, { type: "sign" }],
    ctx,
    r.state,
  );
}

test("there are cases, and their data is valid", () => {
  assert.ok(cases.length >= 3);
  assert.deepEqual(cases.flatMap(caseProblems), []);
  assert.deepEqual(cases.map((c) => c.order), [...cases.map((c) => c.order)].sort((a, b) => a - b), "listed in order");
});

test("every skill a case uses is declared and has a lesson to teach it and one to review it", () => {
  for (const c of cases) {
    for (const k of caseSkills(c)) {
      assert.ok(declared.has(k), `${c.id}: ${k} not declared`);
      assert.ok(lessons.filter((l) => l.skill === k).length >= 2, `${c.id}: ${k} needs two lessons`);
    }
  }
});

for (const c of cases) {
  test(`${c.id}: an expert scores ${MAX_SCORE}/${MAX_SCORE} using only what the case shows`, () => {
    const { events } = expert(c, allSkills(c));
    const signed = events.find((e) => e.type === "signed");
    assert.ok(signed && signed.type === "signed");
    assert.equal(signed.score.total, MAX_SCORE, JSON.stringify(signed.score));
  });

  test(`${c.id}: every timing bar holds the true time, and they agree on a window of 3 h or less`, () => {
    const ctx = allSkills(c);
    let s = startCase(c);
    s = { ...s, revealed: c.findings.map((f) => f.id), interpreted: c.findings.map((f) => f.id) };
    const bs = bars(c, s, ctx);
    for (const b of bs) assert.ok(c.truth.hoursDead >= b.from && c.truth.hoursDead <= b.to, `${b.label}: ${b.from}–${b.to} vs ${c.truth.hoursDead}`);
    const a = agreement(bs)!;
    assert.ok(a.to - a.from <= 3.01, `${c.id}: agreement is ${(a.to - a.from).toFixed(2)} h`);
  });

  test(`${c.id}: novice skills still find the truth, just less precisely`, () => {
    const practiced = expert(c, allSkills(c)).events.find((e) => e.type === "signed");
    const novice = expert(c, allSkills(c, "novice")).events.find((e) => e.type === "signed");
    assert.ok(practiced?.type === "signed" && novice?.type === "signed");
    assert.ok(novice.score.hit, "novice window still holds the truth");
    assert.ok(novice.score.widthHours >= practiced.score.widthHours);
  });
}

test("the reducer refuses out-of-order and impossible actions with a reason", () => {
  const c = cases[0]!;
  const ctx = allSkills(c);
  const s = startCase(c);
  const why = (cmd: Command, st: CaseState = s) => step(c, st, cmd, ctx).events[0];
  assert.equal(why({ type: "run", procedure: "autopsy" })?.type, "rejected", "autopsy needs the external exam");
  assert.equal(why({ type: "examine", region: "jaw", pose: "supine" })?.type, "rejected", "exam not started");
  assert.equal(why({ type: "sign" })?.type, "rejected");
  const ran = play(c, [{ type: "run", procedure: "external" }], ctx).state;
  assert.match(JSON.stringify(why({ type: "examine", region: "back", pose: "supine" }, ran)), /Turn the body/);
  assert.equal(why({ type: "examine", region: "right-leg", pose: "supine" }, ran)?.type, "nothing-new");
});

test("an unknown skill asks for a lesson instead of interpreting", () => {
  const c = cases[0]!;
  const ran = play(c, [{ type: "run", procedure: "external" }, { type: "examine", region: "jaw", pose: "supine" }], { skills: {} }).state;
  const r = step(c, ran, { type: "interpret", finding: "rigor" }, { skills: {} });
  assert.deepEqual(r.events, [{ type: "needs-skill", finding: "rigor", skill: "forensics.rigor-mortis" as SkillId }]);
});

test("the trap in the basement case: linking the wife's account to the time line costs reasoning", () => {
  const c = cases.find((x) => x.id === "basement-stairs")!;
  const ctx = allSkills(c);
  const good = expert(c, ctx);
  const unsigned = { ...good.state, signed: false };
  const withTrap = play(c, [{ type: "link", finding: "call", line: "time" }, { type: "sign" }], ctx, unsigned);
  const signed = withTrap.events.find((e) => e.type === "signed");
  assert.ok(signed?.type === "signed");
  assert.equal(signed.score.reasoning, 1);
  assert.deepEqual(signed.score.badLinks, [{ finding: "call", line: "time" }]);
});

test("extra procedures cost the efficiency point and time; wrong answers queue review skills", () => {
  const c = cases.find((x) => x.id === "basement-stairs")!;
  const ctx = allSkills(c);
  const base = expert(c, ctx).state;
  const r = play(c, [{ type: "run", procedure: "xray" }, { type: "manner", value: "accident" }, { type: "cause", value: "fall" }], ctx, { ...base, signed: false, links: base.links.filter((l) => l.line === "time") });
  const withLinks = play(c, [{ type: "link", finding: "steps", line: "manner" }, { type: "link", finding: "scalp", line: "cause" }, { type: "sign" }], ctx, r.state);
  const signed = withLinks.events.find((e) => e.type === "signed");
  assert.ok(signed?.type === "signed");
  assert.equal(signed.score.efficiency, 0);
  assert.deepEqual(signed.score.extra, ["xray"]);
  assert.equal(signed.score.cause, 0);
  assert.equal(signed.score.manner, 0);
  assert.ok(signed.score.review.includes("forensics.head-injury" as SkillId));
  assert.deepEqual(signBlockers(withLinks.state), []);
});
