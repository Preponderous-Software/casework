// The terminal adapter, driven the way an AI playtester would: one command per line on stdin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const cli = resolve(import.meta.dirname, "..", "src", "adapters", "cli", "play.ts");
const run = (caseId: string, moves: string[]) => spawnSync(process.execPath, [cli, caseId], { input: moves.join("\n") + "\n", encoding: "utf8", timeout: 60000 });

test("the basement case, played in the terminal, catches the timeline trap", () => {
  const moves = [
    "run scene", "interpret call", "interpret steps", "answer 2",
    "run external", "examine abdomen", "interpret temp", "answer 2",
    "examine jaw", "interpret rigor", "answer 1",
    "examine back", "turn", "examine back", "interpret livor", "answer 1",
    "turn", "examine head", "interpret scalp", "examine left-arm", "interpret arms", "answer 1",
    "run autopsy", "interpret skull", "run tox", "interpret tox", "answer 1",
    "link call time", "link temp time", "link rigor time", "link livor time",
    "link scalp cause", "link skull cause", "link scalp manner", "link arms manner", "link steps manner",
    "window 15:40 18:40", "cause blows", "manner homicide", "sign",
  ];
  const r = run("basement-stairs", moves);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Turn the body over to examine that\./);
  assert.match(r.stdout, /Lesson: Head injury/);
  assert.match(r.stdout, /Signed\. 11\/12/);
  assert.match(r.stdout, /link call → time didn't hold/);
  assert.match(r.stdout, /Daniel Ortiz/);
});

test("an unknown case lists the real ones", () => {
  const r = run("no-such-case", []);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /night-shift, kitchen-floor, basement-stairs/);
});
