import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { scanModCompatibility } from "../scripts/mod-compatibility.mjs";
import { buildContentPatcherCatalogOverlay } from "../scripts/content-patcher-catalog.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "companion-mods-"));
  const addMod = (directory, manifest, content) => {
    const target = join(root, directory);
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "manifest.json"), JSON.stringify(manifest), "utf8");
    if (content) writeFileSync(join(target, "content.json"), JSON.stringify(content), "utf8");
    return target;
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

test("supported local crop, object, and shop additions are catalog-aware", async () => {
  const files = fixture();
  try {
    const pack = files.addMod("Crop Pack", {
      UniqueID: "Example.Crops",
      ContentPackFor: { UniqueID: "Pathoschild.ContentPatcher" },
    }, { Changes: [
      { Action: "EditData", Target: "Data/Objects", Entries: { "Example.Seed": { Name: "Example Seed", Price: 10 } } },
      { Action: "EditData", Target: "Data/Crops", Entries: { "Example.Seed": { Seasons: ["Spring"], DaysInPhase: [1], HarvestItemId: "Example.Fruit" } } },
      { Action: "EditData", Target: "Data/Shops", TargetField: ["SeedShop", "Items"], Entries: { Example: { Id: "Example", ItemId: "Example.Seed", Price: 25 } } },
      { Action: "Load", Target: "Mods/Example.Crops/Fruit", FromFile: "fruit.png" },
    ] });
    writeFileSync(join(pack, "fruit.png"), Buffer.from("not-a-committed-game-asset"));
    const summary = scanModCompatibility(files.root);
    assert.equal(summary.status, "mod-aware");
    assert.deepEqual(summary.supportedDomains, ["items", "crops"]);
    assert.deepEqual(summary.uncertainDomains, []);
    const overlay = await buildContentPatcherCatalogOverlay(files.root);
    assert.equal(overlay.objects["Example.Seed"].Name, "Example Seed");
    assert.equal(overlay.crops["Example.Seed"].HarvestItemId, "Example.Fruit");
    assert.deepEqual(overlay.shopItems, [{ shopId: "SeedShop", items: [{ Id: "Example", ItemId: "Example.Seed", Price: 25 }] }]);
    assert.equal(overlay.textures["mods/example.crops/fruit"], join(pack, "fruit.png"));
  } finally {
    files.cleanup();
  }
});

test("conditional or tokenized crop edits and code mods produce explicit uncertainty", async () => {
  const files = fixture();
  try {
    files.addMod("Crop Pack", {
      UniqueID: "PrivateName.NeverExported",
      ContentPackFor: { UniqueID: "Pathoschild.ContentPatcher" },
    }, { Changes: [{ Action: "EditData", Target: "Data/Crops", When: { Season: "spring" }, Entries: { "{{Token}}": {} } }] });
    files.addMod("Gameplay Mod", { UniqueID: "Example.Gameplay", Version: "2.0.0" });
    const summary = scanModCompatibility(files.root);
    assert.equal(summary.status, "uncertain");
    assert.deepEqual(summary.alteredDomains, ["crops"]);
    assert.deepEqual(summary.uncertainDomains, ["crops", "other"]);
    assert.equal(summary.unclassifiedCodeModCount, 1);
    assert.deepEqual((await buildContentPatcherCatalogOverlay(files.root)).crops, {});
    assert.doesNotMatch(JSON.stringify(summary), /PrivateName|Gameplay Mod|companion-mods/i);
  } finally {
    files.cleanup();
  }
});
