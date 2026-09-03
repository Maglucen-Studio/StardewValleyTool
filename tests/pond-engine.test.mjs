import test from "node:test";
import assert from "node:assert/strict";
import { calculateFishPondPlan, roePrice } from "../app/planning/pond-engine.mjs";

const pond = {
  fish: { id: "(O)128", price: 100 }, maxPopulation: 10, spawnTime: 3,
  baseMinProduceChance: 0.15, baseMaxProduceChance: 0.95,
  producedItems: [{ requiredPopulation: 1, chance: 1, precedence: 0, item: { id: "(O)812", price: 30 }, minStack: 1, maxStack: 1 }],
};

test("roe value follows the fish-derived game formula", () => assert.equal(roePrice(100), 80));

test("pond plans grow only to the unlocked population", () => {
  const plan = calculateFishPondPlan({ pond, pondCount: 1, startPopulation: 1, unlockedPopulation: 4, existing: true, startDate: { year: 1, season: "spring", day: 1 }, durationDays: 28 });
  assert.equal(plan.endPopulation, 4);
  assert.ok(plan.warnings.includes("pond-population-gated"));
  assert.ok(plan.scenarios.expected.grossRevenue > 0);
});
