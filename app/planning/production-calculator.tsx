"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useI18n } from "../i18n";
import {
  STARDEW_SEASONS,
  addStardewDays,
  calculateProductionPlan,
  type ProductionPlan,
  type ProductionProducer,
  type StardewDate,
} from "./production-engine.mjs";
import { calculateMushroomLogPlan, expectedTreeGrowthDays, type MushroomSpecies } from "./forestry-engine.mjs";
import { calculateMachinePlan, machineOutputUnitPrice, type MachineConversion } from "./machine-engine.mjs";
import { calculateAnimalPlan } from "./animal-engine.mjs";
import { calculateFishPondPlan } from "./pond-engine.mjs";
import { evaluateProductionPortfolio } from "./portfolio-engine.mjs";

export type ProductionCatalogEntry = Omit<ProductionProducer, "outputValue"> & {
  output: { id: string; name: string; price: number; category?: number; spriteIndex?: number };
  growthPhases?: number[];
  yieldRules?: { maxIncreasePerFarmingLevel: number; extraHarvestChance: number };
  clearance?: number;
  family?: "farming" | "forestry" | "machine" | "animal" | "pond";
  materials?: Array<{ item: { id: string; name: string; price: number; spriteIndex?: number }; quantity: number }>;
  machineConversion?: MachineConversion;
  animal?: ProductionAnimal;
  pond?: ProductionPond;
};
export type ProductionAnimal = {
  id: string; name: string; purchasePrice: number; purchasable: boolean; requiredBuilding: string; buildingCapacity: number; buildingCost: number; daysToMature: number; daysToProduce: number;
  harvestType: string; produceOnMature: boolean; deluxeProduceMinimumFriendship: number; deluxeProduceCareDivisor: number;
  produce: Array<{ item: { id: string; name: string; price: number; spriteIndex?: number } }>;
  deluxeProduce: Array<{ item: { id: string; name: string; price: number; spriteIndex?: number } }>;
};
export type ProductionPond = {
  id: string; fish: { id: string; name: string; price: number; spriteIndex?: number }; ruleId: string; maxPopulation: number; spawnTime: number;
  baseMinProduceChance: number; baseMaxProduceChance: number; populationGates?: Record<string, string[]>;
  producedItems: Array<{ requiredPopulation: number; chance: number; precedence: number; condition?: string | null; item: { id: string; name: string; price: number; spriteIndex?: number }; minStack: number; maxStack: number }>;
};
export type ProductionFertilizer = {
  id: string;
  name: string;
  kind: "quality" | "speed";
  qualityBoost: number;
  speedBoost: number;
  startupCost: number;
  verified: boolean;
  verifiedCost: boolean;
};
export type ProductionCatalog = {
  catalogVersion: number;
  source?: "local-game";
  crops: ProductionCatalogEntry[];
  fruitTrees: ProductionCatalogEntry[];
  fertilizers?: ProductionFertilizer[];
  tappedTrees?: Array<{ id: string; treeType: string; seed: { id: string; name: string; price: number; spriteIndex?: number }; growthChance: number; fertilizedGrowthChance: number; growsInWinter: boolean; tapItems: Array<{ itemId: string; item: { id: string; name: string; price: number; spriteIndex?: number } | null; daysUntilReady: number; condition?: string | null; season?: string | null; hasTimeModifiers?: boolean }> }>;
  mushroomLogOutputs?: Array<{ id: string; name: string; price: number; spriteIndex?: number }>;
  forestryEquipment?: Array<{ id: string; name: string; spriteIndex?: number; opportunityCost: number; materials: Array<{ item: { id: string; name: string; price: number; spriteIndex?: number }; quantity: number }> }>;
  artisanMachines?: MachineConversion[];
  farmAnimals?: ProductionAnimal[];
  fishPonds?: ProductionPond[];
  feedUnitCost?: number;
};

type CalculatorMode = "budget" | "tiles" | "target" | "units";
type HorizonMode = "days" | "date";
type GrowingLocation = "outdoors" | "greenhouse" | "island";
type ComparisonView = "table" | "chart";
type SavedCalculation = {
  id: string;
  name?: string;
  selectedId: string;
  mode: CalculatorMode;
  amount: number;
  horizonMode: HorizonMode;
  durationDays: number;
  endYear: number;
  endSeason: StardewDate["season"];
  endDay: number;
  location: GrowingLocation;
  replant: boolean;
  forcePlantToday: boolean;
  farmingLevel: number;
  tiller: boolean;
  agriculturist: boolean;
  fertilizerId: string;
  forestryExisting?: boolean;
  forestryHeavy?: boolean;
  forestryFertilized?: boolean;
  mushroomSpecies?: MushroomSpecies;
  mushroomMossy?: number;
  machineExisting?: boolean;
  machineInitialInput?: number;
  machineRecurringInput?: number;
  machineInputQuality?: number;
  machineCollectionEveryDays?: number;
  artisan?: boolean;
  animalExistingCount?: number;
  animalFed?: boolean;
  animalFriendship?: number;
  animalHappiness?: number;
  animalProcessorId?: string;
  animalProcessorCount?: number;
  pondExisting?: boolean;
  pondPopulation?: number;
  pondUnlockedPopulation?: number;
  pondProcessRoe?: boolean;
};

type ForestrySettings = {
  existing: boolean;
  heavy: boolean;
  fertilized: boolean;
  species: MushroomSpecies;
  mossy: number;
};

function normalizeSearchValue(value: string, locale: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase(locale);
}

const MUSHROOM_OUTPUT_KEYS: Record<string, "common" | "red" | "purple" | "morel" | "chanterelle"> = {
  "(O)404": "common", "(O)420": "red", "(O)422": "purple", "(O)257": "morel", "(O)281": "chanterelle",
};

function producerGroupKey(kind: ProductionCatalogEntry["kind"]) {
  return kind === "crop" ? "planner.group.crops"
    : kind === "fruit-tree" ? "planner.group.fruitTrees"
      : kind === "tapped-tree" ? "planner.group.tappedTrees"
      : kind === "mushroom-log" ? "planner.group.mushroomLogs"
        : kind === "animal" ? "planner.group.animals"
          : kind === "fish-pond" ? "planner.group.ponds"
            : "planner.group.machines";
}

function buildCalculatorEntries(catalog: ProductionCatalog | undefined, forestry: ForestrySettings): ProductionCatalogEntry[] {
  const farming = [...(catalog?.crops || []), ...(catalog?.fruitTrees || [])].map(entry => ({ ...entry, family: "farming" as const }));
  const simpleTrees = (catalog?.tappedTrees || []).filter(tree => tree.tapItems.length === 1 && tree.tapItems[0].item && !tree.tapItems[0].condition && !tree.tapItems[0].season && !tree.tapItems[0].hasTimeModifiers);
  const tapper = catalog?.forestryEquipment?.find(item => item.id === (forestry.heavy ? "(BC)264" : "(BC)105"));
  const tapped = simpleTrees.map(tree => {
    const tappedItem = tree.tapItems[0];
    const cycle = Math.max(1, Math.floor(tappedItem.daysUntilReady * (forestry.heavy ? 0.5 : 1)));
    const growth = forestry.existing ? 0 : expectedTreeGrowthDays(5, forestry.fertilized ? tree.fertilizedGrowthChance : tree.growthChance);
    return {
      id: `forestry:${tree.id}`,
      kind: "tapped-tree" as const,
      family: "forestry" as const,
      name: tappedItem.item?.name || tappedItem.itemId,
      output: tappedItem.item!,
      seasons: [],
      firstOutputDays: growth + cycle,
      repeatDays: cycle,
      startupCost: forestry.existing ? 0 : tree.seed.price + (tapper?.opportunityCost || 0),
      yield: { min: 1, expected: 1, max: 1 },
      space: 1,
      verified: Boolean(tappedItem.item?.price),
      materials: forestry.existing ? [] : [...(tapper?.materials || []), { item: tree.seed, quantity: 1 }],
    };
  });
  const log = catalog?.forestryEquipment?.find(item => item.id === "(BC)MushroomLog");
  const prices = Object.fromEntries((catalog?.mushroomLogOutputs || []).map(item => [MUSHROOM_OUTPUT_KEYS[item.id], item.price]).filter(([key]) => key));
  const logPlan = calculateMushroomLogPlan({ count: 1, days: 3, existing: forestry.existing, equipmentCost: log?.opportunityCost || 0, mossy: forestry.mossy, species: forestry.species, prices });
  const possiblePrices = Object.entries(logPlan.weights).filter(([, weight]) => weight > 0).map(([key]) => prices[key] || 0).filter(value => value > 0);
  const mushroomLog: ProductionCatalogEntry[] = log ? [{
    id: "forestry:mushroom-log",
    kind: "mushroom-log",
    family: "forestry",
    name: log.name,
    output: { id: log.id, name: log.name, price: Math.round(logPlan.averagePrice * logPlan.qualityMultiplier), spriteIndex: log.spriteIndex },
    outputValueByScenario: { conservative: possiblePrices.length ? Math.min(...possiblePrices) : 0, expected: Math.round(logPlan.averagePrice * logPlan.qualityMultiplier), optimistic: (possiblePrices.length ? Math.max(...possiblePrices) : 0) * 2 },
    seasons: [],
    firstOutputDays: 3,
    repeatDays: 3,
    startupCost: forestry.existing ? 0 : log.opportunityCost,
    yield: { min: Math.max(1, Math.min(5, Math.floor(logPlan.nearbyTrees / 2))), expected: logPlan.unitsPerCycle, max: Math.max(1, Math.min(5, Math.floor(logPlan.nearbyTrees / 2) * 2)) },
    space: 1,
    verified: possiblePrices.length > 0,
    materials: forestry.existing ? [] : log.materials,
  }] : [];
  const machineEntries: ProductionCatalogEntry[] = (catalog?.artisanMachines || []).map(conversion => ({
    id: conversion.id,
    kind: "machine",
    family: "machine",
    name: conversion.output.name,
    output: conversion.output,
    seasons: [],
    firstOutputDays: Math.max(1, Math.ceil(conversion.cycleMinutes / 1600)),
    repeatDays: Math.max(1, Math.ceil(conversion.cycleMinutes / 1600)),
    startupCost: conversion.machine.opportunityCost,
    yield: conversion.outputCount,
    space: 1,
    verified: conversion.verified,
    materials: conversion.machine.materials,
    machineConversion: conversion,
  }));
  const animalEntries: ProductionCatalogEntry[] = (catalog?.farmAnimals || []).flatMap(animal => {
    const output = animal.produce?.[0]?.item;
    return output ? [{ id: animal.id, kind: "animal", family: "animal", name: animal.name, output, seasons: [], firstOutputDays: animal.daysToMature + animal.daysToProduce, repeatDays: animal.daysToProduce, startupCost: animal.purchasePrice, yield: { min: 1, expected: 1, max: 1 }, space: 1, verified: output.price > 0, animal }] : [];
  });
  const pondEntries: ProductionCatalogEntry[] = (catalog?.fishPonds || []).map(pond => ({ id: pond.id, kind: "fish-pond", family: "pond", name: pond.fish.name, output: pond.fish, seasons: [], firstOutputDays: 1, repeatDays: 1, startupCost: 0, yield: { min: 0, expected: 1, max: 1 }, space: 25, verified: pond.fish.price > 0, pond }));
  return [...farming, ...tapped, ...mushroomLog, ...machineEntries, ...animalEntries, ...pondEntries];
}

