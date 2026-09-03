import { addStardewDays, resolvePlanningHorizon } from "./production-engine.mjs";

const whole = value => Math.max(0, Math.floor(Number(value) || 0));
const qualityMultiplier = quality => quality === 4 ? 2 : quality === 2 ? 1.5 : quality === 1 ? 1.25 : 1;

export function calculateAnimalPlan(input) {
  const animal = input.animal;
  const horizon = resolvePlanningHorizon(input);
  const count = Math.max(1, whole(input.count));
  const existingCount = Math.min(count, whole(input.existingCount));
  const newCount = count - existingCount;
  const interval = Math.max(1, whole(animal.daysToProduce) || 1);
  const maturity = Math.max(0, whole(animal.daysToMature));
  const fedDaily = input.fedDaily !== false;
  const existingCycles = fedDaily ? Math.floor(horizon.durationDays / interval) : 0;
  const productiveNewDays = Math.max(0, horizon.durationDays - maturity + (animal.produceOnMature ? interval : 0));
  const newCycles = fedDaily ? Math.floor(productiveNewDays / interval) : 0;
  let cycles = existingCount * existingCycles + newCount * newCycles;
  if (animal.harvestType === "DigUp" && horizon.durationDays > 0) {
    let nonWinterDays = 0;
    for (let day = 1; day <= horizon.durationDays; day += 1)
      if (addStardewDays(horizon.startDate, day).season !== "winter") nonWinterDays += 1;
    cycles = Math.floor(cycles * nonWinterDays / horizon.durationDays);
  }
  const friendship = Math.max(0, Math.min(1000, Number(input.friendship) || 0));
  const happiness = Math.max(0, Math.min(255, Number(input.happiness) || 0));
  const deluxeChance = friendship < (animal.deluxeProduceMinimumFriendship || Infinity)
    ? 0
    : Math.max(0, Math.min(1, (friendship - animal.deluxeProduceMinimumFriendship) / Math.max(1, animal.deluxeProduceCareDivisor || 1200)));
  const caredFor = fedDaily && happiness >= 200;
  const standard = animal.produce?.[0]?.item;
  const deluxe = animal.deluxeProduce?.[0]?.item;
  const standardPrice = Math.max(0, Number(standard?.price) || 0);
  const deluxePrice = Math.max(0, Number(deluxe?.price) || standardPrice);
  const quality = [0, 1, 2, 4].includes(input.quality) ? input.quality : 0;
  const rancherMultiplier = input.rancher ? 1.2 : 1;
  const directPrice = value => Math.floor(value * qualityMultiplier(quality) * rancherMultiplier);
  const processor = input.processor;
  const artisanMultiplier = input.artisan && processor?.artisanEligible ? 1.4 : 1;
  const processedPrice = value => processor
    ? Math.floor((processor.outputPriceForInput?.(value) ?? processor.outputPrice ?? value) * artisanMultiplier)
    : directPrice(value);
  const expectedProcessedPrice = caredFor && deluxe
    ? processedPrice(standardPrice) * (1 - deluxeChance) + processedPrice(deluxePrice) * deluxeChance
    : processedPrice(standardPrice);
  const expectedDirectPrice = caredFor && deluxe
    ? directPrice(standardPrice) * (1 - deluxeChance) + directPrice(deluxePrice) * deluxeChance
    : directPrice(standardPrice);
  const animalPurchaseCost = newCount * Math.max(0, Number(animal.purchasePrice) || 0);
  const detectedCapacity = Number.isFinite(input.buildingCapacity) ? Math.max(0, whole(input.buildingCapacity)) : count;
  const buildingUnits = count > detectedCapacity && animal.buildingCapacity > 0 ? Math.ceil((count - detectedCapacity) / animal.buildingCapacity) : 0;
  const buildingCost = buildingUnits * Math.max(0, Number(animal.buildingCost) || 0);
  const purchaseCost = animalPurchaseCost + buildingCost;
  const feedCost = input.buyFeed ? count * horizon.durationDays * Math.max(0, Number(input.feedUnitCost) || 0) : 0;
  const processorCapacity = processor ? whole(input.processorCount) * Math.floor(horizon.durationDays / Math.max(1, Number(processor.cycleDays) || 1)) : Infinity;
  const processedCycles = processor ? Math.min(cycles, processorCapacity) : 0;
  const rawCycles = cycles - processedCycles;
  const expectedDeluxeCycles = caredFor && deluxe ? rawCycles * deluxeChance : 0;
  const expectedStandardCycles = Math.max(0, rawCycles - expectedDeluxeCycles);
  const outputMap = new Map();
  const addOutput = (item, quantity) => {
    if (!item || quantity <= 0) return;
    const current = outputMap.get(item.id);
    outputMap.set(item.id, { item, quantity: (current?.quantity || 0) + quantity });
  };
  addOutput(standard, expectedStandardCycles);
  addOutput(deluxe, expectedDeluxeCycles);
  addOutput(processor?.output, processedCycles * Math.max(0, Number(processor?.outputCount) || 1));
  const warnings = [...horizon.warnings];
  if (!fedDaily) warnings.push("animal-not-fed");
  if (!animal.purchasable && newCount > 0) warnings.push("animal-not-purchasable");
  if (Number.isFinite(input.buildingCapacity) && count > input.buildingCapacity) warnings.push("animal-building-capacity");
  if (animal.harvestType === "DigUp") warnings.push("animal-weather-dependent");
  if (processor && processedCycles < cycles) warnings.push("animal-processing-bottleneck");
  const processedScenarioPrices = {
    conservative: processedPrice(standardPrice),
    expected: expectedProcessedPrice,
    optimistic: processedPrice(deluxe ? deluxePrice : standardPrice),
  };
  const directScenarioPrices = {
    conservative: directPrice(standardPrice),
    expected: expectedDirectPrice,
    optimistic: directPrice(deluxe ? deluxePrice : standardPrice),
  };
  const scenarios = Object.fromEntries(Object.entries(processedScenarioPrices).map(([key, price]) => {
    const grossRevenue = Math.floor(processedCycles * price + (cycles - processedCycles) * directScenarioPrices[key]);
    const netProfit = grossRevenue - purchaseCost - feedCost;
    return [key, { units: cycles, grossRevenue, netProfit, profitPerDay: horizon.durationDays ? Math.floor(netProfit / horizon.durationDays) : netProfit }];
  }));
  const expectedMargin = Math.max(0, expectedProcessedPrice - (input.buyFeed ? interval * Math.max(0, Number(input.feedUnitCost) || 0) : 0));
  const breakEvenCycles = purchaseCost > 0 && expectedMargin > 0 ? Math.ceil(purchaseCost / expectedMargin) : 0;
  return {
    ...horizon, count, existingCount, newCount, cycles, processedCycles, animalPurchaseCost, buildingCost, purchaseCost, feedCost,
    totalCosts: purchaseCost + feedCost, scenarios,
    firstIncomeDate: cycles > 0 ? addStardewDays(horizon.startDate, existingCount ? interval : maturity + interval) : null,
    breakEvenDate: breakEvenCycles > 0 && breakEvenCycles <= processedCycles ? addStardewDays(horizon.startDate, Math.ceil(breakEvenCycles / count) * interval + (newCount ? maturity : 0)) : null,
    warnings: [...new Set(warnings)], deluxeChance,
    outputs: [...outputMap.values()].map(output => ({ ...output, quantity: Math.round(output.quantity * 100) / 100 })),
  };
}
