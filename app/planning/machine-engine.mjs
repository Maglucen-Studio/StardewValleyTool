import { addStardewDays, resolvePlanningHorizon } from "./production-engine.mjs";

const GAME_MINUTES_PER_DAY = 1600;
const qualityMultiplier = quality => quality === 4 ? 2 : quality === 2 ? 1.5 : quality === 1 ? 1.25 : 1;
const whole = value => Math.max(0, Math.floor(Number(value) || 0));

function chronologicalBatches(input, horizon, machineCount, inputCount, cycleMinutes) {
  const horizonMinutes = horizon.durationDays * GAME_MINUTES_PER_DAY;
  const arrivals = [{ minute: 0, quantity: whole(input.initialInput) }];
  for (const event of input.inputEvents || []) {
    const minute = Number.isFinite(Number(event.minute))
      ? Math.max(0, Number(event.minute))
      : Math.max(0, Number(event.day) || 0) * GAME_MINUTES_PER_DAY;
    const quantity = Math.max(0, Number(event.quantity) || 0);
    if (minute <= horizonMinutes && quantity > 0) arrivals.push({ minute, quantity });
  }
  const recurring = Math.max(0, Number(input.recurringInputPerDay) || 0);
  if (recurring > 0)
    for (let day = 1; day <= horizon.durationDays; day += 1)
      arrivals.push({ minute: day * GAME_MINUTES_PER_DAY, quantity: recurring });
  arrivals.sort((left, right) => left.minute - right.minute);

  const totalInput = arrivals.reduce((sum, event) => sum + event.quantity, 0);
  const readyAt = Array.from({ length: machineCount }, () => 0);
  const completions = [];
  let arrivalIndex = 0;
  let available = 0;
  let consumed = 0;
  let clock = 0;
  while (readyAt.length > 0 && clock <= horizonMinutes) {
    while (arrivalIndex < arrivals.length && arrivals[arrivalIndex].minute <= clock) {
      available += arrivals[arrivalIndex].quantity;
      arrivalIndex += 1;
    }
    const machineIndex = readyAt.findIndex(minute => minute <= clock);
    if (machineIndex >= 0 && available + 1e-9 >= inputCount) {
      if (clock + cycleMinutes > horizonMinutes) break;
      available -= inputCount;
      consumed += inputCount;
      const completedAt = clock + cycleMinutes;
      readyAt[machineIndex] = completedAt;
      completions.push(completedAt);
      continue;
    }
    const nextArrival = arrivals[arrivalIndex]?.minute ?? Infinity;
    const nextReady = Math.min(...readyAt.filter(minute => minute > clock));
    const nextClock = Math.min(nextArrival, nextReady);
    if (!Number.isFinite(nextClock) || nextClock <= clock) break;
    clock = nextClock;
  }
  return { totalInput: Math.floor(totalInput + 1e-9), consumed, completions };
}

