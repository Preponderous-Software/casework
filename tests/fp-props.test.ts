import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MeshBuilder } from "../src/adapters/exam3d/mesh.ts";
import { figureMesh, lightPanels, propMesh, shellMesh } from "../src/adapters/fp/props.ts";
import { PROP_KINDS } from "../src/casework/world/location.ts";
import type { Location } from "../src/casework/world/types.ts";

test("every prop kind builds a mesh Strata will accept", () => {
  for (const kind of PROP_KINDS) {
    for (const yaw of [0, 1.1]) {
      const m = new MeshBuilder(), g = new MeshBuilder();
      propMesh({ id: kind, kind, at: [1, 0, 2], size: [1.2, kind === "lamp" ? 0.12 : 1.4, 0.8], yaw, color: "wood" }, m, g);
      assert.ok(m.count + g.count > 0, kind);
      assert.deepEqual(m.badNormals(), [], kind);
      assert.deepEqual(g.badNormals(), [], kind);
      assert.ok(m.indices.every((i) => i < m.count), kind);
    }
  }
});

test("the office and every scene build without bad normals", () => {
  const base = resolve(import.meta.dirname, "..", "packs/forensics-core/world");
  for (const f of ["office.json", "scenes/scene-night-shift.json", "scenes/scene-kitchen-floor.json", "scenes/scene-basement-stairs.json"]) {
    const loc = JSON.parse(readFileSync(resolve(base, f), "utf8")) as Location;
    const m = new MeshBuilder(), g = new MeshBuilder();
    for (const p of loc.props) propMesh(p, m, g);
    for (const b of [m, g, shellMesh(loc), lightPanels(loc)]) assert.deepEqual(b.badNormals(), [], f);
  }
  assert.deepEqual(figureMesh([0, 0, 0], 0.5).badNormals(), []);
});
