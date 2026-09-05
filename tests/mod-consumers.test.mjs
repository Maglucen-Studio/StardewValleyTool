import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { addCatalogEntries, npcMetadata } from "../scripts/mod-consumers.mjs";

test("accepted NPC additions preserve text while collisions retain original data", () => {
  const target = { Existing: "original" };
  const diagnostic = { status: "mod-aware", uncertainDomains: [] };
  addCatalogEntries(target, { Existing: "replacement", Added: "new" }, diagnostic, "npcs");
  assert.deepEqual(target, { Existing: "original", Added: "new" });
  assert.deepEqual(diagnostic.uncertainDomains, ["npcs"]);
  assert.equal(diagnostic.status, "uncertain");
  assert.deepEqual(npcMetadata({ Added: { DisplayName: "[Strings:Unresolved]", BirthSeason: "spring", BirthDay: 3 } }), {
    Added: { displayName: "[Strings:Unresolved]", birthSeason: "spring", birthDay: 3 },
  });
  assert.equal(npcMetadata({ Added: { BirthDay: 40 } }).Added.birthDay, null);
});

test("mod recipes, buildings and NPCs reach snapshot consumers", () => {
  const result = spawnSync(process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"), [fileURLToPath(new URL("./mod_consumers_test.py", import.meta.url))], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});
