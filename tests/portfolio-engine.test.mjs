import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProductionPortfolio } from "../app/planning/portfolio-engine.mjs";

test("portfolio reservations prevent double allocation", () => {
  const result = evaluateProductionPortfolio([
    { resources: { money: 800, inventory: { "(O)388": 30 }, machines: { "(BC)12": 2 } }, metrics: { profit: 1000 } },
    { resources: { money: 400, inventory: { "(O)388": 25 }, machines: { "(BC)12": 1 } }, metrics: { profit: 700 } },
  ], { money: 1000, inventory: { "(O)388": 50 }, machines: { "(BC)12": 2 } });
  assert.equal(result.feasible, false);
  assert.deepEqual(result.conflicts.map(item => item.kind).sort(), ["inventory", "machines", "money"]);
  assert.equal(result.totals.profit, 1700);
});
