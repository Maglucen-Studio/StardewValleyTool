import assert from "node:assert/strict";
import test from "node:test";
import { calculateMushroomLogPlan, calculateTappedTreePlan, mushroomOutputWeights } from "../app/planning/forestry-engine.mjs";

test("heavy tappers halve a seven-day cycle using the game's floor rule", () => {
  const plan = calculateTappedTreePlan({ count: 2, days: 28, cycleDays: 7, heavy: true, existing: true, growthChance: 0.2, seedCost: 0, equipmentCost: 0, outputPrice: 100 });
  assert.equal(plan.cycleDays, 3);
  assert.equal(plan.cycles, 9);
  assert.equal(plan.gross, 1800);
});

test("new tapped trees include expected growth, seed, and equipment costs", () => {
  const plan = calculateTappedTreePlan({ count: 1, days: 40, cycleDays: 5, heavy: false, existing: false, growthChance: 0.2, seedCost: 5, equipmentCost: 100, outputPrice: 50 });
  assert.equal(plan.growthDelay, 25);
  assert.equal(plan.cycles, 3);
  assert.equal(plan.profit, 45);
  assert.equal(plan.breakEvenDays, 40);
});

test("mushroom species produce the corresponding candidate weights", () => {
  const oak = mushroomOutputWeights({ oak: 4, maple: 0, pine: 0, mystic: 0, other: 0 });
  assert.equal(oak.total, 4);
  assert.ok(oak.weights.morel > oak.weights.common);
  const mystic = mushroomOutputWeights({ oak: 0, maple: 0, pine: 0, mystic: 4, other: 0 });
  assert.ok(mystic.weights.purple > mystic.weights.common);
});

test("mushroom logs include material opportunity cost and quality effect", () => {
  const plan = calculateMushroomLogPlan({ count: 2, days: 12, existing: false, equipmentCost: 200, mossy: 2, species: { oak: 2, maple: 2, pine: 2, mystic: 0, other: 0 }, prices: { common: 40, red: 75, purple: 250, morel: 150, chanterelle: 160 } });
  assert.equal(plan.cycles, 4);
  assert.equal(plan.cost, 400);
  assert.ok(plan.qualityMultiplier > 1);
  assert.ok(plan.gross > 0);
});
