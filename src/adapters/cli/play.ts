// Play a case in the terminal: for people, for AI playtesters and for scripted checks.
//
//   node src/adapters/cli/play.ts night-shift            # interactive
//   node src/adapters/cli/play.ts night-shift < moves.txt # scripted (one command per line)
//
// Type "help" for commands. Skills start unknown; when a finding needs one, the lesson is shown
// and "answer <n>" answers it, exactly as the lesson sheet does in the browser.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import type { CaseDef, Line, Manner } from "../../casework/case/model.ts";
import { MANNERS } from "../../casework/case/model.ts";
import { agreement, bars, linkHolds, MAX_SCORE, signBlockers, startCase, step, type CaseState, type Command, type Event } from "../../casework/case/play.ts";
import { fromClock, toClock } from "../../casework/case/clock.ts";
import { isCorrect, type Lesson } from "../../kernel/lessons.ts";
import { afterLesson, type Mastery, type SkillId } from "../../kernel/skills.ts";

const PACK = resolve(import.meta.dirname, "..", "..", "..", "packs", "forensics-core");
const manifest = JSON.parse(readFileSync(resolve(PACK, "manifest.json"), "utf8"));
const lessons: Lesson[] = JSON.parse(readFileSync(resolve(PACK, manifest.lessons), "utf8"));
const cases: CaseDef[] = manifest.cases.map((p: string) => JSON.parse(readFileSync(resolve(PACK, p), "utf8")));

const id = process.argv[2];
const def = cases.find((c) => c.id === id);
if (!def) {
  console.log(`Usage: node src/adapters/cli/play.ts <case>\nCases: ${cases.map((c) => c.id).join(", ")}`);
  process.exit(id ? 1 : 0);
}

const skills: Partial<Record<SkillId, Mastery>> = {};
let state: CaseState = startCase(def);
let pose: "supine" | "prone" = "supine";
let pending: { lesson: Lesson; finding: string } | null = null;
const ctx = () => ({ skills });
const clock = (h: number) => toClock(def.foundAt, h);
const out = (s = "") => console.log(s);

const HELP = `Commands:
  look                      what you know so far
  run <procedure>           ${def.procedures.map((p) => p.id).join(", ")}
  examine <region>          head, jaw, neck, chest, abdomen, back, left-arm, right-arm, left-leg, right-leg
  turn                      turn the body over (face ${pose === "supine" ? "down" : "up"})
  interpret <finding>       turn a finding into evidence (may need a lesson first)
  answer <n>                answer the open lesson
  link <finding> <line>     time, cause or manner
  unlink <finding> <line>
  window <HH:MM> <HH:MM>    earliest and latest time of death
  cause <id>                ${def.causes.map((c) => c.id).join(", ")}
  manner <m>                ${MANNERS.join(", ")}
  sign                      sign the certificate
  quit`;

function apply(cmd: Command): Event[] {
  const r = step(def!, state, cmd, ctx());
  state = r.state;
  for (const e of r.events) narrate(e);
  return r.events;
}

function narrate(e: Event) {
  const f = (fid: string) => def!.findings.find((x) => x.id === fid)!;
  switch (e.type) {
    case "ran": {
      const p = def!.procedures.find((x) => x.id === e.procedure)!;
      out(`${p.name} done (${state.hoursLeft} h and $${state.budget} left).`);
      for (const id of e.revealed) out(`  • [${id}] ${f(id).text}`);
      if (p.exam) out("  Examine the body region by region.");
      return;
    }
    case "revealed":
      return out(`  • [${e.finding}] ${f(e.finding).text}`);
    case "nothing-new":
      return out(`Nothing new at the ${e.region}.`);
    case "interpreted":
      return out(`  ${f(e.finding).label}: ${f(e.finding).meaning}`);
    case "needs-skill": {
      const l = lessons.find((x) => x.skill === e.skill)!;
      pending = { lesson: l, finding: e.finding };
      out(`Lesson: ${l.title}\n  ${l.prompt}`);
      l.options.forEach((o, i) => out(`  ${i + 1}. ${o}`));
      return out("  (answer <n>)");
    }
    case "linked":
      return out(`Linked ${e.finding} to ${e.line}.`);
    case "unlinked":
      return out(`Unlinked ${e.finding} from ${e.line}.`);
    case "updated":
      return out(`Updated ${e.field}.`);
    case "rejected":
      return out(e.reason);
    case "signed": {
      const s = e.score;
      out(`\nSigned. ${s.total}/${MAX_SCORE}`);
      out(`  time ${s.time}/3 (${s.hit ? "held" : "missed"} ${clock(def!.truth.hoursDead)}, ${s.widthHours} h wide) · cause ${s.cause}/3 · manner ${s.manner}/3 · reasoning ${s.reasoning}/2 · efficiency ${s.efficiency}/1`);
      for (const l of s.badLinks) out(`  link ${l.finding} → ${l.line} didn't hold`);
      if (s.extra.length) out(`  not needed: ${s.extra.join(", ")}`);
      if (s.review.length) out(`  review: ${s.review.join(", ")}`);
      out(`\n${def!.person}\n${def!.story}`);
      return;
    }
  }
}