export function machineOutputUnitPrice(conversion, inputQuality = 0, artisan = false) {
  const inputPrice = Math.max(0, Number(conversion.input.price) || 0);
  const base = Math.max(0, Number(conversion.output.price) || 0);
  const formula = conversion.priceFormula || "fixed";
  let value = formula === "cask" ? inputPrice * qualityMultiplier(4)
    : formula === "wine" ? inputPrice * 3
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
  const inputCount = Math.max(1, whole(conversion.inputCount));
  const caskDaysByQuality = { 0: 56, 1: 42, 2: 28, 4: 0 };
  const baseCycleMinutes = conversion.priceFormula === "cask"
    ? Math.max(1, Math.ceil((caskDaysByQuality[input.inputQuality] ?? 56) / Math.max(0.01, Number(conversion.agingMultiplier) || 1)) * GAME_MINUTES_PER_DAY)
    : Math.max(1, whole(conversion.cycleMinutes));
  const collectionEveryDays = whole(input.collectionEveryDays);
  const cadenceMinutes = collectionEveryDays * GAME_MINUTES_PER_DAY;
  const effectiveCycleMinutes = cadenceMinutes > 0
    ? Math.ceil(baseCycleMinutes / cadenceMinutes) * cadenceMinutes
    : baseCycleMinutes;
  const cyclesPerMachine = Math.floor(horizon.durationDays * GAME_MINUTES_PER_DAY / effectiveCycleMinutes);
  const caskAlreadyIridium = conversion.priceFormula === "cask" && input.inputQuality === 4;
  const capacityBatches = caskAlreadyIridium ? 0 : machineCount * cyclesPerMachine;
  const schedule = caskAlreadyIridium
    ? { totalInput: Math.floor(whole(input.initialInput) + Math.max(0, Number(input.recurringInputPerDay) || 0) * horizon.durationDays), consumed: 0, completions: [] }
    : chronologicalBatches(input, horizon, machineCount, inputCount, effectiveCycleMinutes);
  const availableInput = schedule.totalInput;
  const batches = schedule.completions.length;
  const consumedInput = schedule.consumed;
  const surplusInput = Math.max(0, availableInput - consumedInput);
  const idleBatches = Math.max(0, capacityBatches - batches);
  const inputQuality = [0, 1, 2, 4].includes(input.inputQuality) ? input.inputQuality : 0;
  const inputArtisanMultiplier = conversion.priceFormula === "cask" && input.artisan && conversion.artisanEligible ? 1.4 : 1;
  const directSaleValue = Math.floor(consumedInput * conversion.input.price * qualityMultiplier(inputQuality) * inputArtisanMultiplier);
  const additionalInputCost = batches * Math.max(0, Number(conversion.additionalInputCost) || 0);
  const setupCost = input.existing ? 0 : machineCount * Math.max(0, Number(conversion.machine.opportunityCost) || 0);
  const outputPrice = machineOutputUnitPrice(conversion, inputQuality, input.artisan === true);
  const scenarioCounts = {
    conservative: Math.max(0, Number(conversion.outputCount?.min) || 0),
    expected: Math.max(0, Number(conversion.outputCount?.expected) || 0),
    optimistic: Math.max(0, Number(conversion.outputCount?.max) || 0),
  };
  const outputEvents = schedule.completions.map(minute => ({
    minute,
    day: Math.ceil(minute / GAME_MINUTES_PER_DAY),
    quantity: scenarioCounts.expected,
  }));
  const scenarios = Object.fromEntries(Object.entries(scenarioCounts).map(([key, perBatch]) => {
    const units = batches * perBatch;
    const grossRevenue = Math.floor(units * outputPrice);
    const netProfit = grossRevenue - directSaleValue - additionalInputCost - setupCost;
    return [key, { units, grossRevenue, netProfit, profitPerDay: horizon.durationDays > 0 ? Math.floor(netProfit / horizon.durationDays) : netProfit }];
  }));
  const expectedMarginPerBatch = scenarioCounts.expected * outputPrice - inputCount * conversion.input.price * qualityMultiplier(inputQuality) - Math.max(0, Number(conversion.additionalInputCost) || 0);
  const breakEvenBatches = setupCost > 0 && expectedMarginPerBatch > 0 ? Math.ceil(setupCost / expectedMarginPerBatch) : 0;
  const breakEvenCompletion = breakEvenBatches > 0 ? outputEvents[breakEvenBatches - 1] : outputEvents[0];
  const warnings = [];
  if (!conversion.verified) warnings.push("machine-unverified");
  if (conversion.locationRequirement === "cellar" && input.hasCellar !== true) warnings.push("machine-cellar-required");
  if (caskAlreadyIridium) warnings.push("machine-cask-already-iridium");
  if (conversion.priceFormula === "cask" && conversion.input.source && input.linkedUpstream !== true) warnings.push("machine-cask-flavor-stock-manual");
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
    outputEvents,
    firstIncomeDate: outputEvents[0] ? addStardewDays(horizon.startDate, outputEvents[0].day) : null,
    breakEvenDate: breakEvenCompletion ? addStardewDays(horizon.startDate, breakEvenCompletion.day) : null,
    warnings,
  };
}

