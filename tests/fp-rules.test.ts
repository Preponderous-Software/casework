import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { startCase, step } from "../src/casework/case/play.ts";
import type { CaseDef } from "../src/casework/case/model.ts";
import { promptFor, unlookedSceneFindings, visibleFindings } from "../src/adapters/fp/rules.ts";
import { FP_SAVE_KEY, loadSave, migrateSave, newSave, storeSave } from "../src/adapters/fp/save.ts";
import type { Interactable } from "../src/casework/world/types.ts";

const def = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "packs/forensics-core/cases/night-shift.json"), "utf8")) as CaseDef;
const ctx = { skills: {} };

test("scene findings show in the notebook only once looked at", () => {
  const s = step(def, startCase(def), { type: "run", procedure: "scene" }, ctx).state;
  assert.deepEqual(visibleFindings(def, s, []), []);
  assert.deepEqual(visibleFindings(def, s, ["window"]), ["window"]);
  assert.deepEqual(unlookedSceneFindings(def, ["window"]), ["neighbor", "pills"]);
  const s2 = step(def, s, { type: "run", procedure: "external" }, ctx).state;
  const s3 = step(def, s2, { type: "run", procedure: "autopsy" }, ctx).state;
  assert.ok(visibleFindings(def, s3, []).includes("heart"), "non-scene findings show at once");
});

test("prompts carry costs and say when a station isn't needed", () => {
  const tox: Interactable = { id: "t", at: [0, 1, 0], label: "Send blood for toxicology", action: { kind: "procedure", procedure: "tox" } };
  const xray: Interactable = { id: "x", at: [0, 1, 0], label: "Take X-rays", action: { kind: "procedure", procedure: "xray" } };
  const s = startCase(def);
  assert.match(promptFor(tox, def, s), /\(\d+ h/);
  assert.match(promptFor(xray, def, s), /not needed/);
  assert.equal(promptFor(tox, null, null), tox.label);
  const exam: Interactable = { id: "e", at: [0, 1, 0], label: "Examine the body", action: { kind: "exam" } };
  assert.match(promptFor(exam, def, s), /^Begin the external exam/i);
  assert.match(promptFor(exam, null, null), /empty/);
});

test("saves round-trip, and unreadable ones are kept aside", () => {
  const mem = new Map<string, string>();
  const kv = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  assert.equal(loadSave(kv).save, null);
  const s = { ...newSave({ version: 1 }), active: "night-shift", cases: { "night-shift": startCase(def) }, at: { location: "office", x: 1, z: 2, yaw: 0.5 } };
  storeSave(kv, s);
  const back = loadSave(kv).save!;
  assert.equal(back.active, "night-shift");
  assert.equal(back.at.x, 1);
  mem.set(FP_SAVE_KEY, "{not json");
  const r = loadSave(kv);
  assert.equal(r.save, null);
  assert.ok(r.warning);
  assert.ok([...mem.keys()].some((k) => k.startsWith(`${FP_SAVE_KEY}.unreadable.`)));
  assert.equal(migrateSave({ ...s, version: 99 }), null, "a newer save is refused, not overwritten");
  assert.ok(!mem.has("casework.profile"), "the kernel profile is untouched");
});

test("a fresh save's unknown position survives JSON (NaN becomes null and back)", () => {
  const back = migrateSave(JSON.parse(JSON.stringify(newSave(null))));
  assert.ok(back && Number.isNaN(back.at.x));
});
