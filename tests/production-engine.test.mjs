import assert from "node:assert/strict";
import test from "node:test";

import {
  addStardewDays,
  calculateProductionPlan,
  resolvePlanningHorizon,
  stardewDaysBetween,
} from "../app/planning/production-engine.mjs";

const parsnip = {
  id: "(O)472",
  kind: "crop",
  seasons: ["spring"],
  firstOutputDays: 4,
  repeatDays: null,
  startupCost: 20,
  outputValue: 35,
  yield: { min: 1, expected: 1, max: 1 },
  space: 1,
  verified: true,
};

test("Stardew dates cross season and year boundaries without off-by-one drift", () => {
  assert.deepEqual(addStardewDays({ year: 1, season: "spring", day: 28 }, 1), { year: 1, season: "summer", day: 1 });
  assert.deepEqual(addStardewDays({ year: 1, season: "winter", day: 28 }, 1), { year: 2, season: "spring", day: 1 });
  assert.equal(stardewDaysBetween({ year: 1, season: "fall", day: 28 }, { year: 2, season: "spring", day: 1 }), 29);
});

test("duration and exact end date resolve to the same horizon", () => {
  const startDate = { year: 1, season: "summer", day: 9 };
  const byDays = resolvePlanningHorizon({ startDate, durationDays: 20 });
  const byDate = resolvePlanningHorizon({ startDate, endDate: { year: 1, season: "fall", day: 1 } });
  assert.deepEqual(byDays, byDate);
});

test("budget mode reports quantity, unused money, profit, and break-even", () => {
  const result = calculateProductionPlan({ producer: parsnip, mode: "budget", amount: 105, durationDays: 10, startDate: { year: 1, season: "spring", day: 1 } });
  assert.equal(result.quantity, 5);
  assert.equal(result.unusedBudget, 5);
  assert.equal(result.investment, 100);
  assert.equal(result.scenarios.expected.grossRevenue, 350);
  assert.equal(result.totalCosts, 200);
  assert.equal(result.scenarios.expected.netProfit, 150);
  assert.deepEqual(result.breakEvenDate, { year: 1, season: "spring", day: 9 });
});

test("single-harvest crops deduct every automatic replanting cycle", () => {
  const result = calculateProductionPlan({ producer: parsnip, mode: "tiles", amount: 1, durationDays: 12, startDate: { year: 1, season: "spring", day: 1 } });
  assert.equal(result.harvestDates.length, 3);
  assert.equal(result.investment, 20);
  assert.equal(result.recurringCosts, 40);
  assert.equal(result.totalCosts, 60);
  assert.equal(result.scenarios.expected.netProfit, 45);
});

test("automatic replanting can be disabled for a one-off harvest", () => {
  const result = calculateProductionPlan({ producer: parsnip, mode: "tiles", amount: 1, durationDays: 12, replant: false, startDate: { year: 1, season: "spring", day: 1 } });
  assert.equal(result.harvestDates.length, 1);
  assert.equal(result.totalCosts, 20);
  assert.equal(result.scenarios.expected.netProfit, 15);
});

test("repeat crops include every harvest inside the exact horizon", () => {
  const berries = { ...parsnip, id: "(O)481", firstOutputDays: 7, repeatDays: 5, startupCost: 240, outputValue: 75, yield: { min: 2, expected: 2, max: 2 } };
  const result = calculateProductionPlan({ producer: berries, mode: "tiles", amount: 10, durationDays: 20, startDate: { year: 1, season: "spring", day: 1 } });
  assert.equal(result.harvestDates.length, 3);
  assert.equal(result.scenarios.expected.units, 60);
});

test("outdoor crops do not survive an unsupported season boundary", () => {
  const result = calculateProductionPlan({ producer: parsnip, mode: "tiles", amount: 10, durationDays: 10, startDate: { year: 1, season: "spring", day: 27 } });
  assert.equal(result.harvestDates.length, 0);
  assert.ok(result.warnings.includes("no-production-in-horizon"));
});

