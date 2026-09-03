import test from "node:test";
import assert from "node:assert/strict";
import { calculateMachinePlan } from "../app/planning/machine-engine.mjs";

const wine = {
  id: "(BC)12:(O)254", machine: { id: "(BC)12", name: "Keg", opportunityCost: 1000 },
  input: { id: "(O)254", name: "Melon", price: 250 }, output: { id: "(O)348", name: "Wine", price: 400 },
  inputCount: 1, outputCount: { min: 1, expected: 1, max: 1 }, outputQuality: 0,
  cycleMinutes: 10000, priceFormula: "wine", artisanEligible: true, additionalInputCost: 0, verified: true,
};

test("machine throughput cannot consume one input twice", () => {
  const plan = calculateMachinePlan({ conversion: wine, machineCount: 2, initialInput: 5, startDate: { year: 1, season: "summer", day: 1 }, durationDays: 28, existing: true });
  assert.equal(plan.capacityBatches, 8);
  assert.equal(plan.batches, 5);
  assert.equal(plan.consumedInput, 5);
  assert.equal(plan.surplusInput, 0);
  assert.equal(plan.idleBatches, 3);
  assert.ok(plan.warnings.includes("machine-input-bottleneck"));
});

test("machine plans expose direct-sale comparison, Artisan, and setup break-even", () => {
  const plan = calculateMachinePlan({ conversion: wine, machineCount: 1, initialInput: 4, inputQuality: 2, artisan: true, startDate: { year: 1, season: "summer", day: 1 }, durationDays: 28, existing: false });
  assert.equal(plan.directSaleValue, 1500);
  assert.equal(plan.scenarios.expected.grossRevenue, 4200);
  assert.equal(plan.setupCost, 1000);
  assert.equal(plan.scenarios.expected.netProfit, 1700);
  assert.ok(plan.breakEvenDate);
});

test("collection cadence reduces effective capacity", () => {
  const immediate = calculateMachinePlan({ conversion: { ...wine, cycleMinutes: 1750 }, machineCount: 1, initialInput: 99, startDate: { year: 1, season: "summer", day: 1 }, durationDays: 7, existing: true });
  const everyTwoDays = calculateMachinePlan({ conversion: { ...wine, cycleMinutes: 1750 }, machineCount: 1, initialInput: 99, collectionEveryDays: 2, startDate: { year: 1, season: "summer", day: 1 }, durationDays: 7, existing: true });
  assert.equal(immediate.batches, 6);
  assert.equal(everyTwoDays.batches, 3);
});
