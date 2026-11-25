// Audio and prompt helpers that need no browser: perceptual volume, the sound lists, prompt labels.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AMBIENCES, SFX, gainFor } from "../src/adapters/fp/audio/audio.ts";
import { promptLabel } from "../src/adapters/fp/ui/hud.ts";

test("volume is perceptual (squared), clamped, and mute is silence", () => {
  assert.equal(gainFor(1, false), 1);
  assert.equal(gainFor(0.5, false), 0.25);
  assert.equal(gainFor(0.8, true), 0);
  assert.equal(gainFor(3, false), 1);
  assert.equal(gainFor(-1, false), 0);
  assert.equal(gainFor(NaN, false), 0);
});

test("every ambience and sound effect the contract names exists", () => {
  assert.deepEqual([...AMBIENCES].sort(), ["basement", "house-day", "house-night", "morgue", "office"]);
  assert.deepEqual([...SFX].sort(), ["beep", "click", "door", "drawer", "fail", "paper", "sign", "step", "success"]);
});

test("a prompt passed with its key in front shows just the label", () => {
  assert.equal(promptLabel("E  Read the intake board"), "Read the intake board");
  assert.equal(promptLabel("Read the intake board"), "Read the intake board");
  assert.equal(promptLabel("A sealed envelope"), "A sealed envelope");
  assert.equal(promptLabel("Examine the body"), "Examine the body");
});
