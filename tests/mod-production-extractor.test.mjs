import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { calculateMachinePlan } from "../app/planning/machine-engine.mjs";
import { calculateAnimalPlan } from "../app/planning/animal-engine.mjs";
import { calculateFishPondPlan } from "../app/planning/pond-engine.mjs";
import { calculateTappedTreePlan } from "../app/planning/forestry-engine.mjs";
import { calculateProductionPlan } from "../app/planning/production-engine.mjs";

// Opt-in: game data stays in memory; only synthetic input is written to a temporary directory.
test("local extractor additions reach production engines without replacing base data", { skip: !process.env.STARDEW_PATH }, () => {
  const extractor = resolve("tools/StardewDataExtractor/bin/Debug/net8.0/StardewDataExtractor.dll");
  const read = overlay => JSON.parse(execFileSync("dotnet", [extractor, process.env.STARDEW_PATH, ...(overlay ? [overlay] : [])], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
  const baseline = read();
  const directory = mkdtempSync(join(tmpdir(), "companion-synthetic-"));
  try {
    const overlay = join(directory, "overlay.json");
    writeFileSync(overlay, JSON.stringify({
      objects: { TestInput: { Name: "Synthetic input", Price: 10 }, TestOutput: { Name: "Synthetic output", Price: 50 }, TestFish: { Name: "Synthetic fish", Price: 80, Category: -4, ContextTags: ["synthetic_pond"] }, TestSeed: { Name: "Synthetic seed", Price: 100 } },
      bigCraftables: { TestMachine: { Name: "Synthetic machine" } },
      machines: { "(BC)TestMachine": { OutputRules: [{ Id: "fixed", Triggers: [{ Trigger: "ItemPlacedInMachine", RequiredItemId: "(O)TestInput", RequiredCount: 1 }], OutputItem: [{ ItemId: "(O)TestOutput" }], MinutesUntilReady: 1600 }] } },
      buildings: { TestHouse: { Name: "Synthetic house", BuildCost: 100, MaxOccupants: 4 } },
      farmAnimals: { TestAnimal: { RequiredBuilding: "TestHouse", PurchasePrice: 100, DaysToMature: 1, DaysToProduce: 1, ProduceItemIds: [{ Id: "fixed", ItemId: "TestOutput" }], DeluxeProduceItemIds: [] } },
      fishPondData: { TestPond: { RequiredTags: ["synthetic_pond"], Precedence: -100, MaxPopulation: 2, SpawnTime: 1, BaseMinProduceChance: 1, BaseMaxProduceChance: 1, ProducedItems: [{ Id: "fixed", ItemId: "TestOutput", Chance: 1 }] } },
      fruitTrees: { TestSeed: { Seasons: ["Spring"], Fruit: [{ Id: "fixed", ItemId: "TestOutput", Chance: 1 }] } },
      wildTrees: { TestTree: { SeedItemId: "TestSeed", GrowthChance: 1, TapItems: [{ Id: "fixed", ItemId: "TestOutput", DaysUntilReady: 1, Chance: 1 }] } },
    }));
    const catalog = read(overlay);
    assert.deepEqual(catalog.crops, baseline.crops);
    const startDate = { year: 1, season: "spring", day: 1 };
    const conversion = catalog.artisanMachines.find(item => item.machine.id === "(BC)TestMachine");
    assert.equal(conversion.verified, true);
    assert.equal(calculateMachinePlan({ conversion, machineCount: 1, initialInput: 2, existing: true, startDate, durationDays: 4 }).batches, 2);
    const animal = catalog.farmAnimals.find(item => item.id === "animal:TestAnimal");
    assert.equal(animal.verified, true);
    assert.equal(calculateAnimalPlan({ animal, count: 1, existingCount: 1, startDate, durationDays: 4 }).outputs[0].item.id, "(O)TestOutput");
    const pond = catalog.fishPonds.find(item => item.id === "pond:(O)TestFish");
    assert.equal(pond.ruleId, "TestPond");
    assert.ok(calculateFishPondPlan({ pond, pondCount: 1, startPopulation: 2, existing: true, startDate, durationDays: 4 }).scenarios.expected.grossRevenue > 0);
    const tree = catalog.fruitTrees.find(item => item.id === "(O)TestSeed");
    assert.equal(tree.verified, false, "missing purchase cost must remain uncertain");
    const plan = calculateProductionPlan({ producer: { ...tree, outputValue: tree.output.price }, mode: "units", amount: 1, startDate, durationDays: 50 });
    assert.ok(plan.warnings.includes("unverified-producer-data"));
    const tapped = catalog.tappedTrees.find(item => item.treeType === "TestTree");
    assert.equal(tapped.tapItems[0].item.id, "(O)TestOutput");
    assert.equal(tapped.verified, true);
    const tappedPlan = calculateTappedTreePlan({ count: 1, days: 4, cycleDays: tapped.tapItems[0].daysUntilReady, existing: true, heavy: false, growthChance: tapped.growthChance, seedCost: tapped.seed.price, equipmentCost: 0, outputPrice: tapped.tapItems[0].item.price });
    assert.equal(tappedPlan.gross, 200);
    const unsupported = JSON.parse(readFileSync(overlay, "utf8"));
    unsupported.machines["(BC)TestMachine"].AdditionalConsumedItems = [{ ItemId: "(BC)TestInput", RequiredCount: 1 }];
    unsupported.farmAnimals.TestAnimal.ProduceItemIds[0].Condition = "SYNTHETIC_RUNTIME_CONDITION";
    unsupported.fishPondData.TestPond.ProducedItems[0].Condition = "SYNTHETIC_RUNTIME_CONDITION";
    unsupported.wildTrees.TestTree.TapItems[0].Chance = 0.5;
    writeFileSync(overlay, JSON.stringify(unsupported));
    const uncertain = read(overlay);
    const uncertainMachine = uncertain.artisanMachines.find(item => item.machine.id === "(BC)TestMachine");
    assert.equal(uncertainMachine.verified, false, "a big craftable is not an object with the same suffix");
    assert.equal(uncertainMachine.additionalInputs[0].item.id, "(BC)TestInput");
    assert.equal(uncertain.overlayDiagnostics.skipped.machines, 1);
    assert.equal(uncertain.farmAnimals.find(item => item.id === animal.id).verified, false);
    assert.equal(uncertain.fishPonds.find(item => item.id === pond.id).verified, false);
    assert.equal(uncertain.tappedTrees.find(item => item.treeType === "TestTree").verified, false);
    assert.ok(calculateAnimalPlan({ animal: { ...animal, verified: false }, count: 1, startDate, durationDays: 4 }).warnings.includes("unverified-producer-data"));
    assert.ok(calculateFishPondPlan({ pond: { ...pond, verified: false }, pondCount: 1, startDate, durationDays: 4 }).warnings.includes("unverified-producer-data"));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
