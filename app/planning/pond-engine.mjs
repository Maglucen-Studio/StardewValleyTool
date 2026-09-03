import { addStardewDays, resolvePlanningHorizon } from "./production-engine.mjs";

const whole = value => Math.max(0, Math.floor(Number(value) || 0));

export function roePrice(fishPrice) {
  return Math.max(1, Math.floor(Math.max(0, Number(fishPrice) || 0) / 2) + 30);
}

export function calculateFishPondPlan(input) {
  const pond = input.pond;
  const horizon = resolvePlanningHorizon(input);
  const pondCount = Math.max(1, whole(input.pondCount));
  const startPopulation = Math.max(1, whole(input.startPopulation) || 1);
  const unlockedPopulation = Math.max(startPopulation, Math.min(pond.maxPopulation || 10, whole(input.unlockedPopulation) || pond.maxPopulation || 10));
  const spawnTime = Math.max(1, whole(pond.spawnTime) || 1);
  const fishPrice = Math.max(0, Number(pond.fish?.price) || 0);
  let population = Math.min(startPopulation, unlockedPopulation);
  let expectedItems = 0;
  let conservativeItems = 0;
  let optimisticItems = 0;
  let expectedRoeValue = 0;
  let conservativeRoeValue = 0;
  let optimisticRoeValue = 0;
  let expectedRoeItems = 0;
  let conservativeRoeItems = 0;
  let optimisticRoeItems = 0;
  let expectedOtherValue = 0;
  let conservativeOtherValue = 0;
  let optimisticOtherValue = 0;
  let grossPerExpectedUnit = 0;
  let firstOutputOffset = null;
  const expectedOutputMap = new Map();
  for (let day = 1; day <= horizon.durationDays; day += 1) {
    if (day % spawnTime === 0 && population < unlockedPopulation) population += 1;
    const fullness = Math.min(1, population / Math.max(1, pond.maxPopulation || 10));
    const baseChance = pond.baseMinProduceChance + (pond.baseMaxProduceChance - pond.baseMinProduceChance) * fullness;
    let remaining = 1;
    let dayExpectedItems = 0;
    let dayExpectedRoeValue = 0;
    let dayExpectedRoeItems = 0;
    let dayExpectedOtherValue = 0;
    let dayMaxItems = 0;
    let dayMaxRoeValue = 0;
    let dayMaxRoeItems = 0;
    let dayMaxOtherValue = 0;
    for (const reward of [...(pond.producedItems || [])].sort((a, b) => (a.precedence || 0) - (b.precedence || 0))) {
      if (population < (reward.requiredPopulation || 0) || reward.condition) continue;
      const chance = Math.max(0, Math.min(1, Number(reward.chance) || 0));
      const selectionChance = remaining * chance;
      remaining *= 1 - chance;
      const averageStack = (Math.max(1, reward.minStack || 1) + Math.max(1, reward.maxStack || 1)) / 2;
      const isRoe = reward.item?.id === "(O)812";
      const unitPrice = isRoe ? roePrice(fishPrice) : Math.max(0, Number(reward.item?.price) || 0);
      const expectedQuantity = baseChance * selectionChance * averageStack;
      const currentOutput = expectedOutputMap.get(reward.item?.id);
      if (reward.item?.id) expectedOutputMap.set(reward.item.id, {
        item: reward.item,
        quantity: (currentOutput?.quantity || 0) + expectedQuantity,
      });
      dayExpectedItems += selectionChance * averageStack;
      dayMaxItems = Math.max(dayMaxItems, Math.max(1, reward.maxStack || 1));
      if (isRoe) {
        dayExpectedRoeItems += selectionChance * averageStack;
        dayMaxRoeItems = Math.max(dayMaxRoeItems, Math.max(1, reward.maxStack || 1));
        dayExpectedRoeValue += selectionChance * averageStack * unitPrice;
        dayMaxRoeValue = Math.max(dayMaxRoeValue, Math.max(1, reward.maxStack || 1) * unitPrice);
      } else {
        dayExpectedOtherValue += selectionChance * averageStack * unitPrice;
        dayMaxOtherValue = Math.max(dayMaxOtherValue, Math.max(1, reward.maxStack || 1) * unitPrice);
      }
    }
    if (dayExpectedItems > 0 && firstOutputOffset === null) firstOutputOffset = day;
    const conservativeChance = Math.max(0, baseChance - 0.2);
    const optimisticChance = Math.min(1, baseChance + 0.2);
    expectedItems += baseChance * dayExpectedItems;
    conservativeItems += conservativeChance * dayExpectedItems;
    optimisticItems += optimisticChance * Math.max(dayExpectedItems, dayMaxItems);
    expectedRoeValue += baseChance * dayExpectedRoeValue;
    conservativeRoeValue += conservativeChance * dayExpectedRoeValue;
    optimisticRoeValue += optimisticChance * Math.max(dayExpectedRoeValue, dayMaxRoeValue);
    expectedRoeItems += baseChance * dayExpectedRoeItems;
    conservativeRoeItems += conservativeChance * dayExpectedRoeItems;
    optimisticRoeItems += optimisticChance * Math.max(dayExpectedRoeItems, dayMaxRoeItems);
    expectedOtherValue += baseChance * dayExpectedOtherValue;
    conservativeOtherValue += conservativeChance * dayExpectedOtherValue;
    optimisticOtherValue += optimisticChance * Math.max(dayExpectedOtherValue, dayMaxOtherValue);
    grossPerExpectedUnit = Math.max(grossPerExpectedUnit, dayExpectedRoeValue + dayExpectedOtherValue);
  }
  const purchaseCost = input.existing ? 0 : pondCount * Math.max(0, Number(input.pondCost) || 0);
  const processRoe = input.processRoe === true;
  const processorCount = processRoe ? Math.max(0, whole(input.processorCount)) : 0;
  const processorCycleDays = Math.max(1, Number(input.processorCycleDays) || 1);
  const batchesPerProcessor = horizon.durationDays > 0 ? Math.floor(horizon.durationDays / processorCycleDays) : 0;
  const processorCapacity = processorCount * batchesPerProcessor;
  const artisan = input.artisan && processRoe ? 1.4 : 1;
  const baseRoePrice = roePrice(fishPrice);
  const processedRoePrice = pond.fish?.id === "(O)698" ? 500 : baseRoePrice * 2 + 100;
  const processedValue = (roeItems, roeValue) => {
    if (!processRoe || processorCapacity <= 0) return roeValue * pondCount;
    const totalItems = roeItems * pondCount;
    const processedItems = Math.min(totalItems, processorCapacity);
    const rawItems = Math.max(0, totalItems - processedItems);
    return processedItems * processedRoePrice * artisan + rawItems * baseRoePrice;
  };
  const values = {
    conservative: processedValue(conservativeRoeItems, conservativeRoeValue) + conservativeOtherValue * pondCount,
    expected: processedValue(expectedRoeItems, expectedRoeValue) + expectedOtherValue * pondCount,
    optimistic: processedValue(optimisticRoeItems, optimisticRoeValue) + optimisticOtherValue * pondCount,
  };
  const units = { conservative: conservativeItems, expected: expectedItems, optimistic: optimisticItems };
  const scenarios = Object.fromEntries(Object.entries(values).map(([key, gross]) => {
    const grossRevenue = Math.floor(gross);
    const netProfit = grossRevenue - purchaseCost;
    return [key, { units: Math.round(units[key] * pondCount * 100) / 100, grossRevenue, netProfit, profitPerDay: horizon.durationDays ? Math.floor(netProfit / horizon.durationDays) : netProfit }];
  }));
  const warnings = [...horizon.warnings];
  if (unlockedPopulation < pond.maxPopulation) warnings.push("pond-population-gated");
  if (pond.producedItems?.some(item => item.condition)) warnings.push("pond-conditional-output");
  if (processRoe) warnings.push("pond-roe-processing-estimate");
  const expectedTotalRoe = expectedRoeItems * pondCount;
  const processedRoe = processRoe ? Math.min(expectedTotalRoe, processorCapacity) : 0;
  const unprocessedRoe = Math.max(0, expectedTotalRoe - processedRoe);
  const outputs = [...expectedOutputMap.values()].map(output => ({ ...output, quantity: output.quantity * pondCount }));
  if (processRoe) {
    const roeOutput = outputs.find(output => output.item.id === "(O)812");
    if (roeOutput) roeOutput.quantity = unprocessedRoe;
    if (processedRoe > 0 && input.processedRoeItem)
      outputs.push({ item: input.processedRoeItem, quantity: processedRoe });
  }
  if (processRoe && unprocessedRoe > 0) warnings.push("pond-processing-capacity");
  return {
    ...horizon, pondCount, startPopulation, endPopulation: population, unlockedPopulation,
    purchaseCost, totalCosts: purchaseCost, scenarios, expectedDailyValue: horizon.durationDays ? Math.floor(values.expected / horizon.durationDays) : 0,
    firstIncomeDate: firstOutputOffset ? addStardewDays(horizon.startDate, firstOutputOffset) : null,
    breakEvenDate: purchaseCost === 0 ? (firstOutputOffset ? addStardewDays(horizon.startDate, firstOutputOffset) : null) : null,
    warnings: [...new Set(warnings)], grossPerExpectedUnit,
    processorCount, processorCycleDays, processorCapacity, processedRoe, unprocessedRoe,
    outputs: outputs.filter(output => output.quantity > 0).map(output => ({ ...output, quantity: Math.round(output.quantity * 100) / 100 })),
  };
}
