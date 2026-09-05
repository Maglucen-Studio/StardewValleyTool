import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

async function pureModule(name) {
  const source = await readFile(new URL(`../app/dashboard/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("item identity preserves namespaces even when suffixes and labels match", async () => {
  const { qualifyItemId, inventoryItemId } = await pureModule("identity");
  assert.equal(qualifyItemId("12"), "(O)12");
  assert.equal(qualifyItemId("(W)12", "object"), "(W)12");
  assert.equal(qualifyItemId("-4"), "-4");
  assert.notEqual(inventoryItemId({ id: "12", spriteKind: "object" }), inventoryItemId({ id: "12", spriteKind: "craftable" }));
});

test("game date and bundle formatting use the requested translation and locale", async () => {
  const { formatGameDate, formatBundleRequirement, formatHarvestDate } = await pureModule("formatting");
  const t = (key, values = {}) => key === "season.spring" ? "Primavera" : JSON.stringify({ key, ...values });
  assert.deepEqual(JSON.parse(formatGameDate({ year: 2, season: "spring", day: 7 }, t)), { key: "date.game", year: 2, season: "Primavera", day: 7 });
  assert.equal(formatHarvestDate("unresolved-value", t), "unresolved-value");
  assert.equal(JSON.parse(formatBundleRequirement({ id: "-1", count: 123456, name: "Gold" }, t, "de-DE")).count, "123.456");
});

test("selected soil distinguishes empty tiles, named crops and unresolved planted seeds", async () => {
  const { localizedTerrainFeature } = await pureModule("formatting");
  const translate = (key, variables) => ({ key, ...variables });
  const soil = { kind: "HoeDirt", x: 1, y: 2 };
  assert.deepEqual(localizedTerrainFeature(soil, translate), { key: "map.terrain.tilledSoil" });
  const planted = { ...soil, crop: "Seed", cropHarvestId: "(O)Harvest" };
  assert.deepEqual(localizedTerrainFeature(planted, translate, { "(O)Harvest": "Cultivo local" }), { key: "map.terrain.plantedCrop", name: "Cultivo local" });
  assert.deepEqual(localizedTerrainFeature({ ...soil, crop: "Seed" }, translate, { "(O)Seed": "Semillas locales" }), { key: "map.terrain.plantedSeed", name: "Semillas locales" });
  assert.deepEqual(localizedTerrainFeature(planted, translate, { "(BC)Harvest": "Wrong namespace" }), { key: "map.terrain.plantedUnresolved", id: "(O)Harvest" });
  assert.deepEqual(localizedTerrainFeature({ ...soil, hasCrop: true }, translate), { key: "map.terrain.plantedUnknown" });
});

test("LIVE soil identifies new and replanted crops and clears harvested crop details", async () => {
  const { mergeLiveTerrain } = await pureModule("farm-model");
  const { localizedTerrainFeature } = await pureModule("formatting");
  const saved = { kind: "HoeDirt", x: 1, y: 2, crop: "OldSeed", cropHarvestId: "OldCrop", phase: 4, cropRow: 2 };
  const live = { kind: "HoeDirt", x: 1, y: 2, hasCrop: true, watered: false, cropSeedId: "NewSeed", cropHarvestId: "NewCrop", phase: 0, cropRow: 3 };
  for (const previous of [saved, undefined]) {
    const next = mergeLiveTerrain(previous, live);
    assert.equal(next.cropHarvestId, "NewCrop");
    assert.equal(next.crop, "NewSeed");
    assert.equal(next.phase, 0);
  }
  const empty = mergeLiveTerrain(saved, { ...live, hasCrop: false });
  assert.equal(empty.crop, undefined);
  assert.equal(empty.cropHarvestId, undefined);
  const legacy = mergeLiveTerrain(saved, { kind: "HoeDirt", x: 1, y: 2, hasCrop: true, watered: true });
  assert.equal(localizedTerrainFeature(legacy, (key) => key), "map.terrain.plantedUnknown");
});

test("save terrain exports seed and harvest identities while nil crops remain empty soil", () => {
  const result = spawnSync(process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"), [fileURLToPath(new URL("./terrain_snapshot_test.py", import.meta.url))], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});

test("number formatting follows the selected locale including fixed decimals", async () => {
  const { formatNumber, formatDecimal } = await pureModule("formatting");
  assert.equal(formatNumber(1234567, "es-ES"), "1.234.567");
  assert.equal(formatNumber(1234567, "en-US"), "1,234,567");
  assert.equal(formatDecimal(1.5, "es-ES", 1), "1,5");
  assert.equal(formatDecimal(-0.025, "es-ES", 3), "-0,025");
  assert.equal(formatDecimal(1, "en-US", 1), "1.0");
});

test("materials and tool tiers ignore display names and foreign namespaces", async () => {
  const { inventoryQuantity, inventoryToolTier } = await pureModule("identity");
  const inventory = [
    { id: "(O)334", name: "Barra de cobre", count: 3 },
    { id: "334", name: "Copper Bar", count: 2 },
    { id: "(BC)334", name: "Copper Bar", count: 50 },
    { id: "(O)Example", name: "Copper Bar", count: 50 },
    { id: "(T)SteelAxe", name: "Hacha de acero", count: 1 },
    { id: "(W)IridiumAxe", name: "Iridium Axe", count: 1 },
  ];
  assert.equal(inventoryQuantity(inventory, "(O)334"), 5);
  assert.equal(inventoryQuantity(inventory, undefined), 0);
  assert.equal(inventoryToolTier(inventory, "Axe"), 2);
  assert.equal(inventoryToolTier(inventory, "Pickaxe"), 0);
});

test("crafting goals count inventory stone rather than same-named map nodes", async () => {
  const { commonCraftingGoals } = await pureModule("planning-goals");
  const { inventoryQuantity } = await pureModule("identity");
  const goal = commonCraftingGoals.find((item) => item.name === "Preserves Jar");
  const stone = goal.materials.find((item) => item.name === "Stone");
  const stock = [{ id: "(O)390", count: 40 }, { id: "(O)BasicCoalNode1", count: 5 }];
  assert.equal(inventoryQuantity(stock, stone.id), stone.quantity);
});

test("artifact spot labels and placement use identity rather than an English label", async () => {
  const { routeItemName } = await pureModule("formatting");
  const { validateFarmPlacement } = await pureModule("farm-model");
  const t = (key) => key;
  assert.equal(routeItemName({ id: "(O)590", name: "Localized" }, t), "world.artifactSpot");
  assert.equal(routeItemName({ id: "(BC)590", name: "Artifact Spot" }, t), "Artifact Spot");
  const farm = { map: { width: 5, height: 5, blocked: [] }, buildings: [], terrain: [], objects: [{ x: 1, y: 1, id: "(O)590", name: "Localized", big: false }] };
  assert.equal(validateFarmPlacement(farm, [], { x: 1, y: 1 }, 1, 1, t), "");
  farm.objects[0] = { ...farm.objects[0], id: "(BC)590", name: "Artifact Spot", big: true };
  assert.equal(validateFarmPlacement(farm, [], { x: 1, y: 1 }, 1, 1, t), "map.error.placedObject");
});

test("construction reconciliation deduplicates proposals and honors manual matches", async () => {
  const { reconcileProposals, buildingSignature } = await pureModule("farm-model");
  const proposal = { id: "example", kind: "Coop", name: "Coop", color: "blue", x: 1, y: 2, width: 6, height: 3 };
  const building = { ...proposal, x: 10, daysOfConstructionLeft: 1 };
  assert.equal(reconcileProposals([proposal, { ...proposal, id: "duplicate" }], []).length, 1);
  assert.equal(reconcileProposals([proposal], [building])[0].status, "pending");
  assert.equal(reconcileProposals([proposal], [building], { example: buildingSignature(building) })[0].status, "building");
  assert.equal(reconcileProposals([proposal], [], {}, { example: "resolved" })[0].status, "resolved");
  assert.equal(reconcileProposals([proposal], [{ ...proposal }])[0].status, "completed");
});

test("farm placement rejects boundaries and occupied cells before accepting an empty footprint", async () => {
  const { validateFarmPlacement } = await pureModule("farm-model");
  const t = (key) => key;
  const farm = { map: { width: 10, height: 10, blocked: [[2, 2]] }, buildings: [{ x: 4, y: 4, width: 2, height: 2 }], objects: [{ id: "(BC)Example", name: "Example", x: 7, y: 7 }], terrain: [] };
  const check = (point, proposals = []) => validateFarmPlacement(farm, proposals, point, 1, 1, t);
  assert.equal(validateFarmPlacement(null, [], { x: 0, y: 0 }, 1, 1, t), "map.error.unavailable");
  assert.equal(check({ x: -1, y: 0 }), "map.error.outsideFarm");
  assert.equal(check({ x: 2, y: 2 }), "map.error.nonBuildable");
  assert.equal(check({ x: 5, y: 5 }), "map.error.existingBuilding");
  assert.equal(check({ x: 7, y: 7 }), "map.error.placedObject");
  assert.equal(check({ x: 8, y: 8 }, [{ x: 8, y: 8, width: 1, height: 1, status: "pending" }]), "map.error.pendingProposal");
  assert.equal(check({ x: 0, y: 0 }), "");
});

test("dashboard modules have no dependency cycles or imports back into the page", async () => {
  const directory = new URL("../app/dashboard/", import.meta.url);
  const graph = new Map();
  for (const file of await readdir(directory)) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = ts.createSourceFile(file, await readFile(new URL(file, directory), "utf8"), ts.ScriptTarget.Latest, true);
    const imports = source.statements.filter(ts.isImportDeclaration).map((node) => node.moduleSpecifier.text);
    assert.ok(imports.every((name) => !name.endsWith("/page")), `${file} imports the entry point`);
    graph.set(file.replace(/\.tsx?$/, ""), imports.filter((name) => name.startsWith("./")).map((name) => name.slice(2)));
  }
  function visit(name, ancestors = []) {
    assert.ok(!ancestors.includes(name), `Dependency cycle: ${[...ancestors, name].join(" -> ")}`);
    for (const next of graph.get(name) || []) visit(next, [...ancestors, name]);
  }
  for (const name of graph.keys()) visit(name);
});