test("an unavailable crop is not purchased when no planting date exists in the horizon", () => {
  const result = calculateProductionPlan({ producer: parsnip, mode: "budget", amount: 1_000_000, durationDays: 56, startDate: { year: 1, season: "summer", day: 9 } });
  assert.equal(result.quantity, 0);
  assert.equal(result.investment, 0);
  assert.equal(result.unusedBudget, 1_000_000);
  assert.equal(result.plantingDate, null);
  assert.ok(result.warnings.includes("no-planting-date-in-horizon"));
});

test("an outdoor crop waits for the first valid planting date while the horizon starts today", () => {
  const result = calculateProductionPlan({ producer: parsnip, mode: "tiles", amount: 1, durationDays: 10, replant: false, startDate: { year: 1, season: "winter", day: 25 } });
  assert.deepEqual(result.startDate, { year: 1, season: "winter", day: 25 });
  assert.deepEqual(result.plantingDate, { year: 2, season: "spring", day: 1 });
  assert.equal(result.plantingDelayDays, 4);
  assert.deepEqual(result.harvestDates, [{ year: 2, season: "spring", day: 5 }]);
  assert.ok(result.warnings.includes("planting-delayed"));
});

test("forcing an out-of-season purchase preserves the deliberate negative scenario", () => {
  const result = calculateProductionPlan({ producer: parsnip, mode: "budget", amount: 1_000_000, durationDays: 56, forcePlantToday: true, startDate: { year: 1, season: "summer", day: 9 } });
  assert.equal(result.quantity, 50_000);
  assert.equal(result.investment, 1_000_000);
  assert.equal(result.unusedBudget, 0);
  assert.equal(result.scenarios.expected.netProfit, -1_000_000);
  assert.ok(result.warnings.includes("cannot-plant-on-start-date"));
});

test("fruit trees mature across seasons but only produce in fruiting seasons", () => {
  const apple = { ...parsnip, id: "(O)633", kind: "fruit-tree", seasons: ["fall"], firstOutputDays: 28, repeatDays: 1, startupCost: 4000, outputValue: 100 };
  const result = calculateProductionPlan({ producer: apple, mode: "tiles", amount: 1, endDate: { year: 1, season: "fall", day: 10 }, startDate: { year: 1, season: "summer", day: 1 } });
  assert.equal(result.harvestDates.length, 10);
  assert.deepEqual(result.harvestDates[0], { year: 1, season: "fall", day: 1 });
});

test("target mode refuses an unprofitable horizon", () => {
  const result = calculateProductionPlan({ producer: parsnip, mode: "target", amount: 1000, durationDays: 2, startDate: { year: 1, season: "spring", day: 1 } });
  assert.equal(result.quantity, 0);
  assert.ok(result.warnings.includes("target-not-profitable"));
});

test("fertilizer setup cost and quality-adjusted values affect the estimate", () => {
  const improved = {
    ...parsnip,
    outputValueByScenario: { conservative: 38, expected: 42, optimistic: 57 },
  };
  const result = calculateProductionPlan({ producer: improved, mode: "budget", amount: 350, durationDays: 4, replant: false, setupCostPerProducer: 50, startDate: { year: 1, season: "spring", day: 1 } });
  assert.equal(result.quantity, 5);
  assert.equal(result.investment, 100);
  assert.equal(result.setupCosts, 250);
  assert.equal(result.totalCosts, 350);
  assert.equal(result.scenarios.conservative.grossRevenue, 190);
  assert.equal(result.scenarios.expected.grossRevenue, 210);
  assert.equal(result.scenarios.optimistic.grossRevenue, 285);
});

test("direct producer counts support repeating passive producers", () => {
  const plan = calculateProductionPlan({
    producer: {
      id: "forestry:oak",
      kind: "tapped-tree",
      seasons: [],
      firstOutputDays: 7,
      repeatDays: 7,
      startupCost: 200,
      outputValue: 150,
      yield: { min: 1, expected: 1, max: 1 },
      verified: true,
    },
    mode: "units",
    amount: 3,
    startDate: { year: 1, season: "summer", day: 1 },
    durationDays: 28,
  });
  assert.equal(plan.quantity, 3);
  assert.equal(plan.harvestDates.length, 4);
  assert.equal(plan.totalCosts, 600);
  assert.equal(plan.scenarios.expected.grossRevenue, 1800);
});
