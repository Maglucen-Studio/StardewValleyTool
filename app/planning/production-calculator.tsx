"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useI18n } from "../i18n";
import {
  STARDEW_SEASONS,
  addStardewDays,
  calculateProductionPlan,
  type ProductionProducer,
  type StardewDate,
} from "./production-engine.mjs";
import { calculateMushroomLogPlan, expectedTreeGrowthDays, type MushroomSpecies } from "./forestry-engine.mjs";

export type ProductionCatalogEntry = Omit<ProductionProducer, "outputValue"> & {
  output: { id: string; name: string; price: number; category?: number; spriteIndex?: number };
  growthPhases?: number[];
  yieldRules?: { maxIncreasePerFarmingLevel: number; extraHarvestChance: number };
  clearance?: number;
  family?: "farming" | "forestry";
  materials?: Array<{ item: { id: string; name: string; price: number; spriteIndex?: number }; quantity: number }>;
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
};

type CalculatorMode = "budget" | "tiles" | "target" | "units";
type HorizonMode = "days" | "date";
type GrowingLocation = "outdoors" | "greenhouse" | "island";
type ComparisonView = "table" | "chart";
type SavedCalculation = {
  id: string;
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
};

type ForestrySettings = {
  existing: boolean;
  heavy: boolean;
  fertilized: boolean;
  species: MushroomSpecies;
  mossy: number;
};

const MUSHROOM_OUTPUT_KEYS: Record<string, "common" | "red" | "purple" | "morel" | "chanterelle"> = {
  "(O)404": "common", "(O)420": "red", "(O)422": "purple", "(O)257": "morel", "(O)281": "chanterelle",
};

