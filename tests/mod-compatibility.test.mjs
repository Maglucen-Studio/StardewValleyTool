import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { scanModCompatibility } from "../scripts/mod-compatibility.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "companion-mods-"));
  const addMod = (directory, manifest, content) => {
    const target = join(root, directory);
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "manifest.json"), JSON.stringify(manifest), "utf8");
    if (content) writeFileSync(join(target, "content.json"), JSON.stringify(content), "utf8");
  };
  return { root, addMod, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test("a vanilla or SMAPI-default setup remains vanilla-derived", () => {
  const files = fixture();
  try {
    files.addMod("SaveBackup", { UniqueID: "SMAPI.SaveBackup", Version: "1.0.0" });
    files.addMod("Companion", { UniqueID: "maglucen.StardewValleyToolBridge", Version: "5.1.0" });
    const summary = scanModCompatibility(files.root);
    assert.equal(summary.status, "vanilla");
    assert.equal(summary.installedModCount, 2);
    assert.deepEqual(summary.alteredDomains, []);
  } finally {
    files.cleanup();
  }
});

test("supported Content Patcher NPC data is identified as mod-aware", () => {
  const files = fixture();
  try {
    files.addMod("NPC Pack", {
      UniqueID: "Example.Npcs",
      ContentPackFor: { UniqueID: "Pathoschild.ContentPatcher" },
    }, {
      Changes: [
        { Action: "EditData", Target: "Data/Characters", Entries: { Example: {} } },
        { Action: "Load", Target: "Portraits/Example", FromFile: "portrait.png" },
      ],
    });
    const summary = scanModCompatibility(files.root);
    assert.equal(summary.status, "mod-aware");
    assert.deepEqual(summary.alteredDomains, ["npcs"]);
    assert.deepEqual(summary.supportedDomains, ["npcs"]);
  } finally {
    files.cleanup();
  }
});

test("unverified crop edits and code mods produce explicit uncertainty", () => {
  const files = fixture();
  try {
    files.addMod("Crop Pack", {
      UniqueID: "PrivateName.NeverExported",
      ContentPackFor: { UniqueID: "Pathoschild.ContentPatcher" },
    }, { Changes: [{ Action: "EditData", Target: "Data/Crops", Entries: {} }] });
    files.addMod("Gameplay Mod", { UniqueID: "Example.Gameplay", Version: "2.0.0" });
    const summary = scanModCompatibility(files.root);
    assert.equal(summary.status, "uncertain");
    assert.deepEqual(summary.alteredDomains, ["crops"]);
    assert.deepEqual(summary.uncertainDomains, ["crops", "other"]);
    assert.equal(summary.unclassifiedCodeModCount, 1);
    assert.doesNotMatch(JSON.stringify(summary), /PrivateName|Gameplay Mod|companion-mods/i);
  } finally {
    files.cleanup();
  }
});
