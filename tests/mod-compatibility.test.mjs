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
    const pack = files.addMod("NPC Pack", {
      UniqueID: "Example.Npcs",
      ContentPackFor: { UniqueID: "Pathoschild.ContentPatcher" },
    }, {
      Changes: [
        { Action: "EditData", Target: "Data/Characters", Entries: { Example: {} } },
        { Action: "Load", Target: "Portraits/Example", FromFile: "portrait.png" },
      ],
    });
    writeFileSync(join(pack, "portrait.png"), Buffer.from("synthetic portrait"));
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

test("safe fish, recipe, building, and location additions are catalog-aware", async () => {
  const files = fixture();
  try {
    files.addMod("World Pack", {
      UniqueID: "Example.World",
      ContentPackFor: { UniqueID: "Pathoschild.ContentPatcher" },
    }, { Changes: [
      { Action: "EditData", Target: "Data/Fish", Entries: { "Example.Fish": "Example Fish/40/mixed/12/20/600 1200/spring/sunny/0/.4/0" } },
      { Action: "EditData", Target: "Data/CookingRecipes", Entries: { "Example Meal": "24 1/10 1/Example.Meal" } },
      { Action: "EditData", Target: "Data/Buildings", Entries: { "Example Shed": { Name: "Example Shed", BuildCost: 100 } } },
      { Action: "EditData", Target: "Data/Locations", Entries: { "Example Lake": { DisplayName: "Example Lake", Fish: [] } } },
      { Action: "EditData", Target: "Data/Locations", TargetField: ["Example Lake", "Fish"], Entries: { "Example.Spawn": { ItemId: "Example.Fish" } } },
    ] });
    const summary = scanModCompatibility(files.root);
    assert.equal(summary.status, "mod-aware");
    assert.deepEqual(summary.supportedDomains, ["fish", "recipes", "buildings", "locations"]);
    assert.deepEqual(summary.uncertainDomains, []);
    const overlay = await buildContentPatcherCatalogOverlay(files.root);
    assert.equal(overlay.fish["Example.Fish"].startsWith("Example Fish/"), true);
    assert.equal(overlay.cookingRecipes["Example Meal"], "24 1/10 1/Example.Meal");
    assert.equal(overlay.buildings["Example Shed"].BuildCost, 100);
    assert.equal(overlay.locations["Example Lake"].DisplayName, "Example Lake");
    assert.equal(overlay.locationFish[0].items[0].ItemId, "Example.Fish");
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

const cpManifest = (id) => ({ UniqueID: id, ContentPackFor: { UniqueID: "Pathoschild.ContentPatcher" } });

test("conditional includes identify uncertainty without contributing catalog entries", async () => {
  const files = fixture();
  try {
    const pack = files.addMod("Conditional", cpManifest("Example.Conditional"), { Changes: [
      { Action: "Include", FromFile: "nested.json", When: { Season: "spring" } },
    ] });
    writeFileSync(join(pack, "nested.json"), JSON.stringify({ Changes: [
      { Action: "EditData", Target: "Data/Crops", Entries: { Seed: { HarvestItemId: "Fruit" } } },
    ] }));
    const summary = scanModCompatibility(files.root);
    assert.equal(summary.status, "uncertain");
    assert.deepEqual(summary.supportedDomains, []);
    assert.ok(summary.uncertainDomains.includes("crops"));
    assert.deepEqual((await buildContentPatcherCatalogOverlay(files.root)).crops, {});
  } finally { files.cleanup(); }
});

test("conflicting additions are excluded independently of pack order and qualified ids stay distinct", async () => {
  for (const reversed of [false, true]) {
    const files = fixture();
    try {
      for (const [index, price] of (reversed ? [20, 10] : [10, 20]).entries())
        files.addMod(`Pack${index}`, cpManifest(`Example.${index}`), { Changes: [
          { Action: "EditData", Target: "Data/Objects", Entries: { Shared: { Price: price }, [`${index ? "(BC)" : "(O)"}100`]: { Price: price } } },
          { Action: "EditData", Target: "Data/Shops", TargetField: ["Shop", "Items"], Entries: { Shared: { ItemId: "Shared", Price: price } } },
        ] });
      const overlay = await buildContentPatcherCatalogOverlay(files.root);
      assert.equal(overlay.objects.Shared, undefined);
      assert.ok(overlay.objects["(BC)100"]);
      assert.ok(overlay.objects["(O)100"]);
      assert.deepEqual(overlay.shopItems.flatMap((entry) => entry.items), []);
      const summary = scanModCompatibility(files.root);
      assert.deepEqual(summary.uncertainDomains, ["items"]);
      assert.deepEqual(summary.supportedDomains, []);
    } finally { files.cleanup(); }
  }
});

test("malformed, tokenized and partial patches never claim NPC support", async () => {
  const files = fixture();
  try {
    files.addMod("Partial", cpManifest("Example.Partial"), { Changes: [
      { Action: "EditData", Target: "Data/Characters", Entries: { Example: {} }, Fields: { Example: { Age: "Adult" } } },
      { Action: "EditData", Target: "Data/NPCGiftTastes", Entries: { Example: null } },
      { Action: "Load", Target: "Portraits/Example", FromFile: "{{Season}}.png" },
      { Action: "EditData", Target: "Data/Locations", TargetField: ["{{Location}}", "Fish"], Entries: { Fish: {} } },
      { Action: "EditData", Target: "Data/Buildings", TargetField: "Cost", Entries: { Shed: {} } },
      { Action: "Include", FromFile: "{{Season}}.json" },
      null,
    ] });
    const summary = scanModCompatibility(files.root);
    assert.equal(summary.status, "uncertain");
    assert.deepEqual(summary.supportedDomains, []);
    assert.ok(summary.uncertainDomains.includes("npcs"));
    assert.ok(summary.uncertainDomains.includes("other"));
    const overlay = await buildContentPatcherCatalogOverlay(files.root);
    assert.deepEqual(overlay.characters, {});
    assert.deepEqual(overlay.npcGiftTastes, {});
    assert.deepEqual(overlay.locationFish, []);
    assert.deepEqual(overlay.buildings, {});
  } finally { files.cleanup(); }
});

test("bad included JSON retains valid additions but exposes global uncertainty", async () => {
  const files = fixture();
  try {
    const pack = files.addMod("Broken", cpManifest("Example.Broken"), { Changes: [
      { Action: "EditData", Target: "Data/Objects", Entries: { Item: { Price: 20 } } },
      { Action: "Include", FromFile: "broken.json" },
      { Action: "EditData", Target: "Data/Crops", Entries: { Seed: { HarvestItemId: "Item" } } },
    ] });
    writeFileSync(join(pack, "broken.json"), "{ malformed");
    const summary = scanModCompatibility(files.root);
    assert.equal(summary.status, "uncertain");
    assert.equal(summary.parseFailureCount, 1);
    assert.ok(summary.uncertainDomains.includes("other"));
    const overlay = await buildContentPatcherCatalogOverlay(files.root);
    assert.equal(overlay.objects.Item.Price, 20);
    assert.equal(overlay.crops.Seed.HarvestItemId, "Item");
  } finally { files.cleanup(); }
});

test("missing or escaping texture sources are uncertain and never ingested", async () => {
  const files = fixture();
  try {
    files.addMod("Missing", cpManifest("Example.Missing"), { Changes: [
      { Action: "Load", Target: "Portraits/Example", FromFile: "missing.png" },
      { Action: "Load", Target: "Mods/Example/Image", FromFile: "../../escape.png" },
    ] });
    const summary = scanModCompatibility(files.root);
    assert.equal(summary.status, "uncertain");
    assert.deepEqual(summary.supportedDomains, []);
    const overlay = await buildContentPatcherCatalogOverlay(files.root);
    assert.deepEqual(overlay.textures, {});
    assert.deepEqual(overlay.npcTextures, {});
  } finally { files.cleanup(); }
});

test("no-mod catalog and diagnostics remain empty", async () => {
  const files = fixture();
  try {
    assert.equal(scanModCompatibility(files.root).status, "vanilla");
    for (const value of Object.values(await buildContentPatcherCatalogOverlay(files.root)))
      assert.equal(Object.keys(value).length, 0);
  } finally { files.cleanup(); }
});

test("production dictionaries use the same accepted entries as diagnostics", async () => {
  const files = fixture();
  try {
    const targets = {
      "Data/BigCraftables": "bigCraftables", "Data/Machines": "machines",
      "Data/FarmAnimals": "farmAnimals", "Data/FishPondData": "fishPondData",
      "Data/FruitTrees": "fruitTrees", "Data/WildTrees": "wildTrees",
    };
    files.addMod("Production", cpManifest("Example.Production"), { Changes: Object.keys(targets).map((target) => ({
      Action: "EditData", Target: target, Entries: { Example: { Name: "Synthetic" } },
    })) });
    const overlay = await buildContentPatcherCatalogOverlay(files.root);
    for (const key of Object.values(targets)) assert.equal(overlay[key].Example.Name, "Synthetic");
    const summary = scanModCompatibility(files.root);
    assert.equal(summary.status, "mod-aware");
    assert.deepEqual(summary.supportedDomains, ["items", "crops", "fish", "machines", "animals"]);
  } finally { files.cleanup(); }
});

test("static includes ingest NPC data and preserve texture target casing", async () => {
  const files = fixture();
  try {
    const pack = files.addMod("NPC", cpManifest("Example.NPC"), { Changes: [{ Action: "Include", FromFile: "npc.json" }] });
    writeFileSync(join(pack, "portrait.png"), "synthetic");
    writeFileSync(join(pack, "npc.json"), JSON.stringify({ Changes: [
      { Action: "EditData", Target: "Data/Characters", Entries: { CustomNPC: { DisplayName: "Custom" } } },
      { Action: "EditData", Target: "Data/NPCGiftTastes", Entries: { CustomNPC: "Love/24/Like/16/Dislike/80/Hate/390/Neutral/72/" } },
      { Action: "Load", Target: "Portraits/CustomNPC", FromFile: "portrait.png" },
    ] }));
    const overlay = await buildContentPatcherCatalogOverlay(files.root);
    assert.equal(overlay.characters.CustomNPC.DisplayName, "Custom");
    assert.ok(overlay.npcGiftTastes.CustomNPC);
    assert.equal(overlay.npcTextures["Portraits/CustomNPC"], join(pack, "portrait.png"));
    assert.deepEqual(scanModCompatibility(files.root).supportedDomains, ["npcs"]);
  } finally { files.cleanup(); }
});