function producerGroupKey(kind: ProductionCatalogEntry["kind"]) {
  return kind === "crop" ? "planner.group.crops"
    : kind === "fruit-tree" ? "planner.group.fruitTrees"
      : kind === "tapped-tree" ? "planner.group.tappedTrees"
        : "planner.group.mushroomLogs";
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
  return [...farming, ...tapped, ...mushroomLog];
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
  profileId,
  resolveGameName,
  renderItemArtwork,
}: {
  catalog?: ProductionCatalog;
  currentDate: StardewDate;
  currentMoney: number;
  currentFarmingLevel: number;
  currentProfessionIds: number[];
  profileId: string;
  resolveGameName: (name: string, id?: string) => string;
  renderItemArtwork?: (id: string, name: string, spriteIndex?: number) => ReactNode;
}) {
  const { t, number, date, locale } = useI18n();
  const savedHasTiller = currentProfessionIds.includes(1);
  const savedHasAgriculturist = currentProfessionIds.includes(5);
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
  const [bookmarks, setBookmarks] = useState<SavedCalculation[]>([]);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [comparisonView, setComparisonView] = useState<ComparisonView>("table");
  const [loadedStorageKey, setLoadedStorageKey] = useState("");
  const [bookmarkSaved, setBookmarkSaved] = useState(false);
  const producerMenu = useRef<HTMLDetailsElement>(null);
  const bookmarkNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `maglucen.production-calculator.${profileId || "default"}`;
  const forestrySettings = useMemo<ForestrySettings>(() => ({ existing: forestryExisting, heavy: forestryHeavy, fertilized: forestryFertilized, species: mushroomSpecies, mossy: mushroomMossy }), [forestryExisting, forestryFertilized, forestryHeavy, mushroomMossy, mushroomSpecies]);
  const entries = useMemo(() => buildCalculatorEntries(catalog, forestrySettings), [catalog, forestrySettings]);
  const fertilizers = useMemo(() => catalog?.fertilizers || [], [catalog?.fertilizers]);
  const namedEntries = useMemo(() => entries.map((entry) => ({
    entry,
    displayName: entry.kind === "crop" || entry.family === "forestry"
      ? resolveGameName(entry.output.name, entry.output.id)
      : resolveGameName(entry.name, entry.id),
    outputName: resolveGameName(entry.output.name, entry.output.id),
  })).sort((left, right) => left.displayName.localeCompare(right.displayName, locale)), [entries, locale, resolveGameName]);
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const filtered = namedEntries.filter(({ displayName, outputName }) =>
    `${displayName} ${outputName}`.toLocaleLowerCase(locale).includes(normalizedQuery));
  const selected = entries.find((entry) => entry.id === selectedId) || entries[0];
  const selectedIsForestry = selected?.family === "forestry";
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
  }), [agriculturist, amount, durationDays, endDay, endSeason, endYear, farmingLevel, fertilizerId, forcePlantToday, forestryExisting, forestryFertilized, forestryHeavy, horizonMode, location, mode, mushroomMossy, mushroomSpecies, replant, selected?.id, tiller]);

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
  }, [savedHasAgriculturist, savedHasTiller, storageKey]);

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
  };
  const saveCalculation = () => {
    const bookmark = { ...calculation, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    setBookmarks((current) => [bookmark, ...current].slice(0, 12));
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
    && JSON.stringify(mushroomSpecies) === JSON.stringify({ oak: 2, maple: 2, pine: 2, mystic: 0, other: 0 });
  const toggleComparison = (id: string) => setComparisonIds((current) => current.includes(id)
    ? current.filter((candidate) => candidate !== id)
    : current.length < 3 ? [...current, id] : current);
  const producer = useMemo(() => {
    if (!selected) return null;
    return producerWithModifiers(selected, farmingLevel, tiller, agriculturist, fertilizers.find(({ id }) => id === fertilizerId));
  }, [agriculturist, farmingLevel, fertilizerId, fertilizers, selected, tiller]);
  const selectedFertilizer = fertilizers.find(({ id }) => id === fertilizerId);
  const result = useMemo(() => producer ? calculateProductionPlan({
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
  const visibleWarnings = result?.warnings.filter(warning => !(selectedIsForestry && forestryExisting && warning === "missing-startup-cost")) || [];
  const mushroomNearby = Object.values(mushroomSpecies).reduce((sum, value) => sum + value, 0);
  const setMushroomSpeciesCount = (key: keyof MushroomSpecies, value: number) => setMushroomSpecies(current => ({ ...current, [key]: Math.max(0, Math.floor(value || 0)) }));
  const comparisons = useMemo(() => comparisonIds.flatMap((id) => {
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
    const savedProducer = producerWithModifiers(entry, saved.farmingLevel, saved.tiller ?? savedHasTiller, saved.agriculturist ?? savedHasAgriculturist, savedFertilizer);
    const savedResult = calculateProductionPlan({
      producer: savedProducer,
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
  }), [bookmarks, catalog, comparisonIds, currentDate, fertilizers, namedEntries, savedHasAgriculturist, savedHasTiller]);
  const comparisonRows = result && selected && comparisons.length > 0
    ? [{ saved: { ...calculation, id: "current" }, entry: selected, result, name: selectedNamed?.displayName || selected.name, current: true }, ...comparisons.map((comparison) => ({ ...comparison, current: false }))]
    : [];
  const comparisonScale = Math.max(1, ...comparisonRows.map(({ result: compared }) => Math.abs(compared.scenarios.expected.netProfit)));
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
              <input id="planner-producer-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("planner.searchPlaceholder")} />
              <details className="planner-producer-menu" ref={producerMenu}>
                <summary aria-label={t("planner.chooseProducer")}>
                  {selected && renderItemArtwork?.(selected.output.id, selectedNamed?.outputName || selected.output.name, selected.output.spriteIndex)}
                  <span><strong>{selectedNamed?.displayName}</strong>{selected?.kind === "fruit-tree" && <small>{selectedNamed?.outputName}</small>}{selected?.family === "forestry" && <small>{t(producerGroupKey(selected.kind))}</small>}</span>
                </summary>
                <div className="planner-producer-options">
                  {(["crop", "fruit-tree", "tapped-tree", "mushroom-log"] as const).map((kind) => {
                    const options = filtered.filter(({ entry }) => entry.kind === kind);
                    if (!options.length) return null;
                    return <section key={kind}>
                      <h4>{t(producerGroupKey(kind))}</h4>
                      {options.map(({ entry, displayName, outputName }) => <button type="button" className={entry.id === selected?.id ? "active" : ""} onClick={() => {
                        setSelectedId(entry.id);
                        if (entry.family === "forestry") { setMode("units"); setAmount(1); }
                        producerMenu.current?.removeAttribute("open");
                      }} key={entry.id}>
                        {renderItemArtwork?.(entry.output.id, outputName, entry.output.spriteIndex)}
                        <span><strong>{displayName}</strong>{entry.kind === "fruit-tree" && <small>{outputName}</small>}{entry.family === "forestry" && <small>{t(producerGroupKey(entry.kind))}</small>}</span>
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
                {(!selectedIsForestry || !forestryExisting) && <option value="budget">{t("planner.mode.budget")}</option>}
                <option value="tiles">{t("planner.mode.tiles")}</option>
                <option value="target">{t("planner.mode.target")}</option>
                <option value="units">{t("planner.mode.units")}</option>
              </select>
            </label>
            <label>
              {t(`planner.amount.${mode}`)}
              <input type="number" min="0" step="1" value={amount} onChange={(event) => setAmount(Math.max(0, Number(event.target.value)))} />
            </label>
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
                  <strong>{named?.displayName || bookmark.selectedId}</strong>
                  <small>{t(`planner.amount.${bookmark.mode}`)}: {number(bookmark.amount)} · {horizon}</small>
                </button>
                <label className="planner-bookmark-compare">
                  <input type="checkbox" checked={comparisonIds.includes(bookmark.id)} disabled={!comparisonIds.includes(bookmark.id) && comparisonIds.length >= 3} onChange={() => toggleComparison(bookmark.id)} />
                  <span>{t("planner.compare.select")}</span>
                </label>
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
                    {!selectedIsForestry && <b>{t(`planner.location.${location}`)}</b>}
                    {selectedIsForestry && <b>{t(forestryExisting ? "forestry.existing" : "forestry.newSetup")}</b>}
                    {selected.kind === "tapped-tree" && forestryHeavy && <b>{t("forestry.heavy")}</b>}
                    {selected.kind === "tapped-tree" && !forestryExisting && forestryFertilized && <b>{t("forestry.treeFertilizer")}</b>}
                    {selected.kind === "mushroom-log" && <b>{t("forestry.nearbyCount", { count: number(mushroomNearby) })}</b>}
                    {selected.kind === "crop" && location === "outdoors" && forcePlantToday && <b>{t("planner.applied.forcePlantToday")}</b>}
                    {selected.kind === "crop" && !selected.repeatDays && <b>{t(replant ? "planner.applied.replantOn" : "planner.applied.replantOff")}</b>}
                  </div>
                </div>
              </div>
              <strong>{gold(result.scenarios.expected.netProfit)}<small>{t("planner.netProfit")}</small></strong>
            </div>
            <dl className="planner-metrics">
              <div><dt>{t(selectedIsForestry ? "forestry.count" : selected.kind === "fruit-tree" ? "planner.quantity.saplings" : "planner.quantity.seeds")}</dt><dd>{number(result.quantity)}</dd></div>
              <div><dt>{t("planner.space")}</dt><dd>{number(result.requiredSpace)}</dd></div>
              <div><dt>{t(selectedIsForestry ? "forestry.initialCost" : "planner.investment")}</dt><dd>{gold(result.investment)}</dd></div>
              {result.setupCosts > 0 && <div><dt>{t("planner.fertilizerCosts")}</dt><dd>{gold(result.setupCosts)}</dd></div>}
              <div><dt>{t("planner.totalCosts")}</dt><dd>{gold(result.totalCosts)}</dd></div>
              {mode === "budget" && <div><dt>{t("planner.unusedBudget")}</dt><dd>{gold(result.unusedBudget)}</dd></div>}
              <div><dt>{t(selectedIsForestry ? "forestry.collectionCycles" : "planner.harvests")}</dt><dd>{number(result.harvestDates.length)}</dd></div>
              {selected.kind === "crop" && <div><dt>{t("planner.plantingDate")}</dt><dd>{result.plantingDate ? date(result.plantingDate) : t("planner.none")}</dd></div>}
              <div><dt>{t("planner.grossRevenue")}</dt><dd>{gold(result.scenarios.expected.grossRevenue)}</dd></div>
              <div><dt>{t("planner.profitPerDay")}</dt><dd>{gold(result.scenarios.expected.profitPerDay)}</dd></div>
              <div><dt>{t("planner.firstIncome")}</dt><dd>{result.harvestDates[0] ? date(result.harvestDates[0]) : t("planner.none")}</dd></div>
              <div><dt>{t("planner.breakEven")}</dt><dd>{result.breakEvenDate ? date(result.breakEvenDate) : t("planner.notInRange")}</dd></div>
            </dl>
            {selectedIsForestry && !forestryExisting && selected.materials?.length ? <div className="forestry-materials"><strong>{t("forestry.materials")}</strong><span>{selected.materials.map(({ item, quantity }) => `${number(result.quantity * quantity)}× ${resolveGameName(item.name, item.id)}`).join(" · ")}</span></div> : null}
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
          </section>}
          <details className="planner-advanced">
            <summary>{t("planner.adjust")}</summary>
            {!selectedIsForestry && <label>
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
            {!selectedIsForestry && <label className="planner-check">
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
            <p>{t(selectedIsForestry ? "forestry.assumptions" : "planner.assumptions")}</p>
          </details>
        </>
      )}
    </section>
  );
}
