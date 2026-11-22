// The layer rule that keeps Casework movable: the learning kernel knows nothing about Casework or
// about any adapter, and the Casework core knows nothing about adapters. Only adapters touch the
// outside world (DOM, storage, Strata, clock).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";

const SRC = resolve(import.meta.dirname, "..", "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

function importsOf(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const m of text.matchAll(/(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) {
    const spec = m[1] ?? m[2];
    if (spec) found.push(spec);
  }
  return found;
}

function layerOf(abs: string): string {
  return relative(SRC, abs).split(/[\\/]/)[0] ?? "";
}

const ALLOWED: Record<string, string[]> = {
  kernel: ["kernel"],
  casework: ["kernel", "casework"],
  adapters: ["kernel", "casework", "adapters"],
};

test("each layer imports only from the layers beneath it", () => {
  const problems: string[] = [];
  for (const file of files(SRC)) {
    const from = layerOf(file);
    const allowed = ALLOWED[from];
    if (!allowed) continue;
    for (const spec of importsOf(file)) {
      if (!spec.startsWith(".")) {
        if (from !== "adapters") problems.push(`${relative(SRC, file)} imports package "${spec}"; only adapters may`);
        continue;
      }
      const to = layerOf(resolve(dirname(file), spec));
      if (!allowed.includes(to)) problems.push(`${relative(SRC, file)} (${from}) imports ${spec} (${to})`);
    }
  }
  assert.deepEqual(problems, []);
});
