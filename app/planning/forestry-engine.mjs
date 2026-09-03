const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function expectedTreeGrowthDays(stages, growthChance) {
  if (stages <= 0) return 0;
  if (growthChance <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(stages / growthChance);
}

export function calculateTappedTreePlan(input) {
  const count = Math.max(1, Math.floor(input.count));
  const days = Math.max(1, Math.floor(input.days));
  const cycleDays = Math.max(1, Math.floor(input.cycleDays * (input.heavy ? 0.5 : 1)));
  const growthDelay = input.existing ? 0 : expectedTreeGrowthDays(5, input.growthChance);
  const cycles = Number.isFinite(growthDelay) ? Math.max(0, Math.floor((days - growthDelay) / cycleDays)) : 0;
  const cost = input.existing ? 0 : count * (input.seedCost + input.equipmentCost);
  const units = count * cycles;
  const gross = units * input.outputPrice;
  const incomePerCycle = count * input.outputPrice;
  const breakEvenCycles = cost > 0 && incomePerCycle > 0 ? Math.ceil(cost / incomePerCycle) : 0;
  const breakEvenDays = breakEvenCycles > 0 ? growthDelay + breakEvenCycles * cycleDays : cycleDays;
  return { count, days, cycleDays, growthDelay, cycles, units, gross, cost, profit: gross - cost, breakEvenDays, breaksEvenInRange: breakEvenDays <= days };
}

const BASE_WEIGHTS = { common: 0.8075, red: 0.1425, purple: 0.05, morel: 0, chanterelle: 0 };

export function mushroomOutputWeights(species) {
  const oak = Math.max(0, Math.floor(species.oak || 0));
  const maple = Math.max(0, Math.floor(species.maple || 0));
  const pine = Math.max(0, Math.floor(species.pine || 0));
  const mystic = Math.max(0, Math.floor(species.mystic || 0));
  const other = Math.max(0, Math.floor(species.other || 0));
  const total = oak + maple + pine + mystic + other;
  const fallback = Math.max(1, Math.floor(total * 0.75));
  const candidates = total + fallback;
  const weighted = {
    common: (other + fallback) * BASE_WEIGHTS.common,
    red: maple * 0.9 + (other + fallback) * BASE_WEIGHTS.red,
    purple: maple * 0.1 + mystic + (other + fallback) * BASE_WEIGHTS.purple,
    morel: oak,
    chanterelle: pine,
  };
  return { total, weights: Object.fromEntries(Object.entries(weighted).map(([key, value]) => [key, value / candidates])) };
}

export function calculateMushroomLogPlan(input) {
  const count = Math.max(1, Math.floor(input.count));
  const days = Math.max(1, Math.floor(input.days));
  const cycles = Math.floor(days / 3);
  const { total: nearbyTrees, weights } = mushroomOutputWeights(input.species);
  const base = Math.floor(nearbyTrees / 2);
  const unitsPerCycle = (clamp(base, 1, 5) + clamp(base * 2, 1, 5)) / 2;
  const mossy = clamp(Math.floor(input.mossy || 0), 0, nearbyTrees);
  const qualityChance = clamp((nearbyTrees + mossy) * 0.025, 0, 1);
  const qualityMultiplier = 1 + 0.25 * qualityChance + 0.25 * qualityChance ** 2 + 0.5 * qualityChance ** 3;
  const averagePrice = Object.entries(weights).reduce((sum, [key, weight]) => sum + weight * (input.prices[key] || 0), 0);
  const units = count * cycles * unitsPerCycle;
  const gross = Math.round(units * averagePrice * qualityMultiplier);
  const cost = input.existing ? 0 : count * input.equipmentCost;
  const grossPerCycle = count * unitsPerCycle * averagePrice * qualityMultiplier;
  const breakEvenCycles = cost > 0 && grossPerCycle > 0 ? Math.ceil(cost / grossPerCycle) : 0;
  const breakEvenDays = Math.max(1, breakEvenCycles) * 3;
  return { count, days, cycles, nearbyTrees, units, unitsPerCycle, averagePrice, qualityChance, qualityMultiplier, gross, cost, profit: gross - cost, breakEvenDays, breaksEvenInRange: breakEvenDays <= days, weights };
}
