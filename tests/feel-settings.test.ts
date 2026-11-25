// The first-person settings loader: tolerant of anything storage might hold, and always in range.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RANGES, SETTINGS_KEY, cleanSettings, defaultSettings, loadSettings, onSettingsChange, parseSettings, saveSettings } from "../src/adapters/fp/ui/settings.ts";

const D = defaultSettings(false);

test("nothing saved, or a broken record, gives the defaults", () => {
  for (const t of [null, undefined, "", "{", "not json", "null", "42", '"text"', "[]", "[1,2]", "true"]) {
    assert.deepEqual(parseSettings(t, D), D, `input ${String(t)}`);
  }
});

test("good values survive a round trip", () => {
  const s = { sensitivity: 1.7, invertY: true, fov: 90, reducedMotion: true, volume: 0.35, muted: true };
  assert.deepEqual(parseSettings(JSON.stringify(s), D), s);
});

test("numbers are clamped to their ranges and fov is whole degrees", () => {
  const s = cleanSettings({ sensitivity: 99, fov: 10, volume: -3 }, D);
  assert.equal(s.sensitivity, RANGES.sensitivity[1]);
  assert.equal(s.fov, RANGES.fov[0]);
  assert.equal(s.volume, 0);
  assert.equal(cleanSettings({ fov: 72.6 }, D).fov, 73);
});

test("numeric strings from an old save count; junk takes the default", () => {
  assert.equal(cleanSettings({ sensitivity: "1.5" }, D).sensitivity, 1.5);
  for (const v of [null, "", "  ", true, {}, [], NaN, Infinity, "abc"]) {
    assert.equal(cleanSettings({ sensitivity: v, volume: v }, D).sensitivity, D.sensitivity, `value ${String(v)}`);
    assert.equal(cleanSettings({ volume: v }, D).volume, D.volume, `volume ${String(v)}`);
  }
});

test("booleans accept true/false and the strings, nothing else", () => {
  assert.equal(cleanSettings({ invertY: "true" }, D).invertY, true);
  assert.equal(cleanSettings({ muted: "false" }, { ...D, muted: true }).muted, false);
  assert.equal(cleanSettings({ invertY: 1 }, D).invertY, false);
  assert.equal(cleanSettings({ reducedMotion: "yes" }, { ...D, reducedMotion: true }).reducedMotion, true);
});

test("a half-written record keeps what it has and fills the rest", () => {
  const s = parseSettings('{"volume":0.2,"extra":"dropped"}', D);
  assert.deepEqual(s, { ...D, volume: 0.2 });
  assert.equal("extra" in s, false);
});

test("defaults follow the reduced-motion hint and are themselves clean", () => {
  assert.equal(defaultSettings(true).reducedMotion, true);
  assert.deepEqual(cleanSettings(D, D), D);
});

test("save writes the cleaned record and tells listeners; load reads it back", () => {
  const store = new Map<string, string>();
  const g = globalThis as { localStorage?: unknown };
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  try {
    const seen: number[] = [];
    const off = onSettingsChange((s) => seen.push(s.volume));
    saveSettings({ ...D, volume: 5 });
    off();
    saveSettings({ ...D, volume: 0.5 });
    assert.deepEqual(seen, [1]);
    assert.equal(JSON.parse(store.get(SETTINGS_KEY) ?? "{}").volume, 0.5);
    assert.equal(loadSettings().volume, 0.5);
  } finally {
    delete g.localStorage;
  }
});

test("storage that throws never breaks load or save", () => {
  const g = globalThis as { localStorage?: unknown };
  g.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
  try {
    assert.doesNotThrow(() => saveSettings(D));
    assert.equal(typeof loadSettings().volume, "number");
  } finally {
    delete g.localStorage;
  }
});