function normalizeMachineResult(conversion: MachineConversion, plan: ReturnType<typeof calculateMachinePlan>): ProductionPlan {
  const scenarios = Object.fromEntries(Object.entries(plan.scenarios).map(([key, scenario]) => [key, {
    ...scenario,
    profitPerSpace: plan.machineCount > 0 ? Math.floor(scenario.netProfit / plan.machineCount) : 0,
  }])) as ProductionPlan["scenarios"];
  return {
    producerId: conversion.id,
    mode: "units",
    requestedAmount: plan.machineCount,
    location: "machine",
    replant: false,
    forcePlantToday: false,
    plantingDate: null,
    plantingDelayDays: 0,
    startDate: plan.startDate,
    endDate: plan.endDate,
    durationDays: plan.durationDays,
    quantity: plan.machineCount,
    requiredSpace: plan.machineCount,
    investment: plan.setupCost,
    recurringCosts: plan.directSaleValue + plan.additionalInputCost,
    totalCosts: plan.setupCost + plan.directSaleValue + plan.additionalInputCost,
    setupCosts: 0,
    unusedBudget: 0,
    harvestDates: [],
    breakEvenDate: plan.breakEvenDate,
    scenarios,
    warnings: plan.warnings,
  };
}

type RecurringPlan = ReturnType<typeof calculateAnimalPlan> | ReturnType<typeof calculateFishPondPlan>;
function normalizeRecurringResult(id: string, quantity: number, space: number, plan: RecurringPlan): ProductionPlan {
  const scenarios = Object.fromEntries(Object.entries(plan.scenarios).map(([key, raw]) => {
    const scenario = raw as { units: number; grossRevenue: number; netProfit: number; profitPerDay: number };
    return [key, { ...scenario, profitPerSpace: space > 0 ? Math.floor(scenario.netProfit / space) : 0 }];
  })) as ProductionPlan["scenarios"];
  return {
    producerId: id, mode: "units", requestedAmount: quantity, location: "farm", replant: false, forcePlantToday: false,
    plantingDate: null, plantingDelayDays: 0, startDate: plan.startDate, endDate: plan.endDate, durationDays: plan.durationDays,
    quantity, requiredSpace: space, investment: plan.purchaseCost || 0, recurringCosts: plan.feedCost || 0,
    totalCosts: plan.totalCosts || 0, setupCosts: 0, unusedBudget: 0, harvestDates: [], breakEvenDate: plan.breakEvenDate,
    scenarios, warnings: plan.warnings || [],
  };
}

function acceleratedGrowthDays(entry: ProductionCatalogEntry, speedBonus: number) {
  const phases = entry.growthPhases?.length ? [...entry.growthPhases] : [entry.firstOutputDays];
  let reductions = Math.ceil(phases.reduce((sum, days) => sum + days, 0) * speedBonus);
  for (let pass = 0; reductions > 0 && pass < 3; pass += 1) {
    for (let index = 0; index < phases.length && reductions > 0; index += 1) {
      if ((index > 0 || phases[index] > 1) && phases[index] > 0) {
        phases[index] -= 1;
        reductions -= 1;
      }
    }
  }
  return phases.reduce((sum, days) => sum + days, 0);
}

function qualityPriceMultipliers(farmingLevel: number, qualityBoost: number) {
  const chance = 0.2 * (farmingLevel / 10) + 0.2 * qualityBoost * ((farmingLevel + 2) / 12) + 0.01;
  const silverRoll = Math.min(0.75, chance * 2);
  const iridium = qualityBoost >= 3 ? chance / 2 : 0;
  const gold = (1 - iridium) * chance;
  const silver = qualityBoost >= 3 ? 1 - iridium - gold : (1 - gold) * silverRoll;
  const normal = Math.max(0, 1 - iridium - gold - silver);
  return { min: qualityBoost >= 3 ? 1.25 : 1, expected: normal + silver * 1.25 + gold * 1.5 + iridium * 2, max: qualityBoost >= 3 ? 2 : 1.5 };
}

function tillerApplies(entry: ProductionCatalogEntry) {
  return [-80, -79, -75].includes(entry.output.category ?? 0);
}

function producerWithModifiers(entry: ProductionCatalogEntry, farmingLevel: number, tiller: boolean, agriculturist: boolean, fertilizer?: ProductionFertilizer): ProductionProducer {
  if (entry.family === "forestry") return {
    ...entry,
    outputValue: entry.outputValueByScenario?.expected ?? entry.output.price,
  };
  const rules = entry.yieldRules;
  const professionMultiplier = tiller && tillerApplies(entry) ? 1.1 : 1;
  const quality = entry.kind === "crop" ? qualityPriceMultipliers(farmingLevel, fertilizer?.qualityBoost || 0) : { min: 1, expected: 1, max: 1 };
  const priced = (qualityMultiplier: number) => Math.trunc(Math.trunc(entry.output.price * qualityMultiplier) * professionMultiplier);
  const firstOutputDays = entry.kind === "crop"
    ? acceleratedGrowthDays(entry, (agriculturist ? 0.1 : 0) + (fertilizer?.speedBoost || 0))
    : entry.firstOutputDays;
  const common = {
    ...entry,
    firstOutputDays,
    outputValue: priced(quality.expected),
    outputValueByScenario: { conservative: priced(quality.min), expected: priced(quality.expected), optimistic: priced(quality.max) },
  };
  if (!rules) return common;
  const levelIncrease = Math.max(0, farmingLevel * rules.maxIncreasePerFarmingLevel);
  const extraYield = rules.extraHarvestChance > 0 && rules.extraHarvestChance < 1
    ? rules.extraHarvestChance / (1 - rules.extraHarvestChance)
    : 0;
  return {
    ...common,
    yield: {
      min: entry.yield.min,
      expected: Math.round(((entry.yield.min + entry.yield.max) / 2 + levelIncrease / 2 + extraYield) * 100) / 100,
      max: entry.yield.max + Math.floor(levelIncrease) + (rules.extraHarvestChance > 0 ? 1 : 0),
    },
  };
}

