export const STARDEW_SEASONS = Object.freeze(["spring", "summer", "fall", "winter"]);
export const DAYS_PER_SEASON = 28;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * STARDEW_SEASONS.length;

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

export function normalizeStardewDate(date) {
  const seasonIndex = STARDEW_SEASONS.indexOf(String(date?.season || "").toLowerCase());
  return {
    year: Math.max(1, integer(date?.year, 1)),
    season: STARDEW_SEASONS[seasonIndex < 0 ? 0 : seasonIndex],
    day: Math.min(DAYS_PER_SEASON, Math.max(1, integer(date?.day, 1))),
  };
}

export function stardewDateToOrdinal(date) {
  const normalized = normalizeStardewDate(date);
  return (
    (normalized.year - 1) * DAYS_PER_YEAR
    + STARDEW_SEASONS.indexOf(normalized.season) * DAYS_PER_SEASON
    + normalized.day - 1
  );
}

export function ordinalToStardewDate(value) {
  const ordinal = Math.max(0, integer(value));
  const year = Math.floor(ordinal / DAYS_PER_YEAR) + 1;
  const yearDay = ordinal % DAYS_PER_YEAR;
  return {
    year,
    season: STARDEW_SEASONS[Math.floor(yearDay / DAYS_PER_SEASON)],
    day: yearDay % DAYS_PER_SEASON + 1,
  };
}

export function addStardewDays(date, days) {
  return ordinalToStardewDate(stardewDateToOrdinal(date) + Math.max(0, integer(days)));
}

export function stardewDaysBetween(start, end) {
  return stardewDateToOrdinal(end) - stardewDateToOrdinal(start);
}

export function resolvePlanningHorizon({ startDate, durationDays, endDate }) {
  const start = normalizeStardewDate(startDate);
  const warnings = [];
  let days;
  if (endDate) {
    days = stardewDaysBetween(start, endDate);
    if (days < 0) {
      warnings.push("end-before-start");
      days = 0;
    }
    if (durationDays !== undefined && integer(durationDays) !== days)
      warnings.push("end-date-overrides-duration");
  } else {
    days = Math.max(0, integer(durationDays, 0));
  }
  return { startDate: start, endDate: addStardewDays(start, days), durationDays: days, warnings };
}

function canProduceOn(producer, date, location) {
  if (location === "greenhouse" || location === "island") return true;
  return !producer.seasons?.length || producer.seasons.includes(date.season);
}

function plantingOffsetFor(producer, horizon, location, forcePlantToday) {
  if (producer.kind !== "crop" || forcePlantToday || canProduceOn(producer, horizon.startDate, location)) return 0;
  for (let offset = 1; offset <= horizon.durationDays; offset += 1) {
    if (canProduceOn(producer, addStardewDays(horizon.startDate, offset), location)) return offset;
  }
  return null;
}

function productionOffsets(producer, horizon, location, replant, plantingOffset) {
  const first = Math.max(0, integer(producer.firstOutputDays));
  if (first > horizon.durationDays) return [];
  if (producer.kind === "fruit-tree") {
    const offsets = [];
    for (let offset = first; offset <= horizon.durationDays; offset += 1) {
      if (canProduceOn(producer, addStardewDays(horizon.startDate, offset), location)) offsets.push(offset);
    }
    return offsets;
  }
  if (plantingOffset === null || !canProduceOn(producer, addStardewDays(horizon.startDate, plantingOffset), location)) return [];
  for (let offset = plantingOffset + 1; offset <= plantingOffset + first; offset += 1) {
    if (offset > horizon.durationDays) return [];
    if (!canProduceOn(producer, addStardewDays(horizon.startDate, offset), location)) return [];
  }
  const offsets = [];
  let offset = plantingOffset + first;
  while (offset <= horizon.durationDays) {
    const date = addStardewDays(horizon.startDate, offset);
    if (!canProduceOn(producer, date, location)) break;
    offsets.push(offset);
    const nextCycle = producer.repeatDays && producer.repeatDays > 0
      ? integer(producer.repeatDays)
      : replant ? first : 0;
    if (nextCycle <= 0) break;
    offset += nextCycle;
  }
  return offsets;
}

function safeYield(producer, key) {
  const fallback = Number(producer.yield?.expected ?? producer.yield?.min ?? 1);
  return Math.max(0, Number(producer.yield?.[key] ?? fallback));
}

function quantityFor(mode, amount, producer, harvestCount, plantingCount, setupCostPerProducer) {
  const requested = Math.max(0, Number(amount) || 0);
  const startupCost = Math.max(0, Number(producer.startupCost) || 0);
  const initialCost = startupCost + setupCostPerProducer;
  const space = Math.max(1, Number(producer.space) || 1);
  if (mode === "tiles") return Math.floor(requested / space);
  if (mode === "target") {
    const expectedRevenue = harvestCount * safeYield(producer, "expected") * Math.max(0, Number(producer.outputValueByScenario?.expected ?? producer.outputValue) || 0);
    const profitPerProducer = expectedRevenue - startupCost * plantingCount - setupCostPerProducer;
    return profitPerProducer > 0 ? Math.ceil(requested / profitPerProducer) : 0;
  }
  return initialCost > 0 ? Math.floor(requested / initialCost) : 0;
}

