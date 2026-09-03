import test from "node:test";
import assert from "node:assert/strict";
import { calculateAnimalPlan } from "../app/planning/animal-engine.mjs";

const chicken = {
  purchasePrice: 800, purchasable: true, daysToMature: 3, daysToProduce: 1,
  harvestType: "DropOvernight", deluxeProduceMinimumFriendship: 200, deluxeProduceCareDivisor: 1200,
  produce: [{ item: { id: "(O)176", price: 50 } }], deluxeProduce: [{ item: { id: "(O)174", price: 95 } }],
};

test("animal plans separate existing adults from newly purchased animals", () => {
  const plan = calculateAnimalPlan({ animal: chicken, count: 2, existingCount: 1, startDate: { year: 1, season: "spring", day: 1 }, durationDays: 7, fedDaily: true });
  assert.equal(plan.cycles, 11);
  assert.equal(plan.purchaseCost, 800);
  assert.equal(plan.firstIncomeDate.day, 2);
  assert.deepEqual(plan.outputs.map(output => [output.item.id, output.quantity]), [["(O)176", 11]]);
});

test("animal results identify processed products instead of only their value", () => {
  const plan = calculateAnimalPlan({
    animal: chicken, count: 1, existingCount: 1, fedDaily: true,
    processor: { cycleDays: 1, output: { id: "(O)306", name: "Mayonnaise", price: 190 }, outputCount: 1 }, processorCount: 1,
    startDate: { year: 1, season: "spring", day: 1 }, durationDays: 7,
  });
  assert.deepEqual(plan.outputs.map(output => [output.item.id, output.quantity]), [["(O)306", 7]]);
});

test("unfed animals do not create fictional production", () => {
  const plan = calculateAnimalPlan({ animal: chicken, count: 1, existingCount: 1, startDate: { year: 1, season: "spring", day: 1 }, durationDays: 7, fedDaily: false });
  assert.equal(plan.scenarios.expected.units, 0);
  assert.ok(plan.warnings.includes("animal-not-fed"));
});