export function ProductionCalculator({
  catalog,
  currentDate,
  currentMoney,
  currentFarmingLevel,
  currentProfessionIds,
  currentInventory,
  currentMachines,
  currentHouseUpgradeLevel,
  currentAnimals,
  currentBuildings,
  currentPonds,
  profileId,
  resolveGameName,
  renderItemArtwork,
}: {
  catalog?: ProductionCatalog;
  currentDate: StardewDate;
  currentMoney: number;
  currentFarmingLevel: number;
  currentProfessionIds: number[];
  currentInventory?: Array<{ id: string; count: number; quality?: number }>;
  currentMachines?: Array<{ id?: string; name: string; count: number }>;
  currentHouseUpgradeLevel?: number;
  currentAnimals?: Array<{ type: string; friendship: number; happiness: number }>;
  currentBuildings?: Array<{ name: string; cost: number; owned?: number }>;
  currentPonds?: Array<{ fishId: string; population: number; capacity: number }>;
  profileId: string;
  resolveGameName: (name: string, id?: string) => string;
  renderItemArtwork?: (id: string, name: string, spriteIndex?: number) => ReactNode;
}) {
  const { t, number, date, locale } = useI18n();
  const savedHasTiller = currentProfessionIds.includes(1);
  const savedHasAgriculturist = currentProfessionIds.includes(5);
  const savedHasArtisan = currentProfessionIds.includes(4);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<CalculatorMode>("budget");
  const [amount, setAmount] = useState(Math.max(0, currentMoney));
  const [horizonMode, setHorizonMode] = useState<HorizonMode>("days");
  const [durationDays, setDurationDays] = useState(28);
  const initialEnd = addStardewDays(currentDate, 28);
  const [endYear, setEndYear] = useState(initialEnd.year);
  const [endSeason, setEndSeason] = useState(initialEnd.season);
  const [endDay, setEndDay] = useState(initialEnd.day);
  const [location, setLocation] = useState<GrowingLocation>("outdoors");
  const [replant, setReplant] = useState(true);
  const [forcePlantToday, setForcePlantToday] = useState(false);
  const [farmingLevel, setFarmingLevel] = useState(Math.min(10, Math.max(0, currentFarmingLevel)));
  const [tiller, setTiller] = useState(savedHasTiller);
  const [agriculturist, setAgriculturist] = useState(savedHasAgriculturist);
  const [fertilizerId, setFertilizerId] = useState("");
  const [forestryExisting, setForestryExisting] = useState(true);
  const [forestryHeavy, setForestryHeavy] = useState(false);
  const [forestryFertilized, setForestryFertilized] = useState(false);
  const [mushroomSpecies, setMushroomSpecies] = useState<MushroomSpecies>({ oak: 2, maple: 2, pine: 2, mystic: 0, other: 0 });
  const [mushroomMossy, setMushroomMossy] = useState(0);
  const [machineExisting, setMachineExisting] = useState(true);
  const [machineInitialInput, setMachineInitialInput] = useState(0);
  const [machineRecurringInput, setMachineRecurringInput] = useState(0);
  const [machineInputQuality, setMachineInputQuality] = useState(0);
  const [machineCollectionEveryDays, setMachineCollectionEveryDays] = useState(0);
  const [artisan, setArtisan] = useState(savedHasArtisan);
  const [animalExistingCount, setAnimalExistingCount] = useState(0);
  const [animalFed, setAnimalFed] = useState(true);
  const [animalFriendship, setAnimalFriendship] = useState(0);
  const [animalHappiness, setAnimalHappiness] = useState(255);
  const [animalProcessorId, setAnimalProcessorId] = useState("");
  const [animalProcessorCount, setAnimalProcessorCount] = useState(1);
  const [pondExisting, setPondExisting] = useState(true);
  const [pondPopulation, setPondPopulation] = useState(1);
  const [pondUnlockedPopulation, setPondUnlockedPopulation] = useState(10);
  const [pondProcessRoe, setPondProcessRoe] = useState(false);
  const [bookmarks, setBookmarks] = useState<SavedCalculation[]>([]);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [comparisonView, setComparisonView] = useState<ComparisonView>("table");
  const [loadedStorageKey, setLoadedStorageKey] = useState("");
  const [bookmarkSaved, setBookmarkSaved] = useState(false);
  const [bookmarkName, setBookmarkName] = useState("");
  const producerMenu = useRef<HTMLDetailsElement>(null);
  const producerSearch = useRef<HTMLInputElement>(null);
  const bookmarkNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `maglucen.production-calculator.${profileId || "default"}`;
  const forestrySettings = useMemo<ForestrySettings>(() => ({ existing: forestryExisting, heavy: forestryHeavy, fertilized: forestryFertilized, species: mushroomSpecies, mossy: mushroomMossy }), [forestryExisting, forestryFertilized, forestryHeavy, mushroomMossy, mushroomSpecies]);
  const entries = useMemo(() => buildCalculatorEntries(catalog, forestrySettings), [catalog, forestrySettings]);
  const fertilizers = useMemo(() => catalog?.fertilizers || [], [catalog?.fertilizers]);
  const namedEntries = useMemo(() => entries.map((entry) => ({
    entry,
    displayName: entry.kind === "crop" || entry.family === "forestry"
      ? resolveGameName(entry.output.name, entry.output.id)
      : entry.family === "machine" && entry.machineConversion
        ? `${entry.machineConversion.input.source ? `${resolveGameName(entry.machineConversion.input.source.name, entry.machineConversion.input.source.id)} · ` : ""}${resolveGameName(entry.machineConversion.input.name, entry.machineConversion.input.id)} → ${resolveGameName(entry.output.name, entry.output.id)}`
      : resolveGameName(entry.name, entry.id),
    outputName: resolveGameName(entry.output.name, entry.output.id),
    detailName: entry.family === "machine" && entry.machineConversion
      ? resolveGameName(entry.machineConversion.machine.name, entry.machineConversion.machine.id)
      : "",
  })).sort((left, right) => left.displayName.localeCompare(right.displayName, locale)), [entries, locale, resolveGameName]);
  const normalizedQuery = normalizeSearchValue(query.trim(), locale);
  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  const filtered = namedEntries.filter(({ displayName, outputName, detailName }) => {
    const searchable = normalizeSearchValue(`${displayName} ${outputName} ${detailName}`, locale);
    return queryTerms.every(term => searchable.includes(term));
  });
  const selected = entries.find((entry) => entry.id === selectedId) || entries[0];
  const selectedIsForestry = selected?.family === "forestry";
  const selectedIsMachine = selected?.family === "machine";
  const selectedIsAnimal = selected?.family === "animal";
  const selectedIsPond = selected?.family === "pond";
  const animalInputIds = new Set([...(selected?.animal?.produce || []), ...(selected?.animal?.deluxeProduce || [])].map(item => item.item.id));
  const animalProcessors = (catalog?.artisanMachines || []).filter(conversion => animalInputIds.has(conversion.input.id));
  const animalProcessorConversion = animalProcessors.find(conversion => conversion.id === animalProcessorId);
  const selectedNamed = namedEntries.find(({ entry }) => entry.id === selected?.id);
  const calculation = useMemo<Omit<SavedCalculation, "id">>(() => ({
    selectedId: selected?.id || "",
    mode,
    amount,
    horizonMode,
    durationDays,
    endYear,
    endSeason,
    endDay,
    location,
    replant,
    forcePlantToday,
    farmingLevel,
    tiller,
    agriculturist,
    fertilizerId,
    forestryExisting,
    forestryHeavy,
    forestryFertilized,
    mushroomSpecies,
    mushroomMossy,
    machineExisting,
    machineInitialInput,
    machineRecurringInput,
    machineInputQuality,
    machineCollectionEveryDays,
    artisan,
    animalExistingCount, animalFed, animalFriendship, animalHappiness, animalProcessorId, animalProcessorCount,
    pondExisting, pondPopulation, pondUnlockedPopulation, pondProcessRoe,
  }), [agriculturist, amount, animalExistingCount, animalFed, animalFriendship, animalHappiness, animalProcessorCount, animalProcessorId, artisan, durationDays, endDay, endSeason, endYear, farmingLevel, fertilizerId, forcePlantToday, forestryExisting, forestryFertilized, forestryHeavy, horizonMode, location, machineCollectionEveryDays, machineExisting, machineInitialInput, machineInputQuality, machineRecurringInput, mode, mushroomMossy, mushroomSpecies, pondExisting, pondPopulation, pondProcessRoe, pondUnlockedPopulation, replant, selected?.id, tiller]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (producerMenu.current && !producerMenu.current.contains(event.target as Node))
        producerMenu.current.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(storageKey) || "null") as {
          current?: Partial<SavedCalculation>;
          bookmarks?: SavedCalculation[];
          comparisonIds?: string[];
          comparisonView?: ComparisonView;
        } | null;
        const saved = stored?.current;
        if (saved) {
          if (typeof saved.selectedId === "string") setSelectedId(saved.selectedId);
          if (["budget", "tiles", "target", "units"].includes(String(saved.mode))) setMode(saved.mode as CalculatorMode);
          if (Number.isFinite(saved.amount)) setAmount(Math.max(0, Number(saved.amount)));
          if (["days", "date"].includes(String(saved.horizonMode))) setHorizonMode(saved.horizonMode as HorizonMode);
          if (Number.isFinite(saved.durationDays)) setDurationDays(Math.max(0, Number(saved.durationDays)));
          if (Number.isFinite(saved.endYear)) setEndYear(Math.max(1, Number(saved.endYear)));
          if (STARDEW_SEASONS.includes(saved.endSeason as StardewDate["season"])) setEndSeason(saved.endSeason as StardewDate["season"]);
          if (Number.isFinite(saved.endDay)) setEndDay(Math.min(28, Math.max(1, Number(saved.endDay))));
          if (["outdoors", "greenhouse", "island"].includes(String(saved.location))) setLocation(saved.location as GrowingLocation);
          if (typeof saved.replant === "boolean") setReplant(saved.replant);
          if (typeof saved.forcePlantToday === "boolean") setForcePlantToday(saved.forcePlantToday);
          if (Number.isFinite(saved.farmingLevel)) setFarmingLevel(Math.min(10, Math.max(0, Number(saved.farmingLevel))));
          setTiller(typeof saved.tiller === "boolean" ? saved.tiller : savedHasTiller);
          setAgriculturist(typeof saved.agriculturist === "boolean" ? saved.agriculturist : savedHasAgriculturist);
          if (typeof saved.fertilizerId === "string") setFertilizerId(saved.fertilizerId);
          if (typeof saved.forestryExisting === "boolean") setForestryExisting(saved.forestryExisting);
          if (typeof saved.forestryHeavy === "boolean") setForestryHeavy(saved.forestryHeavy);
          if (typeof saved.forestryFertilized === "boolean") setForestryFertilized(saved.forestryFertilized);
          if (saved.mushroomSpecies) setMushroomSpecies(saved.mushroomSpecies);
          if (Number.isFinite(saved.mushroomMossy)) setMushroomMossy(Math.max(0, Number(saved.mushroomMossy)));
          if (typeof saved.machineExisting === "boolean") setMachineExisting(saved.machineExisting);
          if (Number.isFinite(saved.machineInitialInput)) setMachineInitialInput(Math.max(0, Number(saved.machineInitialInput)));
          if (Number.isFinite(saved.machineRecurringInput)) setMachineRecurringInput(Math.max(0, Number(saved.machineRecurringInput)));
          if ([0, 1, 2, 4].includes(Number(saved.machineInputQuality))) setMachineInputQuality(Number(saved.machineInputQuality));
          if ([0, 1, 2, 7].includes(Number(saved.machineCollectionEveryDays))) setMachineCollectionEveryDays(Number(saved.machineCollectionEveryDays));
          setArtisan(typeof saved.artisan === "boolean" ? saved.artisan : savedHasArtisan);
          if (Number.isFinite(saved.animalExistingCount)) setAnimalExistingCount(Math.max(0, Number(saved.animalExistingCount)));
          if (typeof saved.animalFed === "boolean") setAnimalFed(saved.animalFed);
          if (Number.isFinite(saved.animalFriendship)) setAnimalFriendship(Math.max(0, Number(saved.animalFriendship)));
          if (Number.isFinite(saved.animalHappiness)) setAnimalHappiness(Math.max(0, Number(saved.animalHappiness)));
          if (typeof saved.animalProcessorId === "string") setAnimalProcessorId(saved.animalProcessorId);
          if (Number.isFinite(saved.animalProcessorCount)) setAnimalProcessorCount(Math.max(1, Number(saved.animalProcessorCount)));
          if (typeof saved.pondExisting === "boolean") setPondExisting(saved.pondExisting);
          if (Number.isFinite(saved.pondPopulation)) setPondPopulation(Math.max(1, Number(saved.pondPopulation)));
          if (Number.isFinite(saved.pondUnlockedPopulation)) setPondUnlockedPopulation(Math.max(1, Number(saved.pondUnlockedPopulation)));
          if (typeof saved.pondProcessRoe === "boolean") setPondProcessRoe(saved.pondProcessRoe);
        }
        setBookmarks(Array.isArray(stored?.bookmarks) ? stored.bookmarks.slice(0, 12) : []);
        setComparisonIds(Array.isArray(stored?.comparisonIds) ? stored.comparisonIds.slice(0, 3) : []);
        if (["table", "chart"].includes(String(stored?.comparisonView))) setComparisonView(stored?.comparisonView as ComparisonView);
      } catch {
        setBookmarks([]);
      }
      setLoadedStorageKey(storageKey);
    }, 0);
    return () => window.clearTimeout(restore);
  }, [savedHasAgriculturist, savedHasArtisan, savedHasTiller, storageKey]);

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ current: calculation, bookmarks, comparisonIds, comparisonView }));
  }, [bookmarks, calculation, comparisonIds, comparisonView, loadedStorageKey, storageKey]);

  useEffect(() => () => {
    if (bookmarkNoticeTimer.current) clearTimeout(bookmarkNoticeTimer.current);
  }, []);

  const applyCalculation = (saved: SavedCalculation) => {
    setSelectedId(saved.selectedId);
    setMode(saved.mode);
    setAmount(saved.amount);
    setHorizonMode(saved.horizonMode);
    setDurationDays(saved.durationDays);
    setEndYear(saved.endYear);
    setEndSeason(saved.endSeason);
    setEndDay(saved.endDay);
    setLocation(saved.location);
    setReplant(saved.replant);
    setForcePlantToday(saved.forcePlantToday ?? false);
    setFarmingLevel(saved.farmingLevel);
    setTiller(saved.tiller ?? savedHasTiller);
    setAgriculturist(saved.agriculturist ?? savedHasAgriculturist);
    setFertilizerId(saved.fertilizerId || "");
    setForestryExisting(saved.forestryExisting ?? true);
    setForestryHeavy(saved.forestryHeavy ?? false);
    setForestryFertilized(saved.forestryFertilized ?? false);
    setMushroomSpecies(saved.mushroomSpecies || { oak: 2, maple: 2, pine: 2, mystic: 0, other: 0 });
    setMushroomMossy(saved.mushroomMossy || 0);
    setMachineExisting(saved.machineExisting ?? true);
    setMachineInitialInput(saved.machineInitialInput || 0);
    setMachineRecurringInput(saved.machineRecurringInput || 0);
    setMachineInputQuality(saved.machineInputQuality || 0);
    setMachineCollectionEveryDays(saved.machineCollectionEveryDays || 0);
    setArtisan(saved.artisan ?? savedHasArtisan);
    setAnimalExistingCount(saved.animalExistingCount || 0);
    setAnimalFed(saved.animalFed ?? true);
    setAnimalFriendship(saved.animalFriendship || 0);
    setAnimalHappiness(saved.animalHappiness ?? 255);
    setAnimalProcessorId(saved.animalProcessorId || "");
    setAnimalProcessorCount(saved.animalProcessorCount || 1);
    setPondExisting(saved.pondExisting ?? true);
    setPondPopulation(saved.pondPopulation || 1);
    setPondUnlockedPopulation(saved.pondUnlockedPopulation || 10);
    setPondProcessRoe(saved.pondProcessRoe ?? false);
  };
  const saveCalculation = () => {
    const bookmark = { ...calculation, name: bookmarkName.trim() || selectedNamed?.displayName, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    setBookmarks((current) => [bookmark, ...current].slice(0, 12));
    setBookmarkName("");
    setBookmarkSaved(true);
    if (bookmarkNoticeTimer.current) clearTimeout(bookmarkNoticeTimer.current);
    bookmarkNoticeTimer.current = setTimeout(() => setBookmarkSaved(false), 1600);
  };
  const resetCalculation = () => {
    const defaultEnd = addStardewDays(currentDate, 28);
    setQuery("");
    setSelectedId(entries[0]?.id || "");
    setMode("budget");
    setAmount(Math.max(0, currentMoney));
    setHorizonMode("days");
    setDurationDays(28);
    setEndYear(defaultEnd.year);
    setEndSeason(defaultEnd.season);
    setEndDay(defaultEnd.day);
    setLocation("outdoors");
    setReplant(true);
    setForcePlantToday(false);
    setFarmingLevel(Math.min(10, Math.max(0, currentFarmingLevel)));
    setTiller(savedHasTiller);
    setAgriculturist(savedHasAgriculturist);
    setFertilizerId("");
    setForestryExisting(true);
    setForestryHeavy(false);
    setForestryFertilized(false);
    setMushroomSpecies({ oak: 2, maple: 2, pine: 2, mystic: 0, other: 0 });
    setMushroomMossy(0);
    setMachineExisting(true);
    setMachineInitialInput(0);
    setMachineRecurringInput(0);
    setMachineInputQuality(0);
    setMachineCollectionEveryDays(0);
    setArtisan(savedHasArtisan);
    setAnimalExistingCount(0);
    setAnimalFed(true);
    setAnimalFriendship(0);
    setAnimalHappiness(255);
    setAnimalProcessorId("");
    setAnimalProcessorCount(1);
    setPondExisting(true);
    setPondPopulation(1);
    setPondUnlockedPopulation(10);
    setPondProcessRoe(false);
  };
  const defaultEnd = addStardewDays(currentDate, 28);
  const isDefaultCalculation = !query
    && selected?.id === entries[0]?.id
    && mode === "budget" && amount === Math.max(0, currentMoney)
    && horizonMode === "days" && durationDays === 28
    && endYear === defaultEnd.year && endSeason === defaultEnd.season && endDay === defaultEnd.day
    && location === "outdoors" && replant && !forcePlantToday
    && farmingLevel === Math.min(10, Math.max(0, currentFarmingLevel))
    && tiller === savedHasTiller && agriculturist === savedHasAgriculturist && !fertilizerId
    && forestryExisting && !forestryHeavy && !forestryFertilized && mushroomMossy === 0
    && JSON.stringify(mushroomSpecies) === JSON.stringify({ oak: 2, maple: 2, pine: 2, mystic: 0, other: 0 })
    && machineExisting && machineInitialInput === 0 && machineRecurringInput === 0 && machineInputQuality === 0
    && machineCollectionEveryDays === 0 && artisan === savedHasArtisan;
  const toggleComparison = (id: string) => setComparisonIds((current) => current.includes(id)
    ? current.filter((candidate) => candidate !== id)
    : current.length < 3 ? [...current, id] : current);
  const producer = useMemo(() => {
    if (!selected || ["machine", "animal", "pond"].includes(selected.family || "")) return null;
    return producerWithModifiers(selected, farmingLevel, tiller, agriculturist, fertilizers.find(({ id }) => id === fertilizerId));
  }, [agriculturist, farmingLevel, fertilizerId, fertilizers, selected, tiller]);
  const selectedFertilizer = fertilizers.find(({ id }) => id === fertilizerId);
  const productionResult = useMemo(() => producer ? calculateProductionPlan({
    producer,
    mode,
    amount,
    startDate: currentDate,
    ...(horizonMode === "days"
      ? { durationDays }
      : { endDate: { year: endYear, season: endSeason, day: endDay } }),
    location,
    replant,
    forcePlantToday,
    setupCostPerProducer: selected?.kind === "crop" ? selectedFertilizer?.startupCost || 0 : 0,
  }) : null, [amount, currentDate, durationDays, endDay, endSeason, endYear, forcePlantToday, horizonMode, location, mode, producer, replant, selected?.kind, selectedFertilizer?.startupCost]);
  const machinePlan = useMemo(() => selected?.machineConversion ? calculateMachinePlan({
    conversion: selected.machineConversion,
    machineCount: amount,
    initialInput: machineInitialInput,
    recurringInputPerDay: machineRecurringInput,
    inputQuality: machineInputQuality,
    artisan,
    existing: machineExisting,
    collectionEveryDays: machineCollectionEveryDays,
    hasCellar: (currentHouseUpgradeLevel || 0) >= 3,
    startDate: currentDate,
    ...(horizonMode === "days"
      ? { durationDays }
      : { endDate: { year: endYear, season: endSeason, day: endDay } }),
  }) : null, [amount, artisan, currentDate, currentHouseUpgradeLevel, durationDays, endDay, endSeason, endYear, horizonMode, machineCollectionEveryDays, machineExisting, machineInitialInput, machineInputQuality, machineRecurringInput, selected]);
  const animalPlan = selected?.animal ? calculateAnimalPlan({
    animal: selected.animal, count: amount, existingCount: animalExistingCount, fedDaily: animalFed,
    friendship: animalFriendship, happiness: animalHappiness, feedUnitCost: catalog?.feedUnitCost || 0, buyFeed: true,
    rancher: currentProfessionIds.includes(0), startDate: currentDate,
    processor: animalProcessorConversion ? {
      outputPrice: machineOutputUnitPrice(animalProcessorConversion, 0, false),
      artisanEligible: animalProcessorConversion.artisanEligible,
      cycleDays: Math.max(1, Math.ceil(animalProcessorConversion.cycleMinutes / 1600)),
    } : null,
    processorCount: animalProcessorCount, artisan,
    buildingCapacity: (currentBuildings?.find(building => building.name === selected.animal?.requiredBuilding)?.owned || 0) * selected.animal.buildingCapacity,
    ...(horizonMode === "days" ? { durationDays } : { endDate: { year: endYear, season: endSeason, day: endDay } }),
  }) : null;
  const pondCost = currentBuildings?.find(building => building.name === "Fish Pond")?.cost || 0;
  const pondPlan = selected?.pond ? calculateFishPondPlan({
    pond: selected.pond, pondCount: amount, startPopulation: pondPopulation, unlockedPopulation: pondUnlockedPopulation,
    existing: pondExisting, pondCost, processRoe: pondProcessRoe, artisan, startDate: currentDate,
    ...(horizonMode === "days" ? { durationDays } : { endDate: { year: endYear, season: endSeason, day: endDay } }),
  }) : null;
  const result = machinePlan && selected?.machineConversion ? normalizeMachineResult(selected.machineConversion, machinePlan)
    : animalPlan && selected?.animal ? normalizeRecurringResult(selected.id, animalPlan.count, animalPlan.count, animalPlan)
      : pondPlan && selected?.pond ? normalizeRecurringResult(selected.id, pondPlan.pondCount, pondPlan.pondCount * 25, pondPlan)
        : productionResult;
  const visibleWarnings = result?.warnings.filter(warning => !(selectedIsForestry && forestryExisting && warning === "missing-startup-cost")) || [];
  const mushroomNearby = Object.values(mushroomSpecies).reduce((sum, value) => sum + value, 0);
  const setMushroomSpeciesCount = (key: keyof MushroomSpecies, value: number) => setMushroomSpecies(current => ({ ...current, [key]: Math.max(0, Math.floor(value || 0)) }));
  const comparisons = comparisonIds.flatMap((id) => {
    const saved = bookmarks.find((bookmark) => bookmark.id === id);
    const savedEntries = buildCalculatorEntries(catalog, {
      existing: saved?.forestryExisting ?? true,
      heavy: saved?.forestryHeavy ?? false,
      fertilized: saved?.forestryFertilized ?? false,
      species: saved?.mushroomSpecies || { oak: 2, maple: 2, pine: 2, mystic: 0, other: 0 },
      mossy: saved?.mushroomMossy || 0,
    });
    const entry = savedEntries.find((candidate) => candidate.id === saved?.selectedId);
    if (!saved || !entry) return [];
    const savedFertilizer = fertilizers.find(({ id: candidate }) => candidate === saved.fertilizerId);
    const savedResult = entry.machineConversion
      ? normalizeMachineResult(entry.machineConversion, calculateMachinePlan({
          conversion: entry.machineConversion,
          machineCount: saved.amount,
          initialInput: saved.machineInitialInput || 0,
          recurringInputPerDay: saved.machineRecurringInput || 0,
          inputQuality: saved.machineInputQuality || 0,
          artisan: saved.artisan ?? savedHasArtisan,
          existing: saved.machineExisting ?? true,
          collectionEveryDays: saved.machineCollectionEveryDays || 0,
          hasCellar: (currentHouseUpgradeLevel || 0) >= 3,
          startDate: currentDate,
          ...(saved.horizonMode === "days"
            ? { durationDays: saved.durationDays }
            : { endDate: { year: saved.endYear, season: saved.endSeason, day: saved.endDay } }),
        }))
      : entry.animal
        ? normalizeRecurringResult(entry.id, saved.amount, saved.amount, calculateAnimalPlan({
            animal: entry.animal, count: saved.amount, existingCount: saved.animalExistingCount || 0, fedDaily: saved.animalFed ?? true,
            friendship: saved.animalFriendship || 0, happiness: saved.animalHappiness ?? 255, feedUnitCost: catalog?.feedUnitCost || 0, buyFeed: true,
            rancher: currentProfessionIds.includes(0), startDate: currentDate,
            processor: (() => {
              const conversion = (catalog?.artisanMachines || []).find(candidate => candidate.id === saved.animalProcessorId);
              return conversion ? { outputPrice: machineOutputUnitPrice(conversion, 0, false), artisanEligible: conversion.artisanEligible, cycleDays: Math.max(1, Math.ceil(conversion.cycleMinutes / 1600)) } : null;
            })(),
            processorCount: saved.animalProcessorCount || 1, artisan: saved.artisan ?? savedHasArtisan,
            ...(saved.horizonMode === "days" ? { durationDays: saved.durationDays } : { endDate: { year: saved.endYear, season: saved.endSeason, day: saved.endDay } }),
          }))
        : entry.pond
          ? normalizeRecurringResult(entry.id, saved.amount, saved.amount * 25, calculateFishPondPlan({
              pond: entry.pond, pondCount: saved.amount, startPopulation: saved.pondPopulation || 1, unlockedPopulation: saved.pondUnlockedPopulation || entry.pond.maxPopulation,
              existing: saved.pondExisting ?? true, pondCost, processRoe: saved.pondProcessRoe ?? false, artisan: saved.artisan ?? savedHasArtisan, startDate: currentDate,
              ...(saved.horizonMode === "days" ? { durationDays: saved.durationDays } : { endDate: { year: saved.endYear, season: saved.endSeason, day: saved.endDay } }),
            }))
          : calculateProductionPlan({
          producer: producerWithModifiers(entry, saved.farmingLevel, saved.tiller ?? savedHasTiller, saved.agriculturist ?? savedHasAgriculturist, savedFertilizer),
          mode: saved.mode,
          amount: saved.amount,
          startDate: currentDate,
          ...(saved.horizonMode === "days"
            ? { durationDays: saved.durationDays }
            : { endDate: { year: saved.endYear, season: saved.endSeason, day: saved.endDay } }),
          location: saved.location,
          replant: saved.replant,
          forcePlantToday: saved.forcePlantToday ?? false,
          setupCostPerProducer: entry.kind === "crop" ? savedFertilizer?.startupCost || 0 : 0,
            });
    const named = namedEntries.find(({ entry: candidate }) => candidate.id === entry.id);
    return [{ saved, entry, result: savedResult, name: named?.displayName || entry.name }];
  });
  const comparisonRows = result && selected && comparisons.length > 0
    ? [{ saved: { ...calculation, id: "current" }, entry: selected, result, name: selectedNamed?.displayName || selected.name, current: true }, ...comparisons.map((comparison) => ({ ...comparison, current: false }))]
    : [];
  const comparisonScale = Math.max(1, ...comparisonRows.map(({ result: compared }) => Math.abs(compared.scenarios.expected.netProfit)));
  const portfolio = (() => {
    const plans = comparisonRows.map(({ saved, entry, result: compared }) => {
      const inventory: Record<string, number> = {};
      const machines: Record<string, number> = {};
      if (entry.machineConversion) {
        inventory[entry.machineConversion.input.id] = Math.max(0, (saved.machineInitialInput || 0) + (saved.machineRecurringInput || 0) * compared.durationDays);
        if (saved.machineExisting ?? true) machines[entry.machineConversion.machine.id] = saved.amount;
        else for (const material of entry.machineConversion.machine.materials || []) inventory[material.item.id] = (inventory[material.item.id] || 0) + material.quantity * saved.amount;
      }
      if (entry.animal && saved.animalProcessorId) {
        const processor = (catalog?.artisanMachines || []).find(conversion => conversion.id === saved.animalProcessorId);
        if (processor) machines[processor.machine.id] = saved.animalProcessorCount || 1;
      }
      if (entry.pond && saved.pondProcessRoe) {
        const jar = (catalog?.artisanMachines || []).find(conversion => conversion.machine.name === "Preserves Jar");
        if (jar) machines[jar.machine.id] = saved.amount;
      }
      return {
        resources: { money: compared.totalCosts, space: compared.requiredSpace, inventory, machines },
        metrics: { profit: compared.scenarios.expected.netProfit, revenue: compared.scenarios.expected.grossRevenue, items: compared.scenarios.expected.units },
      };
    });
    const availableInventory = Object.fromEntries((currentInventory || []).map(item => [item.id, (currentInventory || []).filter(candidate => candidate.id === item.id).reduce((sum, candidate) => sum + candidate.count, 0)]));
    const availableMachines = Object.fromEntries((currentMachines || []).map(machine => [machine.id || machine.name, machine.count]));
    return evaluateProductionPortfolio(plans, { money: currentMoney, inventory: availableInventory, machines: availableMachines });
  })();
  const gold = (value: number) => t("planner.gold", { amount: number(value) });
  const fertilizerName = (fertilizer?: ProductionFertilizer) => fertilizer
    ? resolveGameName(fertilizer.name, fertilizer.id)
    : t("planner.fertilizer.none");
  const fertilizerEffect = (fertilizer?: ProductionFertilizer, level = farmingLevel) => {
    if (!fertilizer) return "";
    if (fertilizer.kind === "speed") return t("planner.effect.growth", { percent: number(Math.round(fertilizer.speedBoost * 100)) });
    const multiplier = qualityPriceMultipliers(level, fertilizer.qualityBoost).expected;
    return t("planner.effect.expectedValue", { percent: number(Math.round((multiplier - 1) * 100)) });
  };
  const unqualifiedId = (id?: string) => (id || "").replace(/^\([^)]*\)/, "");
  const savedInputCount = (conversion: MachineConversion) => conversion.input.source ? 0 : (currentInventory || [])
    .filter(item => item.id === conversion.input.id && (item.quality ?? 0) === 0)
    .reduce((sum, item) => sum + Math.max(0, item.count), 0);
  const savedMachineCount = (conversion: MachineConversion) => (currentMachines || [])
    .filter(item => unqualifiedId(item.id) === unqualifiedId(conversion.machine.id))
    .reduce((sum, item) => sum + Math.max(0, item.count), 0);

  return (
    <section className="production-calculator" aria-labelledby="production-calculator-title">
      <div className="crop-section-title">
        <div>
          <p className="eyebrow">{t("planner.quick.eyebrow")}</p>
          <h2 id="production-calculator-title">{t("planner.quick.title")}</h2>
          <p>{t("planner.quick.description")}</p>
        </div>
      </div>
      {!entries.length ? (
        <div className="planner-catalog-empty" role="status">
          <strong>{t("planner.catalogRequired")}</strong>
          <span>{t("planner.catalogRequiredDetail")}</span>
        </div>
      ) : (
        <>
          <div className="planner-quick-grid">
            <div className="planner-field">
              <label htmlFor="planner-producer-search">{t("planner.producer")}</label>
              <details className="planner-producer-menu" ref={producerMenu} onToggle={(event) => {
                if (event.currentTarget.open) window.requestAnimationFrame(() => producerSearch.current?.focus());
                else setQuery("");
              }}>
                <summary aria-label={t("planner.chooseProducer")}>
                  {selected && renderItemArtwork?.(selected.output.id, selectedNamed?.outputName || selected.output.name, selected.output.spriteIndex)}
                  <span><strong>{selectedNamed?.displayName}</strong>{selected?.kind === "fruit-tree" && <small>{selectedNamed?.outputName}</small>}{selected?.family === "forestry" && <small>{t(producerGroupKey(selected.kind))}</small>}{selected?.family === "machine" && <small>{selectedNamed?.detailName}</small>}</span>
                </summary>
                <div className="planner-producer-options">
                  <div className="planner-producer-search">
                    <input ref={producerSearch} id="planner-producer-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
                      if (event.key !== "Escape") return;
                      producerMenu.current?.removeAttribute("open");
                      producerMenu.current?.querySelector("summary")?.focus();
                    }} placeholder={t("planner.searchPlaceholder")} autoComplete="off" />
                  </div>
                  {(["crop", "fruit-tree", "tapped-tree", "mushroom-log", "machine", "animal", "fish-pond"] as const).map((kind) => {
                    const options = filtered.filter(({ entry }) => entry.kind === kind);
                    if (!options.length) return null;
                    return <section key={kind}>
                      <h4>{t(producerGroupKey(kind))}</h4>
                      {options.map(({ entry, displayName, outputName, detailName }) => <button type="button" className={entry.id === selected?.id ? "active" : ""} onClick={() => {
                        setSelectedId(entry.id);
                        if (entry.family === "forestry") { setMode("units"); setAmount(1); }
                        if (entry.machineConversion) {
                          const built = savedMachineCount(entry.machineConversion);
                          setMode("units");
                          setAmount(Math.max(1, built));
                          setMachineExisting(built > 0);
                          setMachineInitialInput(savedInputCount(entry.machineConversion));
                          setMachineInputQuality(0);
                        }
                        if (entry.animal) {
                          const savedAnimals = (currentAnimals || []).filter(animal => animal.type === entry.animal?.name);
                          setMode("units");
                          setAmount(Math.max(1, savedAnimals.length));
                          setAnimalExistingCount(savedAnimals.length);
                          setAnimalProcessorId("");
                          if (savedAnimals.length) {
                            setAnimalFriendship(Math.round(savedAnimals.reduce((sum, animal) => sum + animal.friendship, 0) / savedAnimals.length));
                            setAnimalHappiness(Math.round(savedAnimals.reduce((sum, animal) => sum + animal.happiness, 0) / savedAnimals.length));
                          }
                        }
                        if (entry.pond) {
                          const savedPonds = (currentPonds || []).filter(pond => pond.fishId === entry.pond?.fish.id);
                          setMode("units"); setAmount(Math.max(1, savedPonds.length));
                          setPondExisting(savedPonds.length > 0);
                          setPondPopulation(savedPonds.length ? Math.round(savedPonds.reduce((sum, pond) => sum + pond.population, 0) / savedPonds.length) : 1);
                          setPondUnlockedPopulation(savedPonds.length ? Math.max(...savedPonds.map(pond => pond.capacity)) : entry.pond.maxPopulation);
                        }
                        setQuery("");
                        producerMenu.current?.removeAttribute("open");
                      }} key={entry.id}>
                        {entry.machineConversion
                          ? renderItemArtwork?.(entry.machineConversion.input.id, resolveGameName(entry.machineConversion.input.name, entry.machineConversion.input.id), entry.machineConversion.input.spriteIndex)
                          : renderItemArtwork?.(entry.output.id, outputName, entry.output.spriteIndex)}
                        <span><strong>{displayName}</strong>{entry.kind === "fruit-tree" && <small>{outputName}</small>}{entry.family === "forestry" && <small>{t(producerGroupKey(entry.kind))}</small>}{entry.family === "machine" && <small>{detailName}</small>}</span>
                      </button>)}
                    </section>;
                  })}
                  {!filtered.length && <p>{t("planner.noProducerMatches")}</p>}
                </div>
              </details>
            </div>
            <label>
              {t("planner.question")}
              <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
                {!selectedIsMachine && !selectedIsAnimal && !selectedIsPond && (!selectedIsForestry || !forestryExisting) && <option value="budget">{t("planner.mode.budget")}</option>}
                {!selectedIsMachine && !selectedIsAnimal && !selectedIsPond && <option value="tiles">{t("planner.mode.tiles")}</option>}
                {!selectedIsMachine && !selectedIsAnimal && !selectedIsPond && <option value="target">{t("planner.mode.target")}</option>}
                <option value="units">{t("planner.mode.units")}</option>
              </select>
            </label>
            <label>
              {t(selectedIsMachine ? "machine.machineCount" : selectedIsAnimal ? "animal.count" : selectedIsPond ? "pond.count" : `planner.amount.${mode}`)}
              <input type="number" min="0" step="1" value={amount} onChange={(event) => setAmount(Math.max(0, Number(event.target.value)))} />
            </label>
            {selectedIsMachine && selected.machineConversion && <label>
              {t("machine.initialInput", { item: resolveGameName(selected.machineConversion.input.name, selected.machineConversion.input.id) })}
              <input type="number" min="0" step="1" value={machineInitialInput} onChange={(event) => setMachineInitialInput(Math.max(0, Number(event.target.value)))} />
            </label>}
            {selectedIsAnimal && <label>{t("animal.existingCount")}<input type="number" min="0" max={amount} step="1" value={animalExistingCount} onChange={(event) => setAnimalExistingCount(Math.min(amount, Math.max(0, Number(event.target.value))))} /></label>}
            {selectedIsPond && <label>{t("pond.startPopulation")}<input type="number" min="1" max={selected.pond?.maxPopulation || 10} step="1" value={pondPopulation} onChange={(event) => setPondPopulation(Math.max(1, Number(event.target.value)))} /></label>}
            {selectedIsMachine && selected.machineConversion && <label>
              {t("machine.recurringInput", { item: resolveGameName(selected.machineConversion.input.name, selected.machineConversion.input.id) })}
              <input type="number" min="0" step="0.1" value={machineRecurringInput} onChange={(event) => setMachineRecurringInput(Math.max(0, Number(event.target.value)))} />
            </label>}
            <fieldset>
              <legend>{t("planner.horizon")}</legend>
              <div className="planner-segmented">
                <button type="button" className={horizonMode === "days" ? "active" : ""} onClick={() => setHorizonMode("days")}>{t("planner.horizon.days")}</button>
                <button type="button" className={horizonMode === "date" ? "active" : ""} onClick={() => setHorizonMode("date")}>{t("planner.horizon.date")}</button>
              </div>
              {horizonMode === "days" ? (
                <input aria-label={t("planner.durationDays")} type="number" min="0" step="1" value={durationDays} onChange={(event) => setDurationDays(Math.max(0, Number(event.target.value)))} />
              ) : (
                <div className="planner-date-fields">
                  <label>
                    <span>{t("planner.endSeason")}</span>
                    <select value={endSeason} onChange={(event) => setEndSeason(event.target.value as StardewDate["season"])}>
                      {STARDEW_SEASONS.map((season) => <option key={season} value={season}>{t(`season.${season}`)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>{t("planner.endDay")}</span>
                    <input type="number" min="1" max="28" value={endDay} onChange={(event) => setEndDay(Math.min(28, Math.max(1, Number(event.target.value))))} />
                  </label>
                  <label>
                    <span>{t("planner.endYear")}</span>
                    <input type="number" min="1" value={endYear} onChange={(event) => setEndYear(Math.max(1, Number(event.target.value)))} />
                  </label>
                </div>
              )}
            </fieldset>
          </div>
          <div className="planner-bookmark-toolbar">
            <input type="text" value={bookmarkName} onChange={(event) => setBookmarkName(event.target.value)} placeholder={t("planner.bookmark.namePlaceholder")} aria-label={t("planner.bookmark.name")} />
            <button type="button" onClick={saveCalculation} disabled={!selected}>
              {bookmarkSaved ? t("planner.bookmark.saved") : t("planner.bookmark.save")}
            </button>
            <button type="button" onClick={resetCalculation} disabled={isDefaultCalculation}>{t("planner.reset")}</button>
            {bookmarks.length > 0 && <span>{t("planner.bookmark.count", { count: number(bookmarks.length) })}</span>}
          </div>
          {bookmarks.length > 0 && <div className="planner-bookmarks" aria-label={t("planner.bookmark.list")}>
            {bookmarks.map((bookmark) => {
              const named = namedEntries.find(({ entry }) => entry.id === bookmark.selectedId);
              const horizon = bookmark.horizonMode === "days"
                ? t("planner.bookmark.days", { count: number(bookmark.durationDays) })
                : date({ year: bookmark.endYear, season: bookmark.endSeason, day: bookmark.endDay });
              return <article key={bookmark.id}>
                <button type="button" className="planner-bookmark-load" onClick={() => applyCalculation(bookmark)}>
                  <strong>{bookmark.name || named?.displayName || bookmark.selectedId}</strong>
                  <small>{t(`planner.amount.${bookmark.mode}`)}: {number(bookmark.amount)} · {horizon}</small>
                </button>
                <input className="planner-bookmark-name" aria-label={t("planner.bookmark.rename")} value={bookmark.name || ""} placeholder={named?.displayName || bookmark.selectedId} onChange={(event) => setBookmarks((current) => current.map(item => item.id === bookmark.id ? { ...item, name: event.target.value } : item))} />
                <label className="planner-bookmark-compare">
                  <input type="checkbox" checked={comparisonIds.includes(bookmark.id)} disabled={!comparisonIds.includes(bookmark.id) && comparisonIds.length >= 3} onChange={() => toggleComparison(bookmark.id)} />
                  <span>{t("planner.compare.select")}</span>
                </label>
                <button type="button" className="planner-bookmark-duplicate" onClick={() => setBookmarks((current) => [{ ...bookmark, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: t("planner.bookmark.copyName", { name: bookmark.name || named?.displayName || bookmark.selectedId }) }, ...current].slice(0, 12))}>{t("planner.bookmark.duplicate")}</button>
                <button type="button" className="planner-bookmark-remove" aria-label={t("planner.bookmark.remove", { name: named?.displayName || bookmark.selectedId })} onClick={() => {
                  setBookmarks((current) => current.filter(({ id }) => id !== bookmark.id));
                  setComparisonIds((current) => current.filter((id) => id !== bookmark.id));
                }}>×</button>
              </article>;
            })}
          </div>}
          {result && selected && <div className="planner-results" aria-live="polite">
            <div className="planner-result-head">
              <div className="planner-result-identity">
                {renderItemArtwork?.(selected.output.id, selectedNamed?.outputName || selected.output.name, selected.output.spriteIndex)}
                <div>
                  <p className="eyebrow">{t("planner.result")}</p>
                  <h3>{selectedNamed?.displayName}</h3>
                  <span>{t("planner.range", { start: date(result.startDate), end: date(result.endDate), days: result.durationDays })}</span>
                  <div className="planner-applied-assumptions" aria-label={t("planner.applied.title")}>
                    {selected.kind === "crop" && <b>{t("planner.applied.farmingLevel", { level: number(farmingLevel) })}</b>}
                    {tiller && tillerApplies(selected) && <b>{t("planner.applied.tiller")}</b>}
                    {selected.kind === "crop" && agriculturist && <b>{t("planner.applied.agriculturist")}</b>}
                    {selected.kind === "crop" && selectedFertilizer && <b>{fertilizerName(selectedFertilizer)} · {fertilizerEffect(selectedFertilizer)}</b>}
                    {!selectedIsForestry && !selectedIsMachine && !selectedIsAnimal && !selectedIsPond && <b>{t(`planner.location.${location}`)}</b>}
                    {selectedIsForestry && <b>{t(forestryExisting ? "forestry.existing" : "forestry.newSetup")}</b>}
                    {selected.kind === "tapped-tree" && forestryHeavy && <b>{t("forestry.heavy")}</b>}
                    {selected.kind === "tapped-tree" && !forestryExisting && forestryFertilized && <b>{t("forestry.treeFertilizer")}</b>}
                    {selected.kind === "mushroom-log" && <b>{t("forestry.nearbyCount", { count: number(mushroomNearby) })}</b>}
                    {selectedIsMachine && selected.machineConversion && <b>{resolveGameName(selected.machineConversion.machine.name, selected.machineConversion.machine.id)}</b>}
                    {selectedIsMachine && <b>{t(machineExisting ? "machine.existing" : "machine.newSetup")}</b>}
                    {selectedIsAnimal && <b>{t("animal.savedPrefill", { count: number(animalExistingCount) })}</b>}
                    {selectedIsPond && <b>{t(pondExisting ? "pond.existing" : "pond.newSetup")}</b>}
                    {selectedIsMachine && artisan && <b>{t("machine.artisanApplied")}</b>}
                    {selectedIsMachine && <b>{t(machineCollectionEveryDays === 0 ? "machine.cadence.ready" : "machine.cadence.days", { count: number(machineCollectionEveryDays) })}</b>}
                    {selected.kind === "crop" && location === "outdoors" && forcePlantToday && <b>{t("planner.applied.forcePlantToday")}</b>}
                    {selected.kind === "crop" && !selected.repeatDays && <b>{t(replant ? "planner.applied.replantOn" : "planner.applied.replantOff")}</b>}
                  </div>
                </div>
              </div>
              <strong>{gold(result.scenarios.expected.netProfit)}<small>{t(selectedIsMachine ? "machine.addedValue" : "planner.netProfit")}</small></strong>
            </div>
            <dl className="planner-metrics">
              <div><dt>{t(selectedIsMachine ? "machine.machineCount" : selectedIsAnimal ? "animal.count" : selectedIsPond ? "pond.count" : selectedIsForestry ? "forestry.count" : selected.kind === "fruit-tree" ? "planner.quantity.saplings" : "planner.quantity.seeds")}</dt><dd>{number(result.quantity)}</dd></div>
              <div><dt>{t("planner.space")}</dt><dd>{number(result.requiredSpace)}</dd></div>
              <div><dt>{t(selectedIsMachine ? "machine.setupCost" : selectedIsForestry ? "forestry.initialCost" : "planner.investment")}</dt><dd>{gold(result.investment)}</dd></div>
              {result.setupCosts > 0 && <div><dt>{t("planner.fertilizerCosts")}</dt><dd>{gold(result.setupCosts)}</dd></div>}
              <div><dt>{t("planner.totalCosts")}</dt><dd>{gold(result.totalCosts)}</dd></div>
              {mode === "budget" && <div><dt>{t("planner.unusedBudget")}</dt><dd>{gold(result.unusedBudget)}</dd></div>}
              <div><dt>{t(selectedIsMachine ? "machine.batches" : selectedIsForestry ? "forestry.collectionCycles" : "planner.harvests")}</dt><dd>{number(machinePlan?.batches ?? result.harvestDates.length)}</dd></div>
              {machinePlan && <div><dt>{t("machine.capacity")}</dt><dd>{number(machinePlan.capacityBatches)}</dd></div>}
              {machinePlan && <div><dt>{t("machine.inputsConsumed")}</dt><dd>{number(machinePlan.consumedInput)}</dd></div>}
              {machinePlan && <div><dt>{t("machine.inputSurplus")}</dt><dd>{number(machinePlan.surplusInput)}</dd></div>}
              {machinePlan && <div><dt>{t("machine.idleBatches")}</dt><dd>{number(machinePlan.idleBatches)}</dd></div>}
              {machinePlan && <div><dt>{t("machine.directSaleValue")}</dt><dd>{gold(machinePlan.directSaleValue)}</dd></div>}
              {animalPlan && <div><dt>{t("animal.productionCycles")}</dt><dd>{number(animalPlan.cycles)}</dd></div>}
              {animalPlan && <div><dt>{t("animal.feedCost")}</dt><dd>{gold(animalPlan.feedCost)}</dd></div>}
              {selectedIsAnimal && selected.animal && <div><dt>{t("animal.requiredBuilding")}</dt><dd>{resolveGameName(selected.animal.requiredBuilding)}</dd></div>}
              {pondPlan && <div><dt>{t("pond.endPopulation")}</dt><dd>{number(pondPlan.endPopulation)}</dd></div>}
              {selected.kind === "crop" && <div><dt>{t("planner.plantingDate")}</dt><dd>{result.plantingDate ? date(result.plantingDate) : t("planner.none")}</dd></div>}
              <div><dt>{t("planner.grossRevenue")}</dt><dd>{gold(result.scenarios.expected.grossRevenue)}</dd></div>
              <div><dt>{t("planner.profitPerDay")}</dt><dd>{gold(result.scenarios.expected.profitPerDay)}</dd></div>
              <div><dt>{t("planner.firstIncome")}</dt><dd>{machinePlan?.firstIncomeDate ? date(machinePlan.firstIncomeDate) : animalPlan?.firstIncomeDate ? date(animalPlan.firstIncomeDate) : pondPlan?.firstIncomeDate ? date(pondPlan.firstIncomeDate) : result.harvestDates[0] ? date(result.harvestDates[0]) : t("planner.none")}</dd></div>
              <div><dt>{t("planner.breakEven")}</dt><dd>{result.breakEvenDate ? date(result.breakEvenDate) : t("planner.notInRange")}</dd></div>
            </dl>
            {selectedIsForestry && !forestryExisting && selected.materials?.length ? <div className="forestry-materials"><strong>{t("forestry.materials")}</strong><span>{selected.materials.map(({ item, quantity }) => `${number(result.quantity * quantity)}× ${resolveGameName(item.name, item.id)}`).join(" · ")}</span></div> : null}
            {selectedIsMachine && !machineExisting && selected.materials?.length ? <div className="forestry-materials"><strong>{t("machine.machineMaterials")}</strong><span>{selected.materials.map(({ item, quantity }) => `${number(result.quantity * quantity)}× ${resolveGameName(item.name, item.id)}`).join(" · ")}</span></div> : null}
            {selectedIsMachine && selected.machineConversion?.additionalInputs?.length ? <div className="forestry-materials"><strong>{t("machine.additionalInputs")}</strong><span>{selected.machineConversion.additionalInputs.map(({ item, quantity }) => `${number((machinePlan?.batches || 0) * quantity)}× ${resolveGameName(item.name, item.id)}`).join(" · ")}</span></div> : null}
            <div className="planner-scenarios">
              {(["conservative", "expected", "optimistic"] as const).map((scenario) => <article key={scenario}>
                <span>{t(`planner.scenario.${scenario}`)}</span>
                <strong>{gold(result.scenarios[scenario].netProfit)}</strong>
                <small>{t("planner.units", { count: number(result.scenarios[scenario].units) })}</small>
              </article>)}
            </div>
            {visibleWarnings.length > 0 && <ul className="planner-warnings">
              {visibleWarnings.map((warning) => <li key={warning}>{t(`planner.warning.${warning}`, warning === "cannot-plant-on-start-date" || warning === "no-planting-date-in-horizon"
                ? { seasons: selected.seasons.map((season) => t(`season.${season}`)).join(", ") }
                : warning === "planting-delayed" && result.plantingDate
                  ? { date: date(result.plantingDate) }
                  : undefined)}</li>)}
            </ul>}
            {selectedIsForestry && <ul className="planner-warnings"><li>{t(selected.kind === "mushroom-log" ? "forestry.logUncertainty" : !forestryExisting ? "forestry.treeUncertainty" : "forestry.tapAssumptions")}</li></ul>}
            {selected.kind === "crop" && selectedFertilizer && !selectedFertilizer.verifiedCost && <ul className="planner-warnings"><li>{t("planner.warning.fertilizer-cost-unknown", { fertilizer: fertilizerName(selectedFertilizer) })}</li></ul>}
          </div>}
          {comparisonRows.length > 0 && <section className="planner-comparison" aria-labelledby="planner-comparison-title">
            <header>
              <div>
                <p className="eyebrow">{t("planner.compare.eyebrow")}</p>
                <h3 id="planner-comparison-title">{t("planner.compare.title", { count: number(comparisonRows.length) })}</h3>
                <p>{t("planner.compare.detail")}</p>
              </div>
              <div className="planner-segmented">
                <button type="button" className={comparisonView === "table" ? "active" : ""} onClick={() => setComparisonView("table")}>{t("planner.compare.table")}</button>
                <button type="button" className={comparisonView === "chart" ? "active" : ""} onClick={() => setComparisonView("chart")}>{t("planner.compare.chart")}</button>
              </div>
            </header>
            {comparisonView === "table" ? <div className="planner-comparison-table"><table>
              <thead><tr><th>{t("planner.compare.calculation")}</th><th>{t("planner.compare.configuration")}</th><th>{t("planner.totalCosts")}</th><th>{t("planner.grossRevenue")}</th><th>{t("planner.netProfit")}</th><th>{t("planner.profitPerDay")}</th></tr></thead>
              <tbody>{comparisonRows.map(({ saved, entry, result: compared, name, current: isCurrent }) => <tr key={saved.id} className={isCurrent ? "current" : undefined}>
                <th><div className="planner-comparison-identity">{renderItemArtwork?.(entry.output.id, resolveGameName(entry.output.name, entry.output.id), entry.output.spriteIndex)}<span>{isCurrent && <em>{t("planner.compare.current")}</em>}{name}<small>{t("planner.range", { start: date(compared.startDate), end: date(compared.endDate), days: compared.durationDays })}</small></span></div></th>
                <td>{entry.family === "forestry"
                  ? `${t(producerGroupKey(entry.kind))} · ${t((saved.forestryExisting ?? true) ? "forestry.existing" : "forestry.newSetup")}${entry.kind === "tapped-tree" && saved.forestryHeavy ? ` · ${t("forestry.heavy")}` : ""}`
                  : entry.family === "machine" && entry.machineConversion
                    ? `${resolveGameName(entry.machineConversion.machine.name, entry.machineConversion.machine.id)} · ${t((saved.machineExisting ?? true) ? "machine.existing" : "machine.newSetup")}${saved.artisan ? ` · ${t("machine.artisanApplied")}` : ""}`
                  : <>{entry.kind === "crop" && <span>{t("planner.applied.farmingLevel", { level: number(saved.farmingLevel) })} · </span>}{(saved.tiller ?? savedHasTiller) && tillerApplies(entry) ? `${t("planner.applied.tiller")} · ` : ""}{entry.kind === "crop" && (saved.agriculturist ?? savedHasAgriculturist) ? `${t("planner.applied.agriculturist")} · ` : ""}{entry.kind === "crop" && saved.fertilizerId ? `${fertilizerName(fertilizers.find(({ id }) => id === saved.fertilizerId))} · ${fertilizerEffect(fertilizers.find(({ id }) => id === saved.fertilizerId), saved.farmingLevel)} · ` : ""}{t(`planner.location.${saved.location}`)}{entry.kind === "crop" && saved.location === "outdoors" && (saved.forcePlantToday ?? false) ? ` · ${t("planner.applied.forcePlantToday")}` : ""}{entry.kind === "crop" && !entry.repeatDays ? ` · ${t(saved.replant ? "planner.applied.replantOn" : "planner.applied.replantOff")}` : ""}</>}
                </td>
                <td>{gold(compared.totalCosts)}</td><td>{gold(compared.scenarios.expected.grossRevenue)}</td><td className={compared.scenarios.expected.netProfit < 0 ? "negative" : "positive"}>{gold(compared.scenarios.expected.netProfit)}</td><td>{gold(compared.scenarios.expected.profitPerDay)}</td>
              </tr>)}</tbody>
            </table></div> : <div className="planner-comparison-chart" aria-label={t("planner.compare.chartLabel")}>
              {comparisonRows.map(({ saved, entry, result: compared, name, current: isCurrent }) => {
                const profit = compared.scenarios.expected.netProfit;
                const width = `${Math.abs(profit) / comparisonScale * 50}%`;
                return <div className="planner-comparison-chart-row" key={saved.id}>
                  <strong className="planner-comparison-chart-name">{renderItemArtwork?.(entry.output.id, resolveGameName(entry.output.name, entry.output.id), entry.output.spriteIndex)}<span>{isCurrent ? `${t("planner.compare.current")}: ${name}` : name}</span></strong>
                  <div className="planner-comparison-track"><i className={profit < 0 ? "negative" : "positive"} style={{ width }} /></div>
                  <span className={profit < 0 ? "negative" : "positive"}>{gold(profit)}</span>
                </div>;
              })}
            </div>}
            {comparisonRows.length >= 2 && <div className={`planner-portfolio ${portfolio.feasible ? "feasible" : "conflicted"}`}>
              <strong>{t("planner.portfolio.title")}</strong>
              <span>{t("planner.portfolio.summary", { cost: gold(portfolio.totals.money), profit: gold(portfolio.totals.profit), space: number(portfolio.totals.space) })}</span>
              {portfolio.conflicts.length > 0
                ? <ul>{portfolio.conflicts.map((conflict: { kind: string; id?: string; required: number; available: number }, index: number) => <li key={`${conflict.kind}-${conflict.id || index}`}>{t(`planner.portfolio.conflict.${conflict.kind}`, { item: conflict.id ? resolveGameName(conflict.id, conflict.id) : "", required: number(conflict.required), available: number(conflict.available) })}</li>)}</ul>
                : <small>{t("planner.portfolio.feasible")}</small>}
            </div>}
          </section>}
          <details className="planner-advanced">
            <summary>{t("planner.adjust")}</summary>
            {!selectedIsForestry && !selectedIsMachine && !selectedIsAnimal && !selectedIsPond && <label>
              {t("planner.location")}
              <select value={location} onChange={(event) => {
                const nextLocation = event.target.value as typeof location;
                setLocation(nextLocation);
                if (nextLocation !== "outdoors") setForcePlantToday(false);
              }}>
                <option value="outdoors">{t("planner.location.outdoors")}</option>
                <option value="greenhouse">{t("planner.location.greenhouse")}</option>
                <option value="island">{t("planner.location.island")}</option>
              </select>
            </label>}
            {selected?.kind === "crop" && !selected.repeatDays && <label className="planner-check">
              <input type="checkbox" checked={replant} onChange={(event) => setReplant(event.target.checked)} />
              <span>{t("planner.replant")}</span>
            </label>}
            {selected?.kind === "crop" && location === "outdoors" && <label className="planner-check">
              <input type="checkbox" checked={forcePlantToday} onChange={(event) => setForcePlantToday(event.target.checked)} />
              <span>{t("planner.forcePlantToday")} <small>{t("planner.forcePlantTodayDetail")}</small></span>
            </label>}
            {selected?.kind === "crop" && <label>
              {t("planner.farmingLevel")}
              <input type="number" min="0" max="10" step="1" value={farmingLevel} onChange={(event) => setFarmingLevel(Math.min(10, Math.max(0, Number(event.target.value))))} />
            </label>}
            {!selectedIsForestry && !selectedIsMachine && !selectedIsAnimal && !selectedIsPond && <label className="planner-check">
              <input type="checkbox" checked={tiller} onChange={(event) => setTiller(event.target.checked)} />
              <span>{t("planner.profession.tiller")} <small>{t("planner.effect.salePrice", { percent: number(10) })}</small></span>
            </label>}
            {selected?.kind === "crop" && <label className="planner-check">
              <input type="checkbox" checked={agriculturist} onChange={(event) => setAgriculturist(event.target.checked)} />
              <span>{t("planner.profession.agriculturist")} <small>{t("planner.effect.growth", { percent: number(10) })}</small></span>
            </label>}
            {selected?.kind === "crop" && fertilizers.length > 0 && <label>
              {t("planner.fertilizer")}
              <select value={fertilizerId} onChange={(event) => setFertilizerId(event.target.value)}>
                <option value="">{t("planner.fertilizer.none")}</option>
                {fertilizers.map((fertilizer) => <option key={fertilizer.id} value={fertilizer.id}>{fertilizerName(fertilizer)} · {fertilizerEffect(fertilizer)}</option>)}
              </select>
            </label>}
            {selectedIsForestry && <label className="planner-check">
              <input type="checkbox" checked={forestryExisting} onChange={(event) => {
                const existing = event.target.checked;
                setForestryExisting(existing);
                if (existing && mode === "budget") {
                  setMode("units");
                  setAmount(Math.max(1, amount));
                }
              }} />
              <span>{t("forestry.existing")}</span>
            </label>}
            {selected?.kind === "tapped-tree" && <label className="planner-check">
              <input type="checkbox" checked={forestryHeavy} onChange={(event) => setForestryHeavy(event.target.checked)} />
              <span>{t("forestry.heavy")}</span>
            </label>}
            {selected?.kind === "tapped-tree" && !forestryExisting && <label className="planner-check">
              <input type="checkbox" checked={forestryFertilized} onChange={(event) => setForestryFertilized(event.target.checked)} />
              <span>{t("forestry.treeFertilizer")}</span>
            </label>}
            {selected?.kind === "mushroom-log" && <fieldset className="forestry-species-fields"><legend>{t("forestry.nearbySpecies")}</legend><div className="forestry-species-grid">
              {(["oak", "maple", "pine", "mystic", "other"] as const).map(key => <label key={key}>{t(`forestry.${key}`)}<input type="number" min="0" value={mushroomSpecies[key]} onChange={(event) => setMushroomSpeciesCount(key, Number(event.target.value))} /></label>)}
              <label>{t("forestry.mossy")}<input type="number" min="0" max={mushroomNearby} value={mushroomMossy} onChange={(event) => setMushroomMossy(Math.max(0, Math.min(mushroomNearby, Math.floor(Number(event.target.value) || 0))))} /></label>
            </div></fieldset>}
            {selectedIsMachine && <label className="planner-check">
              <input type="checkbox" checked={machineExisting} onChange={(event) => setMachineExisting(event.target.checked)} />
              <span>{t("machine.existing")}</span>
            </label>}
            {selectedIsMachine && <label>
              {t("machine.inputQuality")}
              <select value={machineInputQuality} onChange={(event) => setMachineInputQuality(Number(event.target.value))}>
                <option value="0">{t("machine.quality.normal")}</option>
                <option value="1">{t("machine.quality.silver")}</option>
                <option value="2">{t("machine.quality.gold")}</option>
                <option value="4">{t("machine.quality.iridium")}</option>
              </select>
            </label>}
            {selectedIsMachine && <label>
              {t("machine.collectionCadence")}
              <select value={machineCollectionEveryDays} onChange={(event) => setMachineCollectionEveryDays(Number(event.target.value))}>
                <option value="0">{t("machine.cadence.ready")}</option>
                <option value="1">{t("machine.cadence.daily")}</option>
                <option value="2">{t("machine.cadence.everyTwoDays")}</option>
                <option value="7">{t("machine.cadence.weekly")}</option>
              </select>
            </label>}
            {selectedIsMachine && selected.machineConversion?.artisanEligible && <label className="planner-check">
              <input type="checkbox" checked={artisan} onChange={(event) => setArtisan(event.target.checked)} />
              <span>{t("machine.artisan")} <small>{t("machine.artisanEffect")}</small></span>
            </label>}
            {selectedIsAnimal && <label className="planner-check"><input type="checkbox" checked={animalFed} onChange={(event) => setAnimalFed(event.target.checked)} /><span>{t("animal.fedDaily")}</span></label>}
            {selectedIsAnimal && <label>{t("animal.friendship")}<input type="number" min="0" max="1000" value={animalFriendship} onChange={(event) => setAnimalFriendship(Math.min(1000, Math.max(0, Number(event.target.value))))} /></label>}
            {selectedIsAnimal && <label>{t("animal.happiness")}<input type="number" min="0" max="255" value={animalHappiness} onChange={(event) => setAnimalHappiness(Math.min(255, Math.max(0, Number(event.target.value))))} /></label>}
            {selectedIsAnimal && animalProcessors.length > 0 && <label>{t("animal.processing")}<select value={animalProcessorId} onChange={(event) => {
              const id = event.target.value;
              setAnimalProcessorId(id);
              const conversion = animalProcessors.find(candidate => candidate.id === id);
              if (conversion) setAnimalProcessorCount(Math.max(1, savedMachineCount(conversion)));
            }}><option value="">{t("animal.sellDirect")}</option>{animalProcessors.map(conversion => <option value={conversion.id} key={conversion.id}>{resolveGameName(conversion.machine.name, conversion.machine.id)} → {resolveGameName(conversion.output.name, conversion.output.id)}</option>)}</select></label>}
            {selectedIsAnimal && animalProcessorId && <label>{t("animal.processorCount")}<input type="number" min="1" value={animalProcessorCount} onChange={(event) => setAnimalProcessorCount(Math.max(1, Number(event.target.value)))} /></label>}
            {selectedIsPond && <label className="planner-check"><input type="checkbox" checked={pondExisting} onChange={(event) => setPondExisting(event.target.checked)} /><span>{t("pond.existing")}</span></label>}
            {selectedIsPond && <label>{t("pond.unlockedPopulation")}<input type="number" min={pondPopulation} max={selected.pond?.maxPopulation || 10} value={pondUnlockedPopulation} onChange={(event) => setPondUnlockedPopulation(Math.max(pondPopulation, Number(event.target.value)))} /></label>}
            {selectedIsPond && <label className="planner-check"><input type="checkbox" checked={pondProcessRoe} onChange={(event) => setPondProcessRoe(event.target.checked)} /><span>{t("pond.processRoe")}</span></label>}
            {selectedIsPond && selected.pond?.populationGates && <div className="forestry-materials"><strong>{t("pond.requests")}</strong><span>{Object.entries(selected.pond.populationGates).map(([population, items]) => t("pond.request", { population, items: items.map(raw => {
              const [id, quantity = "1"] = raw.split(" ");
              return `${quantity}× ${resolveGameName(id, id)}`;
            }).join(" + ") })).join(" · ")}</span></div>}
            <p>{t(selectedIsMachine ? "machine.assumptions" : selectedIsForestry ? "forestry.assumptions" : "planner.assumptions")}</p>
          </details>
        </>
      )}
    </section>
  );
}
