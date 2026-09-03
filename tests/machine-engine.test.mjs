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

test("casks respect starting quality and reject already-iridium goods", () => {
  const conversion = { ...wine, priceFormula: "cask", cycleMinutes: 56 * 1600, agingMultiplier: 2, locationRequirement: "cellar", outputQuality: 4 };
  const plan = calculateMachinePlan({ conversion, machineCount: 1, initialInput: 1, inputQuality: 4, hasCellar: true, startDate: { year: 1, season: "summer", day: 1 }, durationDays: 56 });
  assert.equal(plan.batches, 0);
  assert.ok(plan.warnings.includes("machine-cask-already-iridium"));
});

test("linked casks use the upstream plan instead of requesting manual flavored stock", () => {
  const conversion = {
    ...wine,
    priceFormula: "cask",
    cycleMinutes: 56 * 1600,
    agingMultiplier: 2,
    locationRequirement: "cellar",
    outputQuality: 4,
    input: { ...wine.input, id: "(O)348", name: "Wine", source: wine.input },
  };
  const plan = calculateMachinePlan({
    conversion, machineCount: 1, recurringInputPerDay: 1, linkedUpstream: true, hasCellar: true,
    startDate: { year: 1, season: "summer", day: 1 }, durationDays: 56,
  });
  assert.ok(plan.batches > 0);
  assert.ok(!plan.warnings.includes("machine-cask-flavor-stock-manual"));
});

test("linked production waits for each real upstream batch", () => {
  const plan = calculateMachinePlan({
    conversion: { ...wine, cycleMinutes: 1600 }, machineCount: 1, initialInput: 0,
    inputEvents: [{ day: 5, quantity: 1 }, { day: 9, quantity: 1 }], linkedUpstream: true,
    startDate: { year: 1, season: "summer", day: 1 }, durationDays: 12, existing: true,
  });
  assert.deepEqual(plan.outputEvents.map(event => event.day), [6, 10]);
  assert.equal(plan.batches, 2);
  assert.equal(plan.firstIncomeDate.day, 7);
});

test("machine output events preserve timing across a multi-step chain", () => {
  const first = calculateMachinePlan({
    conversion: { ...wine, cycleMinutes: 1600 }, machineCount: 1, initialInput: 0,
    inputEvents: [{ day: 2, quantity: 1 }], linkedUpstream: true,
    startDate: { year: 1, season: "summer", day: 1 }, durationDays: 6, existing: true,
  });
  const second = calculateMachinePlan({
    conversion: { ...wine, cycleMinutes: 1600 }, machineCount: 1, initialInput: 0,
    inputEvents: first.outputEvents, linkedUpstream: true,
    startDate: { year: 1, season: "summer", day: 1 }, durationDays: 6, existing: true,
  });
  assert.deepEqual(first.outputEvents.map(event => event.day), [3]);
  assert.deepEqual(second.outputEvents.map(event => event.day), [4]);
});

test("parallel machines never consume a future arrival in the past", () => {
  const plan = calculateMachinePlan({
    conversion: { ...wine, cycleMinutes: 1600 }, machineCount: 2, initialInput: 0,
    inputEvents: [{ day: 5, quantity: 2 }], linkedUpstream: true,
    startDate: { year: 1, season: "summer", day: 1 }, durationDays: 7, existing: true,
  });
  assert.deepEqual(plan.outputEvents.map(event => event.day), [6, 6]);
});