export function calculateProductionPlan(input) {
  const producer = input.producer || {};
  const horizon = resolvePlanningHorizon(input);
  const location = input.location || "outdoors";
  const replant = input.replant !== false;
  const forcePlantToday = input.forcePlantToday === true;
  const plantingOffset = plantingOffsetFor(producer, horizon, location, forcePlantToday);
  const plantingDate = plantingOffset === null ? null : addStardewDays(horizon.startDate, plantingOffset);
  const offsets = productionOffsets(producer, horizon, location, replant, plantingOffset);
  const mode = ["budget", "tiles", "target"].includes(input.mode) ? input.mode : "budget";
  const startupCost = Math.max(0, Number(producer.startupCost) || 0);
  const setupCostPerProducer = Math.max(0, Number(input.setupCostPerProducer) || 0);
  const canStart = producer.kind !== "crop" || canProduceOn(producer, horizon.startDate, location);
  const canPlantInHorizon = plantingOffset !== null;
  const isReplantedCrop = producer.kind === "crop" && !producer.repeatDays && replant;
  const plantingCount = isReplantedCrop ? Math.max(1, offsets.length) : 1;
  const quantity = canPlantInHorizon
    ? quantityFor(mode, input.amount, producer, offsets.length, plantingCount, setupCostPerProducer)
    : 0;
  const outputValue = Math.max(0, Number(producer.outputValue) || 0);
  const investment = quantity * startupCost;
  const setupCosts = quantity * setupCostPerProducer;
  const recurringCosts = isReplantedCrop ? investment * Math.max(0, offsets.length - 1) : 0;
  const totalCosts = investment + setupCosts + recurringCosts;
  const scenarios = Object.fromEntries(["conservative", "expected", "optimistic"].map((scenario) => {
    const yieldKey = scenario === "conservative" ? "min" : scenario === "optimistic" ? "max" : "expected";
    const units = quantity * offsets.length * safeYield(producer, yieldKey);
    const scenarioOutputValue = Math.max(0, Number(producer.outputValueByScenario?.[scenario] ?? outputValue) || 0);
    const grossRevenue = Math.round(units * scenarioOutputValue);
    const netProfit = grossRevenue - totalCosts;
    return [scenario, {
      units: Math.round(units * 100) / 100,
      grossRevenue,
      netProfit,
      profitPerDay: horizon.durationDays > 0 ? Math.round(netProfit / horizon.durationDays) : netProfit,
      profitPerSpace: quantity > 0 ? Math.round(netProfit / (quantity * Math.max(1, Number(producer.space) || 1))) : 0,
    }];
  }));
  let accumulated = -(investment + setupCosts);
  let breakEvenDate = null;
  const revenuePerHarvest = quantity * safeYield(producer, "expected") * Math.max(0, Number(producer.outputValueByScenario?.expected ?? outputValue) || 0);
  for (const [index, offset] of offsets.entries()) {
    accumulated += revenuePerHarvest;
    if (isReplantedCrop && index < offsets.length - 1) accumulated -= investment;
    if (accumulated >= 0) {
      breakEvenDate = addStardewDays(horizon.startDate, offset);
      break;
    }
  }
  const warnings = [...horizon.warnings];
  if (!producer.verified) warnings.push("unverified-producer-data");
  if (!producer.startupCost || producer.startupCost <= 0) warnings.push("missing-startup-cost");
  if (!producer.outputValue || producer.outputValue <= 0) warnings.push("missing-output-value");
  if (producer.kind === "crop" && !canPlantInHorizon) warnings.push("no-planting-date-in-horizon");
  else if (producer.kind === "crop" && forcePlantToday && !canStart) warnings.push("cannot-plant-on-start-date");
  else {
    if (producer.kind === "crop" && plantingOffset > 0) warnings.push("planting-delayed");
    if (!offsets.length) warnings.push("no-production-in-horizon");
  }
  if (mode === "target" && quantity === 0) warnings.push("target-not-profitable");
  return {
    producerId: producer.id || "",
    mode,
    requestedAmount: Math.max(0, Number(input.amount) || 0),
    location,
    replant,
    forcePlantToday,
    plantingDate,
    plantingDelayDays: plantingOffset,
    ...horizon,
    quantity,
    requiredSpace: quantity * Math.max(1, Number(producer.space) || 1),
    investment,
    setupCosts,
    recurringCosts,
    totalCosts,
    unusedBudget: mode === "budget" ? Math.max(0, Math.floor(Number(input.amount) || 0) - investment - setupCosts) : 0,
    harvestDates: offsets.map((offset) => addStardewDays(horizon.startDate, offset)),
    breakEvenDate,
    scenarios,
    warnings: [...new Set(warnings)],
  };
}