function look() {
  out(`${def!.title}: ${def!.intake}\n${def!.context}`);
  out(`Shift: ${state.hoursLeft} h, $${state.budget}. Body is face ${pose === "supine" ? "up" : "down"}. Done: ${state.done.join(", ") || "nothing yet"}.`);
  for (const id of state.revealed) {
    const f = def!.findings.find((x) => x.id === id)!;
    out(`  [${id}] ${f.label}${state.interpreted.includes(id) ? ` – ${f.meaning}` : " (not interpreted)"}`);
  }
  const bs = bars(def!, state, ctx());
  for (const b of bs) out(`  time evidence ${b.label}: ${clock(b.to)}–${clock(b.from)} (${b.mastery})`);
  const a = agreement(bs);
  if (a && bs.length > 1) out(`  bars agree on ${clock(a.to)}–${clock(a.from)}`);
  for (const line of ["time", "cause", "manner"] as Line[]) {
    const ls = state.links.filter((l) => l.line === line);
    out(`  ${line}: ${ls.map((l) => l.finding + (state.signed ? (linkHolds(def!, state, l) ? " ✓" : " ✗") : "")).join(", ") || "no links"}`);
  }
  if (state.window) out(`  window ${clock(state.window.to)}–${clock(state.window.from)}`);
  if (state.cause) out(`  cause ${state.cause}`);
  if (state.manner) out(`  manner ${state.manner}`);
  const b = signBlockers(state);
  if (!state.signed && b.length) out(`  to sign: ${b.join(" ")}`);
}

function handle(line: string): boolean {
  const [verb = "", ...a] = line.trim().split(/\s+/);
  switch (verb.toLowerCase()) {
    case "":
      return true;
    case "help":
      out(HELP);
      return true;
    case "look":
      look();
      return true;
    case "quit":
    case "exit":
      return false;
    case "turn":
      pose = pose === "supine" ? "prone" : "supine";
      out(`The body is now face ${pose === "supine" ? "up" : "down"}.`);
      return true;
    case "run":
      apply({ type: "run", procedure: a[0] ?? "" });
      return true;
    case "examine":
      apply({ type: "examine", region: a[0] ?? "", pose });
      return true;
    case "interpret":
      apply({ type: "interpret", finding: a[0] ?? "" });
      return true;
    case "answer": {
      if (!pending) {
        out("No lesson is open.");
        return true;
      }
      const choice = Number(a[0]) - 1;
      const right = isCorrect(pending.lesson, choice);
      skills[pending.lesson.skill] = afterLesson(skills[pending.lesson.skill] ?? "unknown", right);
      out(`${right ? "Correct." : "Not quite."} ${pending.lesson.explain}`);
      out(`  ${pending.lesson.title}: ${skills[pending.lesson.skill]}`);
      const fid = pending.finding;
      pending = null;
      apply({ type: "interpret", finding: fid });
      return true;
    }
    case "link":
    case "unlink":
      apply({ type: verb as "link" | "unlink", finding: a[0] ?? "", line: (a[1] ?? "") as Line });
      return true;
    case "window": {
      const x = fromClock(def!.foundAt, a[0] ?? ""), y = fromClock(def!.foundAt, a[1] ?? "");
      if (x === null || y === null) out("Use: window HH:MM HH:MM");
      else apply({ type: "window", from: Math.min(x, y), to: Math.max(x, y) });
      return true;
    }
    case "cause":
      apply({ type: "cause", value: a[0] ?? "" });
      return true;
    case "manner":
      apply({ type: "manner", value: (a[0] ?? "") as Manner });
      return true;
    case "sign":
      apply({ type: "sign" });
      return !state.signed;
    default:
      out(`Unknown command "${verb}". Type help.`);
      return true;
  }
}

out(`${def.title}\n${def.intake}\n${def.context}${def.note ? `\nNote: ${def.note}` : ""}\nType help for commands.\n`);
const tty = process.stdin.isTTY ?? false;
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: tty, prompt: tty ? "> " : "" });
rl.prompt();
rl.on("line", (l) => {
  if (!process.stdin.isTTY && l.trim()) out(`> ${l.trim()}`);
  if (!handle(l)) rl.close();
  else rl.prompt();
});
