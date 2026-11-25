// The dialogue queue: type-out, press to reveal, press to move on, done after the last line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { advance, current, lineComplete, monogram, speakerHue, startDialogue, tickDialogue, visibleText } from "../src/adapters/fp/ui/dialogue.ts";

const L = [
  { who: "ruiz", name: "Dr. Ana Ruiz", text: "Morning. Your first case is on the board." },
  { who: "you", name: "You", text: "On it." },
];

test("an empty queue is done at once", () => {
  assert.equal(startDialogue([]).done, true);
  assert.equal(current(startDialogue([])), null);
  assert.equal(startDialogue([{ who: "x", name: "X", text: "" }]).done, true);
});

test("a line types out over time and stops at its end", () => {
  let s = startDialogue(L);
  assert.equal(visibleText(s), "");
  s = tickDialogue(s, 0.1, 50);
  assert.equal(visibleText(s), "Morni");
  s = tickDialogue(s, 100, 50);
  assert.equal(visibleText(s), L[0]!.text);
  assert.equal(lineComplete(s), true);
});

test("first press reveals, second moves on, last press finishes", () => {
  let s = startDialogue(L);
  let r = advance(s);
  assert.equal(r.did, "reveal");
  assert.equal(visibleText(r.state), L[0]!.text);
  r = advance(r.state);
  assert.equal(r.did, "next");
  assert.equal(current(r.state)?.who, "you");
  assert.equal(visibleText(r.state), "");
  r = advance(r.state);
  assert.equal(r.did, "reveal");
  r = advance(r.state);
  assert.equal(r.did, "done");
  assert.equal(r.state.done, true);
  assert.equal(advance(r.state).did, "done");
  s = r.state;
  assert.equal(current(s), null);
});

test("instant mode (reduced motion) shows whole lines, so each press moves on", () => {
  let s = startDialogue(L, true);
  assert.equal(visibleText(s), L[0]!.text);
  let r = advance(s, true);
  assert.equal(r.did, "next");
  assert.equal(visibleText(r.state), "On it.");
  r = advance(r.state, true);
  assert.equal(r.did, "done");
});

test("the queue never mutates the lines it was given", () => {
  const copy = JSON.parse(JSON.stringify(L));
  let s = startDialogue(L);
  while (!s.done) s = advance(s).state;
  assert.deepEqual(L, copy);
});

test("speaker monograms and colours are short and stable", () => {
  assert.equal(monogram("Dr. Ana Ruiz"), "AR");
  assert.equal(monogram("You"), "You");
  assert.equal(monogram("Marguerite"), "M");
  assert.equal(monogram(""), "");
  assert.equal(speakerHue("ruiz"), speakerHue("ruiz"));
  for (const w of ["ruiz", "neighbor", "daughter", "caller", "narrator"]) {
    const h = speakerHue(w);
    assert.ok(Number.isInteger(h) && h >= 0 && h < 360);
  }
});
