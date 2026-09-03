const amount = value => Math.max(0, Number(value) || 0);

export function evaluateProductionPortfolio(plans, available = {}) {
  const totals = plans.reduce((result, plan) => {
    result.money += amount(plan.resources?.money);
    result.space += amount(plan.resources?.space);
    result.profit += Number(plan.metrics?.profit) || 0;
    result.revenue += amount(plan.metrics?.revenue);
    result.items += amount(plan.metrics?.items);
    for (const [id, count] of Object.entries(plan.resources?.inventory || {})) result.inventory[id] = (result.inventory[id] || 0) + amount(count);
    for (const [id, count] of Object.entries(plan.resources?.machines || {})) result.machines[id] = (result.machines[id] || 0) + amount(count);
    return result;
  }, { money: 0, space: 0, profit: 0, revenue: 0, items: 0, inventory: {}, machines: {} });
  const conflicts = [];
  if (Number.isFinite(available.money) && totals.money > available.money) conflicts.push({ kind: "money", required: totals.money, available: available.money });
  if (Number.isFinite(available.space) && totals.space > available.space) conflicts.push({ kind: "space", required: totals.space, available: available.space });
  for (const [id, required] of Object.entries(totals.inventory)) {
    const stock = amount(available.inventory?.[id]);
    if (required > stock) conflicts.push({ kind: "inventory", id, required, available: stock });
  }
  for (const [id, required] of Object.entries(totals.machines)) {
    const stock = amount(available.machines?.[id]);
    if (required > stock) conflicts.push({ kind: "machines", id, required, available: stock });
  }
  return { totals, conflicts, feasible: conflicts.length === 0 };
}
