import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lessonProblems, type Lesson } from "../src/kernel/lessons.ts";
import { SKILL } from "../src/casework/drill.ts";

const dir = resolve(import.meta.dirname, "..", "packs", "forensics-core");
const manifest = JSON.parse(readFileSync(resolve(dir, "manifest.json"), "utf8"));
const lessons: Lesson[] = JSON.parse(readFileSync(resolve(dir, manifest.lessons), "utf8"));

test("every lesson is well formed and cites a source", () => {
  assert.deepEqual(lessons.flatMap(lessonProblems), []);
});

test("lesson ids are unique and every lesson's skill is declared in the manifest", () => {
  const ids = lessons.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  const declared = new Set(manifest.skills.map((s: { id: string }) => s.id));
  for (const l of lessons) assert.ok(declared.has(l.skill), `${l.id}: ${l.skill} not in manifest`);
});

test("every drill skill has a just-in-time lesson and at least one review question", () => {
  for (const skill of Object.values(SKILL)) {
    assert.ok(lessons.filter((l) => l.skill === skill).length >= 2, `${skill} needs two lessons`);
  }
});

test("the content is CC BY-SA 4.0", () => {
  assert.equal(manifest.license, "CC-BY-SA-4.0");
});
