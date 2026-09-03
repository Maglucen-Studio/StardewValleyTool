import { addStardewDays, resolvePlanningHorizon } from "./production-engine.mjs";

const GAME_MINUTES_PER_DAY = 1600;
const qualityMultiplier = quality => quality === 4 ? 2 : quality === 2 ? 1.5 : quality === 1 ? 1.25 : 1;
const whole = value => Math.max(0, Math.floor(Number(value) || 0));

function outputUnitPrice(conversion, inputQuality, artisan) {
  const inputPrice = Math.max(0, Number(conversion.input.price) || 0);
  const base = Math.max(0, Number(conversion.output.price) || 0);
  const formula = conversion.priceFormula || "fixed";
  let value = formula === "wine" ? inputPrice * 3
    : formula === "juice" ? inputPrice * 2.25
      : formula === "jelly" || formula === "pickles" ? inputPrice * 2 + 50
        : formula === "dried-fruit" || formula === "dried-mushroom" ? inputPrice * 7.5 + 25
          : formula === "smoked-fish" ? inputPrice * 2 * qualityMultiplier(inputQuality)
            : base * qualityMultiplier(conversion.outputQuality);
  if (artisan && conversion.artisanEligible) value *= 1.4;
  return Math.floor(value);
}

export function calculateMachinePlan(input) {
  const conversion = input.conversion;
  const horizon = resolvePlanningHorizon(input);
  const machineCount = Math.max(1, whole(input.machineCount));
  const initialInput = whole(input.initialInput);
  const recurringInputPerDay = Math.max(0, Number(input.recurringInputPerDay) || 0);
  const inputCount = Math.max(1, whole(conversion.inputCount));
  const baseCycleMinutes = Math.max(1, whole(conversion.cycleMinutes));
  const collectionEveryDays = whole(input.collectionEveryDays);
  const cadenceMinutes = collectionEveryDays * GAME_MINUTES_PER_DAY;
  const effectiveCycleMinutes = cadenceMinutes > 0
    ? Math.ceil(baseCycleMinutes / cadenceMinutes) * cadenceMinutes
    : baseCycleMinutes;
  const cyclesPerMachine = Math.floor(horizon.durationDays * GAME_MINUTES_PER_DAY / effectiveCycleMinutes);
  const capacityBatches = machineCount * cyclesPerMachine;
  const availableInput = Math.floor(initialInput + recurringInputPerDay * horizon.durationDays);
  const inputLimitedBatches = Math.floor(availableInput / inputCount);
  const batches = Math.min(capacityBatches, inputLimitedBatches);
  const consumedInput = batches * inputCount;
  const surplusInput = Math.max(0, availableInput - consumedInput);
  const idleBatches = Math.max(0, capacityBatches - batches);
  const inputQuality = [0, 1, 2, 4].includes(input.inputQuality) ? input.inputQuality : 0;
  const directSaleValue = Math.floor(consumedInput * conversion.input.price * qualityMultiplier(inputQuality));
  const additionalInputCost = batches * Math.max(0, Number(conversion.additionalInputCost) || 0);
  const setupCost = input.existing ? 0 : machineCount * Math.max(0, Number(conversion.machine.opportunityCost) || 0);
  const outputPrice = outputUnitPrice(conversion, inputQuality, input.artisan === true);
  const scenarioCounts = {
    conservative: Math.max(0, Number(conversion.outputCount?.min) || 0),
    expected: Math.max(0, Number(conversion.outputCount?.expected) || 0),
    optimistic: Math.max(0, Number(conversion.outputCount?.max) || 0),
  };
  const scenarios = Object.fromEntries(Object.entries(scenarioCounts).map(([key, perBatch]) => {
    const units = batches * perBatch;
    const grossRevenue = Math.floor(units * outputPrice);
    const netProfit = grossRevenue - directSaleValue - additionalInputCost - setupCost;
    return [key, { units, grossRevenue, netProfit, profitPerDay: horizon.durationDays > 0 ? Math.floor(netProfit / horizon.durationDays) : netProfit }];
  }));
  const expectedMarginPerBatch = scenarioCounts.expected * outputPrice - inputCount * conversion.input.price * qualityMultiplier(inputQuality) - Math.max(0, Number(conversion.additionalInputCost) || 0);
  const breakEvenBatches = setupCost > 0 && expectedMarginPerBatch > 0 ? Math.ceil(setupCost / expectedMarginPerBatch) : 0;
  const breakEvenCycles = breakEvenBatches > 0 ? Math.ceil(breakEvenBatches / machineCount) : cyclesPerMachine > 0 ? 1 : 0;
  const breakEvenOffset = Math.ceil(breakEvenCycles * effectiveCycleMinutes / GAME_MINUTES_PER_DAY);
  const warnings = [];
  if (!conversion.verified) warnings.push("machine-unverified");
  if (cyclesPerMachine === 0) warnings.push("machine-period-too-short");
  if (availableInput < inputCount) warnings.push("machine-no-input");
  else if (batches < capacityBatches) warnings.push("machine-input-bottleneck");
  else if (surplusInput > 0) warnings.push("machine-capacity-bottleneck");
  return {
    ...horizon,
    machineCount,
    effectiveCycleMinutes,
    cyclesPerMachine,
    capacityBatches,
    batches,
    availableInput,
    consumedInput,
    surplusInput,
    idleBatches,
    directSaleValue,
    additionalInputCost,
    setupCost,
    outputPrice,
    scenarios,
    firstIncomeDate: batches > 0 ? addStardewDays(horizon.startDate, Math.ceil(effectiveCycleMinutes / GAME_MINUTES_PER_DAY)) : null,
    breakEvenDate: breakEvenCycles > 0 && breakEvenCycles <= cyclesPerMachine ? addStardewDays(horizon.startDate, breakEvenOffset) : null,
    warnings,
  };
}

