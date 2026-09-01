"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import packageMetadata from "../package.json";
import { ChangelogHistory } from "./changelog";
import { useI18n, type MessageDescriptor } from "./i18n";

const APPLICATION_VERSION = packageMetadata.version;

type Tile = { x: number; y: number };
type Terrain = Tile & {
  kind: string;
  treeType?: string;
  stage?: number;
  stump?: boolean;
  tapped?: boolean;
  fertilized?: boolean;
  watered?: boolean;
  crop?: string;
  phase?: number;
  cropRow?: number;
  flip?: boolean;
  dead?: boolean;
  treeId?: string;
};
type FarmObject = Tile & {
  name: string;
  displayName?: string;
  kind: string;
  id: string;
  big: boolean;
  ready?: boolean;
  processing?: boolean;
  output?: string | null;
  input?: string | null;
  minutesUntilReady?: number;
  readyInDays?: number;
  color?: string | null;
};
type Building = Tile & {
  width: number;
  height: number;
  name: string;
  daysOfConstructionLeft?: number;
  daysUntilUpgrade?: number;
};
type Interior = {
  id: string;
  name: string;
  label: string;
  width: number;
  height: number;
  background?: string;
  objects: FarmObject[];
  furniture: (Tile & {
    name: string;
    sourceX?: number;
    sourceY?: number;
    sourceWidth?: number;
    sourceHeight?: number;
  })[];
};
type Suggestion = Building & { id: string; kind: string; color: string };
type ProposalState = Suggestion & {
  status: "pending" | "building" | "completed" | "resolved";
  actual?: Building;
  matchedBy?: "position" | "manual";
};
type Snapshot = {
  profileId?: string;
  farmType?: number;
  farmName: string;
  farmer: string;
  farmerAvatar?: string | null;
  season: string;
  seasonLabel: string;
  day: number;
  year: number;
  dateKey: string;
  dayIndex: number;
  money: number;
  totalMoneyEarned: number;
  progress: Progress;
  grandpa: GrandpaProgress;
  achievements: AchievementTracking;
  collectionBrief?: LongTermCollectionBrief;
  museumBrief: MuseumBrief;
  dailyBrief: DailyBrief;
  fishingBrief: FishingBrief;
  planningBrief: PlanningBrief;
  localizedObjectNamesByEnglish?: Record<string, string>;
  localizedNamesByQualifiedId?: Record<string, string>;
  itemArtworkCatalog?: Record<string, ItemArtwork>;
  map: { width: number; height: number; tileSize: number; blocked: number[][] };
  objects: FarmObject[];
  terrain: Terrain[];
  buildings: Building[];
  clumps: (Building & { id: string })[];
  interiors: Interior[];
  locationMaps?: Record<
    string,
    { background: string; width: number; height: number }
  >;
  suggestions: Suggestion[];
};
type LocalizedValue = string | MessageDescriptor;
type Progress = {
  farming: number;
  mining: number;
  foraging: number;
  fishing: number;
  combat: number;
  deepestMineLevel: number;
  houseUpgradeLevel: number;
  stepsTaken: number;
  itemsShipped: number;
  cropsShipped: number;
  fishCaught: number;
  monstersKilled: number;
  treesChopped: number;
};
type GrandpaMilestone = {
  id: string;
  label: string;
  points: number;
  done: boolean;
  how: string;
};
type GrandpaProgress = {
  score: number;
  candles: number;
  actualScore?: number;
  actualCandles?: number;
  earningsPoints: number;
  skillPoints: number;
  skillTotal: number;
  friendsAtEightHearts: number;
  petFriendship: number;
  milestones: GrandpaMilestone[];
};
type Achievement = {
  id: string;
  name: string;
  requirement: string;
  category: string;
  done: boolean;
  current?: number | null;
  target?: number | null;
  unit: string;
  timing?: string | null;
  nextStep?: string | null;
};
type AchievementTracking = {
  total: number;
  completed: number;
  items: Achievement[];
  note: string;
};
type MuseumSource = {
  id: string;
  label: string;
  itemIds: string[];
  items?: { id: string; name: string; displayName?: string }[];
  available: boolean;
  hint: string;
  unavailableHint?: string | null;
};
type MuseumBrief = {
  donated: string[];
  artifactIds: string[];
  mineralIds: string[];
  sources: MuseumSource[];
  note: string;
};
type GiftItem = {
  id?: string;
  name: string;
  displayName?: string;
  count: number;
  quality: number;
  sources: string[];
  spriteKind?: ItemSpriteKind;
  spriteIndex?: string;
  spriteWidth?: number;
  spriteHeight?: number;
};
type CollectionRecipeItem = ItemArtwork & {
  complete: boolean;
  count: number;
  learned: boolean;
};
type LongTermCollectionBrief = {
  shipping?: CollectionRecipeItem[];
  cooking: CollectionRecipeItem[];
  crafting: CollectionRecipeItem[];
};
type BirthdayBrief = {
  id?: string;
  person: string;
  when: string;
  gifts: { love: GiftItem[]; like: GiftItem[]; neutral: GiftItem[] };
};
type CropForecast = {
  id: string;
  name: string;
  displayName?: string;
  count: number;
  daysRemaining: number;
  watered: number;
  ready: boolean;
  regrowing: boolean;
  harvestDate: string;
  willWither: boolean;
};
type DailyQuest = {
  id?: number;
  accepted: boolean;
  available?: boolean;
  daily?: boolean;
  title: LocalizedValue;
  description: LocalizedValue;
  objective: LocalizedValue;
  type: string;
  requester: string | null;
  reward: number;
  daysLeft: number;
  progress: number;
  target: number;
  ready: boolean;
  owned: number;
  hasRequestedItems: boolean;
  stock: { name: string; displayName?: string; count: number; sources: string[] }[];
  stockNote: LocalizedValue | null;
  tips?: LocalizedValue[];
  requestedId?: string | null;
  requestedName?: string | null;
};
type DailyBrief = {
  weatherTomorrow: { code: string };
  luck: {
    value: number;
    tier: string;
    label: LocalizedValue;
    advice: LocalizedValue;
    recommendations: LocalizedValue[];
    explanation: LocalizedValue;
  };
  tv: { id?: string; channel: LocalizedValue; title: LocalizedValue; detail: LocalizedValue }[];
  world: { location: string; items: { name: string; displayName?: string; count: number }[] }[];
  beach: { name: string; displayName?: string; count: number; tiles: number[][] }[];
  birthdays: BirthdayBrief[];
  fruitCave: {
    unlocked: boolean;
    type: string;
    count: number;
    items: { name: string; displayName?: string; count: number }[];
  };
  toolUpgrade: {
    name: string;
    displayName?: string;
    type: string;
    level: number;
    daysRemaining: number;
    ready: boolean;
    pickupDate: string;
  } | null;
  crops: CropForecast[];
  dailyQuest: DailyQuest;
  acceptedQuests?: DailyQuest[];
  specialOrders?: SpecialOrderBrief[];
  specialOrdersUnlocked?: boolean;
  boardQuest?: DailyQuest | null;
  inventoryItemsChecked: number;
  summary: LocalizedValue;
};
const isCoreTvProgram = (program: DailyBrief["tv"][number]) => {
  if (program.id === "weather" || program.id === "fortune") return true;
  if (typeof program.channel === "object")
    return program.channel.key === "today.tv.weather.channel" ||
      program.channel.key === "today.tv.fortune.channel";
  return ["Weather Report", "Fortune Teller", "El tiempo", "La adivina"].includes(program.channel);
};
const caveTypeLabel = (type: string, translate: Translate) => {
  const normalized = type.replace(/\s+/g, "").toLocaleLowerCase("en-US");
  const key = normalized === "fruitbats"
    ? "today.cave.fruitBats"
    : normalized === "mushrooms"
      ? "today.cave.mushrooms"
      : "today.cave.notSelected";
  return translate(key);
};
const birthdayWhenLabel = (when: string, translate: Translate) =>
  translate(`today.when.${when.toLocaleLowerCase("en-US")}`);
type FishingFish = {
  id: string;
  name: string;
  displayName?: string;
  difficulty: number;
  behavior: string;
  windows: number[][];
  seasons: string[];
  weather: string;
  locations: string[];
  accessibleLocations: string[];
  basePrice: number;
  minFishingLevel: number;
  caught: boolean;
};
type DisplayFishingFish = FishingFish & { displayName: string };
type FishingBrief = {
  season: string;
  day: number;
  weather: "sunny" | "rainy";
  caughtCount: number;
  fish: FishingFish[];
  note: string;
};
type BundleRequirement = {
  id: string;
  name: string;
  displayName?: string;
  count: number;
  quality: number;
  donated: boolean;
  owned: number;
  ready: boolean;
};
type BundlePlan = {
  id: string;
  name: string;
  required: number;
  donated: number;
  ready: number;
  complete: boolean;
  requirements: BundleRequirement[];
};
type CommunityRoom = {
  id: string;
  name: string;
  completed: number;
  total: number;
  reward?: { name: string; description: string };
  bundles: BundlePlan[];
};
type BuildingPlan = {
  name: string;
  category: "Robin" | "Upgrades" | "Wizard" | "Community";
  projectType: string;
  money: number;
  why: string;
  affordable: boolean;
  owned: number;
  completed: boolean;
  prerequisiteMet: boolean;
  available?: boolean;
  footprint?: string;
  prerequisite?: string;
  unlock?: string;
  materials: { name: string; displayName?: string; owned: number; needed: number }[];
};
type CropPlan = {
  id?: string;
  name: string;
  displayName?: string;
  seed: number;
  growth: number;
  regrow: number;
  sell: number;
  units: number;
  note: string;
  harvests: number;
  profitPerTile: number;
  latestPlantDay: number;
};
type FriendshipPlan = {
  id?: string;
  name: string;
  points: number;
  hearts: number;
  talkedToday: boolean;
  giftsToday: number;
  giftsThisWeek: number;
  daysToBirthday: number | null;
  gifts: { love: GiftItem[]; like: GiftItem[]; neutral: GiftItem[] };
};
type PetPlan = { name: string; type: string; points: number };
type MachineOutput = { name: string; displayName?: string; count: number };
type MachinePlan = {
  id?: string;
  name: string;
  displayName?: string;
  count: number;
  ready: number;
  working: number;
  idle?: number;
  readyOutputs?: MachineOutput[];
  workingOutputs?: MachineOutput[];
  inputs?: MachineOutput[];
  locations?: string[];
  nextReadyMinutes?: number | null;
};
type PlanningBrief = {
  communityCenter: {
    rooms: CommunityRoom[];
    completed: number;
    total: number;
    readyItems: number;
  };
  buildings: BuildingPlan[];
  crops: CropPlan[];
  friendships: FriendshipPlan[];
  pet?: PetPlan;
  machines: MachinePlan[];
  animals?: FarmAnimal[];
  inventory: StorageInventoryItem[];
};
type SpecialOrderBrief = {
  id: string;
  title: string;
  description: string;
  requester: string;
  daysLeft: number;
  duration: string;
  reward: string;
  objectives: { description: string; progress: number; target: number }[];
};
type PersonalGoal = {
  id: string;
  title: string;
  targetId?: string;
  deadline?: string;
  done: boolean;
  createdAt: string;
};
type StrategicGoalTarget = {
  id: string;
  category: string;
  title: string;
  progress: string;
  bottleneck: string;
  forecast: string;
  ready: boolean;
  requirements: {
    id?: string;
    name: string;
    available: number;
    required: number;
    suffix?: string;
    artwork?: StorageInventoryItem;
  }[];
  requirementsLabel?: string;
};
type HistoryEntry = {
  dateKey: string;
  dayIndex: number;
  season: string;
  seasonLabel: string;
  day: number;
  year: number;
  money: number;
  totalMoneyEarned: number;
  income: number;
  spending: number;
  buildings: number;
  trees: number;
  crops: number;
  progress: Progress;
  friendships?: { id?: string; name: string; points: number }[];
  petFriendship?: number;
  annotations?: LocalizedValue[];
};
type FarmHistory = { farmName: string; entries: HistoryEntry[] };
type SessionSummary = {
  profileId: string;
  capturedAt: number;
  dateKey: string;
  money: number;
  totalMoneyEarned: number;
  readyCrops: number;
  readyMachines: number;
  buildings: string[];
  friendships: Record<string, number>;
  completedBundles: number;
  completedAchievements: string[];
  activeQuests: string[];
};
type LiveAlertKind =
  | "machines"
  | "crops"
  | "birthdays"
  | "deadlines"
  | "energy"
  | "tool"
  | "bundles";
type LiveAlertSettings = Record<LiveAlertKind, boolean>;
type LiveAlert = {
  kind: LiveAlertKind;
  title: string;
  detail: string;
  tone: "urgent" | "ready" | "info";
};
type LiveInventoryItem = {
  id: string;
  name: string;
  displayName?: string;
  count: number;
  quality: number;
  spriteKind?: ItemSpriteKind;
  spriteIndex?: string;
  spriteWidth?: number;
  spriteHeight?: number;
};
type ItemArtwork = Pick<
  LiveInventoryItem,
  "id" | "name" | "spriteKind" | "spriteIndex" | "spriteWidth" | "spriteHeight"
> & { displayName?: string };
type StorageSourceDetail = {
  source: string;
  kind: "backpack" | "chest";
  name?: string;
  itemId?: string;
  color?: string | null;
  location?: string;
  x?: number | null;
  y?: number | null;
};
type StorageInventoryItem = LiveInventoryItem & {
  sources: string[];
  sourceCounts?: { source: string; count: number; quality?: number }[];
  sourceDetails?: StorageSourceDetail[];
};
type LiveStorageItem = LiveInventoryItem & {
  source?: string;
  containerKind?: "chest";
  containerName?: string;
  containerItemId?: string;
  containerColor?: string | null;
  containerLocation?: string;
  containerX?: number;
  containerY?: number;
};
const liveStorageSource = (item: LiveStorageItem) =>
  item.source || `chest:${item.containerLocation || "unknown"}:${item.containerX ?? "?"}:${item.containerY ?? "?"}`;
type LiveMachine = {
  id?: string;
  name: string;
  location: string;
  ready: boolean;
  processing: boolean;
  output?: string | null;
  input?: string | null;
  minutesUntilReady?: number;
};
type LiveFriendship = {
  id?: string;
  name: string;
  points: number;
  hearts: number;
  talkedToday: boolean;
  giftsToday: number;
  giftsThisWeek: number;
};
type LiveRouteState = {
  worldTasks: { location: string; items: { name: string; displayName?: string; count: number }[] }[];
  readyCrops: number;
  readyMachines: number;
  toolPickupReady: boolean;
};
type LiveCollections = {
  caughtFish: string[];
  bundleProgress: { id: number; donated: boolean[] }[];
  museumItems: string[];
  shipping?: CollectionRecipeItem[];
};
type LiveTerrainState = Tile & {
  kind: string;
  hasCrop: boolean;
  watered: boolean;
  ready: boolean;
};
type LiveFarmMap = {
  terrain: LiveTerrainState[];
  objects: FarmObject[];
  buildings: Building[];
};
type LiveQuest = {
  id?: number;
  accepted?: boolean;
  available?: boolean;
  daily?: boolean;
  daysLeft?: number;
  title: string;
  description?: string;
  objective?: string;
  type: string;
  requester?: string | null;
  reward?: number;
  progress?: number;
  target?: number;
  ready?: boolean;
  requestedId?: string | null;
  requestedName?: string | null;
};
type LiveState = {
  active: boolean;
  updatedAt?: string | number;
  dateKey?: string;
  timeOfDay?: number;
  season?: string;
  day?: number;
  year?: number;
  raining?: boolean;
  location?: string;
  locationId?: string;
  tileX?: number;
  tileY?: number;
  energy?: number;
  maxEnergy?: number;
  health?: number;
  maxHealth?: number;
  money?: number;
  fishingLevel?: number;
  currentTool?: string;
  boardQuest?: LiveQuest | null;
  dailyQuestCompleted?: boolean;
  acceptedQuests?: LiveQuest[];
  inventory?: LiveInventoryItem[];
  storage?: LiveStorageItem[];
  machines?: LiveMachine[];
  animals?: FarmAnimal[];
  friendships?: LiveFriendship[];
  routeState?: LiveRouteState;
  collections?: LiveCollections;
  farmMap?: LiveFarmMap;
  specialOrders?: SpecialOrderBrief[];
};

type DisplayNamedGameValue = { id?: string; name: string; displayName?: string };
type Translate = (key: string, variables?: Record<string, string | number>) => string;

const QUALIFIED_GAME_NAME_KEYS: Record<string, string> = {
  "(O)174": "gameName.largeEggWhite",
  "(O)182": "gameName.largeEggBrown",
};

const normalizedGameName = (value: string) =>
  value
    .replace(/\bL\.\s*/g, "Large ")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");

type GameNameIndex = {
  normalized: Map<string, string>;
  templates: { prefix: string; suffix: string; localized: string }[];
};
const gameNameIndexes = new WeakMap<Record<string, string>, GameNameIndex>();

function gameNameIndex(byEnglish: Record<string, string>): GameNameIndex {
  const cached = gameNameIndexes.get(byEnglish);
  if (cached) return cached;
  const normalized = new Map<string, string>();
  const templates: GameNameIndex["templates"] = [];
  for (const [englishName, localizedName] of Object.entries(byEnglish)) {
    if (localizedName === englishName) continue;
    const key = normalizedGameName(englishName);
    if (!normalized.has(key)) normalized.set(key, localizedName);
    if (englishName.includes("{0}") && localizedName.includes("{0}")) {
      const [prefix, suffix] = englishName.split("{0}", 2);
      templates.push({ prefix, suffix, localized: localizedName });
    }
  }
  const index = { normalized, templates };
  gameNameIndexes.set(byEnglish, index);
  return index;
}

function resolveGameDisplayName(
  byId: Record<string, string>,
  byEnglish: Record<string, string>,
  name: string,
  id?: string,
) {
  const qualifiedId = id && id.startsWith("(") ? id : id ? `(O)${id}` : "";
  const index = gameNameIndex(byEnglish);
  const localizeEnglishName = (candidate: string) => {
    const exact = byEnglish[candidate];
    if (exact && exact !== candidate) return exact;
    const normalized = index.normalized.get(normalizedGameName(candidate));
    if (normalized) return normalized;

    for (const { prefix, suffix, localized } of index.templates) {
      if (!candidate.startsWith(prefix) || !candidate.endsWith(suffix)) continue;
      const value = candidate.slice(prefix.length, candidate.length - suffix.length || undefined);
      if (!value) continue;
      return localized.replace("{0}", byEnglish[value] || value);
    }
    return candidate;
  };

  const identityName = qualifiedId ? byId[qualifiedId] : undefined;
  for (const candidate of [identityName, name]) {
    if (!candidate) continue;
    const localized = localizeEnglishName(candidate);
    if (localized !== candidate) return localized;
    if (candidate === name && !identityName) return localized;
  }
  if (identityName && /^Item\s+\S+$/i.test(name)) return identityName;
  return name;
}

function localizeSnapshotGameNames(
  snapshot: Snapshot,
  translate: Translate = (key, variables) => String(variables?.item ?? key),
): Snapshot {
  const byId = snapshot.localizedNamesByQualifiedId || {};
  const byEnglish = snapshot.localizedObjectNamesByEnglish || {};
  const registerIdentity = (item: { id?: string; name: string }) => {
    if (!item.id || /^Item\s+\S+$/i.test(item.name)) return;
    const qualifiedId = item.id.startsWith("(") ? item.id : `(O)${item.id}`;
    const current = byId[qualifiedId];
    if (!current || /^Item\s+\S+$/i.test(current)) byId[qualifiedId] = item.name;
  };
  for (const item of [
    ...snapshot.planningBrief.inventory,
    ...snapshot.fishingBrief.fish,
    ...(snapshot.collectionBrief?.shipping || []),
    ...(snapshot.collectionBrief?.cooking || []),
    ...(snapshot.collectionBrief?.crafting || []),
    ...snapshot.museumBrief.sources.flatMap(source => source.items || []),
  ]) registerIdentity(item);
  const localizedName = (name: string, id?: string) =>
    resolveGameDisplayName(byId, byEnglish, name, id);
  const attach = <T extends DisplayNamedGameValue>(item: T) => {
    const displayName = localizedName(item.name, item.id);
    const qualifiedId = item.id?.startsWith("(") ? item.id : item.id ? `(O)${item.id}` : "";
    const qualifiedNameKey = QUALIFIED_GAME_NAME_KEYS[qualifiedId];
    const baseDisplayName = qualifiedNameKey
      ? localizedName(item.name.replace(/\s*\((?:White|Brown)\)\s*$/i, ""))
      : displayName;
    item.displayName = qualifiedNameKey
      ? translate(qualifiedNameKey, { item: baseDisplayName })
      : displayName;
  };
  const attachGifts = (gifts: BirthdayBrief["gifts"] | FriendshipPlan["gifts"]) =>
    [...gifts.love, ...gifts.like, ...gifts.neutral].forEach(attach);

  snapshot.planningBrief.inventory.forEach(attach);
  for (const object of [
    ...snapshot.objects,
    ...snapshot.interiors.flatMap(interior => interior.objects),
  ]) {
    object.displayName = localizedName(object.name, object.id);
    if (object.output) object.output = localizedName(object.output);
    if (object.input) object.input = localizedName(object.input);
  }
  snapshot.dailyBrief.crops.forEach(attach);
  snapshot.planningBrief.crops.forEach(attach);
  snapshot.planningBrief.buildings.flatMap(building => building.materials).forEach(attach);
  snapshot.fishingBrief.fish.forEach(attach);
  snapshot.dailyBrief.world.flatMap(entry => entry.items).forEach(attach);
  snapshot.dailyBrief.beach.forEach(attach);
  snapshot.dailyBrief.fruitCave.items.forEach(attach);
  snapshot.dailyBrief.birthdays.forEach(birthday => attachGifts(birthday.gifts));
  snapshot.planningBrief.friendships.forEach(friend => attachGifts(friend.gifts));
  snapshot.planningBrief.communityCenter.rooms
    .flatMap(room => room.bundles)
    .flatMap(bundle => bundle.requirements)
    .forEach(attach);
  for (const machine of snapshot.planningBrief.machines) {
    attach(machine);
    for (const output of [
      ...(machine.readyOutputs || []),
      ...(machine.workingOutputs || []),
      ...(machine.inputs || []),
    ]) attach(output);
  }
  if (snapshot.dailyBrief.toolUpgrade) attach(snapshot.dailyBrief.toolUpgrade);
  for (const quest of [
    snapshot.dailyBrief.dailyQuest,
    ...(snapshot.dailyBrief.acceptedQuests || []),
    ...(snapshot.dailyBrief.boardQuest ? [snapshot.dailyBrief.boardQuest] : []),
  ]) {
    quest.stock.forEach(item => Object.assign(item, { displayName: localizedName(item.name) }));
    if (quest.requestedName)
      quest.requestedName = localizedName(quest.requestedName, quest.requestedId || undefined);
  }
  for (const group of [
    snapshot.collectionBrief?.shipping,
    snapshot.collectionBrief?.cooking,
    snapshot.collectionBrief?.crafting,
  ]) group?.forEach(attach);
  snapshot.museumBrief.sources.flatMap(source => source.items || []).forEach(attach);
  return snapshot;
}

const VANILLA_FRIENDSHIP_NPCS = new Set([
  "Abigail",
  "Alex",
  "Caroline",
  "Clint",
  "Demetrius",
  "Dwarf",
  "Elliott",
  "Emily",
  "Evelyn",
  "George",
  "Gus",
  "Haley",
  "Harvey",
  "Jas",
  "Jodi",
  "Kent",
  "Krobus",
  "Leah",
  "Leo",
  "Lewis",
  "Linus",
  "Marnie",
  "Maru",
  "Pam",
  "Penny",
  "Pierre",
  "Robin",
  "Sam",
  "Sandy",
  "Sebastian",
  "Shane",
  "Vincent",
  "Willy",
  "Wizard",
]);
const isVanillaFriend = (friend: { id?: string; name: string }) =>
  VANILLA_FRIENDSHIP_NPCS.has(friend.id || friend.name);

const seasonName = (season: string) =>
  ({ spring: "Spring", summer: "Summer", fall: "Fall", winter: "Winter" })[
    season
  ] || season;
const formatGameDate = (
  date: { year: number; season: string; day: number },
  t: (key: string, variables?: Record<string, string | number>) => string,
) => t("date.game", { year: date.year, season: t(`season.${date.season}`), day: date.day });
const formatHarvestDate = (value: string, t: Translate) => {
  if (value === "Today") return t("crops.today");
  const match = /^(?:Year (\d+), )?(Spring|Summer|Fall|Winter) (\d+)$/.exec(value);
  if (!match) return value;
  const season = t(`season.${match[2].toLowerCase()}`);
  return match[1]
    ? t("date.game", { year: match[1], season, day: match[3] })
    : t("date.seasonDay", { season, day: match[3] });
};
const qualifyItemId = (
  id?: string | null,
  spriteKind: ItemSpriteKind = "object",
) => {
  const value = String(id || "").trim();
  if (!value || /^\([A-Z]+\)/.test(value) || value.startsWith("-"))
    return value;
  const qualifier: Partial<Record<ItemSpriteKind, string>> = {
    object: "O",
    object2: "O",
    craftable: "BC",
    furniture: "F",
    weapon: "W",
    tool: "T",
    hat: "H",
    shirt: "S",
  };
  return qualifier[spriteKind] ? `(${qualifier[spriteKind]})${value}` : value;
};
const normalizeObjectId = (id?: string | null) => qualifyItemId(id, "object");
const inventoryItemId = (item: Pick<ItemArtwork, "id" | "spriteKind">) =>
  qualifyItemId(item.id, item.spriteKind || "object");
const defaultLiveAlertSettings: LiveAlertSettings = {
  machines: true,
  crops: true,
  birthdays: true,
  deadlines: true,
  energy: true,
  tool: true,
  bundles: true,
};

function stardewWikiUrl(name: string) {
  return `https://stardewvalleywiki.com/${encodeURIComponent(name.trim().replaceAll(" ", "_"))}`;
}

function WikiLink({ name, label }: { name: string; label?: string }) {
  const { t } = useI18n();
  return (
    <a
      className="wiki-link"
      href={stardewWikiUrl(name)}
      target="_blank"
      rel="noreferrer"
      title={t("wiki.open", { name })}
      aria-label={t("wiki.open", { name })}
    >
      ↗ {label || t("wiki.label")}
    </a>
  );
}

function sessionSummary(snapshot: Snapshot, live?: LiveState): SessionSummary {
  const liveFriends = live?.active && live.friendships?.length
    ? live.friendships
    : snapshot.planningBrief.friendships;
  const quests = live?.active && live.acceptedQuests
    ? live.acceptedQuests
    : snapshot.dailyBrief.acceptedQuests;
  return {
    profileId: snapshot.profileId || "default",
    capturedAt: Date.now(),
    dateKey: snapshot.dateKey,
    money: snapshot.money,
    totalMoneyEarned: snapshot.totalMoneyEarned,
    readyCrops: live?.active
      ? live.routeState?.readyCrops || 0
      : snapshot.dailyBrief.crops
          .filter((crop) => crop.ready)
          .reduce((sum, crop) => sum + crop.count, 0),
    readyMachines: live?.active
      ? (live.machines || []).filter((item) => item.ready).length
      : snapshot.objects.filter((item) => item.ready).length,
    buildings: snapshot.buildings.map(
      (building) => `${building.name}@${building.x},${building.y}`,
    ),
    friendships: Object.fromEntries(
      liveFriends.map((friend) => [
        friend.id || friend.name,
        friend.points,
      ]),
    ),
    completedBundles: snapshot.planningBrief.communityCenter.completed,
    completedAchievements: snapshot.achievements.items
      .filter((item) => item.done)
      .map((item) => item.id),
    activeQuests: (quests || [])
      .filter((quest) => quest.accepted)
      .map((quest) => typeof quest.title === "string" ? quest.title : quest.title.key),
  };
}
const LIVE_ROUTE_LOCATION_NAMES: Record<string, string> = {
  Farm: "Farm",
  FarmCave: "Farm Cave",
  Beach: "Beach",
  Town: "Town",
  Mountain: "Mountain",
  Forest: "Cindersap Forest",
  BusStop: "Bus Stop",
  Backwoods: "Backwoods",
};

function matchingSavedQuest(quest: LiveQuest, savedQuests: DailyQuest[]) {
  if (typeof quest.id === "number") {
    const exact = savedQuests.find((candidate) => candidate.id === quest.id);
    if (exact) return exact;
  }
  let candidates = savedQuests.filter(
    (candidate) => Boolean(candidate.daily) === Boolean(quest.daily),
  );
  if (quest.type) candidates = candidates.filter((candidate) => candidate.type === quest.type);
  if (quest.requester)
    candidates = candidates.filter((candidate) => candidate.requester === quest.requester);
  if (quest.requestedId) {
    const requestedId = normalizeObjectId(quest.requestedId);
    candidates = candidates.filter(
      (candidate) => normalizeObjectId(candidate.requestedId) === requestedId,
    );
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

function liveQuestStatus(
  quest: LiveQuest,
  live: LiveState,
  t: Translate,
  official?: DailyQuest,
): DailyQuest {
  const requestedId = normalizeObjectId(quest.requestedId);
  const matching = (live.inventory || []).filter(
    (item) => inventoryItemId(item) === requestedId,
  );
  const owned = matching.reduce((sum, item) => sum + item.count, 0);
  const target = Math.max(1, quest.target || 1);
  const checksStock = quest.type === "ItemDelivery";
  const progress = checksStock ? Math.min(target, owned) : quest.progress || 0;
  return {
    id: quest.id ?? official?.id,
    accepted: quest.accepted !== false,
    available: quest.available,
    daily: quest.daily,
    title: quest.daily && quest.requester
      ? t(`quest.dailyTitle.${quest.type || "Quest"}`, { requester: quest.requester })
      : official?.title || quest.title || t("quest.accepted"),
    description: official?.description || quest.description || "",
    objective: official?.objective || quest.objective || t("quest.completeRequest"),
    type: quest.type || t("quest.quest"),
    requester: quest.requester || null,
    reward: quest.reward || 0,
    daysLeft: quest.daysLeft || 0,
    progress,
    target,
    ready: Boolean(quest.ready) || progress >= target,
    owned,
    hasRequestedItems: checksStock && owned >= target,
    stock: matching.map((item) => ({
      name: item.name,
      count: item.count,
      sources: ["Backpack · LIVE"],
    })),
    stockNote:
      quest.type === "Fishing"
        ? t("quest.fishingStockNote")
        : null,
    tips:
      quest.type === "Fishing"
        ? [
            t("quest.fishingTip"),
          ]
        : [],
    requestedId: quest.requestedId,
    requestedName: quest.requestedName,
  };
}
type ActiveView =
  | "map"
  | "farm"
  | "growth"
  | "achievements"
  | "agenda"
  | "fishing"
  | "planning";
type UpdateState = {
  status:
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "current"
    | "unavailable"
    | "error";
  currentVersion?: string;
  version?: string;
  percent?: number;
  message?: string;
  reason?: "development" | "portable";
};

function localizedUpdateMessage(state: UpdateState, t: Translate) {
  switch (state.status) {
    case "unavailable":
      return t(state.reason === "portable" ? "updates.requiresSetup" : "updates.developmentUnavailable");
    case "checking": return t("updates.checkingDetail");
    case "available": return t("updates.availableDetail", { version: state.version || "" });
    case "current": return t("updates.currentDetail");
    case "downloading": return t("updates.downloadingDetail", { percent: state.percent || 0 });
    case "downloaded": return t("updates.downloadedDetail", { version: state.version || "" });
    case "error": return t("updates.errorDetail");
    default: return "";
  }
}
type DesktopUpdates = {
  getLocalization?: () => Promise<{
    language: "en" | "es";
    locale: string;
    messages: Record<string, string>;
    fallbackMessages: Record<string, string>;
  }>;
  getUpdateState: () => Promise<UpdateState>;
  checkForUpdates: () => Promise<UpdateState>;
  downloadUpdate: () => Promise<UpdateState>;
  installUpdate: () => Promise<{ ok: boolean }>;
  onUpdateState: (callback: (state: UpdateState) => void) => () => void;
  listFarms: () => Promise<{
    activePath: string;
    farms: FarmOption[];
  }>;
  switchFarm: (savePath: string) => Promise<{ ok: boolean; busy?: boolean }>;
  openSettings: () => Promise<{ ok: boolean }>;
  getDiagnostics: () => Promise<DesktopDiagnostics>;
  copyText: (value: string) => Promise<{ ok: boolean }>;
  exportFarm: () => Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
  setDisplayScale?: (scale: number) => Promise<{ ok: boolean; scale: number }>;
  onOpenHelp?: (callback: () => void) => () => void;
  onNavigateHistory?: (callback: (direction: "back" | "forward") => void) => () => void;
};
type AppNavigationTarget = { view: ActiveView; section?: string };
type FarmAnimal = {
  id: string;
  name: string;
  type: string;
  location: string;
  friendship: number;
  happiness: number;
  fullness: number;
  petted: boolean;
  produceQuality: number;
  currentProduce: string;
};
type DesktopDiagnostics = {
  version: string;
  packaged: boolean;
  development?: boolean;
  osVersion?: string;
  architecture?: string;
  profileId: string;
  gameFound: boolean;
  saveFound: boolean;
  smapiFound: boolean;
  bridgeInstalled: boolean;
  bridgeManifestFound?: boolean;
  bridgeVersion?: string | null;
  bridgeDllFound?: boolean;
  gameRunning?: boolean;
  liveStateFound?: boolean;
  liveStateFresh?: boolean;
  liveStateAgeSeconds?: number | null;
};
type FarmOption = {
  name: string;
  farmer: string;
  avatar?: string;
  gameDate?: string;
  gameSeason?: string;
  gameDay?: number;
  gameYear?: number;
  path: string;
  modifiedAt: number;
  liveUpdatedAt?: number;
};

type FeedbackKind = "bug" | "suggestion";

function feedbackIssueUrl(
  kind: FeedbackKind,
  diagnostics: DesktopDiagnostics | null,
  live: LiveState,
  activeView: ActiveView,
  fallbackVersion?: string,
) {
  const version = diagnostics?.version || fallbackVersion || "development";
  const environment = [
    `- App version: ${version}`,
    `- Build: ${diagnostics?.packaged ? "Installed" : "Development"}`,
    `- Windows version: ${diagnostics?.osVersion || "Not available"}`,
    `- Architecture: ${diagnostics?.architecture || "Not available"}`,
    `- Current section: ${activeView}`,
    `- Game installation: ${diagnostics?.gameFound ? "Found" : "Not detected"}`,
    `- Selected save: ${diagnostics?.saveFound ? "Found" : "Not detected"}`,
    `- SMAPI: ${diagnostics?.smapiFound ? "Found" : "Not detected"}`,
    `- LIVE bridge: ${diagnostics?.bridgeInstalled ? "Installed" : "Not detected"}`,
    `- Bridge DLL: ${diagnostics?.bridgeDllFound ? "Found" : "Not detected"}`,
    `- Game process: ${diagnostics?.gameRunning ? "Running" : "Not running"}`,
    `- LIVE output file: ${diagnostics?.liveStateFound ? diagnostics.liveStateFresh ? "Fresh" : "Stale" : "Not created"}`,
    `- LIVE connection: ${live.active ? "Connected" : "Offline"}`,
  ].join("\n");
  const body = kind === "bug"
    ? `## What happened?\n<!-- Briefly describe the problem. -->\n\n\n## What did you expect?\n<!-- What should have happened instead? -->\n\n\n## Steps to reproduce\n1. \n2. \n3. \n\n## Screenshot or error message\n<!-- Drag screenshots here and remove any private information first. -->\n\n\n## Automatic diagnostics\n<!-- Generated by the app. Review this section before submitting. No paths, usernames, or save contents are included. -->\n${environment}`
    : `## What would you like to improve?\n<!-- Describe the feature or change. -->\n\n\n## Why would it be useful?\n<!-- Explain the problem this would solve. -->\n\n\n## Suggested behavior\n<!-- What should the app do? Examples are welcome. -->\n\n\n## Alternatives considered\n<!-- Optional: how do you handle this today? -->\n\n\n## Automatic context\n<!-- Generated by the app. Review this section before submitting. No paths, usernames, or save contents are included. -->\n${environment}`;
  const params = new URLSearchParams({
    title: kind === "bug" ? "[Bug] " : "[Suggestion] ",
    labels: kind === "bug" ? "bug" : "enhancement",
    body,
  });
  return `https://github.com/Maglucen-Studio/StardewValleyTool/issues/new?${params.toString()}`;
}

function summarizeReadyMachines(items: FarmObject[]) {
  const grouped = new Map<string, number>();
  for (const item of items) {
    const label = item.output || item.name;
    grouped.set(label, (grouped.get(label) || 0) + 1);
  }
  return [...grouped].map(([label, count]) => `${count}× ${label}`).join(" · ");
}

function readyBundleDeliveries(community: { rooms: CommunityRoom[] }) {
  return community.rooms.flatMap((room) =>
    room.bundles.flatMap((bundle) =>
      bundle.requirements
        .filter((item) => item.ready && !item.donated)
        .map((item) => ({
          ...item,
          room: room.name,
          roomId: room.id,
          bundle: bundle.name,
          bundleId: bundle.id,
        })),
    ),
  );
}

function liveReadyBundleDeliveries(
  community: { rooms: CommunityRoom[] },
  live: LiveState,
) {
  if (!live.active) return readyBundleDeliveries(community);
  const donatedByBundle = new Map(
    (live.collections?.bundleProgress || []).map((bundle) => [
      String(bundle.id),
      bundle.donated,
    ]),
  );
  const owned = new Map<string, number>();
  for (const item of [...(live.inventory || []), ...(live.storage || [])]) {
    const id = inventoryItemId(item);
    owned.set(id, (owned.get(id) || 0) + item.count);
  }
  return community.rooms.flatMap((room) =>
    room.bundles.flatMap((bundle) => {
      const donated = donatedByBundle.get(String(bundle.id));
      return bundle.requirements.flatMap((item, index) => {
        const isDonated = donated?.[index] ?? item.donated;
        const liveOwned = owned.get(normalizeObjectId(item.id)) || 0;
        return !isDonated && liveOwned >= item.count
          ? [
              {
                ...item,
                owned: liveOwned,
                ready: true,
                room: room.name,
                roomId: room.id,
                bundle: bundle.name,
                bundleId: bundle.id,
              },
            ]
          : [];
      });
    }),
  );
}

function summarizeReadyLiveMachines(items: LiveMachine[]) {
  const grouped = new Map<string, number>();
  for (const item of items) {
    const label = item.output || item.name;
    grouped.set(label, (grouped.get(label) || 0) + 1);
  }
  return [...grouped].map(([label, count]) => `${count}× ${label}`).join(" · ");
}

function summarizeLiveMachines(
  items: LiveMachine[],
  savedMachines: MachinePlan[] = [],
): MachinePlan[] {
  const grouped = new Map<string, MachinePlan>();
  const addOutput = (list: MachineOutput[] | undefined, name: string) => {
    const outputs = list || [];
    const existing = outputs.find((item) => item.name === name);
    if (existing) existing.count += 1;
    else outputs.push({ name, count: 1 });
    return outputs;
  };
  for (const item of items) {
    const savedId = savedMachines.find(
      (machine) => machine.name === item.name,
    )?.id;
    const machine = grouped.get(item.name) || {
      id: item.id || savedId,
      name: item.name,
      count: 0,
      ready: 0,
      working: 0,
      idle: 0,
      readyOutputs: [],
      workingOutputs: [],
      inputs: [],
      locations: [],
      nextReadyMinutes: null,
    };
    machine.count += 1;
    machine.ready += item.ready ? 1 : 0;
    machine.working += item.processing && !item.ready ? 1 : 0;
    machine.idle =
      (machine.idle || 0) + (!item.ready && !item.processing ? 1 : 0);
    if (!machine.locations!.includes(item.location))
      machine.locations!.push(item.location);
    if (item.output && item.ready)
      machine.readyOutputs = addOutput(machine.readyOutputs, item.output);
    else if (item.output && item.processing)
      machine.workingOutputs = addOutput(machine.workingOutputs, item.output);
    if (item.input && item.processing)
      machine.inputs = addOutput(machine.inputs, item.input);
    if (item.processing && (item.minutesUntilReady || 0) > 0)
      machine.nextReadyMinutes =
        machine.nextReadyMinutes === null
          ? item.minutesUntilReady!
          : Math.min(machine.nextReadyMinutes!, item.minutesUntilReady!);
    grouped.set(item.name, machine);
  }
  return [...grouped.values()].sort(
    (a, b) =>
      b.ready - a.ready ||
      (b.idle || 0) - (a.idle || 0) ||
      a.name.localeCompare(b.name),
  );
}

function formatMachineDuration(minutes?: number | null) {
  if (!minutes) return null;
  if (minutes >= 1440) return `${Math.ceil(minutes / 1440)} in-game days`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours
    ? `${hours}h${remainder ? ` ${remainder}m` : ""}`
    : `${remainder}m`;
}

const TILE = 16;
type ItemSpriteKind =
  | "object"
  | "object2"
  | "craftable"
  | "furniture"
  | "weapon"
  | "tool"
  | "hat"
  | "shirt"
  | "fallback";
const spritePaths: Record<string, string> = {
  objects: "/assets/sprites/springobjects.png",
  objects2: "/assets/sprites/Objects_2.png",
  craftables: "/assets/sprites/Craftables.png",
  furniture: "/assets/sprites/furniture.png",
  weapons: "/assets/sprites/weapons.png",
  tools: "/assets/sprites/tools.png",
  hats: "/assets/sprites/hats.png",
  shirts: "/assets/sprites/shirts.png",
  crops: "/assets/sprites/crops.png",
  grass: "/assets/sprites/grass.png",
  hoeDirt: "/assets/sprites/hoeDirt.png",
  Oak: "/assets/sprites/tree1_spring.png",
  Maple: "/assets/sprites/tree2_spring.png",
  Pine: "/assets/sprites/tree3_spring.png",
  Mahogany: "/assets/sprites/tree8_spring.png",
  fruitTrees: "/assets/sprites/fruitTrees.png",
  Farmhouse: "/assets/sprites/houses.png",
  Greenhouse: "/assets/sprites/Greenhouse.png",
  "Shipping Bin": "/assets/sprites/Shipping Bin.png",
  "Pet Bowl": "/assets/sprites/Pet Bowl.png",
  Silo: "/assets/sprites/Silo.png",
  Coop: "/assets/sprites/Coop.png",
  "Big Coop": "/assets/sprites/Big Coop.png",
  "Deluxe Coop": "/assets/sprites/Deluxe Coop.png",
  Barn: "/assets/sprites/Barn.png",
  "Big Barn": "/assets/sprites/Big Barn.png",
  "Deluxe Barn": "/assets/sprites/Deluxe Barn.png",
  Stable: "/assets/sprites/Stable.png",
  Shed: "/assets/sprites/Shed.png",
  "Big Shed": "/assets/sprites/Big Shed.png",
  "Fish Pond": "/assets/sprites/Fish Pond.png",
  "Slime Hutch": "/assets/sprites/Slime Hutch.png",
  Well: "/assets/sprites/Well.png",
  Mill: "/assets/sprites/Mill.png",
  "Junimo Hut": "/assets/sprites/Junimo Hut.png",
  "Earth Obelisk": "/assets/sprites/Earth Obelisk.png",
  "Water Obelisk": "/assets/sprites/Water Obelisk.png",
  "Desert Obelisk": "/assets/sprites/Desert Obelisk.png",
  "Island Obelisk": "/assets/sprites/Island Obelisk.png",
  "Gold Clock": "/assets/sprites/Gold Clock.png",
  "Log Cabin": "/assets/sprites/Log Cabin.png",
};
const ItemArtworkCatalogContext = createContext<Record<string, ItemArtwork>>({});
const itemArtworkKey = (name: string) =>
  name.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
const tools = [
  { id: "inspect", label: "Inspect", width: 1, height: 1 },
  { id: "marker", label: "Marker", width: 1, height: 1 },
  { id: "well", label: "Well", width: 3, height: 3 },
  { id: "silo", label: "Silo", width: 3, height: 3 },
  { id: "coop", label: "Coop", width: 6, height: 3 },
  { id: "barn", label: "Barn", width: 7, height: 4 },
  { id: "stable", label: "Stable", width: 4, height: 2 },
  { id: "shed", label: "Shed", width: 7, height: 3 },
  { id: "fishpond", label: "Fish Pond", width: 5, height: 5 },
  { id: "slimehutch", label: "Slime Hutch", width: 7, height: 4 },
  { id: "mill", label: "Mill", width: 4, height: 2 },
];
const commonCraftingGoals = [
  { name: "Quality Sprinkler", materials: { "Iron Bar": 1, "Gold Bar": 1, "Refined Quartz": 1 } },
  { name: "Iridium Sprinkler", materials: { "Gold Bar": 1, "Iridium Bar": 1, "Battery Pack": 1 } },
  { name: "Keg", materials: { Wood: 30, "Copper Bar": 1, "Iron Bar": 1, "Oak Resin": 1 } },
  { name: "Preserves Jar", materials: { Wood: 50, Stone: 40, Coal: 8 } },
  { name: "Mayonnaise Machine", materials: { Wood: 15, Stone: 15, "Earth Crystal": 1, "Copper Bar": 1 } },
  { name: "Cheese Press", materials: { Wood: 45, Stone: 45, Hardwood: 10, "Copper Bar": 1 } },
  { name: "Loom", materials: { Wood: 60, Fiber: 30, "Pine Tar": 1 } },
  { name: "Oil Maker", materials: { Slime: 50, Hardwood: 20, "Gold Bar": 1 } },
  { name: "Cask", materials: { Wood: 20, Hardwood: 1 } },
  { name: "Crystalarium", materials: { Stone: 99, "Gold Bar": 5, "Iridium Bar": 2, "Battery Pack": 1 } },
  { name: "Seed Maker", materials: { Wood: 25, Coal: 10, "Gold Bar": 1 } },
  { name: "Lightning Rod", materials: { "Iron Bar": 1, "Refined Quartz": 1, "Bat Wing": 5 } },
  { name: "Bee House", materials: { Wood: 40, Coal: 8, "Iron Bar": 1, "Maple Syrup": 1 } },
] as const;

function tileKey(x: number, y: number) {
  return `${x},${y}`;
}

function buildingType(item: Pick<Building, "name"> & { kind?: string }) {
  const value = `${item.kind || ""} ${item.name}`.toLowerCase();
  if (value.includes("deluxe coop")) return "deluxecoop";
  if (value.includes("big coop")) return "bigcoop";
  if (value.includes("deluxe barn")) return "deluxebarn";
  if (value.includes("big barn")) return "bigbarn";
  if (value.includes("big shed")) return "bigshed";
  if (value.includes("junimo hut")) return "junimohut";
  if (value.includes("earth obelisk")) return "earthobelisk";
  if (value.includes("water obelisk")) return "waterobelisk";
  if (value.includes("desert obelisk")) return "desertobelisk";
  if (value.includes("island obelisk")) return "islandobelisk";
  if (value.includes("gold clock")) return "goldclock";
  if (value.includes("farmhouse upgrade")) return "farmhouse";
  if (value.includes("cabin")) return "cabin";
  if (value.includes("silo")) return "silo";
  if (value.includes("coop")) return "coop";
  if (value.includes("barn")) return "barn";
  if (value.includes("stable")) return "stable";
  if (value.includes("fish pond") || value.includes("fishpond"))
    return "fishpond";
  if (value.includes("slime hutch") || value.includes("slimehutch"))
    return "slimehutch";
  if (value.includes("shed")) return "shed";
  if (value.includes("well")) return "well";
  if (value.includes("mill")) return "mill";
  return value.trim();
}

const buildingSpriteDefinitions: Record<
  string,
  { image: string; source: [number, number, number, number]; offsetX?: number }
> = {
  farmhouse: { image: "Farmhouse", source: [0, 0, 160, 144], offsetX: -16 },
  greenhouse: { image: "Greenhouse", source: [0, 0, 112, 160] },
  "shipping bin": { image: "Shipping Bin", source: [0, 0, 32, 32] },
  "pet bowl": { image: "Pet Bowl", source: [0, 0, 32, 32] },
  silo: { image: "Silo", source: [0, 0, 48, 128] },
  coop: { image: "Coop", source: [0, 0, 96, 128] },
  bigcoop: { image: "Big Coop", source: [0, 0, 96, 128] },
  deluxecoop: { image: "Deluxe Coop", source: [0, 0, 96, 128] },
  barn: { image: "Barn", source: [0, 0, 112, 128] },
  bigbarn: { image: "Big Barn", source: [0, 0, 112, 128] },
  deluxebarn: { image: "Deluxe Barn", source: [0, 0, 112, 128] },
  stable: { image: "Stable", source: [0, 0, 64, 96] },
  shed: { image: "Shed", source: [0, 0, 112, 128] },
  bigshed: { image: "Big Shed", source: [0, 0, 112, 128] },
  fishpond: { image: "Fish Pond", source: [0, 0, 80, 80] },
  slimehutch: { image: "Slime Hutch", source: [0, 0, 112, 112] },
  well: { image: "Well", source: [0, 0, 48, 80] },
  mill: { image: "Mill", source: [0, 0, 64, 112] },
  junimohut: { image: "Junimo Hut", source: [0, 0, 64, 64] },
  earthobelisk: { image: "Earth Obelisk", source: [0, 0, 48, 128] },
  waterobelisk: { image: "Water Obelisk", source: [0, 0, 48, 128] },
  desertobelisk: { image: "Desert Obelisk", source: [0, 0, 48, 128] },
  islandobelisk: { image: "Island Obelisk", source: [0, 0, 48, 128] },
  goldclock: { image: "Gold Clock", source: [0, 0, 48, 80] },
  cabin: { image: "Log Cabin", source: [0, 0, 80, 112] },
};

function buildingSignature(building: Building) {
  return `${buildingType(building)}:${building.x}:${building.y}:${building.width}:${building.height}`;
}

function reconcileProposals(
  proposals: Suggestion[],
  buildings: Building[],
  proposalLinks: Record<string, string> = {},
  proposalResolutions: Record<string, "resolved"> = {},
): ProposalState[] {
  const seen = new Set<string>();
  return proposals
    .filter((proposal) => {
      const signature = `${buildingType(proposal)}:${proposal.x}:${proposal.y}:${proposal.width}:${proposal.height}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .map((proposal) => {
      const exact = buildings.find(
        (building) =>
          buildingType(building) === buildingType(proposal) &&
          building.x === proposal.x &&
          building.y === proposal.y &&
          building.width === proposal.width &&
          building.height === proposal.height,
      );
      const manual = proposalLinks[proposal.id]
        ? buildings.find(
            (building) =>
              buildingSignature(building) === proposalLinks[proposal.id] &&
              buildingType(building) === buildingType(proposal),
          )
        : undefined;
      const actual = exact || manual;
      if (!actual)
        return {
          ...proposal,
          status: proposalResolutions[proposal.id] || "pending",
        };
      return {
        ...proposal,
        actual,
        matchedBy: exact ? "position" : "manual",
        status:
          actual.daysOfConstructionLeft || actual.daysUntilUpgrade
            ? "building"
            : "completed",
      };
    });
}

function sprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  source: [number, number, number, number],
  destination: [number, number, number?, number?],
  flip = false,
) {
  if (!image) return;
  const [sx, sy, sw, sh] = source;
  const [dx, dy, dw = sw, dh = sh] = destination;
  ctx.save();
  if (flip) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
  } else {
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  ctx.restore();
}

function cropSpriteSource(
  row: number,
  phase: number,
): [number, number, number, number] {
  const safeRow = Math.max(0, row);
  const safePhase = Math.max(0, Math.min(7, phase));
  return [
    (safeRow % 2) * 128 + safePhase * TILE,
    Math.floor(safeRow / 2) * 32,
    TILE,
    32,
  ];
}

function drawBuildingSprite(
  ctx: CanvasRenderingContext2D,
  sprites: Record<string, HTMLImageElement>,
  building: Pick<Building, "name" | "x" | "y" | "width" | "height"> & {
    kind?: string;
  },
) {
  const definition = buildingSpriteDefinitions[buildingType(building)];
  const image = definition && sprites[definition.image];
  if (!definition || !image) return false;
  const [, , width, height] = definition.source;
  const rise = Math.max(0, height - building.height * TILE);
  sprite(ctx, image, definition.source, [
    building.x * TILE + (definition.offsetX || 0),
    building.y * TILE - rise,
    width,
    height,
  ]);
  return true;
}

export default function Home() {
  const { t, text, locale } = useI18n();
  const appShellRef = useRef<HTMLElement>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const [progressTabsTop, setProgressTabsTop] = useState(82);
  const [initialMapPreferences] = useState<Record<string, unknown>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(
        window.localStorage.getItem("stardew-tool-map-preferences") ||
          window.localStorage.getItem("aincrad-map-preferences") ||
          "{}",
      );
    } catch {
      return {};
    }
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const hasCenteredFarmRef = useRef(false);
  const [data, setData] = useState<Snapshot | null>(null);
  const [previousDay, setPreviousDay] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<FarmHistory>({
    farmName: "Farm",
    entries: [],
  });
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window === "undefined") return "map";
    const saved =
      window.localStorage.getItem("stardew-tool-active-view") ||
      window.localStorage.getItem("aincrad-active-view");
    return saved === "map" ||
      saved === "growth" ||
      saved === "achievements" ||
      saved === "farm" ||
      saved === "agenda" ||
      saved === "fishing" ||
      saved === "planning"
      ? saved
      : "map";
  });
  const [showDailyBrief, setShowDailyBrief] = useState(false);
  const [showLiveAlerts, setShowLiveAlerts] = useState(false);
  const [sessionBaseline, setSessionBaseline] = useState<SessionSummary | null>(null);
  const sessionProfileRef = useRef("");
  const [liveAlertSettings, setLiveAlertSettings] = useState<LiveAlertSettings>(() => {
    if (typeof window === "undefined") return defaultLiveAlertSettings;
    try {
      return {
        ...defaultLiveAlertSettings,
        ...JSON.parse(window.localStorage.getItem("stardew-tool-live-alerts") || "{}"),
      };
    } catch {
      return defaultLiveAlertSettings;
    }
  });
  const activeViewRef = useRef(activeView);
  const navigationBackRef = useRef<AppNavigationTarget[]>([]);
  const navigationForwardRef = useRef<AppNavigationTarget[]>([]);
  const lastHardwareNavigationRef = useRef({ direction: "", at: 0 });
  const [navigationAvailability, setNavigationAvailability] = useState({ back: false, forward: false });
  const [showLivePanel, setShowLivePanel] = useState(false);
  const livePanelCloseTimer = useRef<number | null>(null);
  const [showFarmSwitcher, setShowFarmSwitcher] = useState(false);
  const farmSwitcherRef = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showAppSearch, setShowAppSearch] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const appSearchInputRef = useRef<HTMLInputElement>(null);
  const [locatedItemName, setLocatedItemName] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DesktopDiagnostics | null>(null);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const [farmOptions, setFarmOptions] = useState<FarmOption[]>([]);
  const [activeSavePath, setActiveSavePath] = useState("");
  const [switchingFarm, setSwitchingFarm] = useState("");
  const currentNavigationTarget = useCallback((): AppNavigationTarget => {
    const view = activeViewRef.current;
    if (view === "farm")
      return { view, section: window.localStorage.getItem("stardew-tool-farm-section") || "crops" };
    if (view === "planning")
      return { view, section: window.localStorage.getItem("stardew-tool-plan-section") || "community" };
    return { view };
  }, []);
  const applyNavigationTarget = useCallback((target: AppNavigationTarget) => {
    activeViewRef.current = target.view;
    if (target.view === "growth" || target.view === "achievements")
      window.localStorage.setItem("stardew-tool-progress-section", target.view);
    if ((target.view === "farm" || target.view === "planning") && target.section) {
      const mode = target.view === "farm" ? "farm" : "plan";
      window.localStorage.setItem(`stardew-tool-${mode}-section`, target.section);
      window.dispatchEvent(new CustomEvent("stardew:open-planning-section", {
        detail: { mode, section: target.section },
      }));
    }
    setActiveView(target.view);
  }, []);
  const navigateTo = useCallback((target: AppNavigationTarget) => {
    const current = currentNavigationTarget();
    if (current.view === target.view && current.section === target.section) return;
    navigationBackRef.current.push(current);
    navigationForwardRef.current = [];
    applyNavigationTarget(target);
    setNavigationAvailability({ back: true, forward: false });
  }, [applyNavigationTarget, currentNavigationTarget]);
  const navigateHistory = useCallback((direction: "back" | "forward") => {
    const source = direction === "back" ? navigationBackRef : navigationForwardRef;
    const destination = direction === "back" ? navigationForwardRef : navigationBackRef;
    const target = source.current.pop();
    if (!target) return;
    destination.current.push(currentNavigationTarget());
    applyNavigationTarget(target);
    setNavigationAvailability({
      back: navigationBackRef.current.length > 0,
      forward: navigationForwardRef.current.length > 0,
    });
  }, [applyNavigationTarget, currentNavigationTarget]);
  const navigateHardwareHistory = useCallback((direction: "back" | "forward") => {
    const now = performance.now();
    const previous = lastHardwareNavigationRef.current;
    if (previous.direction === direction && now - previous.at < 120) return;
    lastHardwareNavigationRef.current = { direction, at: now };
    navigateHistory(direction);
  }, [navigateHistory]);
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: "idle",
  });
  const updateFeedbackMessage =
    localizedUpdateMessage(updateState, t) || updateState.message || "";
  const [layersCollapsed, setLayersCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("stardew-tool-layers-collapsed") === "true",
  );
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 230;
    return Math.max(180, Math.min(420, Number(window.localStorage.getItem("stardew-tool-left-panel-width")) || 230));
  });
  useEffect(() => {
    if (!showAppSearch) return;
    const frame = window.requestAnimationFrame(() => appSearchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [showAppSearch]);

  useEffect(() => {
    const topbar = topbarRef.current;
    if (!topbar) return;
    const update = () => setProgressTabsTop(topbar.offsetHeight + 14);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(topbar);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [data]);
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 230;
    return Math.max(180, Math.min(420, Number(window.localStorage.getItem("stardew-tool-right-panel-width")) || 230));
  });
  const [uiScale, setUiScale] = useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = Number(window.localStorage.getItem("stardew-tool-ui-scale"));
    if ([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(saved)) return saved;
    if (window.innerWidth >= 3000) return 1.5;
    if (window.innerWidth >= 2200) return 1.25;
    return 1;
  });

  useEffect(() => {
    window.localStorage.setItem("stardew-tool-active-view", activeView);
  }, [activeView]);

  useEffect(() => {
    window.localStorage.setItem(
      "stardew-tool-live-alerts",
      JSON.stringify(liveAlertSettings),
    );
  }, [liveAlertSettings]);

  const openLivePanel = () => {
    if (livePanelCloseTimer.current !== null)
      window.clearTimeout(livePanelCloseTimer.current);
    livePanelCloseTimer.current = null;
    setShowLivePanel(true);
  };
  const closeLivePanelSoon = () => {
    if (livePanelCloseTimer.current !== null)
      window.clearTimeout(livePanelCloseTimer.current);
    livePanelCloseTimer.current = window.setTimeout(() => {
      setShowLivePanel(false);
      livePanelCloseTimer.current = null;
    }, 140);
  };
  useEffect(
    () => () => {
      if (livePanelCloseTimer.current !== null)
        window.clearTimeout(livePanelCloseTimer.current);
    },
    [],
  );

  useEffect(() => {
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates })
      .stardewDesktop;
    if (!desktop?.getUpdateState) return;
    desktop
      .getUpdateState()
      .then(setUpdateState)
      .catch(() => undefined);
    return desktop.onUpdateState(setUpdateState);
  }, []);

  useEffect(() => {
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates })
      .stardewDesktop;
    if (!desktop?.listFarms) return;
    desktop
      .listFarms()
      .then(({ farms, activePath }) => {
        setFarmOptions(farms);
        setActiveSavePath(activePath);
      })
      .catch(() => undefined);
  }, []);

  const switchFarm = async (farm: FarmOption) => {
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates })
      .stardewDesktop;
    if (!desktop || farm.path === activeSavePath) {
      setShowFarmSwitcher(false);
      return;
    }
    setSwitchingFarm(farm.path);
    setShowFarmSwitcher(false);
    try {
      const result = await desktop.switchFarm(farm.path);
      if (!result.ok) throw new Error(t("shell.farmSwitchBusy"));
      setActiveSavePath(farm.path);
    } catch (error) {
      setDataLoadError(
        error instanceof Error ? error.message : t("shell.farmSwitchFailed"),
      );
    } finally {
      setSwitchingFarm("");
    }
  };

  const openHelp = useCallback(() => {
    setShowHelp(true);
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates })
      .stardewDesktop;
    desktop?.getDiagnostics?.().then(setDiagnostics).catch(() => undefined);
  }, []);

  useEffect(() => {
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates })
      .stardewDesktop;
    return desktop?.onOpenHelp?.(openHelp);
  }, [openHelp]);

  useEffect(() => {
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates })
      .stardewDesktop;
    return desktop?.onNavigateHistory?.(navigateHardwareHistory);
  }, [navigateHardwareHistory]);

  useEffect(() => {
    const mouseHistoryShortcut = (event: MouseEvent) => {
      if (event.button !== 3 && event.button !== 4) return;
      event.preventDefault();
      navigateHardwareHistory(event.button === 3 ? "back" : "forward");
    };
    const preventNativeHistory = (event: MouseEvent) => {
      if (event.button === 3 || event.button === 4) event.preventDefault();
    };
    window.addEventListener("mousedown", mouseHistoryShortcut, true);
    window.addEventListener("auxclick", preventNativeHistory, true);
    return () => {
      window.removeEventListener("mousedown", mouseHistoryShortcut, true);
      window.removeEventListener("auxclick", preventNativeHistory, true);
    };
  }, [navigateHardwareHistory]);

  useEffect(() => {
    const historyShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      navigateHistory(event.key === "ArrowLeft" ? "back" : "forward");
    };
    window.addEventListener("keydown", historyShortcut);
    return () => window.removeEventListener("keydown", historyShortcut);
  }, [navigateHistory]);

  useEffect(() => {
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates })
      .stardewDesktop;
    desktop?.getDiagnostics?.().then(setDiagnostics).catch(() => undefined);
  }, []);

  useEffect(() => {
    document.title = diagnostics?.development
      ? `Maglucen Companion Development · v${APPLICATION_VERSION}`
      : `Maglucen Stardew Valley Companion · v${APPLICATION_VERSION}`;
  }, [diagnostics?.development]);

  useEffect(() => {
    const locate = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, a, summary, input, select, textarea, [role='button']")) {
        return;
      }
      const card = target?.closest<HTMLElement>(
        "[data-storage-item]",
      );
      const name = card?.dataset.storageItem;
      if (!name) return;
      event.preventDefault();
      setLocatedItemName(name);
    };
    document.addEventListener("click", locate);
    return () => document.removeEventListener("click", locate);
  }, []);

  useEffect(() => {
    const search = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setShowAppSearch(true);
      }
    };
    window.addEventListener("keydown", search);
    return () => window.removeEventListener("keydown", search);
  }, []);

  useEffect(() => {
    const closePopup = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showLiveAlerts) {
        setShowLiveAlerts(false);
      } else if (showAppSearch) {
        setShowAppSearch(false);
        setAppSearchQuery("");
      } else if (showHelp) {
        setShowHelp(false);
      } else if (locatedItemName) {
        setLocatedItemName(null);
      } else if (showDailyBrief) {
        setShowDailyBrief(false);
      } else if (showFarmSwitcher) {
        setShowFarmSwitcher(false);
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", closePopup);
    return () => window.removeEventListener("keydown", closePopup);
  }, [locatedItemName, showAppSearch, showDailyBrief, showFarmSwitcher, showHelp, showLiveAlerts]);

  useEffect(() => {
    const openSection = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, select, textarea, [contenteditable='true']") ||
        showHelp ||
        showLiveAlerts ||
        showAppSearch ||
        showDailyBrief ||
        locatedItemName
      ) return;
      const viewByKey: Record<string, ActiveView> = {
        "1": "agenda",
        "2": "map",
        "3": "farm",
        "4": "fishing",
        "5": "planning",
        "6": window.localStorage.getItem("stardew-tool-progress-section") === "achievements"
          ? "achievements"
          : "growth",
      };
      const nextView = viewByKey[event.key];
      if (!nextView) return;
      event.preventDefault();
      navigateTo({
        view: nextView,
        section: nextView === "farm"
          ? window.localStorage.getItem("stardew-tool-farm-section") || "crops"
          : nextView === "planning"
            ? window.localStorage.getItem("stardew-tool-plan-section") || "community"
            : undefined,
      });
    };
    window.addEventListener("keydown", openSection);
    return () => window.removeEventListener("keydown", openSection);
  }, [locatedItemName, navigateTo, showAppSearch, showDailyBrief, showHelp, showLiveAlerts]);

  useEffect(() => {
    if (!["current", "unavailable", "error"].includes(updateState.status))
      return;
    const status = updateState.status;
    const timer = window.setTimeout(
      () =>
        setUpdateState((state) =>
          state.status === status
            ? { status: "idle", currentVersion: state.currentVersion }
            : state,
        ),
      status === "error" ? 10000 : 6500,
    );
    return () => window.clearTimeout(timer);
  }, [updateState.status, updateState.message]);

  const updateAction = async () => {
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates })
      .stardewDesktop;
    if (!desktop) {
      setUpdateState({
        status: "unavailable",
        message: t("update.desktopOnly"),
      });
      return;
    }
    try {
      if (updateState.status === "available") {
        setUpdateState((state) => ({
          ...state,
          status: "downloading",
          percent: 0,
          message: t("update.startingDownload"),
        }));
        setUpdateState(await desktop.downloadUpdate());
      } else if (updateState.status === "downloaded") {
        setUpdateState((state) => ({
          ...state,
          message: t("update.closingToInstall"),
        }));
        await desktop.installUpdate();
      } else {
        setUpdateState((state) => ({
          ...state,
          status: "checking",
          message: t("update.checking"),
        }));
        setUpdateState(await desktop.checkForUpdates());
      }
    } catch {
      setUpdateState((state) => ({
        ...state,
        status: "error",
        message: t("update.failed"),
      }));
    }
  };

  useEffect(() => {
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates })
      .stardewDesktop;
    if (desktop?.setDisplayScale) {
      document.documentElement.style.zoom = "";
      desktop.setDisplayScale(uiScale).catch(() => undefined);
    } else {
      document.documentElement.style.zoom = String(uiScale);
    }
    window.localStorage.setItem("stardew-tool-ui-scale", String(uiScale));
  }, [uiScale]);

  useEffect(() => {
    appShellRef.current?.scrollTo({ top: 0 });
  }, [activeView]);

  useEffect(() => {
    const closeFarmSwitcher = (event: PointerEvent) => {
      if (
        showFarmSwitcher &&
        !farmSwitcherRef.current?.contains(event.target as Node)
      )
        setShowFarmSwitcher(false);
    };
    document.addEventListener("pointerdown", closeFarmSwitcher);
    return () => {
      document.removeEventListener("pointerdown", closeFarmSwitcher);
    };
  }, [showFarmSwitcher]);

  useEffect(() => {
    const scales = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const resizeInterface = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setUiScale((current) => {
        const index = Math.max(0, scales.indexOf(current));
        const next = index + (event.deltaY < 0 ? 1 : -1);
        return scales[Math.max(0, Math.min(scales.length - 1, next))];
      });
    };
    window.addEventListener("wheel", resizeInterface, { passive: false });
    return () => window.removeEventListener("wheel", resizeInterface);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "stardew-tool-layers-collapsed",
      String(layersCollapsed),
    );
  }, [layersCollapsed]);
  useEffect(() => {
    window.localStorage.setItem("stardew-tool-left-panel-width", String(leftPanelWidth));
  }, [leftPanelWidth]);
  useEffect(() => {
    window.localStorage.setItem("stardew-tool-right-panel-width", String(rightPanelWidth));
  }, [rightPanelWidth]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [live, setLive] = useState<LiveState>({ active: false });
  const [base, setBase] = useState<HTMLImageElement | null>(null);
  const [sprites, setSprites] = useState<Record<string, HTMLImageElement>>({});
  const [assetError, setAssetError] = useState("");
  const [dataLoadError, setDataLoadError] = useState("");
  const [zoom, setZoom] = useState(() =>
    typeof initialMapPreferences.zoom === "number"
      ? Math.max(0.65, Math.min(2.1, initialMapPreferences.zoom))
      : 1,
  );
  const [hover, setHover] = useState<Tile | null>(null);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [tool, setTool] = useState("inspect");
  const [proposalEditMode, setProposalEditMode] = useState(false);
  const [movingProposalId, setMovingProposalId] = useState<string | null>(null);
  const [proposalMenu, setProposalMenu] = useState<{
    id: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const [proposalUndo, setProposalUndo] = useState<Suggestion[] | null>(null);
  const [showGrid, setShowGrid] = useState(() =>
    typeof initialMapPreferences.showGrid === "boolean"
      ? initialMapPreferences.showGrid
      : false,
  );
  const [showState, setShowState] = useState(() =>
    typeof initialMapPreferences.showState === "boolean"
      ? initialMapPreferences.showState
      : true,
  );
  const [showProduction, setShowProduction] = useState(() =>
    typeof initialMapPreferences.showProduction === "boolean"
      ? initialMapPreferences.showProduction
      : true,
  );
  const [showBlocked, setShowBlocked] = useState(() =>
    typeof initialMapPreferences.showBlocked === "boolean"
      ? initialMapPreferences.showBlocked
      : false,
  );
  const [showSuggestions, setShowSuggestions] = useState(() =>
    typeof initialMapPreferences.showSuggestions === "boolean"
      ? initialMapPreferences.showSuggestions
      : true,
  );
  const [localSuggestions, setLocalSuggestions] = useState<Suggestion[]>([]);
  const [proposalLinks, setProposalLinks] = useState<Record<string, string>>({});
  const [proposalResolutions, setProposalResolutions] = useState<
    Record<string, "resolved">
  >({});
  const [placementError, setPlacementError] = useState("");
  const [mapLocation, setMapLocation] = useState(() =>
    typeof initialMapPreferences.location === "string"
      ? initialMapPreferences.location
      : "farm",
  );

  useEffect(() => {
    fetch("/api/preferences", { cache: "no-store" })
      .then((response) => response.json())
      .then((preferences) => {
        if (Array.isArray(preferences.suggestions))
          setLocalSuggestions(preferences.suggestions);
        if (
          preferences.proposalLinks &&
          typeof preferences.proposalLinks === "object" &&
          !Array.isArray(preferences.proposalLinks)
        )
          setProposalLinks(preferences.proposalLinks);
        if (
          preferences.proposalResolutions &&
          typeof preferences.proposalResolutions === "object" &&
          !Array.isArray(preferences.proposalResolutions)
        )
          setProposalResolutions(preferences.proposalResolutions);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const loadLive = () => {
      if (document.hidden) return Promise.resolve();
      return fetch(`/data/live-state.json?live=${Date.now()}`, {
        cache: "no-store",
      })
        .then((response) => response.json())
        .then((payload: LiveState) => {
          const fresh =
            Boolean(payload.updatedAt) &&
            Date.now() -
              new Date(payload.updatedAt as string | number).getTime() <
              6500;
          setLive((previous) => {
            const next = {
              ...payload,
              active: Boolean(payload.active && fresh),
            };
            return previous.updatedAt === next.updatedAt &&
              previous.active === next.active
              ? previous
              : next;
          });
        })
        .catch(() =>
          setLive((previous) =>
            previous.active ? { active: false } : previous,
          ),
        );
    };
    loadLive();
    const timer = window.setInterval(loadLive, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "stardew-tool-map-preferences",
      JSON.stringify({
        zoom,
        location: mapLocation,
        showGrid,
        showState,
        showProduction,
        showBlocked,
        showSuggestions,
      }),
    );
  }, [
    mapLocation,
    showBlocked,
    showGrid,
    showProduction,
    showState,
    showSuggestions,
    zoom,
  ]);

  useEffect(() => {
    let loadingLatest = false;
    const loadLatest = () => {
      if (document.hidden || loadingLatest) return Promise.resolve();
      loadingLatest = true;
      return Promise.all([
        fetch(`/data/farm-state.json?save=${Date.now()}`, {
          cache: "no-store",
        }).then((r) => {
          if (!r.ok) throw new Error(`Farm data returned ${r.status}`);
          return r.json();
        }),
        fetch(`/data/farm-history.json?save=${Date.now()}`, {
          cache: "no-store",
        }).then((r) => {
          if (!r.ok) throw new Error(`Farm history returned ${r.status}`);
          return r.json();
        }),
      ])
        .then(([snapshot, farmHistory]: [Snapshot, FarmHistory]) => {
          snapshot = localizeSnapshotGameNames(snapshot, t);
          const profileId = snapshot.profileId || "default";
          const sessionStorageKey = `stardew-tool-last-session-${profileId}`;
          if (sessionProfileRef.current !== profileId) {
            sessionProfileRef.current = profileId;
            try {
              const saved = JSON.parse(
                window.localStorage.getItem(sessionStorageKey) || "null",
              );
              setSessionBaseline(
                saved && saved.profileId === profileId ? saved : null,
              );
            } catch {
              setSessionBaseline(null);
            }
          }
          setData((previous) =>
            previous && JSON.stringify(previous) === JSON.stringify(snapshot)
              ? previous
              : snapshot,
          );
          setHistory((previous) =>
            previous && JSON.stringify(previous) === JSON.stringify(farmHistory)
              ? previous
              : farmHistory,
          );
          setDataLoadError("");
          setLastRefresh(new Date());
        })
        .catch((error) =>
          setDataLoadError(
            error instanceof Error
              ? error.message
              : t("error.farmDataLoad"),
          ),
        )
        .finally(() => {
          loadingLatest = false;
        });
    };
    loadLatest();
    const refreshTimer = window.setInterval(loadLatest, 5000);
    Object.entries(spritePaths).forEach(([name, path]) => {
      const asset = new Image();
      let settled = false;
      const finish = (loaded: HTMLImageElement | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (loaded) setSprites((previous) => ({ ...previous, [name]: loaded }));
      };
      const timeout = window.setTimeout(() => finish(null), 8000);
      asset.onload = () => finish(asset);
      asset.onerror = () => finish(null);
      asset.src = path;
    });
    return () => window.clearInterval(refreshTimer);
  }, [t]);

  useEffect(() => {
    const path = data?.locationMaps?.Farm?.background;
    if (!path) return;
    const image = new Image();
    image.src = path;
    image.onload = () => {
      setBase(image);
      setAssetError("");
    };
    image.onerror = () =>
      setAssetError(
        t("error.farmBackground"),
      );
  }, [data?.locationMaps?.Farm?.background, t]);

  useEffect(() => {
    if (!data || !sessionProfileRef.current) return;
    window.localStorage.setItem(
      `stardew-tool-last-session-${sessionProfileRef.current}`,
      JSON.stringify(sessionSummary(data, live)),
    );
  }, [data, live]);

  useEffect(() => {
    if (!data) return;
    const previous = history.entries
      .filter((entry) => entry.dayIndex < data.dayIndex)
      .at(-1);
    if (!previous) return;
    fetch(`/data/days/${data.profileId || "default"}--${previous.dateKey}.json?save=${Date.now()}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((snapshot) =>
        setPreviousDay(
          snapshot
            ? localizeSnapshotGameNames({ ...snapshot, seasonLabel: seasonName(snapshot.season) }, t)
            : null,
        ),
      )
      .catch(() => setPreviousDay(null));
  }, [data, history, t]);

  useEffect(() => {
    if (!data || mapLocation === "farm") return;
    if (!data.interiors.some((interior) => interior.id === mapLocation)) {
      const frame = window.requestAnimationFrame(() => setMapLocation("farm"));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [data, mapLocation]);

  useEffect(() => {
    if (!data?.dailyBrief) return;
    const storageKey = `stardew-tool-daily-brief-${data.farmName}`;
    if (window.localStorage.getItem(storageKey) !== data.dateKey) {
      const frame = window.requestAnimationFrame(() => {
        window.localStorage.setItem(storageKey, data.dateKey);
        setShowDailyBrief(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [data]);

  const persist = (next: Suggestion[], remember = true) => {
    if (remember) setProposalUndo(localSuggestions);
    setLocalSuggestions(next);
    fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suggestions: next }),
    }).catch(() => undefined);
  };

  const persistProposalLinks = (next: Record<string, string>) => {
    setProposalLinks(next);
    fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalLinks: next }),
    }).catch(() => undefined);
  };

  const persistProposalResolutions = (next: Record<string, "resolved">) => {
    setProposalResolutions(next);
    fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalResolutions: next }),
    }).catch(() => undefined);
  };

  const mapData = useMemo(() => {
    if (!data || !live.active || !live.farmMap) return data;
    const savedTerrain = new Map(
      data.terrain.map((feature) => [tileKey(feature.x, feature.y), feature]),
    );
    const terrain = live.farmMap.terrain.map((feature) => {
      const saved = savedTerrain.get(tileKey(feature.x, feature.y));
      if (!saved)
        return {
          x: feature.x,
          y: feature.y,
          kind: feature.kind,
          watered: feature.watered,
        } as Terrain;
      if (feature.kind === "HoeDirt" && !feature.hasCrop) {
        const soil = { ...saved };
        delete soil.crop;
        delete soil.phase;
        delete soil.cropRow;
        return { ...soil, watered: feature.watered };
      }
      return { ...saved, watered: feature.watered };
    });
    return {
      ...data,
      terrain,
      objects: live.farmMap.objects,
      buildings: live.farmMap.buildings,
    };
  }, [data, live.active, live.farmMap]);

  const proposalStates = useMemo(
    () =>
      mapData
        ? reconcileProposals(
            [...mapData.suggestions, ...localSuggestions],
            mapData.buildings,
            proposalLinks,
            proposalResolutions,
          )
        : [],
    [localSuggestions, mapData, proposalLinks, proposalResolutions],
  );

  const centerOnFarmhouse = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const viewport = mapViewportRef.current;
      const farmhouse = mapData?.buildings.find(
        (building) => buildingType(building) === "farmhouse",
      );
      if (!viewport || !farmhouse) return;
      const centerX = (farmhouse.x + farmhouse.width / 2) * TILE * zoom;
      const centerY = (farmhouse.y + farmhouse.height / 2) * TILE * zoom;
      viewport.scrollTo({
        left: Math.max(0, centerX - viewport.clientWidth / 2),
        top: Math.max(0, centerY - viewport.clientHeight / 2),
        behavior,
      });
    },
    [mapData, zoom],
  );

  useEffect(() => {
    if (activeView !== "map" || mapLocation !== "farm") return;
    if (hasCenteredFarmRef.current) return;
    if (
      !mapData ||
      !mapViewportRef.current ||
      !mapData.buildings.some(
        (building) => buildingType(building) === "farmhouse",
      )
    )
      return;
    hasCenteredFarmRef.current = true;
    const frame = window.requestAnimationFrame(() => centerOnFarmhouse("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, centerOnFarmhouse, mapData, mapLocation]);

  const validatePlacement = (point: Tile, width: number, height: number) => {
    if (!mapData) return t("map.error.unavailable");
    const cells = Array.from({ length: width * height }, (_, index) => ({
      x: point.x + (index % width),
      y: point.y + Math.floor(index / width),
    }));
    if (
      cells.some(
        (cell) =>
          cell.x < 0 ||
          cell.y < 0 ||
          cell.x >= mapData.map.width ||
          cell.y >= mapData.map.height,
      )
    )
      return t("map.error.outsideFarm");
    if (
      cells.some((cell) =>
        mapData.map.blocked.some(([x, y]) => x === cell.x && y === cell.y),
      )
    )
      return t("map.error.nonBuildable");
    if (
      cells.some((cell) =>
        mapData.buildings.some(
          (building) =>
            cell.x >= building.x &&
            cell.x < building.x + building.width &&
            cell.y >= building.y &&
            cell.y < building.y + building.height,
        ),
      )
    )
      return t("map.error.existingBuilding");
    if (
      cells.some((cell) =>
        mapData.objects.some(
          (object) => {
            if (object.x !== cell.x || object.y !== cell.y) return false;
            if (object.kind === "Litter" || object.name === "Artifact Spot")
              return false;
            return !mapData.terrain.some(
              (feature) =>
                feature.x === object.x &&
                feature.y === object.y &&
                ["Tree", "FruitTree"].includes(feature.kind),
            );
          },
        ),
      )
    )
      return t("map.error.placedObject");
    if (
      cells.some((cell) =>
        proposalStates.some(
          (proposal) =>
            proposal.status === "pending" &&
            cell.x >= proposal.x &&
            cell.x < proposal.x + proposal.width &&
            cell.y >= proposal.y &&
            cell.y < proposal.y + proposal.height,
        ),
      )
    )
      return t("map.error.pendingProposal");
    return "";
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData || !base) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);

    if (mapData.farmType === 0 && (mapData.grandpa.actualCandles || 0) > 0) {
      const candleTiles = [
        [7.65, 8.15],
        [8.15, 7.55],
        [8.85, 7.55],
        [9.35, 8.15],
      ];
      candleTiles
        .slice(0, mapData.grandpa.actualCandles)
        .forEach(([x, y]) => {
          ctx.fillStyle = "#8b4a20";
          ctx.fillRect(x * TILE, y * TILE, 2, 5);
          ctx.fillStyle = "#ffd65a";
          ctx.fillRect(x * TILE - 1, y * TILE - 4, 4, 4);
          ctx.fillStyle = "#fff4a0";
          ctx.fillRect(x * TILE, y * TILE - 3, 2, 2);
        });
    }

    if (showBlocked) {
      ctx.fillStyle = "rgba(72, 38, 76, .26)";
      for (const [x, y] of mapData.map.blocked)
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }

    if (showState) {
      const tall: { bottom: number; paint: () => void }[] = [];
      for (const feature of mapData.terrain) {
        const px = feature.x * TILE,
          py = feature.y * TILE;
        if (feature.kind === "HoeDirt") {
          const soilOffset = feature.watered ? 128 : 0;
          sprite(
            ctx,
            sprites.hoeDirt,
            [soilOffset + 16, 0, 32, 32],
            [px, py, 16, 16],
          );
          if (feature.crop && feature.cropRow !== undefined)
            tall.push({
              bottom: py + TILE,
              paint: () => {
                const phase = feature.dead
                  ? 6
                  : Math.min(feature.phase || 0, 5);
                sprite(
                  ctx,
                  sprites.crops,
                  cropSpriteSource(feature.cropRow!, phase),
                  [px, py - 16],
                  Boolean(feature.flip),
                );
              },
            });
        } else if (feature.kind === "Grass") {
          const variant = Math.abs(feature.x * 17 + feature.y * 31) % 3;
          tall.push({
            bottom: py + TILE,
            paint: () =>
              sprite(
                ctx,
                sprites.grass,
                [variant * 15, 0, 15, 20],
                [px, py - 4],
              ),
          });
        } else if (feature.kind === "Tree") {
          const tree = sprites[feature.treeType || "Oak"] || sprites.Oak;
          tall.push({
            bottom: py + TILE,
            paint: () => {
              const stage = feature.stage || 0;
              if (feature.stump && stage >= 5)
                sprite(ctx, tree, [16, 96, 32, 32], [px - 8, py - 16]);
              else if (stage >= 5)
                sprite(ctx, tree, [0, 0, 48, 96], [px - 16, py - 80]);
              else if (stage === 4)
                sprite(ctx, tree, [0, 96, 16, 32], [px, py - 16]);
              else if (stage === 3)
                sprite(ctx, tree, [32, 128, 16, 16], [px, py]);
              else {
                const sourceX = stage === 0 ? 48 : stage === 1 ? 0 : 16;
                sprite(ctx, tree, [sourceX, 128, 16, 16], [px, py]);
              }
              if (feature.fertilized && stage < 5) {
                ctx.strokeStyle = "#ffe878";
                ctx.strokeRect(px + 1.5, py + 1.5, 13, 13);
              }
            },
          });
        } else if (feature.kind === "FruitTree") {
          tall.push({
            bottom: py + TILE,
            paint: () => {
              const row = Math.max(
                0,
                Math.min(8, Number(feature.treeId || 628) - 628),
              );
              const slot = Math.min(feature.stage || 0, 4);
              sprite(
                ctx,
                sprites.fruitTrees,
                [slot * 48, row * 80, 48, 80],
                [px - 16, py - 64],
              );
            },
          });
        }
      }

      for (const object of mapData.objects) {
        const index = Number(object.id);
        if (!Number.isFinite(index)) continue;
        const px = object.x * TILE,
          py = object.y * TILE;
        tall.push({
          bottom: py + TILE,
          paint: () => {
            if (object.big)
              sprite(
                ctx,
                sprites.craftables,
                [(index % 8) * 16, Math.floor(index / 8) * 32, 16, 32],
                [px, py - 16],
              );
            else
              sprite(
                ctx,
                sprites.objects,
                [(index % 24) * 16, Math.floor(index / 24) * 16, 16, 16],
                [px, py],
              );
          },
        });
      }

      for (const clump of mapData.clumps) {
        tall.push({
          bottom: (clump.y + clump.height) * TILE,
          paint: () => {
            const index = Number(clump.id);
            for (let y = 0; y < clump.height; y++)
              for (let x = 0; x < clump.width; x++) {
                const part = index + y * 24 + x;
                sprite(
                  ctx,
                  sprites.objects,
                  [(part % 24) * 16, Math.floor(part / 24) * 16, 16, 16],
                  [(clump.x + x) * TILE, (clump.y + y) * TILE],
                );
              }
          },
        });
      }

      for (const building of mapData.buildings) {
        tall.push({
          bottom: (building.y + building.height) * TILE,
          paint: () => {
            const px = building.x * TILE,
              py = building.y * TILE;
            if (!drawBuildingSprite(ctx, sprites, building)) {
              ctx.fillStyle = "rgba(116,82,154,.35)";
              ctx.fillRect(
                px,
                py,
                building.width * TILE,
                building.height * TILE,
              );
            }
            if ((building.daysOfConstructionLeft || 0) > 0) {
              ctx.fillStyle = "rgba(240, 167, 55, .2)";
              ctx.strokeStyle = "#ffd166";
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 3]);
              ctx.fillRect(
                px,
                py,
                building.width * TILE,
                building.height * TILE,
              );
              ctx.strokeRect(
                px + 1,
                py + 1,
                building.width * TILE - 2,
                building.height * TILE - 2,
              );
              ctx.setLineDash([]);
            }
          },
        });
      }
      tall
        .sort((a, b) => a.bottom - b.bottom)
        .forEach((entity) => entity.paint());

      if (showProduction) {
        for (const object of mapData.objects.filter(
          (item) => item.ready || item.processing,
        )) {
          const cx = object.x * TILE + 12,
            cy = object.y * TILE + 3;
          ctx.beginPath();
          ctx.fillStyle = object.ready ? "#69c36a" : "#e5a83e";
          ctx.strokeStyle = "#fff6d8";
          ctx.lineWidth = 1.5;
          ctx.arc(cx, cy, object.ready ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (object.ready) {
            ctx.fillStyle = "white";
            ctx.font = "bold 7px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("✓", cx, cy + 0.5);
          }
        }
      }
    }

    if (showSuggestions) {
      for (const suggestion of proposalStates.filter(
        (item) => item.status === "pending",
      )) {
        ctx.globalAlpha = 0.82;
        const hasSprite = drawBuildingSprite(ctx, sprites, suggestion);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `${suggestion.color}80`;
        ctx.strokeStyle = "rgba(30, 25, 18, .9)";
        ctx.lineWidth = 5;
        ctx.setLineDash([5, 3]);
        ctx.fillRect(
          suggestion.x * TILE,
          suggestion.y * TILE,
          suggestion.width * TILE,
          suggestion.height * TILE,
        );
        ctx.strokeRect(
          suggestion.x * TILE + 1,
          suggestion.y * TILE + 1,
          suggestion.width * TILE - 2,
          suggestion.height * TILE - 2,
        );
        ctx.strokeStyle = suggestion.color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(
          suggestion.x * TILE + 1,
          suggestion.y * TILE + 1,
          suggestion.width * TILE - 2,
          suggestion.height * TILE - 2,
        );
        ctx.setLineDash([]);
        if (!hasSprite || proposalEditMode) {
          const label = suggestion.name.replace(
            /^(Proposed|Future|Optional) /,
            "",
          );
          ctx.font = "bold 9px Arial";
          ctx.fillStyle = "rgba(28, 25, 23, .82)";
          ctx.fillRect(
            suggestion.x * TILE + 3,
            suggestion.y * TILE + 3,
            Math.min(
              suggestion.width * TILE - 6,
              ctx.measureText(label).width + 10,
            ),
            16,
          );
          ctx.fillStyle = "#fff8e8";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(
            label,
            suggestion.x * TILE + 8,
            suggestion.y * TILE + 11,
            suggestion.width * TILE - 12,
          );
        }
      }
    }

    if (showGrid) {
      ctx.strokeStyle = "rgba(50, 38, 29, .24)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= mapData.map.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE + 0.5, 0);
        ctx.lineTo(x * TILE + 0.5, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= mapData.map.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE + 0.5);
        ctx.lineTo(canvas.width, y * TILE + 0.5);
        ctx.stroke();
      }
    }

    if (hover) {
      const moving = movingProposalId
        ? localSuggestions.find((item) => item.id === movingProposalId)
        : null;
      const selectedTool = tools.find((item) => item.id === tool) || tools[0];
      const active = moving || selectedTool;
      if (proposalEditMode && (moving || tool !== "inspect")) {
        ctx.globalAlpha = 0.78;
        drawBuildingSprite(ctx, sprites, {
          ...active,
          name: moving?.name || selectedTool.label,
          x: hover.x,
          y: hover.y,
        });
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle =
        tool === "inspect" && !moving
          ? "rgba(255,255,255,.22)"
          : "rgba(255, 224, 117, .35)";
      ctx.strokeStyle = "#fff1a8";
      ctx.lineWidth = 2;
      ctx.fillRect(
        hover.x * TILE,
        hover.y * TILE,
        active.width * TILE,
        active.height * TILE,
      );
      ctx.strokeRect(
        hover.x * TILE + 1,
        hover.y * TILE + 1,
        active.width * TILE - 2,
        active.height * TILE - 2,
      );
    }
  }, [
    base,
    hover,
    mapData,
    localSuggestions,
    movingProposalId,
    proposalEditMode,
    proposalStates,
    showBlocked,
    showGrid,
    showProduction,
    showState,
    showSuggestions,
    sprites,
    tool,
  ]);

  useEffect(() => {
    if (activeView === "map") draw();
  }, [activeView, draw, mapLocation]);

  const pointFromEvent = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * 80),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * 65),
    };
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setProposalMenu(null);
    const point = pointFromEvent(event);
    setSelected(point);
    if (movingProposalId) {
      const moving = localSuggestions.find((item) => item.id === movingProposalId);
      if (!moving) return setMovingProposalId(null);
      const invalid = validatePlacement(point, moving.width, moving.height);
      if (invalid) return setPlacementError(invalid);
      persist(localSuggestions.map((item) =>
        item.id === movingProposalId ? { ...item, x: point.x, y: point.y } : item,
      ));
      setMovingProposalId(null);
      setPlacementError("");
      return;
    }
    if (proposalEditMode && tool !== "inspect") {
      const active = tools.find((item) => item.id === tool)!;
      const invalid = validatePlacement(point, active.width, active.height);
      if (invalid) {
        setPlacementError(invalid);
        return;
      }
      setPlacementError("");
      persist([
        ...localSuggestions,
        {
          id: `${tool}-${Date.now()}`,
          kind: tool,
          name: `Proposed ${active.label}`,
          x: point.x,
          y: point.y,
          width: active.width,
          height: active.height,
          color: "#ffcf5c",
        },
      ]);
      setTool("inspect");
    }
  };

  const openProposalMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = pointFromEvent(event);
    const proposal = [...localSuggestions].reverse().find(
      (item) =>
        point.x >= item.x &&
        point.x < item.x + item.width &&
        point.y >= item.y &&
        point.y < item.y + item.height,
    );
    if (!proposal) {
      setProposalMenu(null);
      return;
    }
    setProposalMenu({
      id: proposal.id,
      name: proposal.name.replace(/^(Proposed|Future|Optional) /, ""),
      x: event.clientX,
      y: event.clientY,
    });
  };

  useEffect(() => {
    if (!proposalMenu) return;
    const close = () => setProposalMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [proposalMenu]);

  const beginPanelResize = (
    side: "left" | "right",
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const resize = (pointer: PointerEvent) => {
      const bounds = workspace.getBoundingClientRect();
      const width = side === "left"
        ? pointer.clientX - bounds.left
        : bounds.right - pointer.clientX;
      const next = Math.max(180, Math.min(420, Math.round(width)));
      if (side === "left") setLeftPanelWidth(next);
      else setRightPanelWidth(next);
    };
    const finish = () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", finish, { once: true });
  };

  const details = (() => {
    if (!mapData || !selected) return [];
    const key = tileKey(selected.x, selected.y);
    const result: string[] = [];
    const feature = mapData.terrain.find((t) => tileKey(t.x, t.y) === key);
    if (feature) result.push(localizedTerrainFeature(feature, t));
    const object = mapData.objects.find((o) => tileKey(o.x, o.y) === key);
    if (object)
      result.push(
        object.ready
          ? t("map.objectReady", { machine: object.displayName || object.name, output: object.output || t("map.collect") })
          : object.processing
            ? t("map.objectProcessing", { machine: object.displayName || object.name, output: object.output || t("map.product"), days: object.readyInDays || 0 })
            : object.displayName || object.name,
      );
    const building = mapData.buildings.find(
      (b) =>
        selected.x >= b.x &&
        selected.x < b.x + b.width &&
        selected.y >= b.y &&
        selected.y < b.y + b.height,
    );
    if (building) result.push(buildingDisplayName(building.name, t));
    if (
      mapData.map.blocked.some(([x, y]) => x === selected.x && y === selected.y)
    )
      result.push(t("map.nonBuildableTerrain"));
    return result.length ? result : [t("map.emptyTile")];
  })();

  if (assetError)
    return (
      <main className="loading load-error">
        <div>
          <strong>{t("web.home.farmVisualsCouldNotBePrepared")}</strong>
          <p>{assetError}</p>
          <button onClick={() => window.location.reload()}>{t("common.tryAgain")}</button>
        </div>
      </main>
    );
  if (dataLoadError && !data)
    return (
      <main className="loading load-error">
        <div>
          <strong>{t("web.home.farmDataCouldNotBeLoaded")}</strong>
          <p>{dataLoadError}</p>
          <button onClick={() => window.location.reload()}>{t("common.tryAgain")}</button>
        </div>
      </main>
    );
  if (!data) return <main className="loading">{t("web.home.preparingYourFarm")}</main>;

  const liveAlerts = deriveLiveAlerts(data, live, liveAlertSettings, t, text);
  const canNavigateBack = navigationAvailability.back;
  const canNavigateForward = navigationAvailability.forward;

  const locationInventory: StorageInventoryItem[] = live.active
    ? [
        ...(live.inventory || []).map((item) => ({
          ...item,
          sources: ["Backpack · LIVE"],
          sourceCounts: [{ source: "Backpack · LIVE", count: item.count, quality: item.quality }],
          sourceDetails: [{ source: "Backpack · LIVE", kind: "backpack" as const }],
        })),
        ...(live.storage || []).map((item) => {
          const source = liveStorageSource(item);
          return ({
          ...item,
          sources: [source],
          sourceCounts: [{ source, count: item.count, quality: item.quality }],
          sourceDetails: [{
            source,
            kind: "chest" as const,
            name: item.containerName,
            itemId: item.containerItemId,
            color: item.containerColor,
            location: item.containerLocation,
            x: item.containerX,
            y: item.containerY,
          }],
        });}),
      ]
    : data.planningBrief.inventory;
  const locationMatches = locatedItemName
    ? locationInventory.filter(
        (item) => item.name.toLowerCase() === locatedItemName.toLowerCase(),
      )
    : [];
  const locatedItem = locationMatches.length
    ? {
        ...locationMatches[0],
        count: locationMatches.reduce((sum, item) => sum + item.count, 0),
        sources: Array.from(new Set(locationMatches.flatMap((item) => item.sources))),
        sourceCounts: locationMatches.flatMap((item) =>
          (item.sourceCounts || []).map((entry) => ({
            ...entry,
            quality: entry.quality ?? item.quality,
          })),
        ),
        sourceDetails: locationMatches.flatMap((item) => item.sourceDetails || []),
      }
    : undefined;
  type AppSearchEntry = {
    id: string;
    label: string;
    detail: string;
    target: string;
    itemName?: string;
    achievementId?: string;
  };
  const appSearchEntries: AppSearchEntry[] = [
    { id: "view-today", label: t("nav.today"), detail: t("search.todayDetail"), target: "agenda" },
    { id: "view-map", label: t("nav.map"), detail: t("search.mapDetail"), target: "map" },
    { id: "view-farm", label: t("nav.farm"), detail: t("search.farmDetail"), target: "farm:crops" },
    { id: "view-fishing", label: t("nav.fishing"), detail: t("search.fishingDetail"), target: "fishing" },
    { id: "view-plan", label: t("nav.plan"), detail: t("search.planDetail"), target: "plan:community" },
    { id: "view-progress", label: t("nav.progress"), detail: t("search.progressDetail"), target: "growth" },
    ...Array.from(new Map(locationInventory.map((item) => [item.name, item.displayName || item.name])).entries()).map(([name, displayName]) => ({
      id: `item-${name}`,
      label: displayName,
      detail: t("search.ownedItemDetail"),
      target: "item",
      itemName: name,
    })),
    ...data.achievements.items.map((item) => ({
      id: `achievement-${item.id}`,
      label: item.name,
      detail: t("search.achievementDetail", { category: t(`achievement.category.${item.category.toLowerCase()}`) }),
      target: "achievement",
      achievementId: item.id,
    })),
    ...data.planningBrief.communityCenter.rooms.flatMap((room) =>
      room.bundles.map((bundle) => ({
        id: `bundle-${room.id}-${bundle.id}`,
        label: communityBundleName(bundle.id, bundle.name, t),
        detail: t("search.communityDetail", { room: communityRoomName(room.id, t) }),
        target: "plan:community",
      })),
    ),
    ...data.planningBrief.buildings.map((building) => ({
      id: `building-${building.name}`,
      label: buildingPlanText(building, "name", t),
      detail: t("search.buildingDetail", { category: buildingCategoryName(building.category, t) }),
      target: "plan:buildings",
    })),
    ...data.planningBrief.friendships.map((friend) => ({
      id: `friend-${friend.name}`,
      label: friend.name,
      detail: t("search.villagerDetail"),
      target: "plan:friends",
    })),
    ...data.planningBrief.crops.map((crop) => ({
      id: `crop-${crop.name}`,
      label: crop.displayName || crop.name,
      detail: t("search.cropDetail"),
      target: "farm:crops",
    })),
  ];
  const normalizedAppSearch = appSearchQuery.trim().toLowerCase();
  const appSearchResults = Array.from(
    new Map(
      appSearchEntries
        .filter((entry) =>
          !normalizedAppSearch ||
          `${entry.label} ${entry.detail}`.toLowerCase().includes(normalizedAppSearch),
        )
        .map((entry) => [`${entry.target}:${entry.label}`, entry]),
    ).values(),
  ).slice(0, 12);
  const openAppSearchEntry = (entry: AppSearchEntry) => {
    setShowAppSearch(false);
    setAppSearchQuery("");
    if (entry.target === "item" && entry.itemName) {
      setLocatedItemName(entry.itemName);
      return;
    }
    if (entry.target === "achievement" && entry.achievementId) {
      window.localStorage.setItem("stardew-tool-progress-section", "achievements");
      navigateTo({ view: "achievements" });
      window.setTimeout(
        () => window.dispatchEvent(new CustomEvent("stardew:focus-achievement", { detail: { id: entry.achievementId } })),
        80,
      );
      return;
    }
    const [area, section] = entry.target.split(":");
    if (area === "farm" || area === "plan") {
      navigateTo({ view: area === "farm" ? "farm" : "planning", section });
      return;
    }
    navigateTo({ view: area as ActiveView });
  };

  const selectedInterior = data.interiors?.find(
    (item) => item.id === mapLocation,
  );
  const visibleObjects = selectedInterior
    ? selectedInterior.objects
    : mapData!.objects;
  const treeCount = mapData!.terrain.filter((t) => t.kind === "Tree").length;
  const cropCount = mapData!.terrain.filter(
    (t) => t.kind === "HoeDirt" && t.crop,
  ).length;
  const readyMachines = visibleObjects.filter((item) => item.ready);
  const processingMachines = visibleObjects.filter((item) => item.processing);
  const selectedInteriorDetails =
    selectedInterior && selected
      ? [
          ...selectedInterior.objects
            .filter((item) => item.x === selected.x && item.y === selected.y)
            .map((item) =>
              item.ready
                ? t("map.objectReady", { machine: item.displayName || item.name, output: item.output || t("map.collect") })
                : item.processing
                  ? t("map.objectProcessing", { machine: item.displayName || item.name, output: item.output || t("map.product"), days: item.readyInDays || 0 })
                  : item.displayName || item.name,
            ),
          ...selectedInterior.furniture
            .filter((item) => item.x === selected.x && item.y === selected.y)
            .map((item) => item.name),
        ]
      : [];

  return (
    <ItemArtworkCatalogContext.Provider value={data.itemArtworkCatalog || {}}>
    <main
      ref={appShellRef}
      className={`app-shell ${activeView === "map" ? "map-mode" : "content-mode"}`}
      style={
        {
          "--progress-tabs-top": `${progressTabsTop}px`,
        } as CSSProperties
      }
    >
      {switchingFarm && (
        <div className="farm-switch-feedback" role="status" aria-live="assertive">
          <span className="farm-switch-spinner" aria-hidden="true" />
          <div>
            <strong>{t("shell.changingFarm")}</strong>
            <span>{t("shell.changingFarmDetail", {
              farm: farmOptions.find((farm) => farm.path === switchingFarm)?.name || "",
            })}</span>
          </div>
        </div>
      )}
      <header className="topbar" ref={topbarRef}>
        <div className="brand">
          {/* The selected save's farmer is composed locally from the user's own game assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="farmer-avatar"
            src={data.farmerAvatar || "/app-icon.png"}
            alt={t("shell.farmerFromFarm", { farmer: data.farmer, farm: data.farmName })}
            width={60}
            height={102}
            onError={(event) => {
              if (!event.currentTarget.src.endsWith("/app-icon.png")) {
                event.currentTarget.src = "/app-icon.png";
                event.currentTarget.classList.add("farmer-avatar-fallback");
              }
            }}
          />
          <div className="farm-switcher" ref={farmSwitcherRef}>
            <button
              type="button"
              className="farm-switcher-trigger"
              onClick={() => setShowFarmSwitcher((value) => !value)}
              disabled={Boolean(switchingFarm)}
              aria-busy={Boolean(switchingFarm)}
              aria-expanded={showFarmSwitcher}
              title={t("shell.changeFarm")}
            >
              <strong>{switchingFarm ? t("shell.changingFarm") : data.farmName}</strong>
              <span aria-hidden="true">▾</span>
            </button>
            <span className="farmer-name">
              {data.farmer}
              {diagnostics?.development && (
                <b className="development-badge">{t("shell.development")}</b>
              )}
            </span>
            {showFarmSwitcher && (
              <div className="farm-switcher-menu">
                {farmOptions.map((farm) => {
                  const active = farm.path === activeSavePath;
                  const recentlyLive =
                    active && live.active;
                  const avatar = (active ? data.farmerAvatar : null) || farm.avatar || "/app-icon.png";
                  return (
                    <button
                      type="button"
                      key={farm.path}
                      className={active ? "active" : ""}
                      onClick={() => switchFarm(farm)}
                      disabled={Boolean(switchingFarm)}
                    >
                      <span className="farm-option-main">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="farm-option-avatar"
                          src={avatar}
                          alt=""
                          width={60}
                          height={102}
                          onError={(event) => {
                            if (!event.currentTarget.src.endsWith("/app-icon.png")) {
                              event.currentTarget.src = "/app-icon.png";
                              event.currentTarget.classList.add("fallback");
                            }
                          }}
                        />
                        <span>
                          <b>{farm.name}</b>
                          <small>{farm.farmer || t("shell.unknownFarmer")}{farm.gameSeason && farm.gameDay && farm.gameYear
                            ? ` · ${formatGameDate({ year: farm.gameYear, season: farm.gameSeason, day: farm.gameDay }, t)}`
                            : ""}</small>
                        </span>
                      </span>
                      <i>{recentlyLive ? t("status.live") : active ? "✓" : ""}</i>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="manage-farms"
                  onClick={() =>
                    (window as Window & { stardewDesktop?: DesktopUpdates }).stardewDesktop?.openSettings()
                  }
                >
                  {t("shell.manageFarms")}
                </button>
              </div>
            )}
          </div>
          <nav className="history-navigation" aria-label={t("shell.history")}>
            <button
              type="button"
              disabled={!canNavigateBack}
              onClick={() => navigateHistory("back")}
              title={t("web.home.backMouseBackButtonAltLeftArrow")}
              aria-label={t("shell.back")}
            >
              ←
            </button>
            <button
              type="button"
              disabled={!canNavigateForward}
              onClick={() => navigateHistory("forward")}
              title={t("web.home.forwardMouseForwardButtonAltRightArrow")}
              aria-label={t("shell.forward")}
            >
              →
            </button>
          </nav>
        </div>
        <div className="date-card">
          <span>{t("shell.year", { year: data.year })}</span>
          <span>{t(`season.${data.season}`)}</span>
          <strong>{data.day}</strong>
        </div>
        <nav className="view-tabs" aria-label={t("shell.sections")}>
          <button
            aria-current={activeView === "agenda" ? "page" : undefined}
            className={activeView === "agenda" ? "active" : ""}
            onClick={() => navigateTo({ view: "agenda" })}
            title={t("shell.shortcut", { section: t("nav.today"), number: 1 })}
          >
            {t("nav.today")} <kbd>1</kbd>
          </button>
          <button
            aria-current={activeView === "map" ? "page" : undefined}
            className={activeView === "map" ? "active" : ""}
            onClick={() => {
              navigateTo({ view: "map" });
              window.requestAnimationFrame(() =>
                window.requestAnimationFrame(draw),
              );
            }}
            title={t("shell.shortcut", { section: t("nav.map"), number: 2 })}
          >
            {t("nav.map")} <kbd>2</kbd>
          </button>
          <button
            aria-current={activeView === "farm" ? "page" : undefined}
            className={activeView === "farm" ? "active" : ""}
            onClick={() => navigateTo({ view: "farm", section: window.localStorage.getItem("stardew-tool-farm-section") || "crops" })}
            title={t("shell.shortcut", { section: t("nav.farm"), number: 3 })}
          >
            {t("nav.farm")} <kbd>3</kbd>
          </button>
          <button
            aria-current={activeView === "fishing" ? "page" : undefined}
            className={activeView === "fishing" ? "active" : ""}
            onClick={() => navigateTo({ view: "fishing" })}
            title={t("shell.shortcut", { section: t("nav.fishing"), number: 4 })}
          >
            {t("nav.fishing")} <kbd>4</kbd>
          </button>
          <button
            aria-current={activeView === "planning" ? "page" : undefined}
            className={activeView === "planning" ? "active" : ""}
            onClick={() => navigateTo({ view: "planning", section: window.localStorage.getItem("stardew-tool-plan-section") || "community" })}
            title={t("shell.shortcut", { section: t("nav.plan"), number: 5 })}
          >
            {t("nav.plan")} <kbd>5</kbd>
          </button>
          <button
            aria-current={
              activeView === "growth" || activeView === "achievements"
                ? "page"
                : undefined
            }
            className={
              activeView === "growth" || activeView === "achievements"
                ? "active"
                : ""
            }
            onClick={() => {
              const saved = window.localStorage.getItem("stardew-tool-progress-section");
              navigateTo({ view: saved === "achievements" ? "achievements" : "growth" });
            }}
            title={t("shell.shortcut", { section: t("nav.progress"), number: 6 })}
          >
            {t("nav.progress")} <kbd>6</kbd>
          </button>
        </nav>
        <button
          className={`save-note ${live.active ? "is-live" : ""}`}
          onMouseEnter={openLivePanel}
          onMouseLeave={closeLivePanelSoon}
          onFocus={openLivePanel}
          onBlur={closeLivePanelSoon}
          aria-expanded={showLivePanel}
          title={t("web.home.hoverToPreviewSaveAndLIVEData")}
        >
          <span className="live-dot" />
          {live.active
            ? t("shell.liveMapAt", { time: formatLiveTime(live.timeOfDay), location: live.location || t("shell.unknownLocation") })
            : t("shell.localSaveAt", {
                time: lastRefresh?.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) || t("shell.now"),
              })}
        </button>
        <button
          type="button"
          className={`live-alert-button ${liveAlerts.length ? "has-alerts" : ""}`}
          onClick={() => setShowLiveAlerts(true)}
          title={t("web.home.openConfigurableLIVEAlerts")}
        >
          {t("shell.alerts")} <b>{liveAlerts.length}</b>
        </button>
        <div className="update-control">
          <button
            type="button"
            className={`update-button ${updateState.status}`}
            onClick={updateAction}
            disabled={
              updateState.status === "checking" ||
              updateState.status === "downloading" ||
              updateState.status === "unavailable"
            }
            title={updateFeedbackMessage || t("updates.title")}
          >
            {updateState.status === "available"
              ? t("updates.download", { version: updateState.version || "" })
              : updateState.status === "downloaded"
                ? t("updates.restart")
                : updateState.status === "downloading"
                  ? `${updateState.percent || 0}%`
                  : updateState.status === "checking"
                    ? t("updates.checking")
                    : updateState.status === "current"
                      ? t("updates.current")
                      : updateState.status === "error"
                        ? t("common.tryAgain")
                        : t("updates.check")}
          </button>
          {updateState.status !== "idle" && updateFeedbackMessage && (
            <div
              className={`update-feedback ${updateState.status}`}
              role="status"
              aria-live="polite"
            >
              <span>{updateFeedbackMessage}</span>
              <button
                type="button"
                aria-label={t("updates.dismiss")}
                onClick={() =>
                  setUpdateState((state) => ({
                    status: "idle",
                    currentVersion: state.currentVersion,
                  }))
                }
              >
                ×
              </button>
            </div>
          )}
        </div>
        <label
          className="display-scale"
          title={t("web.home.interfaceSizeLargeScreensChooseAComfortableSizeAutomatically")}
        >
          <span>{t("shell.display")}</span>
          <select
            aria-label={t("shell.interfaceSize")}
            value={uiScale}
            onChange={(event) => setUiScale(Number(event.target.value))}
          >
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={1.75}>175%</option>
            <option value={2}>200%</option>
          </select>
        </label>
      </header>
      {showAppSearch && (
        <div className="app-search-backdrop" onPointerDown={() => setShowAppSearch(false)}>
          <section
            className="app-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("web.home.searchTheCompanion")}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">{t("web.home.jumpToAnything")}</p>
                <h2>{t("web.home.searchTheCompanion")}</h2>
              </div>
              <kbd>{t("web.home.esc")}</kbd>
            </header>
            <input
              ref={appSearchInputRef}
              value={appSearchQuery}
              onChange={(event) => setAppSearchQuery(event.target.value)}
              placeholder={t("web.home.tryAnItemVillagerBuildingBundleOrAchievement")}
              aria-label={t("web.home.searchTheCompanion")}
            />
            <div className="app-search-results">
              {appSearchResults.map((entry) => (
                <button type="button" onClick={() => openAppSearchEntry(entry)} key={entry.id}>
                  <span><strong>{entry.label}</strong><small>{entry.detail}</small></span>
                  <i>↵</i>
                </button>
              ))}
              {!appSearchResults.length && (
                <p>{t("web.home.noMatchingItemOrSectionWasFound")}</p>
              )}
            </div>
            <footer><kbd>{t("web.home.ctrl")}</kbd> + <kbd>F</kbd>{t("web.home.opensThisSearchFromAnywhere")}</footer>
          </section>
        </div>
      )}
      {showHelp && (
        <div className="help-backdrop" onPointerDown={() => setShowHelp(false)}>
          <section
            className="help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button className="help-close" onClick={() => setShowHelp(false)} aria-label={t("web.home.closeHelp")}>×</button>
            <p className="eyebrow">{t("web.home.helpAbout")}</p>
            <h2 id="help-title">{t("web.home.maglucenStardewValleyCompanion")}</h2>
            <strong>{t("web.home.version")}{diagnostics?.version || updateState.currentVersion || "development"}</strong>
            <p>{t("web.home.localReadOnlyPlanningAndLIVETrackingForYour")}</p>
            {diagnostics?.development && (
              <p className="development-help-note">{t("setup.development")}</p>
            )}
            <div className="help-actions">
              <a href={feedbackIssueUrl("bug", diagnostics, live, activeView, updateState.currentVersion)} target="_blank" rel="noreferrer">{t("web.home.reportAProblem")}</a>
              <a href={feedbackIssueUrl("suggestion", diagnostics, live, activeView, updateState.currentVersion)} target="_blank" rel="noreferrer">{t("web.home.suggestAnImprovement")}</a>
              {diagnostics && !diagnostics.smapiFound && (
                <>
                  <a href="https://www.nexusmods.com/stardewvalley/mods/2400" target="_blank" rel="noreferrer">{t("web.home.installSMAPINexusMods")}</a>
                  <a href="https://www.curseforge.com/stardewvalley/mods/smapi" target="_blank" rel="noreferrer">{t("web.home.installSMAPICurseForge")}</a>
                </>
              )}
              <a href="https://stardewvalleywiki.com/Stardew_Valley_Wiki" target="_blank" rel="noreferrer">{t("menu.wiki")}</a>
              <button className="wide" type="button" onClick={() =>
                (window as Window & { stardewDesktop?: DesktopUpdates }).stardewDesktop?.exportFarm()
              }>{t("web.home.exportThisFarmsCompanionBackup")}</button>
            </div>
            <section className="help-quick-controls">
              <h3>{t("web.home.quickControls")}</h3>
              <p><kbd>1</kbd>{t("today.when.today")}<kbd>2</kbd>{t("nav.map")}<kbd>3</kbd>{t("nav.farm")}<kbd>4</kbd>{t("nav.fishing")}<kbd>5</kbd>{t("nav.plan")}<kbd>6</kbd>{t("nav.progress")}</p>
              <p><kbd>{t("web.home.alt")}</kbd> + <kbd>←</kbd>/<kbd>→</kbd>{t("web.home.theHeaderArrowsOrYourMouseBackForwardButtons")}</p>
              <p><kbd>{t("web.home.ctrl")}</kbd> + <kbd>F</kbd>{t("web.home.searchesItemsVillagersBuildingsBundlesAndAchievementsThroughoutThe")}</p>
              <p>{t("web.home.clickAnItemCardToSeeWhereItIs")}</p>
            </section>
            <p className="privacy-note">{t("web.home.beforeAttachingLogsOrScreenshotsCheckThatTheyDo")}</p>
            <div className="diagnostics-box">
              <h3>{t("web.home.diagnostics")}</h3>
              {diagnostics ? (
                <>
                  <span>{t("setup.gameInstallation")}<b>{diagnostics.gameFound ? t("diagnostics.found") : t("diagnostics.missing")}</b></span>
                  <span>{t("setup.selectedSave")}<b>{diagnostics.saveFound ? t("diagnostics.found") : t("diagnostics.missing")}</b></span>
                  <span>{t("web.home.smapi")}<b>{diagnostics.smapiFound ? t("diagnostics.found") : t("diagnostics.notInstalled")}</b></span>
                  <span>{t("web.home.liveBridge")}<b>{diagnostics.bridgeInstalled ? t("diagnostics.installedVersion", { version: diagnostics.bridgeVersion ? `v${diagnostics.bridgeVersion}` : "" }) : diagnostics.bridgeManifestFound || diagnostics.bridgeDllFound ? t("diagnostics.incomplete") : t("diagnostics.notInstalled")}</b></span>
                  <span>{t("web.home.stardewProcess")}<b>{diagnostics.gameRunning ? t("diagnostics.running") : t("diagnostics.notRunning")}</b></span>
                  <span>{t("web.home.bridgeOutput")}<b>{diagnostics.liveStateFound ? diagnostics.liveStateFresh ? t("diagnostics.recent") : t("diagnostics.stale", { age: diagnostics.liveStateAgeSeconds != null ? `${diagnostics.liveStateAgeSeconds}s` : "" }) : t("diagnostics.notCreated")}</b></span>
                  <span>{t("web.home.liveFreshness")}<b>{live.active ? t("diagnostics.connectedAt", { time: formatLiveTime(live.timeOfDay) }) : t("diagnostics.offline")}</b></span>
                  <span>{t("web.home.environment")}<b>{diagnostics.development ? t("setup.development") : t("diagnostics.installed")}</b></span>
                  <button type="button" onClick={async () => {
                    const text = JSON.stringify({ ...diagnostics, live: live.active, liveLocation: live.locationId || null }, null, 2);
                    await (window as Window & { stardewDesktop?: DesktopUpdates }).stardewDesktop?.copyText(text);
                    setDiagnosticsCopied(true);
                  }}>{diagnosticsCopied ? t("diagnostics.copied") : t("diagnostics.copy")}</button>
                </>
              ) : (
                <p>{t("web.home.desktopDiagnosticsAreUnavailableInThisBrowserSession")}</p>
              )}
            </div>
            <ChangelogHistory />
          </section>
        </div>
      )}
      {locatedItemName && (
        <ItemLocationDialog
          name={locatedItemName}
          item={locatedItem}
          current={data}
          live={live}
          sprites={sprites}
          onClose={() => setLocatedItemName(null)}
        />
      )}
      {showLivePanel && (
        <LiveDataPanel
          live={live}
          current={data}
          onClose={() => setShowLivePanel(false)}
          onMouseEnter={openLivePanel}
          onMouseLeave={closeLivePanelSoon}
        />
      )}
      {showLiveAlerts && (
        <LiveAlertCenter
          alerts={liveAlerts}
          live={live}
          settings={liveAlertSettings}
          onChange={(kind, enabled) =>
            setLiveAlertSettings((currentSettings) => ({
              ...currentSettings,
              [kind]: enabled,
            }))
          }
          onClose={() => setShowLiveAlerts(false)}
        />
      )}

      <section
        ref={workspaceRef}
        className={`workspace ${layersCollapsed ? "layers-collapsed" : ""} ${activeView === "map" ? "" : "view-hidden"}`}
        style={{
          "--left-panel-width": `${leftPanelWidth}px`,
          "--right-panel-width": `${rightPanelWidth}px`,
        } as Record<string, string>}
        aria-hidden={activeView !== "map"}
      >
        <aside className="panel left-panel">
          <button
            className="layers-collapse"
            onClick={() => setLayersCollapsed((value) => !value)}
            aria-expanded={!layersCollapsed}
            title={layersCollapsed ? t("map.openLayers") : t("map.collapseLayers")}
          >
            {layersCollapsed ? "›" : "‹"}
            <span>{t("web.home.layers")}</span>
          </button>
          <div className="layers-content">
            <p className="eyebrow">{t("web.home.layers")}</p>
            <h2>{t("web.home.whatToDisplay")}</h2>
            <Toggle
              label={t("map.dailyState")}
              hint={t("map.objectCount", { count: visibleObjects.length })}
              checked={showState}
              onChange={setShowState}
              color="#6b8f43"
            />
            <Toggle
              label={t("web.home.processing")}
              hint={t("map.productionCount", { ready: readyMachines.length, working: processingMachines.length })}
              checked={showProduction}
              onChange={setShowProduction}
              color="#e5a83e"
            />
            {!selectedInterior && (
              <Toggle
                label={t("map.proposals")}
                hint={t("map.proposalCount", { pending: proposalStates.filter((item) => item.status === "pending").length, building: proposalStates.filter((item) => item.status === "building").length })}
                checked={showSuggestions}
                onChange={setShowSuggestions}
                color="#ffcf5c"
              />
            )}
            <Toggle
              label={t("map.grid")}
              hint={
                selectedInterior
                  ? t("map.tileDimensions", { width: selectedInterior.width, height: selectedInterior.height })
                  : t("map.tileDimensions", { width: 80, height: 65 })
              }
              checked={showGrid}
              onChange={setShowGrid}
              color="#e8dcc4"
            />
            {!selectedInterior && (
              <Toggle
                label={t("map.nonBuildable")}
                hint={t("map.edgesAndWater")}
                checked={showBlocked}
                onChange={setShowBlocked}
                color="#6f496d"
              />
            )}

            {!selectedInterior && (
              <>
                <div className="divider" />
                <button
                  type="button"
                  className={`proposal-edit-toggle ${proposalEditMode ? "active" : ""}`}
                  onClick={() => {
                    setProposalEditMode((value) => !value);
                    setTool("inspect");
                    setMovingProposalId(null);
                  }}
                >
                  {proposalEditMode ? t("map.finishEditing") : t("map.editProposals")}
                </button>
                {proposalEditMode && <>
                <p className="eyebrow">{t("web.home.buildingPalette")}</p>
                <div className="tool-grid proposal-palette">
                  {tools.map((item) => (
                    <button
                      key={item.id}
                      className={tool === item.id ? "tool active" : "tool"}
                      onClick={() => setTool(item.id)}
                    >
                      {item.id !== "inspect" && item.id !== "marker" && spritePaths[item.label] ? (
                        <BuildingPreview name={item.label} />
                      ) : (
                        <span className="tool-preview-placeholder" aria-hidden="true">{item.id === "inspect" ? "⌖" : "+"}</span>
                      )}
                      <span>{t(`map.tool.${item.id}`)}<small>{item.width}×{item.height}</small></span>
                    </button>
                  ))}
                </div>
                <p className="proposal-save-note">{t("web.home.chooseAFootprintAndClickTheMapSelectMove")}</p>
                {proposalUndo && (
                  <button className="clear" onClick={() => {
                    const previous = proposalUndo;
                    setProposalUndo(localSuggestions);
                    persist(previous, false);
                  }}>{t("web.home.undoLastProposalChange")}</button>
                )}
                {localSuggestions.length > 0 && (
                  <button className="clear" onClick={() => persist([])}>{t("web.home.clearMyDrawings")}</button>
                )}
                </>}
              </>
            )}
          </div>
        </aside>

        <div
          className="column-resizer left-column-resizer"
          role="separator"
          aria-label={t("web.home.resizeLayersColumn")}
          aria-orientation="vertical"
          onPointerDown={(event) => beginPanelResize("left", event)}
        />

        <section className="map-column">
          <div className="map-toolbar">
            <div className="location-picker">
              <label htmlFor="map-location">{t("storage.view")}</label>
              <select
                id="map-location"
                value={mapLocation}
                onChange={(event) => {
                  setMapLocation(event.target.value);
                  setSelected(null);
                  setPlacementError("");
                }}
              >
                <option value="farm">{t("web.home.farmExterior")}</option>
                {(data.interiors || []).map((interior) => (
                  <option key={interior.id} value={interior.id}>
                    {localizedInteriorName(interior, t)}
                  </option>
                ))}
              </select>
              <span className="crumb">{t("web.home.day")}{data.day}</span>
            </div>
            <div className="map-actions">
              {mapLocation === "farm" && (
                <button
                  className="home-button"
                  onClick={() => centerOnFarmhouse("smooth")}
                  title={t("web.home.centerTheMapOnTheFarmhouse")}
                >{t("web.home.home")}</button>
              )}
              <div className="zoom-control">
                <button onClick={() => setZoom(Math.max(0.65, zoom - 0.15))}>
                  −
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(Math.min(2.1, zoom + 0.15))}>
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="map-viewport" ref={mapViewportRef}>
            {mapLocation === "farm" ? (
              <canvas
                ref={canvasRef}
                width={1280}
                height={1040}
                style={{
                  width: `${1280 * zoom}px`,
                  height: `${1040 * zoom}px`,
                }}
                onMouseMove={(e) => setHover(pointFromEvent(e))}
                onMouseLeave={() => setHover(null)}
                onClick={handleClick}
                onContextMenu={openProposalMenu}
              />
            ) : selectedInterior ? (
              <InteriorView
                interior={selectedInterior}
                zoom={zoom}
                showState={showState}
                showProduction={showProduction}
                showGrid={showGrid}
                sprites={sprites}
                selected={selected}
                onSelect={setSelected}
              />
            ) : null}
            <div className="map-legend">
              <span>
                <i className="current" />
                {live.active && live.farmMap ? t("status.live") : t("map.lastSave")}
              </span>
              {mapLocation === "farm" && (
                <span>
                  <i className="proposal" />{t("web.home.proposal")}</span>
              )}
              <span>
                <i className="ready" />{t("web.home.ready")}</span>
              <span>
                <i className="working" />{t("web.home.processing")}</span>
            </div>
            {proposalMenu && (
              <div
                className="proposal-context-menu"
                role="menu"
                tabIndex={-1}
                style={{ left: proposalMenu.x, top: proposalMenu.y }}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setProposalMenu(null);
                }}
              >
                <strong>{proposalMenu.name}</strong>
                <button
                  type="button"
                  onClick={() => {
                    persist(localSuggestions.filter((item) => item.id !== proposalMenu.id));
                    setProposalMenu(null);
                  }}
                >{t("web.home.deleteProposal")}</button>
              </div>
            )}
          </div>
          <div className="tile-strip">
            <div>
              <span>
                {mapLocation === "farm"
                  ? t("storage.tile")
                  : selectedInterior?.label || t("map.interior")}
              </span>
              <strong>{selected ? `${selected.x}, ${selected.y}` : "—"}</strong>
            </div>
            <p className={placementError ? "placement-error" : ""}>
              {mapLocation === "farm"
                ? placementError ||
                  (selected
                    ? details.join(" · ")
                    : t("map.clickPoint"))
                : selected
                  ? selectedInteriorDetails.join(" · ") || t("map.emptyInteriorTile")
                  : t("map.clickInteriorTile")}
            </p>
          </div>
        </section>

        <div
          className="column-resizer right-column-resizer"
          role="separator"
          aria-label={t("web.home.resizeAtAGlanceColumn")}
          aria-orientation="vertical"
          onPointerDown={(event) => beginPanelResize("right", event)}
        />

        <aside className="panel right-panel">
          <p className="eyebrow">{t("web.home.atAGlance")}</p>
          <h2>
            {selectedInterior ? selectedInterior.label : t("map.day", { day: data.day })}
          </h2>
          {selectedInterior ? (
            <>
              <div className="stat">
                <span>{t("web.home.objects")}</span>
                <strong>{selectedInterior.objects.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.furniture")}</span>
                <strong>{selectedInterior.furniture.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.ready")}</span>
                <strong>{readyMachines.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.processing")}</span>
                <strong>{processingMachines.length}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="stat">
                <span>{t("web.home.trees")}</span>
                <strong>{treeCount}</strong>
              </div>
              <div className="stat">
                <span>{t("planning.crops")}</span>
                <strong>{cropCount}</strong>
              </div>
              <div className="stat">
                <span>{t("planning.buildings")}</span>
                <strong>{mapData!.buildings.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.money")}</span>
                <strong>{data.money.toLocaleString(locale)}g</strong>
              </div>
              {(data.grandpa.actualCandles || 0) > 0 && (
                <div className="stat">
                  <span>{t("web.home.grandpasShrine")}</span>
                  <strong>{data.grandpa.actualCandles}{t("web.home.candles")}</strong>
                </div>
              )}
            </>
          )}
          <div className="production-summary">
            <span className="eyebrow">{t("web.home.readyToCollect")}</span>
            {readyMachines.length ? (
              readyMachines.map((item, index) => (
                <div
                  className="machine-row ready-machine"
                  key={`${item.x}-${item.y}-${index}`}
                >
                  <strong>{item.output || item.name}</strong>
                  <small>
                    {item.displayName || item.name}{t("web.home.tile")}{item.x}, {item.y})
                  </small>
                </div>
              ))
            ) : (
              <p>{t("web.home.nothingIsReadyInTheCurrentReading")}</p>
            )}
            {processingMachines.length > 0 && (
              <span className="eyebrow production-working-title">{t("web.home.processing")}</span>
            )}
            {processingMachines.slice(0, 8).map((item, index) => (
              <div className="machine-row" key={`${item.x}-${item.y}-${index}`}>
                <strong>{item.output || item.name}</strong>
                <small>
                  {t("map.machineReadyIn", { machine: item.displayName || item.name, days: item.readyInDays || 0 })}
                </small>
              </div>
            ))}
          </div>
          {!selectedInterior && (
            <div className="proposal-list">
              {proposalStates.map((proposal) => {
                const alternatives = mapData!.buildings.filter(
                  (building) =>
                    buildingType(building) === buildingType(proposal) &&
                    (building.x !== proposal.x || building.y !== proposal.y),
                );
                return (
                  <div
                    className={`callout ${proposal.status}`}
                    key={proposal.id}
                  >
                    <span>
                      {proposal.status === "pending"
                        ? t("map.proposal.pending")
                        : proposal.status === "building"
                          ? t("map.proposal.building")
                          : proposal.status === "resolved"
                            ? t("map.proposal.resolved")
                            : t("map.proposal.completed")}
                    </span>
                    <strong>{t(`map.tool.${proposal.kind}`)}</strong>
                    <p>
                      {proposal.status === "building"
                        ? t("map.proposal.robinWorking", { x: proposal.actual?.x || 0, y: proposal.actual?.y || 0, days: proposal.actual?.daysOfConstructionLeft || 0 })
                        : proposal.status === "resolved"
                          ? t("map.proposal.manuallyResolved")
                          : proposal.status === "completed"
                            ? proposal.matchedBy === "manual"
                            ? t("map.proposal.completedElsewhere", { building: buildingDisplayName(proposal.actual?.name || "", t), x: proposal.actual?.x || 0, y: proposal.actual?.y || 0 })
                            : t("map.proposal.detectedAtTiles")
                          : t("map.proposal.position", { x: proposal.x, y: proposal.y, width: proposal.width, height: proposal.height })}
                    </p>
                    {proposalEditMode && proposal.status === "pending" && (
                      <div className="proposal-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setMovingProposalId(proposal.id);
                            setTool("inspect");
                            setPlacementError(t("map.proposal.chooseNewPosition"));
                          }}
                        >{t("web.home.move")}</button>
                        <button
                          type="button"
                          onClick={() =>
                            persist(localSuggestions.filter((item) => item.id !== proposal.id))
                          }
                        >{t("web.home.delete")}</button>
                        <button
                          type="button"
                          onClick={() =>
                            persistProposalResolutions({
                              ...proposalResolutions,
                              [proposal.id]: "resolved",
                            })
                          }
                        >{t("web.home.markPlanDone")}</button>
                      </div>
                    )}
                    {proposal.status === "resolved" && proposalEditMode && (
                      <button
                        className="proposal-reopen"
                        onClick={() => {
                          const next = { ...proposalResolutions };
                          delete next[proposal.id];
                          persistProposalResolutions(next);
                        }}
                      >{t("web.home.reopenPlan")}</button>
                    )}
                    {proposal.status === "pending" &&
                      alternatives.length > 0 && (
                        <div className="proposal-match">
                          <small>{t("web.home.alreadyBuiltElsewhere")}</small>
                          {alternatives.map((building) => (
                            <button
                              key={buildingSignature(building)}
                              onClick={() =>
                                persistProposalLinks({
                                  ...proposalLinks,
                                  [proposal.id]: buildingSignature(building),
                                })
                              }
                            >{t("web.home.use")}{buildingDisplayName(building.name, t)}{t("web.home.at")}{building.x}, {building.y}
                              )
                            </button>
                          ))}
                        </div>
                      )}
                    {proposal.matchedBy === "manual" && (
                      <button
                        className="proposal-reopen"
                        onClick={() => {
                          const next = { ...proposalLinks };
                          delete next[proposal.id];
                          persistProposalLinks(next);
                        }}
                      >{t("web.home.reopenProposal")}</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="fine-print">{t("web.home.thisViewOnlyReadsACopyOfTheSave")}{" "}
            {selectedInterior
              ? t("map.interiorReadOnlyNote")
              : t("map.drawingsReadOnlyNote")}
          </p>
        </aside>
      </section>
      {activeView !== "map" &&
        (activeView === "fishing" ? (
          <FishingView current={data} live={live} />
        ) : activeView === "farm" ? (
          <PlanningView key="farm" current={data} live={live} history={history} sprites={sprites} mode="farm" onNavigateSection={(section) => navigateTo({ view: "farm", section })} />
        ) : activeView === "planning" ? (
          <PlanningView key="plan" current={data} live={live} history={history} sprites={sprites} mode="plan" onNavigateSection={(section) => navigateTo({ view: "planning", section })} />
        ) : activeView === "growth" || activeView === "achievements" ? (
          <section className="progress-shell">
            <nav className="progress-tabs" aria-label={t("web.home.progressAreas")}>
              <button
                className={activeView === "growth" ? "active" : ""}
                onClick={() => {
                  window.localStorage.setItem("stardew-tool-progress-section", "growth");
                  navigateTo({ view: "growth" });
                }}
              >{t("web.home.growth")}</button>
              <button
                className={activeView === "achievements" ? "active" : ""}
                onClick={() => {
                  window.localStorage.setItem("stardew-tool-progress-section", "achievements");
                  navigateTo({ view: "achievements" });
                }}
              >{t("web.home.collectionsAchievements")}</button>
            </nav>
            {activeView === "growth" ? (
              <GrowthView
                history={history}
                current={data}
                previous={previousDay}
                live={live}
              />
            ) : (
              <AchievementsView current={data} live={live} />
            )}
          </section>
        ) : (
          <DailyBriefView
            key={data.dateKey}
            current={data}
            previous={previousDay}
            history={history}
            live={live}
            sessionBaseline={sessionBaseline}
            onOpenCommunityCenter={() => {
              window.localStorage.setItem(
                "stardew-tool-plan-section",
                "community",
              );
              navigateTo({ view: "planning", section: "community" });
            }}
          />
        ))}
      {showDailyBrief && (
        <DailyBriefModal
          current={data}
          onClose={() => setShowDailyBrief(false)}
          onOpenAgenda={() => {
            setShowDailyBrief(false);
            navigateTo({ view: "agenda" });
          }}
        />
      )}
    </main>
    </ItemArtworkCatalogContext.Provider>
  );
}

function deriveLiveAlerts(
  current: Snapshot,
  live: LiveState,
  settings: LiveAlertSettings,
  t: Translate,
  text: (value: LocalizedValue | null | undefined) => string,
): LiveAlert[] {
  if (!live.active) return [];
  const alerts: LiveAlert[] = [];
  const readyMachines = (live.machines || []).filter((item) => item.ready);
  if (settings.machines && readyMachines.length) {
    alerts.push({
      kind: "machines",
      title: t("alert.machinesReady", { count: readyMachines.length }),
      detail: summarizeReadyLiveMachines(readyMachines),
      tone: "ready",
    });
  }
  const readyCrops = live.routeState?.readyCrops || 0;
  if (settings.crops && readyCrops) {
    alerts.push({
      kind: "crops",
      title: t("alert.cropsReady", { count: readyCrops }),
      detail: t("alert.harvestableNow"),
      tone: "ready",
    });
  }
  const birthday = current.dailyBrief.birthdays.find((item) => item.when === "Today");
  if (settings.birthdays && birthday) {
    alerts.push({
      kind: "birthdays",
      title: t("alert.birthday", { person: birthday.person }),
      detail: t("alert.birthdayDetail"),
      tone: "info",
    });
  }
  const deadlineQuests = (live.acceptedQuests || []).filter(
    (quest) => quest.accepted !== false && (quest.daysLeft || 0) <= 1,
  );
  if (settings.deadlines) {
    alerts.push(
      ...deadlineQuests.map((quest) => {
        const official = matchingSavedQuest(
          quest,
          current.dailyBrief.acceptedQuests || [],
        );
        return {
          kind: "deadlines" as const,
          title: official ? text(official.title) : quest.title,
          detail: t("alert.finalDay", {
            objective: official
              ? text(official.objective)
              : quest.objective || t("alert.completeObjective"),
          }),
          tone: "urgent" as const,
        };
      }),
    );
  }
  if (
    settings.energy &&
    (live.maxEnergy || 0) > 0 &&
    (live.energy || 0) < (live.maxEnergy || 1) * 0.2
  ) {
    alerts.push({
      kind: "energy",
      title: t("alert.lowEnergy"),
      detail: t("alert.energyRemaining", { current: Math.round(live.energy || 0), max: Math.round(live.maxEnergy || 0) }),
      tone: "urgent",
    });
  }
  if (settings.tool && live.routeState?.toolPickupReady) {
    alerts.push({
      kind: "tool",
      title: t("alert.toolReady"),
      detail: t("alert.toolReadyDetail"),
      tone: "urgent",
    });
  }
  const bundleDeliveries = liveReadyBundleDeliveries(
    current.planningBrief.communityCenter,
    live,
  );
  if (settings.bundles && bundleDeliveries.length) {
    alerts.push({
      kind: "bundles",
      title: t("alert.bundleDeliveries", { count: bundleDeliveries.length }),
      detail: bundleDeliveries
        .slice(0, 3)
        .map((item) => `${item.name} → ${item.room}`)
        .join(" · "),
      tone: "ready",
    });
  }
  return alerts;
}

function LiveAlertCenter({
  alerts,
  live,
  settings,
  onChange,
  onClose,
}: {
  alerts: LiveAlert[];
  live: LiveState;
  settings: LiveAlertSettings;
  onChange: (kind: LiveAlertKind, enabled: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const labels: Record<LiveAlertKind, string> = {
    machines: t("alert.setting.machines"),
    crops: t("alert.setting.crops"),
    birthdays: t("alert.setting.birthdays"),
    deadlines: t("alert.setting.deadlines"),
    energy: t("alert.setting.energy"),
    tool: t("alert.setting.tool"),
    bundles: t("alert.setting.bundles"),
  };
  return (
    <div className="live-alert-backdrop" onPointerDown={onClose}>
      <section
        className="live-alert-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-alert-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="help-close" onClick={onClose} aria-label={t("today.brief.close")}>×</button>
        <p className="eyebrow">{t("web.liveAlertCenter.configurableLIVECenter")}</p>
        <h2 id="live-alert-title">{t("web.liveAlertCenter.alertsWhileYouPlay")}</h2>
        <p className="live-alert-status">
          {live.active
            ? t("alert.updatesImmediately")
            : t("alert.offline")}
        </p>
        <div className="live-alert-list" aria-live="polite">
          {alerts.map((alert, index) => (
            <article className={alert.tone} key={`${alert.kind}-${index}`}>
              <span />
              <div><strong>{alert.title}</strong><small>{alert.detail}</small></div>
            </article>
          ))}
          {live.active && !alerts.length && <p>{t("web.liveAlertCenter.nothingEnabledNeedsYourAttentionRightNow")}</p>}
        </div>
        <fieldset className="live-alert-settings">
          <legend>{t("web.liveAlertCenter.notifyMeAbout")}</legend>
          {(Object.keys(labels) as LiveAlertKind[]).map((kind) => (
            <label key={kind}>
              <input
                type="checkbox"
                checked={settings[kind]}
                onChange={(event) => onChange(kind, event.target.checked)}
              />
              <span>{labels[kind]}</span>
            </label>
          ))}
        </fieldset>
        <small className="dialog-escape-hint">{t("web.liveAlertCenter.clickOutsideOrPressEscToClose")}</small>
      </section>
    </div>
  );
}

function LiveDataPanel({
  live,
  current,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: {
  live: LiveState;
  current: Snapshot;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const { t, locale } = useI18n();
  const inventory = live.inventory || [];
  const gameName = (name: string, id?: string) => resolveGameDisplayName(
    current.localizedNamesByQualifiedId || {},
    current.localizedObjectNamesByEnglish || {},
    name,
    id,
  );
  const friendships = (live.friendships || []).filter(isVanillaFriend);
  const routeState = live.routeState;
  const collections = live.collections;
  const liveBundles = new Map(
    (collections?.bundleProgress || []).map((bundle) => [
      String(bundle.id),
      bundle.donated,
    ]),
  );
  const completedBundles = current.planningBrief.communityCenter.rooms.reduce(
    (sum, room) =>
      sum +
      room.bundles.filter((bundle) => {
        const donated = liveBundles.get(bundle.id);
        return donated
          ? donated.slice(0, bundle.requirements.length).filter(Boolean)
              .length >= bundle.required
          : bundle.complete;
      }).length,
    0,
  );
  const worldRemaining =
    routeState?.worldTasks.flatMap((stop) =>
      stop.items.map((item) => ({ ...item, location: stop.location })),
    ) || [];
  return (
    <aside
      className="live-data-panel"
      aria-label={t("web.liveDataPanel.realTimeDataReceived")}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onMouseEnter}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          onMouseLeave();
      }}
    >
      <div className="live-panel-title">
        <div>
          <p className="eyebrow">{t("web.liveDataPanel.stardewConnection")}</p>
          <h2>{live.active ? t("live.realTimeData") : t("live.notConnected")}</h2>
        </div>
        <button onClick={onClose} aria-label={t("web.liveDataPanel.closePanel")}>
          ×
        </button>
      </div>
      {!live.active ? (
        <p className="live-offline">{t("web.liveDataPanel.whileTheGameIsClosedTheLatestSaveIs")}</p>
      ) : (
        <>
          <div className="live-stat-grid">
            <div>
              <span>{t("web.liveDataPanel.time")}</span>
              <strong>{formatLiveTime(live.timeOfDay)}</strong>
            </div>
            <div>
              <span>{t("web.home.money")}</span>
              <strong>{(live.money || 0).toLocaleString(locale)}g</strong>
            </div>
            <div>
              <span>{t("web.liveDataPanel.energy")}</span>
              <strong>
                {Math.round(live.energy || 0)}/{Math.round(live.maxEnergy || 0)}
              </strong>
            </div>
            <div>
              <span>{t("web.liveDataPanel.health")}</span>
              <strong>
                {live.health}/{live.maxHealth}
              </strong>
            </div>
          </div>
          <section className="live-location">
            <span>{t("web.liveDataPanel.currentLocation")}</span>
            <strong>{live.location}</strong>
            <small>
              {live.locationId}{t("web.home.tile")}{live.tileX}, {live.tileY}) ·{" "}
              {live.currentTool ? gameName(live.currentTool) : t("live.noTool")}
            </small>
          </section>
          <LiveWorldMap
            live={live}
            season={live.season || current.season}
            compact
          />
          <section className="live-panel-section">
            <div className="live-section-title">
              <strong>{t("web.liveDataPanel.collections")}</strong>
              <span>{t("web.liveDataPanel.immediateUpdates")}</span>
            </div>
            <div className="live-collection-grid">
              <div>
                <strong>{collections?.caughtFish.length || 0}</strong>
                <span>{t("web.liveDataPanel.fishSpecies")}</span>
              </div>
              <div>
                <strong>
                  {completedBundles}/
                  {current.planningBrief.communityCenter.total}
                </strong>
                <span>{t("web.liveDataPanel.bundles")}</span>
              </div>
              <div>
                <strong>{collections?.museumItems.length || 0}</strong>
                <span>{t("web.liveDataPanel.museumDonations")}</span>
              </div>
            </div>
          </section>
          <section className="live-panel-section">
            <div className="live-section-title">
              <strong>{t("storage.backpack")}</strong>
              <span>{inventory.length}{t("web.liveDataPanel.occupiedSlots")}</span>
            </div>
            {inventory.length ? (
              <div className="live-inventory">
                {inventory.map((item, index) => (
                  <div key={`${item.id}-${item.quality}-${index}`}>
                    <strong>
                      {item.count}× {gameName(item.name, item.id)}
                    </strong>
                    <span>
                      {t(`quality.${item.quality >= 4 ? "iridium" : item.quality === 2 ? "gold" : item.quality === 1 ? "silver" : "normal"}`)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="live-empty">{t("web.liveDataPanel.backpackEmpty")}</p>
            )}
          </section>
          <section className="live-panel-section">
            <div className="live-section-title">
              <strong>{t("web.liveDataPanel.automaticRoute")}</strong>
              <span>
                {worldRemaining.reduce((sum, item) => sum + item.count, 0)}{" "}{t("web.liveDataPanel.pendingItems")}</span>
            </div>
            <div className="live-route-state">
              <span>
                <b>{t("nav.farm")}</b>
                {routeState?.readyCrops || 0}{t("web.liveDataPanel.crops")}{" "}
                {routeState?.readyMachines || 0}{t("web.liveDataPanel.machines")}</span>
              {routeState?.toolPickupReady && (
                <span>
                  <b>{t("web.liveDataPanel.town")}</b>
                  {t("live.toolReadyAtClint")}
                </span>
              )}
              {worldRemaining.map((item, index) => (
                <span key={`${item.location}-${item.name}-${index}`}>
                  <b>{routeLocationName(item.location, t)}</b>
                  {item.count}× {gameName(item.name)}
                </span>
              ))}
            </div>
          </section>
          <section className="live-panel-section">
            <div className="live-section-title">
              <strong>{t("web.liveDataPanel.friendshipsToday")}</strong>
              <span>
                {friendships.filter((friend) => friend.talkedToday).length}/
                {friendships.length}{t("web.liveDataPanel.greeted")}</span>
            </div>
            <div className="live-friends">
              {friendships
                .filter(
                  (friend) => friend.talkedToday || friend.giftsThisWeek > 0,
                )
                .slice(0, 12)
                .map((friend) => (
                  <span key={friend.name}>
                    <b>{friend.name}</b>
                    {friend.talkedToday ? t("friendship.talked") : t("friendship.notTalked")} ·{" "}
                    {friend.giftsThisWeek}{t("web.liveDataPanel.2Gifts")}</span>
                ))}
            </div>
          </section>
        </>
      )}
      <section className="live-panel-section data-health">
        <div className="live-section-title">
          <strong>{t("web.liveDataPanel.dataStatus")}</strong>
          <span>{live.active ? t("live.healthyConnection") : t("live.safeMode")}</span>
        </div>
        <div className="live-route-state">
          <span>
            <b>{live.active ? t("status.live") : t("map.lastSave")}</b>
            {live.active
              ? t("live.liveDataScope")
              : t("live.snapshot", { date: current.dateKey })}
          </span>
          <span>
            <b>{live.active && live.farmMap ? t("status.live") : t("map.lastSave")}</b>{t("web.liveDataPanel.farmExterior")}</span>
          <span>
            <b>{t("web.liveDataPanel.estimate")}</b>{t("web.liveDataPanel.futureEconomyAndConditionalDates")}</span>
        </div>
      </section>
      <small className="live-panel-foot">{t("web.liveDataPanel.theToolOnlyWritesItsOwnCompanionFilesIt")}</small>
    </aside>
  );
}

function BuildingPreview({
  name,
  catalog = false,
}: {
  name: string;
  catalog?: boolean;
}) {
  const { t } = useI18n();
  const definition = buildingSpriteDefinitions[buildingType({ name })];
  const frameWidth = catalog ? 96 : 42;
  const frameHeight = catalog ? 76 : 38;
  if (!definition) {
    return <span className={catalog ? "building-catalog-artwork missing" : "tool-preview-placeholder"} />;
  }
  const [sourceX, sourceY, sourceWidth, sourceHeight] = definition.source;
  const scale = Math.min((frameWidth - 4) / sourceWidth, (frameHeight - 4) / sourceHeight);
  const outputWidth = sourceWidth * scale;
  const outputHeight = sourceHeight * scale;
  return (
    <span
      className={catalog ? "building-catalog-artwork" : "tool-preview"}
      role="img"
      aria-label={t("artwork.buildingSprite", { name })}
    >
      {/* Building textures are extracted locally from the installed game. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={spritePaths[definition.image]}
        alt=""
        style={{
          left: (frameWidth - outputWidth) / 2 - sourceX * scale,
          top: frameHeight - outputHeight - sourceY * scale,
          transform: `scale(${scale})`,
        }}
      />
    </span>
  );
}

function formatBundleRequirement(
  item: Pick<BundleRequirement, "id" | "count" | "name" | "displayName">,
  t: Translate,
  locale: string,
) {
  return item.id === "-1"
    ? t("community.payment", { count: item.count.toLocaleString(locale) })
    : `${item.count}× ${item.displayName || item.name}`;
}

function localizedQuestTitle(
  quest: DailyQuest | LiveQuest,
  t: Translate,
  text: (value: LocalizedValue | null | undefined) => string,
) {
  if (quest.daily && quest.requester)
    return t(`quest.dailyTitle.${quest.type || "Quest"}`, { requester: quest.requester });
  return text(quest.title);
}

function InteriorView({
  interior,
  zoom,
  showState,
  showProduction,
  showGrid,
  sprites,
  selected,
  onSelect,
}: {
  interior: Interior;
  zoom: number;
  showState: boolean;
  showProduction: boolean;
  showGrid: boolean;
  sprites: Record<string, HTMLImageElement>;
  selected: Tile | null;
  onSelect: (tile: Tile) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [background, setBackground] = useState<{
    path: string;
    image: HTMLImageElement;
  } | null>(null);
  const size = 32;

  useEffect(() => {
    if (!interior.background) return;
    const path = interior.background;
    const image = new Image();
    image.onload = () => setBackground({ path, image });
    image.src = path;
  }, [interior.background]);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    const currentBackground = background;
    if (currentBackground?.path === interior.background) {
      ctx.drawImage(currentBackground!.image, 0, 0, element.width, element.height);
    } else {
      ctx.fillStyle = "#6f5437";
      ctx.fillRect(0, 0, element.width, element.height);
      for (let y = 0; y < interior.height; y += 1)
        for (let x = 0; x < interior.width; x += 1) {
          const edge =
            x === 0 ||
            y === 0 ||
            x === interior.width - 1 ||
            y === interior.height - 1;
          ctx.fillStyle = edge
            ? (x + y) % 2
              ? "#76573a"
              : "#684b32"
            : (x + y) % 2
              ? "#c99f67"
              : "#d2aa70";
          ctx.fillRect(x * size, y * size, size, size);
          if (!edge) {
            ctx.fillStyle = "rgba(255,239,190,.08)";
            ctx.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
          }
        }
    }

    const entities = [
      ...interior.furniture.map((item) => ({
        ...item,
        entity: "furniture" as const,
      })),
      ...(showState
        ? interior.objects.map((item) => ({
            ...item,
            entity: "object" as const,
          }))
        : []),
    ].sort((a, b) => a.y - b.y);
    for (const entity of entities) {
      const px = entity.x * size,
        py = entity.y * size;
      if (entity.entity === "object") {
        const index = Number(entity.id);
        if (Number.isFinite(index)) {
          if (entity.big)
            sprite(
              ctx,
              sprites.craftables,
              [(index % 8) * 16, Math.floor(index / 8) * 32, 16, 32],
              [px, py - size, size, size * 2],
            );
          else
            sprite(
              ctx,
              sprites.objects,
              [(index % 24) * 16, Math.floor(index / 24) * 16, 16, 16],
              [px, py, size, size],
            );
        }
        if (showProduction && (entity.ready || entity.processing)) {
          ctx.beginPath();
          ctx.fillStyle = entity.ready ? "#69c36a" : "#e5a83e";
          ctx.strokeStyle = "#fff6d8";
          ctx.lineWidth = 2;
          ctx.arc(px + size - 5, py + 5, entity.ready ? 7 : 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (entity.ready) {
            ctx.fillStyle = "white";
            ctx.font = "bold 10px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("✓", px + size - 5, py + 6);
          }
        }
      } else if (
        entity.sourceWidth &&
        entity.sourceHeight &&
        sprites.furniture
      ) {
        const width = entity.sourceWidth * 2,
          height = entity.sourceHeight * 2;
        sprite(
          ctx,
          sprites.furniture,
          [
            entity.sourceX || 0,
            entity.sourceY || 0,
            entity.sourceWidth,
            entity.sourceHeight,
          ],
          [px, py - Math.max(0, height - size), width, height],
        );
      } else {
        ctx.fillStyle = "#9a7048";
        ctx.strokeStyle = "#5b402a";
        ctx.lineWidth = 2;
        ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
        ctx.strokeRect(px + 3, py + 3, size - 6, size - 6);
        ctx.fillStyle = "#f5dfb5";
        ctx.font = "bold 9px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          entity.name.slice(0, 2).toUpperCase(),
          px + size / 2,
          py + size / 2,
        );
      }
    }

    if (showGrid) {
      ctx.strokeStyle = "rgba(58,39,25,.28)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= interior.width; x += 1) {
        ctx.beginPath();
        ctx.moveTo(x * size + 0.5, 0);
        ctx.lineTo(x * size + 0.5, element.height);
        ctx.stroke();
      }
      for (let y = 0; y <= interior.height; y += 1) {
        ctx.beginPath();
        ctx.moveTo(0, y * size + 0.5);
        ctx.lineTo(element.width, y * size + 0.5);
        ctx.stroke();
      }
    }
    if (selected) {
      ctx.strokeStyle = "#ffe17a";
      ctx.lineWidth = 3;
      ctx.strokeRect(
        selected.x * size + 2,
        selected.y * size + 2,
        size - 4,
        size - 4,
      );
    }
  }, [
    background,
    interior,
    selected,
    showGrid,
    showProduction,
    showState,
    sprites,
  ]);

  return (
    <div
      className="interior-stage"
      style={{
        width: interior.width * size * zoom,
        height: interior.height * size * zoom,
      }}
    >
      <canvas
        ref={canvas}
        width={interior.width * size}
        height={interior.height * size}
        style={{
          width: interior.width * size * zoom,
          height: interior.height * size * zoom,
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onSelect({
            x: Math.floor(
              ((event.clientX - rect.left) / rect.width) * interior.width,
            ),
            y: Math.floor(
              ((event.clientY - rect.top) / rect.height) * interior.height,
            ),
          });
        }}
      />
    </div>
  );
}

const fishingHours = [
  600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500,
  1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500,
];
function formatLiveTime(value = 600) {
  const hour = Math.floor(value / 100);
  const minute = value % 100;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function fishTime(value: number) {
  const normalized = value >= 2400 ? value - 2400 : value;
  return `${String(Math.floor(normalized / 100)).padStart(2, "0")}:00${value >= 2400 ? " (+1)" : ""}`;
}
function fishWindow(fish: FishingFish) {
  return fish.windows
    .map(([start, end]) => `${fishTime(start)}–${fishTime(end)}`)
    .join(" / ");
}

const legacyCraftableSpriteIndex: Record<string, number> = {
  "Lightning Rod": 9,
  "Bee House": 10,
  Keg: 12,
  Furnace: 13,
  "Preserves Jar": 15,
  "Cheese Press": 16,
  Loom: 17,
  "Oil Maker": 19,
  "Recycling Machine": 20,
  Crystalarium: 21,
  "Mayonnaise Machine": 24,
  "Seed Maker": 25,
  Tapper: 105,
  "Charcoal Kiln": 114,
  "Worm Bin": 154,
  Cask: 163,
};

// Stardew 1.6 crops use stable text IDs and live on the second object sheet.
// Keep the mapping beside the renderer so every crop surface (Farm, Today and
// Plan) resolves them consistently instead of falling back to an initial.
const modernObjectSpriteIndex: Record<string, number> = {
  Carrot: 80,
  SummerSquash: 81,
  "Summer Squash": 81,
  Broccoli: 82,
  Powdermelon: 83,
};

function SheetArtwork({
  id,
  kind,
  label,
  className = "",
  sourceWidth = 1,
  sourceHeight = 1,
  fit = false,
}: {
  id?: string;
  kind: Exclude<ItemSpriteKind, "fallback">;
  label: string;
  className?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  fit?: boolean;
}) {
  const { t } = useI18n();
  const raw = String(id || "").replace(/^\([A-Z]+\)/, "");
  const parsed = raw === "" ? Number.NaN : Number(raw);
  const modernIndex =
    kind === "object"
      ? modernObjectSpriteIndex[raw] ?? modernObjectSpriteIndex[label]
      : undefined;
  const resolvedKind = modernIndex === undefined ? kind : "object2";
  let index = parsed;
  if (!Number.isFinite(index)) {
    index =
      modernIndex ??
      (resolvedKind === "craftable"
        ? legacyCraftableSpriteIndex[label]
        : Number.NaN);
  }
  if (!Number.isFinite(index))
    return (
      <span
        className={`sheet-artwork missing ${resolvedKind} ${className}`}
        title={t("artwork.spriteUnavailable", { name: label })}
        aria-hidden="true"
      >
        {label.slice(0, 1)}
      </span>
    );
  const sheets = {
    object: { path: spritePaths.objects, columns: 24, width: 16, height: 16, row: 16, scale: 2 },
    object2: { path: spritePaths.objects2, columns: 8, width: 16, height: 16, row: 16, scale: 2 },
    craftable: { path: spritePaths.craftables, columns: 8, width: 16, height: 32, row: 32, scale: 2 },
    furniture: { path: spritePaths.furniture, columns: 32, width: 16, height: 16, row: 16, scale: 2 },
    weapon: { path: spritePaths.weapons, columns: 8, width: 16, height: 16, row: 16, scale: 2 },
    // Tool indices address a 16px-high grid. Tall tools opt into two source
    // tiles through sourceHeight, while fishing rods use a single square tile.
    tool: { path: spritePaths.tools, columns: 21, width: 16, height: 16, row: 16, scale: 2 },
    hat: { path: spritePaths.hats, columns: 12, width: 20, height: 20, row: 80, scale: 1.6 },
    shirt: { path: spritePaths.shirts, columns: 16, width: 8, height: 8, row: 32, scale: 4 },
  } as const;
  const sheet = sheets[resolvedKind];
  const scale = fit
    ? Math.min(
        sheet.scale,
        32 / (sheet.width * Math.max(1, sourceWidth)),
        32 / (sheet.height * Math.max(1, sourceHeight)),
      )
    : sheet.scale;
  const renderedWidth = sheet.width * Math.max(1, sourceWidth) * scale;
  const renderedHeight =
    sheet.height *
    Math.max(1, sourceHeight) *
    scale;
  const fitLeft = fit ? Math.max(0, (32 - renderedWidth) / 2) : 0;
  const fitTop = fit ? Math.max(0, (32 - renderedHeight) / 2) : 0;
  const left = -(index % sheet.columns) * sheet.width * scale;
  const top = -Math.floor(index / sheet.columns) * sheet.row * scale;
  return (
    <span
      className={`sheet-artwork ${resolvedKind} ${className}`}
      title={label}
      aria-hidden="true"
      style={fit ? { width: 32, height: 32 } : undefined}
    >
      <span
        className="sheet-artwork-crop"
        style={{
          left: fitLeft,
          top: fitTop,
          width: renderedWidth,
          height: renderedHeight,
        }}
      >
        {/* Local spritesheets retain their original pixel grid and must not be optimized. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sheet.path}
          alt=""
          style={{
            left: `${left}px`,
            top: `${top}px`,
            transform: `scale(${scale})`,
          }}
          onError={(event) => {
            event.currentTarget.hidden = true;
            event.currentTarget.closest(".sheet-artwork")?.classList.add("missing");
          }}
        />
      </span>
    </span>
  );
}

function StorageArtwork({ item }: { item: ItemArtwork }) {
  const label = item.displayName || item.name;
  const qualifier = /^\(([A-Z]+)\)/.exec(item.id)?.[1];
  const qualifiedKind: ItemSpriteKind | undefined = {
    O: "object",
    BC: "craftable",
    F: "furniture",
    W: "weapon",
    T: "tool",
    H: "hat",
    S: "shirt",
    B: "object",
    R: "object",
  }[qualifier || ""] as ItemSpriteKind | undefined;
  const kind = item.spriteKind || qualifiedKind;
  const spriteIndex = item.spriteIndex || item.id;
  if (
    kind === "fallback" ||
    (!kind && !Number.isFinite(Number(spriteIndex)))
  ) {
    return <SheetArtwork kind="object" label={label} />;
  }
  return (
    <SheetArtwork
      id={spriteIndex}
      kind={(kind || "object") as Exclude<ItemSpriteKind, "fallback">}
      label={label}
      sourceWidth={item.spriteWidth}
      sourceHeight={item.spriteHeight}
      fit
    />
  );
}

function ItemMentionArtwork({
  id,
  name,
  item,
  locatable = true,
}: {
  id?: string;
  name: string;
  item?: ItemArtwork;
  locatable?: boolean;
}) {
  const { t } = useI18n();
  const catalog = useContext(ItemArtworkCatalogContext);
  const resolvedItem = item || catalog[itemArtworkKey(name)];
  if (id === "-1" || name === "Gold") {
    return (
      <span
        className="item-mention-artwork money"
        title={t("web.itemMentionArtwork.gold")}
        aria-hidden="true"
      >
        g
      </span>
    );
  }
  return (
    <span
      className={`item-mention-artwork${locatable ? " locatable" : ""}`}
      data-storage-item={locatable ? name : undefined}
      title={locatable ? t("storage.clickToLocateNamed", { name }) : name}
    >
      {resolvedItem ? (
        <StorageArtwork item={resolvedItem} />
      ) : (
        <SheetArtwork id={id} kind="object" label={name} fit />
      )}
    </span>
  );
}

function GoalRequirements({
  target,
  compact = false,
}: {
  target: StrategicGoalTarget;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  return (
    <section className={`goal-requirements${compact ? " compact" : ""}`}>
      <header>
        <strong>{t("web.goalRequirements.resources")}</strong>
        <span>{target.requirementsLabel || t("goal.everythingRequired")}</span>
      </header>
      <ul>
        {target.requirements.map((requirement) => {
          const missing = Math.max(0, requirement.required - requirement.available);
          const satisfied = missing === 0;
          const suffix = requirement.suffix || "";
          return (
            <li
              className={`${satisfied ? "ready" : "missing"} locatable-item-card`}
              data-storage-item={requirement.name}
              title={t("storage.clickToLocateNamed", { name: requirement.name })}
              key={`${target.id}:${requirement.name}`}
            >
              <span className="goal-resource-status" aria-hidden="true">
                {satisfied ? "✓" : "!"}
              </span>
              <ItemMentionArtwork
                id={requirement.id}
                name={requirement.name}
                item={requirement.artwork}
              />
              <span className="goal-resource-name">{requirement.name}</span>
              <span className="goal-resource-count">
                {requirement.available.toLocaleString(locale)}{suffix}
                {" / "}
                {requirement.required.toLocaleString(locale)}{suffix}
              </span>
              <small>
                {satisfied
                  ? t("common.ready")
                  : t("goal.missingAmount", { amount: `${missing.toLocaleString(locale)}${suffix}` })}
              </small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StorageContainerArtwork({ detail }: { detail?: StorageSourceDetail }) {
  const { t } = useI18n();
  if (!detail || detail.kind === "backpack") {
    return <span className="storage-container-artwork backpack" aria-hidden="true">B</span>;
  }
  const rawIndex = Number(String(detail.itemId || "130").replace(/^\([A-Z]+\)/, ""));
  const spriteIndex = Number.isFinite(rawIndex) ? rawIndex : 130;
  return (
    <span
      className="storage-container-artwork chest"
      title={detail.color ? t("storage.chestColor", { color: detail.color }) : t("storage.defaultWoodChest")}
      aria-hidden="true"
    >
      <span
        className="storage-chest-sprite"
      >
        <i
          className="storage-chest-base"
          style={{
            backgroundImage: `url("${spritePaths.craftables}")`,
            backgroundPosition: `${-(spriteIndex % 8) * 16}px ${-Math.floor(spriteIndex / 8) * 32}px`,
          }}
        />
        {detail.color && (
          <i
            className="storage-chest-tint"
            style={{
              backgroundColor: detail.color,
              maskImage: `url("${spritePaths.craftables}")`,
              maskPosition: `${-(spriteIndex % 8) * 16}px ${-Math.floor(spriteIndex / 8) * 32}px`,
              WebkitMaskImage: `url("${spritePaths.craftables}")`,
              WebkitMaskPosition: `${-(spriteIndex % 8) * 16}px ${-Math.floor(spriteIndex / 8) * 32}px`,
            }}
          />
        )}
      </span>
    </span>
  );
}

function completeStorageSourceDetail(detail: StorageSourceDetail | undefined) {
  if (!detail || detail.kind !== "chest") return detail;
  const legacy = /^Chest · (.+?) \((-?\d+),\s*(-?\d+)\)$/.exec(detail.source);
  if (!legacy) return detail;
  return {
    ...detail,
    location: detail.location || legacy[1],
    x: detail.x ?? Number(legacy[2]),
    y: detail.y ?? Number(legacy[3]),
  };
}

function readableStorageLocation(detail: StorageSourceDetail | undefined, current: Snapshot, t: Translate) {
  detail = completeStorageSourceDetail(detail);
  const raw = detail?.location || "";
  if (!raw) return t("storage.unknownLocation");
  if (raw === "Farm") return t("nav.farm");
  const interior = current.interiors.find((entry) => entry.id === raw)
    || current.interiors.find((entry) => entry.name === raw && entry.background)
    || current.interiors.find((entry) => entry.name === raw);
  if (interior) {
    const exterior = /-(\d+)-(\d+)$/.exec(interior.id);
    return exterior
      ? `${localizedInteriorName(interior, t)} · ${t("nav.farm")} (${exterior[1]}, ${exterior[2]})`
      : localizedInteriorName(interior, t);
  }
  return raw
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}$/i, "")
    .replace(/[_-]+$/, "") || raw;
}

function readableStorageSource(
  source: string,
  detail: StorageSourceDetail | undefined,
  current: Snapshot,
  t: Translate,
) {
  detail = completeStorageSourceDetail(detail);
  if (detail?.kind !== "chest") return source;
  const tile = typeof detail.x === "number" && typeof detail.y === "number"
    ? ` · tile ${detail.x}, ${detail.y}`
    : "";
  return `${t("storage.chest")} · ${readableStorageLocation(detail, current, t)}${tile}`;
}

function StorageLocationPreview({
  detail,
  current,
  live,
  sprites,
}: {
  detail?: StorageSourceDetail;
  current: Snapshot;
  live: LiveState;
  sprites: Record<string, HTMLImageElement>;
}) {
  detail = completeStorageSourceDetail(detail);
  if (
    !detail ||
    detail.kind !== "chest" ||
    typeof detail.x !== "number" ||
    typeof detail.y !== "number"
  ) return null;
  return (
    <StorageLocationPreviewCanvas
      detail={detail as StorageSourceDetail & { kind: "chest"; x: number; y: number }}
      current={current}
      live={live}
      sprites={sprites}
    />
  );
}

function StorageLocationPreviewCanvas({
  detail,
  current,
  live,
  sprites,
}: {
  detail: StorageSourceDetail & { kind: "chest"; x: number; y: number };
  current: Snapshot;
  live: LiveState;
  sprites: Record<string, HTMLImageElement>;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const rawLocation = detail.location || "";
  const legacyLocation = rawLocation.split("_")[0];
  const normalizedLocation = rawLocation === "Farm" ? "Farm" : rawLocation;
  const interior = current.interiors.find((entry) => entry.id === rawLocation)
    || current.interiors.find((entry) => entry.name === rawLocation && entry.background)
    || current.interiors.find((entry) => entry.name === rawLocation)
    || current.interiors.find((entry) => entry.id === legacyLocation)
    || current.interiors.find(
      (entry) => entry.name === legacyLocation && entry.background,
    )
    || current.interiors.find((entry) => entry.name === legacyLocation);
  const extractedLocation = current.locationMaps?.[rawLocation]
    || current.locationMaps?.[legacyLocation];
  const background = normalizedLocation === "Farm"
    ? current.locationMaps?.Farm?.background
    : interior?.background || extractedLocation?.background;
  const mapWidth = normalizedLocation === "Farm"
    ? current.map.width
    : interior?.width || extractedLocation?.width;
  const mapHeight = normalizedLocation === "Farm"
    ? current.map.height
    : interior?.height || extractedLocation?.height;
  const safeMapWidth = mapWidth || 1;
  const safeMapHeight = mapHeight || 1;
  const frameWidth = Math.min(16, safeMapWidth);
  const frameHeight = Math.min(10, safeMapHeight);
  const startX = Math.max(0, Math.min(safeMapWidth - frameWidth, detail.x - Math.floor(frameWidth / 2)));
  const startY = Math.max(0, Math.min(safeMapHeight - frameHeight, detail.y - Math.floor(frameHeight / 2)));

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    ctx.clearRect(0, 0, element.width, element.height);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(-startX * TILE, -startY * TILE);

    const tintCraftable = (
      index: number,
      x: number,
      y: number,
      color?: string | null,
    ) => {
      const sheet = sprites.craftables;
      if (!sheet) return;
      const source: [number, number, number, number] = [
        (index % 8) * 16,
        Math.floor(index / 8) * 32,
        16,
        32,
      ];
      sprite(ctx, sheet, source, [x, y - TILE]);
      if (!color) return;
      const tinted = document.createElement("canvas");
      tinted.width = 16;
      tinted.height = 32;
      const tint = tinted.getContext("2d");
      if (!tint) return;
      tint.imageSmoothingEnabled = false;
      tint.drawImage(sheet, ...source, 0, 0, 16, 32);
      tint.globalCompositeOperation = "source-atop";
      tint.globalAlpha = 0.72;
      tint.fillStyle = color;
      tint.fillRect(0, 0, 16, 32);
      tint.globalAlpha = 0.32;
      tint.drawImage(sheet, ...source, 0, 0, 16, 32);
      ctx.drawImage(tinted, x, y - TILE);
    };

    const chestColors = new Map<string, string | null>();
    for (const item of current.planningBrief.inventory)
      for (const source of item.sourceDetails || [])
        if (
          source.kind === "chest" &&
          source.location &&
          typeof source.x === "number" &&
          typeof source.y === "number"
        ) chestColors.set(`${source.location}:${source.x}:${source.y}`, source.color || null);

    if (normalizedLocation === "Farm") {
      for (const feature of current.terrain) {
        const px = feature.x * TILE;
        const py = feature.y * TILE;
        if (feature.kind === "Grass" && sprites.grass) {
          sprite(ctx, sprites.grass, [0, 0, 15, 20], [px, py - 4]);
        } else if (feature.kind === "Tree") {
          const tree = sprites[feature.treeType || "Oak"] || sprites.Oak;
          if (!tree) continue;
          const stage = feature.stage || 0;
          if (feature.stump && stage >= 5)
            sprite(ctx, tree, [16, 96, 32, 32], [px - 8, py - 16]);
          else if (stage >= 5)
            sprite(ctx, tree, [0, 0, 48, 96], [px - 16, py - 80]);
          else if (stage === 4)
            sprite(ctx, tree, [0, 96, 16, 32], [px, py - 16]);
          else
            sprite(ctx, tree, [stage === 0 ? 48 : stage === 1 ? 0 : 16, 128, 16, 16], [px, py]);
        } else if (feature.kind === "HoeDirt" && sprites.hoeDirt) {
          sprite(ctx, sprites.hoeDirt, [0, feature.watered ? 16 : 0, 16, 16], [px, py]);
          if (feature.crop && sprites.crops)
            sprite(ctx, sprites.crops, cropSpriteSource(feature.cropRow || 0, feature.phase || 0), [px, py - 16]);
        }
      }
    }

    const objects = normalizedLocation === "Farm"
      ? live.active && live.farmMap?.objects
        ? live.farmMap.objects
        : current.objects
      : interior?.objects || [];
    const buildings = normalizedLocation === "Farm"
      ? live.active && live.farmMap?.buildings
        ? live.farmMap.buildings
        : current.buildings
      : [];
    const furniture = interior?.furniture || [];
    const entities: Array<
      | { type: "object"; bottom: number; item: FarmObject }
      | { type: "building"; bottom: number; item: Building }
      | { type: "furniture"; bottom: number; item: Interior["furniture"][number] }
    > = [
      ...objects.map((item) => ({ type: "object" as const, bottom: item.y + 1, item })),
      ...buildings.map((item) => ({ type: "building" as const, bottom: item.y + item.height, item })),
      ...furniture.map((item) => ({ type: "furniture" as const, bottom: item.y + 1, item })),
    ].sort((a, b) => a.bottom - b.bottom);

    for (const entity of entities) {
      if (entity.type === "building") {
        drawBuildingSprite(ctx, sprites, entity.item);
        continue;
      }
      if (entity.type === "furniture") {
        const item = entity.item;
        const px = item.x * TILE;
        const py = item.y * TILE;
        if (item.sourceWidth && item.sourceHeight && sprites.furniture)
          sprite(ctx, sprites.furniture, [item.sourceX || 0, item.sourceY || 0, item.sourceWidth, item.sourceHeight], [px, py - Math.max(0, item.sourceHeight - TILE)]);
        continue;
      }
      const item = entity.item;
      const px = item.x * TILE;
      const py = item.y * TILE;
      const index = Number(item.id);
      if (!Number.isFinite(index)) continue;
      const color = item.color || chestColors.get(`${normalizedLocation}:${item.x}:${item.y}`);
      if (item.big) tintCraftable(index, px, py, color);
      else if (sprites.objects)
        sprite(ctx, sprites.objects, [(index % 24) * 16, Math.floor(index / 24) * 16, 16, 16], [px, py]);
    }

    if (!objects.some((item) => item.x === detail.x && item.y === detail.y)) {
      const chestIndex = Number(String(detail.itemId || "130").replace(/^\(BC\)/, ""));
      if (Number.isFinite(chestIndex))
        tintCraftable(
          chestIndex,
          detail.x * TILE,
          detail.y * TILE,
          detail.color,
        );
    }

    ctx.restore();
    const targetX = (detail.x - startX) * TILE;
    const targetY = (detail.y - startY) * TILE;
    ctx.strokeStyle = "#ffe36e";
    ctx.lineWidth = 2;
    ctx.strokeRect(targetX + 1, targetY + 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = "#243b2c";
    ctx.lineWidth = 1;
    ctx.strokeRect(targetX + 3, targetY + 3, TILE - 6, TILE - 6);
  }, [current, detail, interior, live, normalizedLocation, sprites, startX, startY]);

  if (!background || !mapWidth || !mapHeight) return null;
  return (
    <span
      className="storage-location-preview"
      title={t("storage.locationTile", { location: detail.location || "", x: detail.x, y: detail.y })}
      style={{
        width: frameWidth * 12,
        height: frameHeight * 12,
        backgroundImage: `url("${background}")`,
        backgroundSize: `${mapWidth * 12}px ${mapHeight * 12}px`,
        backgroundPosition: `${-startX * 12}px ${-startY * 12}px`,
      }}
      aria-hidden="true"
    >
      <canvas ref={canvas} width={frameWidth * TILE} height={frameHeight * TILE} />
    </span>
  );
}

function ItemLocationDialog({
  name,
  item,
  current,
  live,
  sprites,
  onClose,
}: {
  name: string;
  item?: StorageInventoryItem;
  current: Snapshot;
  live: LiveState;
  sprites: Record<string, HTMLImageElement>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const rawEntries = (item?.sourceCounts?.length
    ? item.sourceCounts
    : (item?.sources || []).map((source) => ({
        source,
        count: item?.count || 0,
        quality: item?.quality || 0,
      })))
    .map((entry, index) => ({
      ...entry,
      quality: entry.quality ?? item?.quality ?? 0,
      detail: item?.sourceDetails?.find((detail) => detail.source === entry.source)
        || item?.sourceDetails?.[index],
    }));
  const entries = Array.from(
    rawEntries.reduce<
      Map<
        string,
        {
          source: string;
          count: number;
          detail?: StorageSourceDetail;
          stacks: { quality: number; count: number }[];
        }
      >
    >((grouped, entry) => {
      const existing = grouped.get(entry.source) || {
        source: entry.source,
        count: 0,
        detail: entry.detail,
        stacks: [],
      };
      existing.count += entry.count;
      const stack = existing.stacks.find(
        (candidate) => candidate.quality === entry.quality,
      );
      if (stack) stack.count += entry.count;
      else existing.stacks.push({ quality: entry.quality, count: entry.count });
      grouped.set(entry.source, existing);
      return grouped;
    }, new Map()).values(),
  );
  return (
    <div className="item-locator-backdrop" onPointerDown={onClose}>
      <section
        className="item-locator-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("storage.whereStored", { name })}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="help-close" onClick={onClose} aria-label={t("today.brief.close")}>×</button>
        <p className="eyebrow">{t("web.itemLocationDialog.storageLocation")}</p>
        <header>
          {item ? <StorageArtwork item={item} /> : <ItemMentionArtwork name={name} />}
          <div>
            <h2>{name}</h2>
            <span>{item ? t("storage.availableCount", { count: item.count }) : t("storage.notFoundLatest")}</span>
            <WikiLink name={name} />
          </div>
        </header>
        {entries.length > 0 ? (
          <div className="item-locator-sources">
            {entries.map((entry) => (
              <article key={entry.source}>
                <div className="item-locator-source-title">
                  <StorageContainerArtwork detail={entry.detail} />
                  <span>
                    <strong>{entry.source}</strong>
                    <small>{entry.count}{t("web.itemLocationDialog.here")}</small>
                    <span className="item-locator-quality-list">
                      {entry.stacks
                        .sort((a, b) => a.quality - b.quality)
                        .map((stack) => {
                          const quality = stack.quality >= 4
                            ? "iridium"
                            : stack.quality === 2
                              ? "gold"
                              : stack.quality === 1
                                ? "silver"
                                : "normal";
                          return (
                            <span key={stack.quality} title={t("storage.qualityNamed", { quality: t(`quality.${quality}`) })}>
                              <i className={quality} aria-hidden="true">
                                {quality === "normal" ? "—" : "★"}
                              </i>
                              {stack.count} {t(`quality.${quality}`)}
                            </span>
                          );
                        })}
                    </span>
                  </span>
                </div>
                <StorageLocationPreview
                  detail={entry.detail}
                  current={current}
                  live={live}
                  sprites={sprites}
                />
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-daily">{t("web.itemLocationDialog.itMayHaveBeenMovedSinceTheLatestSave")}</p>
        )}
        <small className="item-locator-hint">{t("web.itemLocationDialog.clickItemCardsAnywhereInTheAppToOpen")}</small>
      </section>
    </div>
  );
}

function FishingView({
  current,
  live,
}: {
  current: Snapshot;
  live: LiveState;
}) {
  const { t, text } = useI18n();
  const brief = current.fishingBrief;
  const locationName = (name: string) => {
    const key = ({
      "Town River": "townRiver", "Forest River": "forestRiver", "Mountain Lake": "mountainLake",
      "Forest Pond": "forestPond", Ocean: "ocean", "Secret Woods": "secretWoods", Sewers: "sewers",
      Desert: "desert", "Ginger Island": "gingerIsland", "Ginger Island Ocean": "gingerOcean",
      "Ginger Island River/Pond": "gingerRiverPond", "Witch's Swamp": "witchSwamp",
      "Mutant Bug Lair": "mutantLair", "Night Market submarine": "nightMarketSubmarine",
      "The Mines · floor 20/60": "mines2060", "The Mines · floor 20": "mines20",
      "The Mines · floor 60": "mines60", "The Mines · floor 100": "mines100",
      "Ocean · east pier": "oceanEastPier", "Town · north of JojaMart": "townNorthJoja",
      "Mountain Lake · log island": "mountainLogIsland", "Forest · Arrowhead Island": "forestArrowhead",
      "Ginger Island · Pirate Cove": "pirateCove",
    } as Record<string, string>)[name];
    return key ? t(`fishing.location.${key}`) : name;
  };
  const [hour, setHour] = useState(600);
  const [useLiveTime, setUseLiveTime] = useState(true);
  const [fishListMode, setFishListMode] = useState<"collection" | "all">(() =>
    typeof window !== "undefined" &&
    window.localStorage.getItem("stardew-tool-fishing-list") === "all"
      ? "all"
      : "collection",
  );
  const followingLiveTime = Boolean(
    live.active && live.timeOfDay && useLiveTime,
  );
  const displayedHour = followingLiveTime ? live.timeOfDay! : hour;
  const liveWeather = live.active
    ? live.raining
      ? "rainy"
      : "sunny"
    : brief.weather;
  const fishingLevel = live.active
    ? (live.fishingLevel ?? current.progress.fishing)
    : current.progress.fishing;
  const liveCaught =
    live.active && live.collections
      ? new Set(live.collections.caughtFish.map((id) => id.replace("(O)", "")))
      : null;
  const trackedFish = brief.fish.map((fish) => ({
    ...fish,
    displayName:
      current.localizedNamesByQualifiedId?.[`(O)${normalizeObjectId(fish.id)}`] ||
      current.localizedObjectNamesByEnglish?.[fish.name] ||
      fish.name,
    caught: liveCaught
      ? liveCaught.has(fish.id.replace("(O)", ""))
      : fish.caught,
  }));
  const acceptedMissionQuests = live.active
    ? (live.acceptedQuests || []).filter((quest) => quest.accepted !== false)
    : (current.dailyBrief.acceptedQuests || []).filter(
        (quest) => quest.accepted,
      );
  const fishingQuests = acceptedMissionQuests.filter((quest) =>
    trackedFish.some(
      (fish) =>
        normalizeObjectId(fish.id) === normalizeObjectId(quest.requestedId),
    ),
  );
  const questForFish = (fish: FishingFish) =>
    fishingQuests.find(
      (quest) =>
        normalizeObjectId(fish.id) === normalizeObjectId(quest.requestedId),
    );
  const questProgress = (quest: (typeof fishingQuests)[number]) => {
    if (quest.type !== "ItemDelivery") return quest.progress || 0;
    if (live.active)
      return (live.inventory || [])
        .filter(
          (item) =>
            inventoryItemId(item) ===
              normalizeObjectId(quest.requestedId),
        )
        .reduce((sum, item) => sum + item.count, 0);
    return "owned" in quest ? quest.owned : quest.progress || 0;
  };
  const weatherMatches = (fish: FishingFish) =>
    fish.weather === "both" || fish.weather === liveWeather;
  const timeMatches = (fish: FishingFish) =>
    fish.windows.some(
      ([start, end]) => displayedHour >= start && displayedHour < end,
    );
  const liveFishingAreas = live.active
    ? (
        {
          Beach: ["Ocean"],
          Town: ["Town River"],
          Forest: ["Forest River", "Forest Pond"],
          Mountain: ["Mountain Lake"],
        } as Record<string, string[]>
      )[live.locationId || ""] || []
    : [];
  const atLiveLocation = (fish: FishingFish) =>
    liveFishingAreas.some((area) => fish.accessibleLocations.includes(area));
  const seasonal = trackedFish.filter(
    (fish) =>
      fish.seasons.includes(brief.season) &&
      weatherMatches(fish) &&
      fish.accessibleLocations.length > 0,
  );
  const hourStatus = (value: number) => {
    const fishAtHour = seasonal.filter((fish) =>
      fish.windows.some(([start, end]) => value >= start && value < end),
    );
    const missing = fishAtHour.filter((fish) => !fish.caught).length;
    return {
      available: fishAtHour.length,
      missing,
      complete: fishAtHour.length > 0 && missing === 0,
    };
  };
  const available = seasonal.filter(timeMatches);
  const missingNow = available
    .filter((fish) => !fish.caught)
    .sort(
      (a, b) =>
        Number(Boolean(questForFish(b))) - Number(Boolean(questForFish(a))) ||
        b.basePrice - a.basePrice ||
        a.difficulty - b.difficulty,
    );
  const allAvailable = [...available].sort(
    (a, b) =>
      Number(atLiveLocation(b)) - Number(atLiveLocation(a)) ||
      Number(Boolean(questForFish(b))) - Number(Boolean(questForFish(a))) ||
      Number(a.caught) - Number(b.caught) ||
      b.basePrice - a.basePrice,
  );
  const displayedFish =
    fishListMode === "collection" ? missingNow : allAvailable;
  const laterToday = seasonal
    .filter(
      (fish) =>
        !fish.caught &&
        !timeMatches(fish) &&
        fish.windows.some(([start]) => start > displayedHour),
    )
    .sort(
      (a, b) =>
        Math.min(...a.windows.map((window) => window[0])) -
        Math.min(...b.windows.map((window) => window[0])),
    );
  const locationScores = new Map<
    string,
    { location: string; fish: DisplayFishingFish[]; score: number }
  >();
  for (const fish of available)
    for (const location of fish.accessibleLocations) {
      const group = locationScores.get(location) || {
        location,
        fish: [],
        score: 0,
      };
      group.fish.push(fish);
      locationScores.set(location, group);
    }
  const moneySpots = [...locationScores.values()]
    .map((group) => {
      const ranked = [...group.fish].sort((a, b) => b.basePrice - a.basePrice);
      const values = ranked
        .slice(0, 3)
        .map(
          (fish) =>
            fish.basePrice *
            Math.max(
              0.3,
              1.1 - Math.max(0, fish.difficulty - fishingLevel * 5) / 120,
            ),
        );
      return {
        ...group,
        fish: ranked,
        score: Math.round(
          values.reduce((sum, value) => sum + value, 0) /
            Math.max(1, values.length),
        ),
      };
    })
    .sort((a, b) => b.score - a.score);
  const bestSpot = moneySpots[0];
  const caughtTracked = trackedFish.filter((fish) => fish.caught).length;
  const questFishDetails = fishingQuests.map((quest) => {
    const fish = trackedFish.find(
      (item) =>
        normalizeObjectId(item.id) === normalizeObjectId(quest.requestedId),
    );
    const catchableNow = Boolean(
      fish &&
      fish.seasons.includes(brief.season) &&
      weatherMatches(fish) &&
      timeMatches(fish) &&
      fish.accessibleLocations.length > 0,
    );
    return { quest, fish, catchableNow };
  });
  const chooseFishListMode = (mode: "collection" | "all") => {
    setFishListMode(mode);
    window.localStorage.setItem("stardew-tool-fishing-list", mode);
  };

  return (
    <section className="fishing-page">
      <div className="fishing-heading">
        <div>
          <p className="eyebrow">
            {t("fishing.eyebrow")}{" "}
            {live.active && <span className="live-badge">{t("status.live")}</span>}
          </p>
          <h1>{t("fishing.title")}</h1>
          <p>
            {t("date.game", { year: current.year, season: t(`season.${current.season}`), day: current.day })} ·{" "}
            {t(`fishing.weather.${liveWeather}`)} · {t("fishing.level", { level: fishingLevel })}
            {live.active ? ` · ${live.location || t("shell.unknownLocation")}` : ""}
          </p>
        </div>
        <div className="fish-progress">
          <strong>
            {caughtTracked}/{trackedFish.length}
          </strong>
          <span>{t("fishing.recorded")}</span>
        </div>
      </div>
      <section className="fishing-clock">
        <div>
          <p className="eyebrow">
            {followingLiveTime ? t("fishing.liveTime") : t("fishing.planningTime")}
          </p>
          <h2>{fishTime(displayedHour)}</h2>
          <small>
            {t("fishing.clockHelp")}
          </small>
          {live.active && !followingLiveTime && (
            <button
              type="button"
              className="use-live-time"
              onClick={() => setUseLiveTime(true)}
            >
              {t("fishing.returnLive", { time: fishTime(live.timeOfDay || 600) })}
            </button>
          )}
        </div>
        <div className="hour-buttons">
          {fishingHours.map((value) => {
            const status = hourStatus(value);
            return (
              <button
                className={`${!followingLiveTime && displayedHour === value ? "active " : ""}${status.complete ? "complete" : status.missing ? "pending" : "empty"}`}
                onClick={() => {
                  setHour(value);
                  setUseLiveTime(false);
                }}
                aria-label={t(status.complete ? "fishing.hourComplete" : status.missing ? "fishing.hourMissing" : "fishing.hourEmpty", { time: fishTime(value), count: status.missing })}
                key={value}
              >
                <span>{fishTime(value).replace(" (+1)", "")}</span>
                <b>{status.complete ? "✓" : status.missing || "–"}</b>
              </button>
            );
          })}
        </div>
      </section>
      {questFishDetails.length > 0 && (
        <div className="fishing-quest-list">
          {questFishDetails.map(({ quest, fish, catchableNow }, index) => (
            <section
              className={`fishing-quest ${catchableNow ? "catchable" : "waiting"}`}
              key={`${quest.requestedId || quest.requestedName}-${index}`}
            >
              <div className="mission-fish-art">
                <SheetArtwork
                  id={normalizeObjectId(quest.requestedId)}
                  kind="object"
                  label={quest.requestedName || t("fishing.requestedFish")}
                />
              </div>
              <div className="mission-fish-copy">
                <p className="eyebrow">
                  {t("fishing.missionPriority")} · {live.active ? t("status.live") : t("status.localSave")}
                </p>
                <h2>
                   {quest.requestedName || localizedQuestTitle(quest, t, text)}
                  {quest.requester && <small> {t("fishing.forRequester", { requester: quest.requester })}</small>}
                </h2>
                <strong>
                   {text(quest.objective) ||
                    t("fishing.catchTarget", { count: quest.target || 1, fish: quest.requestedName || t("fishing.fish") })}
                </strong>
                {fish ? (
                  <div className="mission-fish-conditions">
                    <span>
                      {(fish.accessibleLocations.length ? fish.accessibleLocations : fish.locations).map(locationName).join(" · ")}
                    </span>
                    <span>{fishWindow(fish)}</span>
                    <span>
                      {fish.weather === "both"
                        ? t("fishing.anyWeather")
                        : fish.weather === "rainy"
                          ? t("fishing.rainRequired")
                          : t("fishing.weather.sunny")}
                    </span>
                    <span>{t("fishing.difficulty", { difficulty: fish.difficulty })}</span>
                    {atLiveLocation(fish) && (
                      <span className="current-area-chip">
                        {t("fishing.availableHere")}
                      </span>
                    )}
                  </div>
                ) : (
                  <p>
                    {t("fishing.notInCatalog", { fish: quest.requestedName || t("fishing.requestedFish") })}
                  </p>
                )}
              </div>
              <div className="mission-fish-progress">
                <b>
                  {questProgress(quest)}/{quest.target || 1}
                </b>
                <small>
                  {quest.type === "ItemDelivery" &&
                  questProgress(quest) >= (quest.target || 1)
                    ? t("fishing.readyToDeliver", { requester: quest.requester || t("fishing.requester") })
                    : catchableNow
                      ? t("fishing.catchableNow")
                      : t("fishing.changeConditions")}
                </small>
              </div>
            </section>
          ))}
        </div>
      )}
      <div className="fishing-grid">
        <article className="fish-panel collection-panel">
          <div className="card-title fishing-list-title">
            <div>
              <p className="eyebrow">{t("fishing.availableNow")}</p>
              <h2>
                {fishListMode === "collection"
                  ? t("fishing.missingCollection")
                  : t("fishing.everyCatchable")}
              </h2>
              <div className="fish-list-tabs">
                <button
                  type="button"
                  className={fishListMode === "collection" ? "active" : ""}
                  onClick={() => chooseFishListMode("collection")}
                >
                  {t("fishing.collectionCount", { count: missingNow.length })}
                </button>
                <button
                  type="button"
                  className={fishListMode === "all" ? "active" : ""}
                  onClick={() => chooseFishListMode("all")}
                >
                  {t("fishing.allAvailable", { count: allAvailable.length })}
                </button>
              </div>
            </div>
            <strong className="fish-count">{displayedFish.length}</strong>
          </div>
          {displayedFish.length ? (
            <div className="fish-list">
              {displayedFish.map((fish) => {
                const mission = questForFish(fish);
                const here = atLiveLocation(fish);
                return (
                  <div
                    className={`fish-row ${fish.caught ? "caught" : "missing"} ${mission ? "mission-fish" : ""} ${here ? "current-location-fish" : ""}`}
                    key={fish.id}
                  >
                    <SheetArtwork
                      id={fish.id}
                      kind="object"
                      label={fish.displayName}
                    />
                    <div>
                      <strong>
                        {fish.displayName}
                        {mission && <em>{t("fishing.mission")}</em>}
                        {here && <em className="here-badge">{t("fishing.here")}</em>}
                        {fishListMode === "all" && fish.caught && (
                          <em className="caught-badge">{t("fishing.caught")}</em>
                        )}
                      </strong>
                      <small>{fish.accessibleLocations.map(locationName).join(" · ")}</small>
                      <WikiLink name={fish.name} label={t("fishing.wiki")} />
                    </div>
                    <div className="fish-meta">
                      <b>{fish.basePrice}g</b>
                      <span>
                        {fishWindow(fish)} · {t("fishing.difficulty", { difficulty: fish.difficulty })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="fish-empty">
              {fishListMode === "collection"
                ? t("fishing.noneMissingNow")
                : t("fishing.noneAvailableNow")}
            </p>
          )}
          {laterToday.length > 0 && (
            <div className="later-fish">
              <strong>{t("fishing.laterToday")}</strong>
              {laterToday.slice(0, 6).map((fish) => (
                <span
                  className={questForFish(fish) ? "mission-fish" : ""}
                  key={fish.id}
                >
                  <SheetArtwork id={fish.id} kind="object" label={fish.displayName} />
                  <b>{fish.displayName}</b>
                  {questForFish(fish) && <em>{t("fishing.mission")}</em>} · {fishWindow(fish)}{" "}
                  · {locationName(fish.accessibleLocations[0])}
                </span>
              ))}
            </div>
          )}
        </article>
        <article className="fish-panel money-panel">
          <div className="card-title">
            <div>
              <p className="eyebrow">{t("fishing.optimizeIncome")}</p>
              <h2>
                {bestSpot
                  ? t("fishing.goTo", { location: locationName(bestSpot.location) })
                  : t("fishing.noArea")}
              </h2>
            </div>
            {bestSpot && (
              <strong className="money-score">
                {bestSpot.score}
                <small>{t("fishing.score")}</small>
              </strong>
            )}
          </div>
          {bestSpot ? (
            <>
              <p className="money-explanation">
                {t("fishing.incomeExplanation")}
              </p>
              <div className="money-targets">
                {bestSpot.fish.slice(0, 5).map((fish, index) => (
                  <div
                    className={questForFish(fish) ? "mission-fish" : ""}
                    key={fish.id}
                  >
                    <span>{index + 1}</span>
                    <SheetArtwork
                      id={fish.id}
                      kind="object"
                      label={fish.displayName}
                    />
                    <strong>
                      {fish.displayName}
                      {questForFish(fish) && <em>{t("fishing.mission")}</em>}
                    </strong>
                    <b>{fish.basePrice}g</b>
                    <small>
                      {fish.caught
                        ? t("fishing.alreadyCaught")
                        : t("fishing.newCollection")}{" "}
                      · {t("fishing.difficulty", { difficulty: fish.difficulty })}
                    </small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="fish-empty">
              {t("fishing.noRodFish")}
            </p>
          )}
          {moneySpots.length > 1 && (
            <div className="alternative-spots">
              <strong>{t("fishing.alternatives")}</strong>
              {moneySpots.slice(1, 5).map((spot) => (
                <span key={spot.location}>
                  <b>{locationName(spot.location)}</b>
                  <i
                    style={{
                      width: `${Math.max(8, (spot.score / Math.max(1, bestSpot?.score || 1)) * 100)}%`,
                    }}
                  />
                  {spot.score}
                </span>
              ))}
            </div>
          )}
        </article>
      </div>
      <p className="fishing-note">
        {t("fishing.liveNote")}
      </p>
    </section>
  );
}

const communityRoomKeys: Record<string, string> = {
  Pantry: "pantry",
  "Crafts Room": "craftsRoom",
  "Fish Tank": "fishTank",
  "Boiler Room": "boilerRoom",
  Vault: "vault",
  "Bulletin Board": "bulletinBoard",
  "Abandoned Joja Mart": "abandonedJojaMart",
};

function routeLocationName(location: string, t: Translate) {
  const key = location.replace(/\s+/g, "").toLowerCase();
  const known = new Set([
    "farm", "farmcave", "beach", "town", "mountain", "railroad",
    "backwoods", "cindersapforest", "secretwoods", "desert", "busstop",
  ]);
  return known.has(key) ? t(`location.${key}`) : location;
}

function localizedTerrainFeature(feature: Terrain, t: Translate) {
  const kindKey: Record<string, string> = {
    Grass: "grass",
    HoeDirt: "tilledSoil",
    FruitTree: "fruitTree",
    Bush: "bush",
    Flooring: "flooring",
  };
  if (feature.kind !== "Tree")
    return kindKey[feature.kind] ? t(`map.terrain.${kindKey[feature.kind]}`) : feature.kind;
  const treeKey: Record<string, string> = {
    Oak: "oak", Maple: "maple", Pine: "pine", Mahogany: "mahogany", Mushroom: "mushroom",
  };
  const tree = feature.treeType && treeKey[feature.treeType]
    ? t(`map.tree.${treeKey[feature.treeType]}`)
    : t("map.tree.generic");
  return t(feature.tapped ? "map.tree.detailTapped" : "map.tree.detail", {
    tree,
    stage: feature.stage ?? 0,
  });
}

function localizedStorageSource(source: string, t: Translate) {
  return source
    .replace(/^Backpack\b/, t("storage.backpack"))
    .replace(/^Chest\b/, t("storage.chest"))
    .replace(/\bFarmHouse\b|\bFarmhouse\b/g, t("storage.farmhouse"))
    .replace(/\bFarm\b/g, t("nav.farm"))
    .replace(/ · tile /g, ` · ${t("storage.tile")} `);
}

function routeItemName(item: DisplayNamedGameValue, t: Translate) {
  if (item.name === "Artifact Spot") return t("world.artifactSpot");
  if (item.name === "Seed Spot") return t("world.seedSpot");
  return item.displayName || item.name;
}

const CROP_PLAN_KEYS: Record<string, string> = {
  "400": "strawberry", "190": "cauliflower", "192": "potato",
  "258": "blueberry", "254": "melon", "304": "hops", "256": "tomato",
  "268": "starfruit", "282": "cranberry", "276": "pumpkin",
};

const BUILDING_PLAN_KEYS: Record<string, string> = {
  Silo: "silo", Well: "well", Coop: "coop", Barn: "barn", Mill: "mill",
  Shed: "shed", "Fish Pond": "fishPond", "Slime Hutch": "slimeHutch",
  Stable: "stable", "Shipping Bin": "shippingBin", "Pet Bowl": "petBowl",
  Cabin: "cabin", "Big Coop": "bigCoop", "Deluxe Coop": "deluxeCoop",
  "Big Barn": "bigBarn", "Deluxe Barn": "deluxeBarn", "Big Shed": "bigShed",
  "Farmhouse Upgrade 1": "farmhouse1", "Farmhouse Upgrade 2": "farmhouse2",
  "Farmhouse Upgrade 3": "farmhouse3", "Junimo Hut": "junimoHut",
  "Earth Obelisk": "earthObelisk", "Water Obelisk": "waterObelisk",
  "Desert Obelisk": "desertObelisk", "Island Obelisk": "islandObelisk",
  "Gold Clock": "goldClock", "Pam's House": "pamsHouse",
  "Town Shortcuts": "townShortcuts",
};

function buildingDisplayName(name: string, t: Translate) {
  const key = BUILDING_PLAN_KEYS[name];
  return key ? t(`building.${key}.name`) : name;
}

function localizedInteriorName(interior: Interior, t: Translate) {
  const compact = interior.name.replace(/[\s_-]+/g, "").toLowerCase();
  if (compact === "farmhouse") return t("storage.farmhouse");
  if (compact === "farmcave") return t("location.farmcave");
  const buildingName = Object.keys(BUILDING_PLAN_KEYS).find(
    (name) => name.replace(/[\s_-]+/g, "").toLowerCase() === compact,
  );
  return buildingName ? buildingDisplayName(buildingName, t) : interior.label;
}

function localizedHistoryAnnotation(
  annotation: LocalizedValue,
  t: Translate,
  text: (value: LocalizedValue | null | undefined) => string,
) {
  if (typeof annotation === "string") return annotation;
  const variables = { ...(annotation.variables || {}) };
  if (typeof variables.building === "string")
    variables.building = buildingDisplayName(variables.building, t);
  if (typeof variables.tool === "string") {
    const key: Record<string, string> = {
      axe: "axe", pickaxe: "pickaxe", hoe: "hoe", wateringcan: "wateringCan", trashcan: "trashCan",
    };
    const normalized = variables.tool.replace(/[\s_-]+/g, "").toLowerCase();
    if (key[normalized]) variables.tool = t(`history.tool.${key[normalized]}`);
  }
  if (typeof variables.tier === "string")
    variables.tier = t(`history.tier.${variables.tier.toLowerCase()}`);
  if (typeof variables.skill === "string")
    variables.skill = t(`history.skill.${variables.skill.toLowerCase()}`);
  return text({ ...annotation, variables });
}

function buildingPlanText(building: BuildingPlan, field: "name" | "why" | "prerequisite" | "unlock", t: Translate) {
  const key = BUILDING_PLAN_KEYS[building.name];
  const fallback = field === "name" ? buildingDisplayName(building.name, t) : building[field] || "";
  return key ? t(`building.${key}.${field}`) : fallback;
}

function buildingCategoryName(category: string, t: Translate) {
  const key = category.toLowerCase();
  return ["all", "robin", "upgrades", "wizard", "community"].includes(key)
    ? t(`building.category.${key}`)
    : category;
}

function buildingProjectTypeName(projectType: string, t: Translate) {
  const key: Record<string, string> = {
    "Farm building": "farmBuilding", "Building upgrade": "buildingUpgrade",
    "Home upgrade": "homeUpgrade", "Magical building": "magicalBuilding",
    "Community upgrade": "communityUpgrade", "Multiplayer cabin · 7 styles": "multiplayerCabin",
  };
  return key[projectType] ? t(`building.projectType.${key[projectType]}`) : projectType;
}

function cropPlanNote(crop: CropPlan, t: Translate) {
  const key = crop.id && CROP_PLAN_KEYS[crop.id];
  return key ? t(`cropPlan.${key}.note`) : crop.note;
}
const communityBundleKeys: Record<string, string> = {
  "0": "springCrops", "1": "summerCrops", "2": "fallCrops", "3": "qualityCrops",
  "4": "animal", "5": "artisan", "6": "riverFish", "7": "lakeFish",
  "8": "oceanFish", "9": "nightFishing", "10": "specialtyFish", "11": "crabPot",
  "13": "springForaging", "14": "summerForaging", "15": "fallForaging",
  "16": "winterForaging", "17": "construction", "19": "exoticForaging",
  "20": "blacksmith", "21": "geologist", "22": "adventurer",
  "23": "vault2500", "24": "vault5000", "25": "vault10000", "26": "vault25000",
  "31": "chef", "32": "fieldResearch", "33": "enchanter", "34": "dye",
  "35": "fodder", "36": "missing",
};
const communityRoomName = (id: string, translate: Translate) =>
  translate(`community.room.${communityRoomKeys[id] || "restoration"}.name`);
const communityRoomReward = (id: string, translate: Translate) => {
  const key = communityRoomKeys[id] || "restoration";
  return {
    name: translate(`community.room.${key}.reward`),
    description: translate(`community.room.${key}.description`),
  };
};
const communityBundleName = (id: string, fallback: string, translate: Translate) => {
  const key = communityBundleKeys[id];
  return key ? translate(`community.bundle.${key}`) : fallback;
};

function CommunityRoomArtwork({ room }: { room: CommunityRoom }) {
  const { t } = useI18n();
  const label = communityRoomName(room.id, t);
  const state =
    room.total > 0 && room.completed >= room.total ? "complete" : "ruined";
  return (
    <span
      className="community-room-artwork"
      title={t("community.room.preview", { room: label })}
      aria-hidden="true"
    >
      <b>{label.slice(0, 1)}</b>
      {/* This private room preview is rendered from the user's local Community Center map and tilesheets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/community-rooms/${encodeURIComponent(room.id)}-${state}.png`}
        alt=""
        onError={(event) => {
          event.currentTarget.hidden = true;
          event.currentTarget.parentElement?.classList.add("missing");
        }}
      />
    </span>
  );
}

type PlanningSection =
  | "community"
  | "crops"
  | "buildings"
  | "production"
  | "animals"
  | "friends"
  | "storage"
  | "goals";
function PlanningView({
  current,
  live,
  history,
  sprites,
  mode = "plan",
  onNavigateSection,
}: {
  current: Snapshot;
  live: LiveState;
  history: FarmHistory;
  sprites: Record<string, HTMLImageElement>;
  mode?: "farm" | "plan";
  onNavigateSection?: (section: PlanningSection) => void;
}) {
  const { t, locale } = useI18n();
  const [section, setSection] = useState<PlanningSection>(() => {
    if (typeof window === "undefined") return mode === "farm" ? "crops" : "community";
    const saved = window.localStorage.getItem(`stardew-tool-${mode}-section`);
    const allowed = mode === "farm" ? ["crops", "production", "animals", "storage"] : ["community", "crops", "buildings", "friends", "goals"];
    if (!allowed.includes(String(saved))) return mode === "farm" ? "crops" : "community";
    return saved === "community" ||
      saved === "crops" ||
      saved === "buildings" ||
      saved === "production" ||
      saved === "animals" ||
      saved === "friends" ||
      saved === "storage" ||
      saved === "goals"
      ? saved
      : "community";
  });
  useEffect(() => {
    const openSection = (event: Event) => {
      const detail = (event as CustomEvent<{ mode: "farm" | "plan"; section: PlanningSection }>).detail;
      if (detail.mode === mode) setSection(detail.section);
    };
    window.addEventListener("stardew:open-planning-section", openSection);
    return () => window.removeEventListener("stardew:open-planning-section", openSection);
  }, [mode]);
  const [friendSort, setFriendSort] = useState<
    "birthday" | "name" | "friendship"
  >("birthday");
  const [plantedCropSort, setPlantedCropSort] = useState<
    "name" | "quantity" | "harvest"
  >(() => {
    if (typeof window === "undefined") return "quantity";
    const saved = window.localStorage.getItem("stardew-tool-planted-crop-sort");
    return saved === "name" || saved === "harvest" ? saved : "quantity";
  });
  const [buildingCategory, setBuildingCategory] = useState<
    "All" | BuildingPlan["category"]
  >("All");
  const [buildingSort, setBuildingSort] = useState<"name" | "cost">(() =>
    typeof window === "undefined"
      ? "name"
      : window.localStorage.getItem("stardew-tool-building-sort") === "cost"
        ? "cost"
        : "name",
  );
  const [expandedFriend, setExpandedFriend] = useState<string | null>(null);
  const [storageQuery, setStorageQuery] = useState("");
  const [storageSort, setStorageSort] = useState<
    "name" | "quantity-desc" | "quantity-asc"
  >(() => {
    if (typeof window === "undefined") return "name";
    const saved = window.localStorage.getItem("stardew-tool-storage-sort");
    return saved === "quantity-desc" || saved === "quantity-asc" ? saved : "name";
  });
  const [storageView, setStorageView] = useState<"combined" | "containers">(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("stardew-tool-storage-view") === "containers"
        ? "containers"
        : "combined",
  );
  const [storageLocation, setStorageLocation] = useState(() =>
    typeof window === "undefined"
      ? "all"
      : window.localStorage.getItem("stardew-tool-storage-location") || "all",
  );
  const [personalGoals, setPersonalGoals] = useState<PersonalGoal[]>([]);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [craftingQuantity, setCraftingQuantity] = useState(1);
  useEffect(() => {
    window.localStorage.setItem(`stardew-tool-${mode}-section`, section);
  }, [mode, section]);
  useEffect(() => {
    window.localStorage.setItem(
      "stardew-tool-planted-crop-sort",
      plantedCropSort,
    );
  }, [plantedCropSort]);
  useEffect(() => {
    window.localStorage.setItem("stardew-tool-building-sort", buildingSort);
  }, [buildingSort]);
  useEffect(() => {
    window.localStorage.setItem("stardew-tool-storage-sort", storageSort);
  }, [storageSort]);
  useEffect(() => {
    window.localStorage.setItem("stardew-tool-storage-view", storageView);
  }, [storageView]);
  useEffect(() => {
    window.localStorage.setItem("stardew-tool-storage-location", storageLocation);
  }, [storageLocation]);
  useEffect(() => {
    fetch("/api/preferences", { cache: "no-store" })
      .then((response) => response.json())
      .then((preferences) => {
        if (Array.isArray(preferences.goals)) setPersonalGoals(preferences.goals);
      })
      .catch(() => undefined);
  }, []);

  const plan = current.planningBrief;
  const gameName = (name: string, qualifiedId?: string) =>
    resolveGameDisplayName(
      current.localizedNamesByQualifiedId || {},
      current.localizedObjectNamesByEnglish || {},
      name,
      qualifiedId,
    );
  const savedBackpackInventory = plan.inventory.filter(
    (item) => item.sources.includes("Backpack"),
  );
  const savedChestInventory = plan.inventory.filter(
    (item) => !item.sources.includes("Backpack"),
  );
  const inventory: StorageInventoryItem[] =
    live.active && live.inventory
      ? [
          ...live.inventory.map((item) => {
            const savedItem = savedBackpackInventory.find(
              (candidate) =>
                inventoryItemId(candidate) === inventoryItemId(item) &&
                candidate.name === item.name,
            );
            return {
              ...savedItem,
              ...item,
              spriteKind: item.spriteKind || savedItem?.spriteKind,
              spriteIndex: item.spriteIndex || savedItem?.spriteIndex,
              spriteWidth: item.spriteWidth || savedItem?.spriteWidth,
              spriteHeight: item.spriteHeight || savedItem?.spriteHeight,
              sources: ["Backpack · LIVE"],
              sourceCounts: [{ source: "Backpack · LIVE", count: item.count, quality: item.quality }],
              sourceDetails: [{ source: "Backpack · LIVE", kind: "backpack" as const }],
            };
          }),
          ...(live.storage !== undefined
              ? live.storage.map((item) => {
                const source = liveStorageSource(item);
                const savedItem = savedChestInventory.find(
                  (candidate) =>
                    inventoryItemId(candidate) === inventoryItemId(item) &&
                    candidate.name === item.name,
                );
                const savedDetail = savedItem?.sourceDetails?.find(
                  (detail) => detail.source === source,
                );
                return {
                  ...savedItem,
                  ...item,
                  spriteKind: item.spriteKind || savedItem?.spriteKind,
                  spriteIndex: item.spriteIndex || savedItem?.spriteIndex,
                  spriteWidth: item.spriteWidth || savedItem?.spriteWidth,
                  spriteHeight: item.spriteHeight || savedItem?.spriteHeight,
                  sources: [source],
                  sourceCounts: [{ source, count: item.count, quality: item.quality }],
                  sourceDetails: [{
                    source,
                    kind: "chest" as const,
                    name: item.containerName || savedDetail?.name,
                    itemId: item.containerItemId || savedDetail?.itemId,
                    color: item.containerColor ?? savedDetail?.color,
                    location: item.containerLocation || savedDetail?.location,
                    x: item.containerX ?? savedDetail?.x,
                    y: item.containerY ?? savedDetail?.y,
                  }],
                };
              })
            : savedChestInventory),
        ]
      : plan.inventory;
  const inventoryCount = (name: string) =>
    inventory
      .filter((item) => item.name === name)
      .reduce((sum, item) => sum + item.count, 0);
  const storageIndex = Object.values(
    inventory.reduce<
      Record<
        string,
        StorageInventoryItem & {
          qualities: number[];
          sourceCounts: { source: string; count: number; quality?: number }[];
          sourceDetails: StorageSourceDetail[];
        }
      >
    >((index, item) => {
      const key = `${inventoryItemId(item)}:${item.name}`;
      const existing = index[key] || {
        id: item.id,
        name: item.name,
        displayName: gameName(item.displayName || item.name, item.id),
        count: 0,
        quality: item.quality,
        qualities: [],
        sources: [],
        sourceCounts: [],
        sourceDetails: [],
        spriteKind: item.spriteKind,
        spriteIndex: item.spriteIndex,
        spriteWidth: item.spriteWidth,
        spriteHeight: item.spriteHeight,
      };
      existing.count += item.count;
      if (!existing.qualities.includes(item.quality))
        existing.qualities.push(item.quality);
      for (const source of item.sources) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
      }
      const sourceCounts = item.sourceCounts?.length
        ? item.sourceCounts
        : item.sources.length === 1
          ? [{ source: item.sources[0], count: item.count }]
          : [];
      for (const sourceCount of sourceCounts) {
        const stored = existing.sourceCounts.find(
          (entry) => entry.source === sourceCount.source,
        );
        if (stored) stored.count += sourceCount.count;
        else existing.sourceCounts.push({ ...sourceCount });
      }
      for (const detail of item.sourceDetails || []) {
        if (!existing.sourceDetails.some((entry) => entry.source === detail.source))
          existing.sourceDetails.push(detail);
      }
      if (!existing.spriteKind && item.spriteKind)
        existing.spriteKind = item.spriteKind;
      if (!existing.displayName && item.displayName)
        existing.displayName = item.displayName;
      if (!existing.spriteIndex && item.spriteIndex)
        existing.spriteIndex = item.spriteIndex;
      index[key] = existing;
      return index;
    }, {}),
  );
  const artworkForItem = (name: string) =>
    storageIndex.find((item) => item.name === name);
  const storageLocations = Array.from(
    new Set(storageIndex.flatMap((item) => item.sources)),
  ).sort((a, b) => a.localeCompare(b));
  const storageDetailBySource = new Map(
    storageIndex
      .flatMap((item) => item.sourceDetails || [])
      .map((detail) => [detail.source, detail] as const),
  );
  const displayStorageSource = (source: string) =>
    localizedStorageSource(
      readableStorageSource(source, storageDetailBySource.get(source), current, t),
      t,
    );
  const displayStorageLocation = (detail: StorageSourceDetail | undefined) =>
    readableStorageLocation(detail, current, t)
      .replace(/\bFarmhouse\b/g, t("storage.farmhouse"))
      .replace(/\bFarm\b/g, t("nav.farm"));
  const effectiveStorageLocation =
    storageLocation === "all" || storageLocations.includes(storageLocation)
      ? storageLocation
      : "all";
  const storageSearch = storageQuery.trim().toLowerCase();
  const sortStorageItems = <T extends { name: string; displayName?: string; count: number }>(items: T[]) =>
    [...items].sort((a, b) => {
      if (storageSort === "quantity-desc")
        return b.count - a.count || (a.displayName || a.name).localeCompare(b.displayName || b.name, locale);
      if (storageSort === "quantity-asc")
        return a.count - b.count || (a.displayName || a.name).localeCompare(b.displayName || b.name, locale);
      return (a.displayName || a.name).localeCompare(b.displayName || b.name, locale);
    });
  const visibleStorage = sortStorageItems(
    storageIndex
      .filter(
        (item) =>
          effectiveStorageLocation === "all" ||
          item.sources.includes(effectiveStorageLocation),
      )
      .map((item) => {
        if (effectiveStorageLocation === "all") return item;
        return {
          ...item,
          count:
            item.sourceCounts.find(
              (entry) => entry.source === effectiveStorageLocation,
            )
              ?.count || 0,
          sources: [effectiveStorageLocation],
        };
      })
      .filter((item) =>
          `${item.displayName || ""} ${item.name} ${item.sources.map(displayStorageSource).join(" ")}`
          .toLowerCase()
          .includes(storageSearch),
      ),
  );
  const storageGroups = (effectiveStorageLocation === "all"
    ? storageLocations
    : [effectiveStorageLocation]
  )
    .map((source) => ({
      source,
      detail: storageIndex
        .flatMap((item) => item.sourceDetails)
        .find((entry) => entry.source === source),
      items: sortStorageItems(
        storageIndex
          .map((item) => ({
            ...item,
            count:
              item.sourceCounts.find((entry) => entry.source === source)?.count ||
              0,
            sources: [source],
          }))
          .filter(
            (item) =>
              item.count > 0 &&
              `${item.displayName || ""} ${item.name} ${displayStorageSource(source)}`.toLowerCase().includes(storageSearch),
          ),
      ),
    }))
    .filter((group) => group.items.length > 0);
  const inventoryForRequirement = (requirement: BundleRequirement) =>
    inventory
      .filter(
        (item) => inventoryItemId(item) === normalizeObjectId(requirement.id),
      )
      .filter((item) => item.quality >= requirement.quality);
  const liveBundleProgress = new Map(
    (live.active ? live.collections?.bundleProgress || [] : []).map(
      (bundle) => [String(bundle.id), bundle.donated],
    ),
  );
  const liveCommunityRooms = plan.communityCenter.rooms.map((room) => {
    const bundles = room.bundles.map((bundle) => {
      const liveDonated = liveBundleProgress.get(bundle.id);
      const requirements = bundle.requirements.map((item, index) => {
        const stock = item.id === "-1" ? [] : inventoryForRequirement(item);
        const owned = item.id === "-1"
          ? (live.active ? (live.money ?? current.money) : current.money)
          : stock.reduce((sum, entry) => sum + entry.count, 0);
        const donated = liveDonated
          ? Boolean(liveDonated[index])
          : item.donated;
        return {
          ...item,
          donated,
          owned,
          ready: donated || owned >= item.count,
        };
      });
      const donated = requirements.filter((item) => item.donated).length;
      const ready = requirements.filter((item) => item.ready).length;
      return {
        ...bundle,
        requirements,
        donated,
        ready,
        complete: requirements.length
          ? donated >= bundle.required
          : bundle.complete,
      };
    });
    return {
      ...room,
      bundles,
      completed: bundles.filter((bundle) => bundle.complete).length,
    };
  });
  const community = {
    ...plan.communityCenter,
    rooms: liveCommunityRooms,
    completed: liveCommunityRooms.reduce(
      (sum, room) => sum + room.completed,
      0,
    ),
    readyItems: liveCommunityRooms.reduce(
      (sum, room) =>
        sum +
        room.bundles.reduce(
          (bundleSum, bundle) =>
            bundleSum +
            bundle.requirements.filter((item) => item.ready && !item.donated)
              .length,
          0,
        ),
      0,
    ),
  };
  const plantedCrops = Object.values(
    current.dailyBrief.crops.reduce<
      Record<
        string,
        {
          id: string;
          name: string;
          displayName: string;
          count: number;
          watered: number;
          daysRemaining: number;
          ready: boolean;
          harvestDates: string[];
        }
      >
    >((grouped, crop) => {
      const entry = grouped[crop.name] || {
        id: crop.id,
        name: crop.name,
        displayName: gameName(crop.name, `(O)${crop.id}`),
        count: 0,
        watered: 0,
        daysRemaining: crop.daysRemaining,
        ready: false,
        harvestDates: [],
      };
      entry.count += crop.count;
      entry.watered += crop.watered;
      entry.daysRemaining = Math.min(entry.daysRemaining, crop.daysRemaining);
      entry.ready ||= crop.ready;
      if (!entry.harvestDates.includes(crop.harvestDate))
        entry.harvestDates.push(crop.harvestDate);
      grouped[crop.name] = entry;
      return grouped;
    }, {}),
  ).sort((a, b) =>
    plantedCropSort === "name"
      ? a.displayName.localeCompare(b.displayName, locale)
      : plantedCropSort === "harvest"
        ? a.daysRemaining - b.daysRemaining || a.displayName.localeCompare(b.displayName, locale)
        : b.count - a.count || a.displayName.localeCompare(b.displayName, locale),
  );
  const displayHarvestDate = (value: string) => {
    return formatHarvestDate(value, t);
  };
  const readyDeliveries = readyBundleDeliveries(community).map((item) => ({
    ...item,
    sources: inventoryForRequirement(item).flatMap((stock) => stock.sources),
  }));
  const savedFriendships = plan.friendships.filter(isVanillaFriend);
  const liveFriendships = (live.friendships || []).filter(isVanillaFriend);
  const friendships =
    live.active && live.friendships
      ? savedFriendships
          .map((saved) => {
            const liveFriend = liveFriendships.find(
              (friend) => friend.name === (saved.id || saved.name),
            );
            return liveFriend
              ? {
                  ...saved,
                  ...liveFriend,
                  id: saved.id || liveFriend.name,
                  name: saved.name,
                }
              : saved;
          })
          .concat(
            liveFriendships
              .filter(
                (friend) =>
                  !savedFriendships.some(
                    (saved) => (saved.id || saved.name) === friend.name,
                  ),
              )
              .map((friend) => ({
                ...friend,
                id: friend.name,
                daysToBirthday: null,
                gifts: { love: [], like: [], neutral: [] },
              })),
          )
      : savedFriendships;
  const friendshipProjection = (friend: FriendshipPlan) => {
    const samples = history.entries
      .flatMap((entry) => {
        const match = entry.friendships?.find(
          (item) =>
            (item.id || item.name) === (friend.id || friend.name) ||
            item.name === friend.name,
        );
        return match
          ? [{ dayIndex: entry.dayIndex, points: match.points }]
          : [];
      })
      .filter(
        (sample) =>
          sample.dayIndex >= current.dayIndex - 28 &&
          sample.dayIndex <= current.dayIndex,
      );
    const first = samples[0];
    const last = samples.at(-1);
    const elapsed = first && last ? last.dayIndex - first.dayIndex : 0;
    const dailyGain =
      elapsed > 0 ? Math.max(0, (last!.points - first!.points) / elapsed) : 0;
    const evaluationDay = 225;
    const daysRemaining = Math.max(0, evaluationDay - current.dayIndex);
    const projectedPoints = Math.min(
      2500,
      Math.round(friend.points + dailyGain * daysRemaining),
    );
    return {
      dailyGain,
      projectedPoints,
      projectedHearts: Math.min(10, projectedPoints / 250),
      daysRemaining,
      sampleDays: elapsed,
    };
  };
  const sortedFriendships = [...friendships].sort((a, b) =>
    friendSort === "name"
      ? a.name.localeCompare(b.name)
      : friendSort === "friendship"
        ? b.points - a.points || a.name.localeCompare(b.name)
        : (a.daysToBirthday ?? 999) - (b.daysToBirthday ?? 999) ||
          b.points - a.points,
  );
  const projectedEightHeartFriends = friendships.filter(
    (friend) => friendshipProjection(friend).projectedPoints >= 1975,
  ).length;
  const pet = plan.pet || {
    name: "Pet",
    type: "Pet",
    points: current.grandpa.petFriendship,
  };
  const petSamples = history.entries.filter(
    (entry) =>
      typeof entry.petFriendship === "number" &&
      (pet.points === 0 || entry.petFriendship! > 0) &&
      entry.dayIndex >= current.dayIndex - 28,
  );
  const firstPetSample = petSamples[0];
  const lastPetSample = petSamples.at(-1);
  const petElapsed =
    firstPetSample && lastPetSample
      ? lastPetSample.dayIndex - firstPetSample.dayIndex
      : 0;
  const petDailyGain =
    petElapsed > 0
      ? Math.max(
          0,
          ((lastPetSample?.petFriendship || 0) -
            (firstPetSample?.petFriendship || 0)) /
            petElapsed,
        )
      : 0;
  const projectedPetPoints = Math.min(
    1000,
    Math.round(pet.points + petDailyGain * Math.max(0, 225 - current.dayIndex)),
  );
  const machines =
    live.active && live.machines !== undefined
      ? summarizeLiveMachines(live.machines, plan.machines)
      : [...plan.machines].sort(
          (a, b) =>
            b.ready - a.ready ||
            (b.idle ?? Math.max(0, b.count - b.ready - b.working)) -
              (a.idle ?? Math.max(0, a.count - a.ready - a.working)) ||
            a.name.localeCompare(b.name),
        );
  const animals = live.active && live.animals !== undefined
    ? live.animals
    : plan.animals || [];
  const machineTotals = machines.reduce(
    (totals, machine) => ({
      built: totals.built + machine.count,
      ready: totals.ready + machine.ready,
      working: totals.working + machine.working,
      idle:
        totals.idle +
        (machine.idle ??
          Math.max(0, machine.count - machine.ready - machine.working)),
    }),
    { built: 0, ready: 0, working: 0, idle: 0 },
  );
  const availableBuildings = plan.buildings.filter(
    (building) => building.available !== false,
  );
  const buildingCategories = (
    ["All", "Robin", "Upgrades", "Wizard", "Community"] as const
  ).filter(
    (category) =>
      category === "All" ||
      availableBuildings.some((building) => building.category === category),
  );
  const effectiveBuildingCategory = buildingCategories.includes(buildingCategory)
    ? buildingCategory
    : "All";
  const visibleBuildings = availableBuildings.filter(
    (building) =>
      effectiveBuildingCategory === "All" ||
      building.category === effectiveBuildingCategory,
  );
  const buildingMoney = live.active
    ? (live.money ?? current.money)
    : current.money;
  const buildingOptions = visibleBuildings.map((building) => {
    const materials = building.materials.map((material) => ({
      ...material,
      owned: live.active ? inventoryCount(material.name) : material.owned,
    }));
    const resourcesReady =
      buildingMoney >= building.money &&
      materials.every((item) => item.owned >= item.needed);
    const ready =
      !building.completed && building.prerequisiteMet && resourcesReady;
    const status = building.completed
      ? t("building.status.completed")
      : ready
        ? building.owned > 0
          ? t("building.status.readyOwned", { count: building.owned })
          : t("building.status.ready")
        : building.owned > 0
          ? t("building.status.owned", { count: building.owned })
          : !building.prerequisiteMet
            ? t("building.status.prerequisite")
            : t("building.status.materials");
    return { building, materials, ready, status };
  });
  const sortBuildingOptions = (items: typeof buildingOptions) =>
    [...items].sort((a, b) =>
      buildingSort === "cost"
        ? a.building.money - b.building.money ||
          a.building.name.localeCompare(b.building.name)
        : a.building.name.localeCompare(b.building.name),
    );
  const buildingGroups = [
    {
      id: "ready",
      title: t("building.group.ready.title"),
      detail: t("building.group.ready.detail"),
      items: sortBuildingOptions(
        buildingOptions.filter((option) => option.ready),
      ),
    },
    {
      id: "missing",
      title: t("building.group.missing.title"),
      detail: t("building.group.missing.detail"),
      items: sortBuildingOptions(
        buildingOptions.filter(
          (option) => !option.ready && !option.building.completed,
        ),
      ),
    },
    {
      id: "completed",
      title: t("building.group.completed.title"),
      detail: t("building.group.completed.detail"),
      items: sortBuildingOptions(
        buildingOptions.filter((option) => option.building.completed),
      ),
    },
  ];
  const recentEntries = history.entries.slice(-7);
  const recentDailyIncome = recentEntries.length
    ? recentEntries.reduce((sum, entry) => sum + entry.income, 0) /
      recentEntries.length
    : 0;
  const constructionTargets: StrategicGoalTarget[] = availableBuildings
    .filter((building) => !building.completed)
    .map((building) => {
      const materials = building.materials.map((material) => ({
        ...material,
        owned: inventoryCount(material.name),
      }));
      const missing = materials.filter(
        (material) => material.owned < material.needed,
      );
      const moneyMissing = Math.max(0, building.money - buildingMoney);
      const ready =
        building.prerequisiteMet &&
        moneyMissing === 0 &&
        missing.length === 0;
      const incomeDays =
        moneyMissing > 0 && recentDailyIncome > 0
          ? Math.ceil(moneyMissing / recentDailyIncome)
          : 0;
      return {
        id: `building:${building.name}`,
        category: t("goal.category.construction"),
        title: buildingPlanText(building, "name", t),
        progress: ready
          ? t("goal.construction.ready")
          : t("goal.materialsReady", { ready: materials.length - missing.length, total: materials.length }),
        bottleneck: !building.prerequisiteMet
          ? buildingPlanText(building, "prerequisite", t) || t("goal.previousUpgrade")
          : moneyMissing > 0
            ? t("goal.goldNeeded", { amount: moneyMissing.toLocaleString(locale) })
            : missing.length
              ? missing
                  .map(
                    (item) =>
                      `${item.needed - item.owned} ${item.displayName || item.name}`,
                  )
                  .join(" · ")
              : t("goal.noBottleneck"),
        forecast: ready
          ? t("goal.readyNow")
          : incomeDays
            ? t("goal.incomeDays", { days: incomeDays })
            : t("goal.noDate"),
        ready,
        requirements: [
          {
            name: t("community.gold"),
            available: buildingMoney,
            required: building.money,
            suffix: "g",
          },
          ...materials.map((material) => ({
            name: material.displayName || material.name,
            available: material.owned,
            required: material.needed,
            artwork: artworkForItem(material.name),
          })),
        ],
      };
    });
  const toolTiers = ["", "Copper", "Steel", "Gold", "Iridium"];
  const upgradeBars = ["", "Copper Bar", "Iron Bar", "Gold Bar", "Iridium Bar"];
  const upgradeCosts = [0, 2000, 5000, 10000, 25000];
  const toolTargets: StrategicGoalTarget[] = [
    "Axe",
    "Pickaxe",
    "Hoe",
    "Watering Can",
  ].flatMap((tool) => {
    const currentTier = storageIndex.reduce((highest, item) => {
      const tier = toolTiers.findIndex((prefix) =>
        prefix ? item.name === `${prefix} ${tool}` : item.name === tool,
      );
      return Math.max(highest, tier);
    }, 0);
    const targetTier = currentTier + 1;
    if (targetTier >= toolTiers.length) return [];
    const bar = upgradeBars[targetTier];
    const localizedBar = gameName(bar);
    const localizedTool = gameName(`${toolTiers[targetTier]} ${tool}`);
    const barMissing = Math.max(0, 5 - inventoryCount(bar));
    const moneyMissing = Math.max(0, upgradeCosts[targetTier] - buildingMoney);
    const ready = barMissing === 0 && moneyMissing === 0;
    return [{
      id: `tool:${tool}:${targetTier}`,
      category: t("goal.category.toolUpgrade"),
      title: localizedTool,
      progress: `${inventoryCount(bar)}/5 ${localizedBar} · ${buildingMoney.toLocaleString(locale)}/${upgradeCosts[targetTier].toLocaleString(locale)}g`,
      bottleneck: ready
        ? t("goal.tool.takeToClint")
        : [
            barMissing ? `${barMissing} ${localizedBar}` : "",
            moneyMissing ? `${moneyMissing.toLocaleString(locale)}g` : "",
          ].filter(Boolean).join(" · "),
      forecast:
        ready
          ? t("goal.tool.readyOrder")
          : moneyMissing > 0 && recentDailyIncome > 0
            ? t("goal.incomeDays", { days: Math.ceil(moneyMissing / recentDailyIncome) })
            : t("goal.tool.waiting"),
      ready,
      requirements: [
        {
          name: t("community.gold"),
          available: buildingMoney,
          required: upgradeCosts[targetTier],
          suffix: "g",
        },
        {
          name: localizedBar,
          available: inventoryCount(bar),
          required: 5,
          artwork: artworkForItem(bar),
        },
      ],
    }];
  });
  const craftingTargets: StrategicGoalTarget[] = commonCraftingGoals.map(
    (recipe) => {
      const materials = (Object.entries(recipe.materials) as [string, number][]).map(
        ([name, amount]) => ({
          name,
          displayName: gameName(name),
          needed: amount * craftingQuantity,
          owned: inventoryCount(name),
        }),
      );
      const missing = materials.filter((item) => item.owned < item.needed);
      const ready = missing.length === 0;
      return {
        id: `crafting:${recipe.name}`,
        category: t("goal.category.crafting"),
        title: t("goal.craftTitle", { count: craftingQuantity, item: gameName(recipe.name) }),
        progress: t("goal.materialsReady", { ready: materials.length - missing.length, total: materials.length }),
        bottleneck: ready
          ? t("goal.crafting.ingredientsReady")
          : missing
              .map((item) => `${item.needed - item.owned} ${item.displayName || item.name}`)
              .join(" · "),
        forecast: ready ? t("goal.crafting.ready") : t("goal.crafting.waiting"),
        ready,
        requirements: materials.map((material) => ({
          name: material.displayName || material.name,
          available: material.owned,
          required: material.needed,
          artwork: artworkForItem(material.name),
        })),
      };
    },
  );
  const bundleTargets: StrategicGoalTarget[] = community.rooms.flatMap((room) =>
    room.bundles
      .filter((bundle) => !bundle.complete)
      .map((bundle) => {
        const remaining = bundle.requirements.filter((item) => !item.donated);
        const available = remaining.filter((item) => item.ready);
        const needed = Math.max(0, bundle.required - bundle.donated);
        const ready = available.length >= needed;
        const missing = remaining
          .filter((item) => !item.ready)
          .slice(0, 4)
          .map((item) => item.displayName || item.name);
        return {
          id: `bundle:${room.id}:${bundle.id}`,
          category: t("goal.category.community"),
          title: `${communityRoomName(room.id, t)} · ${communityBundleName(bundle.id, bundle.name, t)}`,
          progress: t("goal.bundle.progress", { donated: bundle.donated, required: bundle.required, ready: available.length }),
          bottleneck: ready
            ? t("goal.bundle.itemsReady")
            : missing.length
              ? missing.join(" · ")
              : t("goal.bundle.moreItems", { count: needed - available.length }),
          forecast: ready ? t("goal.bundle.ready") : t("goal.bundle.waiting"),
          ready,
          requirements: remaining.map((item) => ({
            id: item.id,
            name: item.name,
            available: item.owned,
            required: item.count,
            artwork: artworkForItem(item.name),
          })),
          requirementsLabel: t("goal.bundle.choose", { count: needed }),
        };
      }),
  );
  const strategicTargets = [
    ...constructionTargets,
    ...toolTargets,
    ...craftingTargets,
    ...bundleTargets,
  ];
  const selectedTarget = strategicTargets.find(
    (target) => target.id === selectedTargetId,
  );
  const persistGoals = (goals: PersonalGoal[]) => {
    setPersonalGoals(goals);
    fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goals }),
    }).catch(() => undefined);
  };
  const addGoal = (title: string, targetId?: string) => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    persistGoals([
      ...personalGoals,
      {
        id,
        title: cleanTitle,
        ...(targetId ? { targetId } : {}),
        ...(goalDeadline.trim() ? { deadline: goalDeadline.trim() } : {}),
        done: false,
        createdAt: new Date().toISOString(),
      },
    ]);
    setGoalDraft("");
    setGoalDeadline("");
  };

  return (
    <section className="planning-page">
      <div className="planning-heading">
        <div>
          <p className="eyebrow">
            {t("planning.decisionCenter")}{" "}
            {live.active && <span className="live-badge">{t("status.live")}</span>}
          </p>
          <h1>{mode === "farm" ? t("planning.farmTitle") : t("planning.planTitle")}</h1>
          <p>
            {mode === "farm"
              ? t("planning.farmDescription")
              : t("planning.planDescription")}
          </p>
        </div>
        <div className="planning-balance">
          <strong>
            {(live.active
              ? (live.money ?? current.money)
              : current.money
            ).toLocaleString(locale)}
            g
          </strong>
          <span>
            {live.active
              ? `${formatLiveTime(live.timeOfDay)} · ${live.location}`
              : t("planning.savedDate", {
                  date: t("date.game", {
                    year: current.year,
                    season: t(`season.${current.season}`),
                    day: current.day,
                  }),
                })}
          </span>
        </div>
      </div>
      <nav className="planning-tabs" aria-label={t("planning.areas")}>
        {(
          (mode === "farm"
            ? [
                ["crops", t("planning.crops")],
                ["production", t("planning.production")],
                ["animals", t("planning.animals")],
                ["storage", t("planning.storage")],
              ]
            : [
            ["community", t("planning.community")],
            ["crops", t("planning.planting")],
            ["buildings", t("planning.buildings")],
            ["friends", t("planning.friendships")],
            ["goals", t("planning.goals")],
              ]) as [PlanningSection, string][]
        ).map(([id, label]) => (
          <button
            className={section === id ? "active" : ""}
            onClick={() => {
              setSection(id);
              onNavigateSection?.(id);
            }}
            key={id}
          >
            {label}
            {id === "community" && community.readyItems > 0 ? (
              <b>{community.readyItems}</b>
            ) : null}
          </button>
        ))}
      </nav>

      {section === "community" && (
        <div className="community-layout">
          <aside className="planning-summary">
            <p className="eyebrow">{t("web.planning.totalProgress")}</p>
            <strong>
              {community.completed}/{community.total}
            </strong>
            <span>{t("web.planning.completedBundles")}</span>
            <i>
              <b
                style={{
                  width: `${community.total ? (community.completed / community.total) * 100 : 0}%`,
                }}
              />
            </i>
            <p>
              {community.readyItems
                ? t("community.readyDeliveries", { count: community.readyItems })
                : t("community.noReadyDeliveries")}
            </p>
            {readyDeliveries.length > 0 && (
              <div className="ready-deliveries">
                {readyDeliveries.map((item) => (
                  <article
                    className="locatable-item-card"
                    data-storage-item={item.name}
                    title={t("storage.clickToLocate", { item: item.id === "-1" ? t("community.gold") : item.displayName || item.name })}
                    key={`${item.room}-${item.bundle}-${item.id}`}
                  >
                    <ItemMentionArtwork
                      id={item.id}
                      name={item.name}
                      item={artworkForItem(item.name)}
                    />
                    <div>
                      <strong>{formatBundleRequirement(item, t, locale)}</strong>
                      <span>
                        {communityRoomName(item.roomId, t)} · {communityBundleName(item.bundleId, item.bundle, t)}
                      </span>
                      <small>
                        {t("community.ownedAvailable", {
                          count: `${item.owned.toLocaleString(locale)}${item.id === "-1" ? "g" : ""}`,
                        })}{item.sources.length
                          ? ` · ${[...new Set(item.sources)].map(displayStorageSource).join(" · ")}`
                          : ""}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
          <div className="community-rooms">
            {community.rooms.map((room) => {
              const reward = communityRoomReward(room.id, t);
              const complete = room.total > 0 && room.completed >= room.total;
              return (
                <section
                  className={`community-room ${complete ? "complete" : ""}`}
                  key={room.id}
                >
                  <div className="room-title">
                    <div className="room-identity">
                      <CommunityRoomArtwork room={room} />
                      <div>
                        <p className="eyebrow">{t("web.planning.room")}</p>
                        <h2>{communityRoomName(room.id, t)}</h2>
                      </div>
                    </div>
                    <strong>
                      {room.completed}/{room.total}
                    </strong>
                  </div>
                  <div className={`room-reward ${complete ? "complete" : ""}`}>
                    <span>
                      {complete
                        ? t("community.rewardUnlocked")
                        : t("community.completionReward")}
                    </span>
                    <strong>{reward.name}</strong>
                    <small>{reward.description}</small>
                  </div>
                  {room.bundles.map((bundle) => (
                    <details
                      className={
                        bundle.complete
                          ? "bundle complete"
                          : bundle.ready >= bundle.required
                            ? "bundle ready"
                            : "bundle"
                      }
                      key={`${room.id}-${bundle.id}`}
                    >
                      <summary>
                        <span>
                          {bundle.complete
                            ? "✓"
                            : bundle.ready >= bundle.required
                              ? "!"
                              : "○"}
                        </span>
                        <strong>{communityBundleName(bundle.id, bundle.name, t)}</strong>
                        <small>
                          {bundle.complete
                            ? t("community.completed")
                            : t("community.bundleAvailable", {
                                ready: bundle.ready,
                                required: bundle.required,
                              })}
                        </small>
                      </summary>
                      <div className="bundle-items">
                        {bundle.requirements.map((item, index) => (
                          <div
                            className={`${item.donated ? "donated" : item.ready ? "ready" : "missing"} locatable-item-card`}
                            data-storage-item={item.name}
                            title={t("storage.clickToLocate", { item: item.displayName || item.name })}
                            key={`${bundle.id}-${item.id}-${index}`}
                          >
                            <span className="bundle-item-status">
                              {item.donated ? "✓" : item.ready ? "→" : "·"}
                            </span>
                            <ItemMentionArtwork
                              id={item.id}
                              name={item.name}
                              item={artworkForItem(item.name)}
                            />
                            <span className="bundle-item-copy">
                              <strong>{formatBundleRequirement(item, t, locale)}</strong>
                              <small>
                                {item.donated
                                  ? t("community.donated")
                                  : item.id === "-1"
                                    ? t("community.goldAvailable", { count: item.owned.toLocaleString(locale) })
                                    : t(item.quality ? "community.storedQuality" : "community.stored", {
                                        owned: item.owned,
                                        count: item.count,
                                        quality: t(`quality.${item.quality >= 4 ? "iridium" : item.quality === 2 ? "gold" : "silver"}`),
                                      })}
                              </small>
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </section>
              );
            })}
          </div>
        </div>
      )}

      {section === "crops" && (
        <div className="crop-planning-sections">
          {mode === "farm" && <section className="planted-section">
            <div className="crop-section-title">
              <div>
                <p className="eyebrow">{t("crops.fromSave")}</p>
                <h2>{t("crops.currentlyPlanted")}</h2>
                <p>{t("crops.description")}</p>
              </div>
              <div className="planted-sort-controls">
                <strong>
                  {plantedCrops.reduce((sum, crop) => sum + crop.count, 0)}
                  <small> {t("crops.plantedTiles")}</small>
                </strong>
                <label>
                  {t("storage.sort")}
                  <select
                    value={plantedCropSort}
                    onChange={(event) =>
                      setPlantedCropSort(
                        event.target.value as typeof plantedCropSort,
                      )
                    }
                  >
                    <option value="name">{t("crops.sortAlphabetical")}</option>
                    <option value="quantity">{t("crops.sortQuantity")}</option>
                    <option value="harvest">{t("crops.sortHarvest")}</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="planted-grid">
              {plantedCrops.map((crop) => (
                <article className={crop.ready ? "ready" : ""} key={crop.name}>
                  <SheetArtwork id={crop.id} kind="object" label={crop.displayName} />
                  <div>
                    <strong>
                      {crop.count}× {crop.displayName}
                    </strong>
                    <span>
                      {crop.ready
                        ? t("crops.readyToday")
                        : t("crops.nextHarvest", {
                            date: crop.harvestDates.map(displayHarvestDate).join(" / "),
                          })}
                    </span>
                    <small>
                      {t("crops.watered", { watered: crop.watered, count: crop.count })}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          </section>}
          {mode === "plan" && <section className="crop-options-section">
            <div className="crop-section-title">
              <div>
                <p className="eyebrow">{t("web.planning.plantingGuideForToday")}</p>
                <h2>{t("planning.plantOnDate", { date: t("date.seasonDay", { season: t(`season.${current.season}`), day: current.day }) })}</h2>
                <p>{t("web.planning.theseAreNotCropsDetectedOnYourFarmEach")}</p>
              </div>
            </div>
            <div className="crop-simulation-guide">
              <div>
                <b>{t("web.planning.assumes")}</b>
                <span>{t("web.planning.wateredEveryDay")}</span>
              </div>
              <div>
                <b>{t("web.planning.profitMeans")}</b>
                <span>{t("web.planning.baseQualityCropsSoldRawMinusTheSeedCost")}</span>
              </div>
              <div>
                <b>{t("web.planning.repeatCrops")}</b>
                <span>{t("web.planning.everyPossibleRegrowthBeforeTheSeasonEndsIsIncluded")}</span>
              </div>
              <div>
                <b>{t("web.planning.notIncluded")}</b>
                <span>{t("web.planning.fertilizerSpeedGroProfessionsProcessingOrMissedWatering")}</span>
              </div>
            </div>
            <div className="crop-plan-grid">
              {plan.crops.map((crop, index) => (
                <article
                  className={crop.harvests ? "crop-plan" : "crop-plan expired"}
                  key={crop.name}
                >
                  <span className="rank">{t("planning.rankProfit", { rank: index + 1 })}</span>
                  <p className="eyebrow">
                    {crop.harvests
                      ? t("planning.harvestsBeforeSeason", { count: crop.harvests, season: t("season.fall") })
                      : t("planning.noHarvestToday")}
                  </p>
                  <div className="crop-plan-identity">
                    <SheetArtwork
                      id={crop.id}
                      kind="object"
                      label={crop.displayName || crop.name}
                    />
                    <h2>{crop.displayName || crop.name}</h2>
                  </div>
                  <strong
                    className={
                      crop.profitPerTile >= 0 ? "positive" : "negative"
                    }
                  >
                    {crop.profitPerTile >= 0 ? "+" : ""}
                    {crop.profitPerTile}g
                    <small> {t("web.planning.estimatedRawProfitTile")}</small>
                  </strong>
                  <dl>
                    <div>
                      <dt>{t("web.planning.seedCost")}</dt>
                      <dd>{crop.seed}g</dd>
                    </div>
                    <div>
                      <dt>{t("web.planning.firstHarvestIn")}</dt>
                      <dd>{t("planning.daysCount", { count: crop.growth })}</dd>
                    </div>
                    <div>
                      <dt>{t("web.planning.latestSafePlantingDay")}</dt>
                      <dd>
                        {t("date.seasonDay", { season: t(`season.${current.season}`), day: crop.latestPlantDay })}
                      </dd>
                    </div>
                  </dl>
                  <p>{cropPlanNote(crop, t)}</p>
                </article>
              ))}
            </div>
            <p className="crop-simulation-footnote">{t("web.planning.latestSafePlantingDayMeansTheLastDayYou")}</p>
          </section>}
        </div>
      )}

      {section === "buildings" && (
        <div className="building-catalog">
          <section className="building-catalog-head">
            <div>
              <p className="eyebrow">{t("web.planning.constructionCatalog")}</p>
              <h2>{t("web.planning.constructionProjectsCurrentlyUnlocked")}</h2>
              <p>{t("web.planning.thisTabOnlyShowsProjectsYourFarmerCanCurrently")}</p>
            </div>
            <strong>
              {availableBuildings.length}
              <small>{t("web.planning.projects")}</small>
            </strong>
          </section>
          <div className="building-controls">
            <nav className="building-filters" aria-label={t("web.planning.buildingCategories")}>
              {buildingCategories.map((category) => (
                <button
                  type="button"
                  className={effectiveBuildingCategory === category ? "active" : ""}
                  onClick={() => setBuildingCategory(category)}
                  key={category}
                >
                  {buildingCategoryName(category, t)}
                  <b>
                    {category === "All"
                      ? availableBuildings.length
                      : availableBuildings.filter(
                          (building) => building.category === category,
                        ).length}
                  </b>
                </button>
              ))}
            </nav>
            <label>{t("web.planning.sortBy")}<select
                value={buildingSort}
                onChange={(event) =>
                  setBuildingSort(event.target.value as typeof buildingSort)
                }
              >
                <option value="name">{t("crops.sortAlphabetical")}</option>
                <option value="cost">{t("web.planning.costLowToHigh")}</option>
              </select>
            </label>
          </div>
          {buildingGroups.map(
            (group) =>
              group.items.length > 0 && (
                <section
                  className={`building-group ${group.id}`}
                  key={group.id}
                >
                  <header>
                    <div>
                      <p className="eyebrow">
                        {group.id === "ready"
                          ? t("building.group.ready.eyebrow")
                          : group.id === "completed"
                            ? t("building.group.completed.eyebrow")
                            : t("building.group.missing.eyebrow")}
                      </p>
                      <h2>{group.title}</h2>
                      <p>{group.detail}</p>
                    </div>
                    <strong>{group.items.length}</strong>
                  </header>
                  <div className="building-plan-list">
                    {group.items.map(
                      ({ building, materials, ready, status }) => (
                        <article
                          className={`${ready ? "can-build" : ""} ${building.completed ? "completed" : ""}`}
                          key={building.name}
                        >
                          <div className="building-description">
                            <BuildingPreview name={building.name} catalog />
                            <div>
                              <p className="eyebrow">
                                {buildingCategoryName(building.category, t)} · {buildingProjectTypeName(building.projectType, t)}
                              </p>
                              <h2>{buildingPlanText(building, "name", t)}</h2>
                              <p>{buildingPlanText(building, "why", t)}</p>
                              <WikiLink name={building.name} />
                              <div className="building-notes">
                                {building.footprint && (
                                  <span>{t("web.planning.footprint")}{building.footprint}</span>
                                )}
                                {building.prerequisite && (
                                  <span className="met">✓ {buildingPlanText(building, "prerequisite", t)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="building-price">
                            <strong>
                              {building.money.toLocaleString(locale)}g
                            </strong>
                            <small>
                              {buildingMoney >= building.money
                                ? t("building.money.enough")
                                : t("building.money.missing", { amount: (building.money - buildingMoney).toLocaleString(locale) })}
                            </small>
                            <b>{status}</b>
                          </div>
                          <div className="material-list">
                            {materials.length ? (
                              materials.map((material) => (
                                <span
                                  className={
                                    material.owned >= material.needed
                                      ? "done"
                                      : ""
                                  }
                                  key={material.name}
                                >
                                  <ItemMentionArtwork
                                    name={material.name}
                                    item={artworkForItem(material.name)}
                                  />
                                  <b>{material.displayName || material.name}</b>
                                  <em>
                                    {material.owned}/{material.needed}
                                  </em>
                                </span>
                              ))
                            ) : (
                              <span className="done">
                                <b>{t("web.planning.materials")}</b>{t("common.none")}</span>
                            )}
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                </section>
              ),
          )}
        </div>
      )}

      {section === "animals" && (
        animals.length ? (
          <section className="animal-dashboard">
            <div className="crop-section-title">
              <div>
                <p className="eyebrow">{t("crops.fromSave")}</p>
                <h2>{t("web.planning.yourAnimals")}</h2>
                <p>{t("web.planning.careStatusComesFromTheLatestSavedDay")}</p>
              </div>
              <strong>{animals.length}<small>{t("web.planning.animals")}</small></strong>
            </div>
            <div className="animal-grid">
              {animals.map((animal) => (
                <article key={animal.id} className={animal.petted ? "petted" : "needs-care"}>
                  <span>{animal.petted ? "✓" : "!"}</span>
                  <div><strong>{animal.name}</strong><small>{t(`animal.type.${animal.type.toLowerCase().replaceAll(" ", "")}`)} · {routeLocationName(animal.location, t)}</small></div>
                  <dl>
                    <div><dt>{t("web.planning.friendship")}</dt><dd>{animal.friendship}/1000</dd></div>
                    <div><dt>{t("web.planning.happiness")}</dt><dd>{animal.happiness}/255</dd></div>
                    <div><dt>{t("today.when.today")}</dt><dd>{animal.petted ? t("animal.petted") : t("animal.needsPetting")}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        ) : (
        <section className="empty-farm-section">
          <p className="eyebrow">{t("web.planning.farmAnimals")}</p>
          <h2>{t("web.planning.noAnimalsDetectedInThisSaveYet")}</h2>
          <p>{t("web.planning.coopsBarnsTheirInteriorsAndAnimalCareWillAppear")}</p>
        </section>
        )
      )}

      {section === "production" && (
        <div className="production-plan">
          <section>
            <p className="eyebrow">{t("web.planning.currentMachinesAndCrabPots")}{" "}
              {live.active && live.machines !== undefined && (
                <span className="live-badge">{t("status.live")}</span>
              )}
            </p>
            <h2>{t("web.planning.whatToCollectAndRefill")}</h2>
            <div className="production-overview">
              <span>
                <b>{machineTotals.built}</b>{t("web.planning.built")}</span>
              <span className={machineTotals.ready ? "attention" : ""}>
                <b>{machineTotals.ready}</b>{t("web.planning.ready")}</span>
              <span>
                <b>{machineTotals.working}</b>{t("web.planning.working")}</span>
              <span className={machineTotals.idle ? "idle" : ""}>
                <b>{machineTotals.idle}</b>{t("web.planning.idle")}</span>
            </div>
            {machines.length ? (
              <div className="machine-plan-grid">
                {machines.map((machine) => {
                  const idle =
                    machine.idle ??
                    Math.max(
                      0,
                      machine.count - machine.ready - machine.working,
                    );
                  const duration = formatMachineDuration(
                    machine.nextReadyMinutes,
                  );
                  const isCrabPot = machine.name === "Crab Pot";
                  return (
                    <details
                      className={
                        machine.ready ? "has-ready" : idle ? "has-idle" : ""
                      }
                      key={machine.name}
                    >
                      <summary>
                        <SheetArtwork
                          id={machine.id}
                          kind={isCrabPot ? "object" : "craftable"}
                          label={machine.displayName || machine.name}
                        />
                        <span className="machine-heading">
                          <strong>{machine.displayName || machine.name}</strong>
                          <span>{machine.count}{t("web.planning.built")}</span>
                          <b>
                            {machine.ready}{t("web.planning.ready.b22a12")}{machine.working}{t("web.planning.working.2de782")}{" "}
                            {idle}{t("web.planning.idle")}</b>
                        </span>
                      </summary>
                      <div className="machine-details">
                        {machine.readyOutputs?.length ? (
                          <p className="ready-output">
                            <b>{t("web.planning.collect")}</b>
                            {machine.readyOutputs
                              .map((item) => `${item.count}× ${item.displayName || item.name}`)
                              .join(" · ")}
                          </p>
                        ) : null}
                        {machine.inputs?.length ? (
                          <p>
                            <b>{t("web.home.processing")}</b>
                            {machine.inputs
                              .map((item) => `${item.count}× ${item.displayName || item.name}`)
                              .join(" · ")}
                            {machine.workingOutputs?.length
                              ? ` → ${machine.workingOutputs.map((item) => `${item.count}× ${item.displayName || item.name}`).join(" · ")}`
                              : ""}
                          </p>
                        ) : machine.working ? (
                          <p>
                            <b>{t("web.home.processing")}</b>
                            {machine.working}{t("web.planning.activeMachine")}{machine.working === 1 ? "" : "s"}
                          </p>
                        ) : null}
                        {duration && (
                          <p>
                            <b>{t("web.planning.nextCompletion")}</b>
                            {duration}
                          </p>
                        )}
                        {idle > 0 && (
                          <p className="idle-output">
                            <b>
                              {isCrabPot ? t("web.production.checkBait") : t("web.production.availableCapacity")}
                            </b>
                            {isCrabPot
                              ? t("web.production.crabPotsWaiting", { count: idle })
                              : t("web.production.machinesAvailable", { count: idle })}
                          </p>
                        )}
                        {machine.locations?.length ? (
                          <p>
                            <b>{t("storage.location")}</b>
                            {machine.locations.join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </details>
                  );
                })}
              </div>
            ) : (
              <p className="empty-daily">{t("web.planning.noProductionMachinesOrCrabPotsHaveBeenDetected")}</p>
            )}
          </section>
          <section className="production-advice">
            <p className="eyebrow">{t("web.planning.nextBottleneck")}</p>
            <h2>
              {machines.some((machine) => machine.name === "Keg")
                ? t("web.production.fillKegsFirst")
                : t("web.production.preserveJarsFirst")}
            </h2>
            <p>
              {machines.some((machine) => machine.name === "Keg")
                ? t("web.production.kegAdvice")
                : machineTotals.ready
                  ? t("web.production.collectBeforeBatch", { count: machineTotals.ready })
                  : machineTotals.idle
                    ? t("web.production.fillIdleBeforeCrafting", { count: machineTotals.idle })
                    : t("web.production.futureProcessingAdvice")}
            </p>
            <div className="reserve-list">
              <span>
                <b>{t("web.planning.blueberry")}</b>
                {inventoryCount("Blueberry")}{t("web.planning.stored")}</span>
              <span>
                <b>{t("web.planning.melon")}</b>
                {inventoryCount("Melon")}{t("web.planning.stored")}</span>
              <span>
                <b>{t("web.planning.hops")}</b>
                {inventoryCount("Hops")}{t("web.planning.stored")}</span>
              <span>
                <b>{t("web.planning.starfruit")}</b>
                {inventoryCount("Starfruit")}{t("web.planning.stored")}</span>
            </div>
            <small className="inventory-source-note">
              {live.active
                ? live.storage !== undefined
                  ? t("web.production.inventoryLive")
                  : t("web.production.backpackLiveStorageSaved")
                : t("web.production.inventoryFromSave")}
            </small>
          </section>
        </div>
      )}

      {section === "storage" && (
        <section className="storage-dashboard">
          <div className="storage-heading">
            <div>
              <p className="eyebrow">
                {t("storage.eyebrow")} {live.active && <span className="live-badge">{t("status.live")}</span>}
              </p>
              <h2>{t("storage.title")}</h2>
              <p>{t("storage.description")}</p>
            </div>
            <div className="storage-totals">
              <strong>{storageIndex.length}</strong>
              <span>{t("storage.itemTypes")}</span>
              <b>{t("storage.units", { count: inventory.reduce((sum, item) => sum + item.count, 0).toLocaleString(locale) })}</b>
            </div>
          </div>
          <div className="storage-controls">
            <label className="storage-search">
              <span>{t("storage.searchLabel")}</span>
              <input
                type="search"
                value={storageQuery}
                onChange={(event) => setStorageQuery(event.target.value)}
                placeholder={t("storage.searchPlaceholder")}
              />
            </label>
            <label>
              <span>{t("storage.view")}</span>
              <select
                value={storageView}
                onChange={(event) =>
                  setStorageView(event.target.value as "combined" | "containers")
                }
              >
                <option value="combined">{t("storage.combined")}</option>
                <option value="containers">{t("storage.byContainer")}</option>
              </select>
            </label>
            <label>
              <span>{t("storage.location")}</span>
              <select
                value={effectiveStorageLocation}
                onChange={(event) => setStorageLocation(event.target.value)}
              >
                <option value="all">{t("storage.allLocations")}</option>
                {storageLocations.map((location) => (
                  <option key={location} value={location}>{displayStorageSource(location)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("storage.sort")}</span>
              <select
                value={storageSort}
                onChange={(event) =>
                  setStorageSort(
                    event.target.value as
                      | "name"
                      | "quantity-desc"
                      | "quantity-asc",
                  )
                }
              >
                <option value="name">{t("storage.sortName")}</option>
                <option value="quantity-desc">{t("storage.sortQuantityDesc")}</option>
                <option value="quantity-asc">{t("storage.sortQuantityAsc")}</option>
              </select>
            </label>
          </div>
          {storageView === "combined" ? (
            <div className="storage-results">
              {visibleStorage.map((item) => (
                <article
                  className="locatable-item-card"
                  data-storage-item={item.name}
                  title={t("storage.clickToLocate", { item: item.displayName || item.name })}
                  key={`${item.id}:${item.name}`}
                >
                  <StorageArtwork item={item} />
                  <div>
                    <strong>{item.displayName || item.name}</strong>
                    <span>{item.sources.map(displayStorageSource).join(" · ")}</span>
                  </div>
                  <b>{item.count.toLocaleString(locale)}</b>
                </article>
              ))}
            </div>
          ) : (
            <div className="storage-container-groups">
              {storageGroups.map((group) => (
                <section key={group.source}>
                  <header>
                    <div className="storage-container-identity">
                      <StorageContainerArtwork detail={group.detail} />
                      <div>
                        <h3>{displayStorageSource(group.source)}</h3>
                        {group.detail?.kind === "chest" && group.detail.location && (
                          <small>
                            {displayStorageLocation(group.detail)}
                            {typeof group.detail.x === "number" && typeof group.detail.y === "number"
                              ? ` · ${t("storage.tile")} ${group.detail.x}, ${group.detail.y}`
                              : ""}
                          </small>
                        )}
                      </div>
                    </div>
                    <div className="storage-container-context">
                      <StorageLocationPreview
                        detail={group.detail}
                        current={current}
                        live={live}
                        sprites={sprites}
                      />
                      <span>{t("storage.groupSummary", { types: group.items.length, units: group.items.reduce((sum, item) => sum + item.count, 0).toLocaleString(locale) })}</span>
                    </div>
                  </header>
                  <div className="storage-results">
                    {group.items.map((item) => (
                      <article key={`${group.source}:${item.id}:${item.name}`}>
                        <StorageArtwork item={item} />
                        <div><strong>{item.displayName || item.name}</strong></div>
                        <b>{item.count.toLocaleString(locale)}</b>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          {!visibleStorage.length && !storageGroups.length && (
            <p className="empty-daily">{t("storage.noMatches")}</p>
          )}
          <small className="inventory-source-note">
            {live.active && live.storage !== undefined
              ? t("storage.liveNote")
              : t("storage.savedNote")}
          </small>
        </section>
      )}
      {section === "goals" && (
        <div className="goal-planner">
          <section className="goal-planner-heading">
            <div>
              <p className="eyebrow">{t("web.planning.goalPlanner")}</p>
              <h2>{t("web.planning.turnProgressIntoAConcreteNextStep")}</h2>
              <p>{t("web.planning.linkedGoalsReuseTheSameInventoryBundleConstructionAnd")}</p>
            </div>
            <strong>{personalGoals.filter((goal) => !goal.done).length}<small>{t("web.planning.activeGoals")}</small></strong>
          </section>
          <section className="strategic-goal-builder">
            <label>
              <span>{t("web.planning.linkAConstructionToolRecipeOrBundle")}</span>
              <select
                value={selectedTargetId}
                onChange={(event) => setSelectedTargetId(event.target.value)}
              >
                <option value="">{t("web.planning.chooseATrackedObjective")}</option>
                {strategicTargets.map((target) => (
                  <option value={target.id} key={target.id}>
                    {target.category} · {target.title}
                  </option>
                ))}
              </select>
            </label>
            {selectedTargetId.startsWith("crafting:") && (
              <label className="crafting-quantity">
                <span>{t("web.planning.quantityToCraft")}</span>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={craftingQuantity}
                  onChange={(event) =>
                    setCraftingQuantity(
                      Math.max(1, Math.min(999, Number(event.target.value) || 1)),
                    )
                  }
                />
              </label>
            )}
            {selectedTarget && (
              <article className={selectedTarget.ready ? "ready" : ""}>
                <div>
                  <p className="eyebrow">{selectedTarget.category}</p>
                  <h3>{selectedTarget.title}</h3>
                  <span>{selectedTarget.progress}</span>
                </div>
                <dl>
                  <div><dt>{t("web.planning.bottleneck")}</dt><dd>{selectedTarget.bottleneck}</dd></div>
                  <div><dt>{t("web.planning.forecast")}</dt><dd>{selectedTarget.forecast}</dd></div>
                </dl>
                <button
                  type="button"
                  onClick={() => addGoal(selectedTarget.title, selectedTarget.id)}
                >{t("web.planning.trackThisGoal")}</button>
                <GoalRequirements target={selectedTarget} />
              </article>
            )}
          </section>
          <form
            className="custom-goal-form"
            onSubmit={(event) => {
              event.preventDefault();
              addGoal(goalDraft);
            }}
          >
            <label>
              <span>{t("web.planning.personalGoal")}</span>
              <input
                value={goalDraft}
                onChange={(event) => setGoalDraft(event.target.value)}
                placeholder={t("web.planning.eGPrepare20QualitySprinklers")}
              />
            </label>
            <label>
              <span>{t("web.planning.optionalInGameDeadline")}</span>
              <input
                value={goalDeadline}
                onChange={(event) => setGoalDeadline(event.target.value)}
                placeholder={t("web.planning.year1Fall1")}
              />
            </label>
            <button type="submit" disabled={!goalDraft.trim()}>{t("web.planning.addGoal")}</button>
          </form>
          <section className="personal-goal-list">
            {personalGoals.map((goal) => {
              const target = strategicTargets.find((item) => item.id === goal.targetId);
              return (
                <article className={goal.done ? "done" : target?.ready ? "ready" : ""} key={goal.id}>
                  <button
                    className="goal-check"
                    type="button"
                    aria-label={goal.done ? t("goal.reopenNamed", { name: goal.title }) : t("goal.completeNamed", { name: goal.title })}
                    onClick={() => persistGoals(personalGoals.map((item) =>
                      item.id === goal.id ? { ...item, done: !item.done } : item,
                    ))}
                  >
                    {goal.done ? "✓" : ""}
                  </button>
                  <div>
                    <strong>{goal.title}</strong>
                    <span>
                      {goal.deadline ? t("goal.deadline", { date: goal.deadline }) : ""}
                      {target ? target.forecast : t("goal.personalTarget")}
                    </span>
                    {target && <small>{target.bottleneck}</small>}
                    {target && <GoalRequirements target={target} compact />}
                  </div>
                  <button
                    className="goal-remove"
                    type="button"
                    onClick={() => persistGoals(personalGoals.filter((item) => item.id !== goal.id))}
                  >{t("web.planning.remove")}</button>
                </article>
              );
            })}
            {!personalGoals.length && (
              <p className="empty-daily">{t("web.planning.noPersonalGoalsYetLinkATrackedObjectiveOr")}</p>
            )}
          </section>
        </div>
      )}

      {section === "friends" && (
        <div className="friendship-planner">
          <section className="pet-friendship-card">
            <div>
              <p className="eyebrow">{t("web.planning.yourPet")}</p>
              <h2>{pet.name}</h2>
              <span>
                {t(`pet.type.${pet.type.toLowerCase()}`)} · {pet.points}{t("web.planning.1000Friendship")}</span>
            </div>
            <div className="pet-progress">
              <i>
                <b style={{ width: `${Math.min(100, pet.points / 10)}%` }} />
              </i>
              <strong>
                {projectedPetPoints >= 999
                  ? t("friendship.pet.onTrack")
                  : t("friendship.pet.pointsShort", { count: 999 - projectedPetPoints })}
              </strong>
              <small>
                {petElapsed > 0
                  ? t("friendship.pet.projection", { rate: petDailyGain.toFixed(1), days: petElapsed, points: projectedPetPoints, date: t("date.game", { year: 3, season: t("season.spring"), day: 1 }) })
                  : t("friendship.pet.noProjection")}
              </small>
            </div>
          </section>
          <div className="friend-plan-head">
            <div>
              <p>{t("web.planning.openOnePersonToSeeAvailableLovedLikedGifts")}</p>
              <div className="friend-plan-meta">
                <strong>
                  {projectedEightHeartFriends}{t("web.planning.projectedAtEightHeartsMilestonesAt5And10")}</strong>
                <span className="gift-points-tooltip">
                  <button
                    type="button"
                    aria-label={t("web.planning.howGiftFriendshipPointsWork")}
                    aria-describedby="gift-points-tooltip"
                  >{t("web.planning.giftPoints")}</button>
                  <span id="gift-points-tooltip" role="tooltip">
                    <strong>{t("web.planning.friendshipPointsPerGift")}</strong>
                    <span className="gift-reaction-row">
                      <b>{t("web.planning.loved")}</b>
                      <em>+80</em>
                      <b>{t("web.planning.liked")}</b>
                      <em>+45</em>
                      <b>{t("web.planning.neutral")}</b>
                      <em>+20</em>
                      <b>{t("web.planning.disliked")}</b>
                      <em>−20</em>
                      <b>{t("web.planning.hated")}</b>
                      <em>−40</em>
                    </span>
                    <strong>{t("web.planning.qualityBonusForLovedAndLikedGifts")}</strong>
                    <span className="gift-quality-row">
                      <b>{t("web.planning.quality")}</b>
                      <b>{t("web.planning.loved")}</b>
                      <b>{t("web.planning.liked")}</b>
                      <span>{t("web.planning.regular1")}</span>
                      <span>+80</span>
                      <span>+45</span>
                      <span>{t("web.planning.silver110")}</span>
                      <span>+88</span>
                      <span>+49</span>
                      <span>{t("web.planning.gold125")}</span>
                      <span>+100</span>
                      <span>+56</span>
                      <span>{t("web.planning.iridium150")}</span>
                      <span>+120</span>
                      <span>+67</span>
                    </span>
                    <small>{t("web.planning.qualityDoesNotChangeNeutralDislikedOrHatedGifts")}</small>
                  </span>
                </span>
              </div>
            </div>
            <label>{t("web.planning.sortBy")}<select
                value={friendSort}
                onChange={(event) =>
                  setFriendSort(event.target.value as typeof friendSort)
                }
              >
                <option value="birthday">{t("web.planning.nextBirthday")}</option>
                <option value="name">{t("web.planning.nameAZ")}</option>
                <option value="friendship">{t("web.planning.friendship")}</option>
              </select>
            </label>
            <span>
              {friendships.filter((friend) => friend.talkedToday).length}/
              {friendships.length}{t("web.planning.greetedToday")}</span>
          </div>
          <div className="friend-plan-list">
            {sortedFriendships.slice(0, 30).map((friend) => {
              const projection = friendshipProjection(friend);
              const expanded = expandedFriend === friend.name;
              const giftsToday = friend.giftsToday ?? 0;
              const projectionStatus =
                friend.points >= 1975
                  ? "achieved"
                  : projection.sampleDays > 0
                    ? projection.projectedPoints >= 1975
                      ? "on-track"
                      : "behind"
                    : "unknown";
              const projectionLabel =
                projectionStatus === "achieved"
                  ? t("friendship.projection.reached", { hearts: Math.min(10, friend.hearts) })
                  : projectionStatus === "unknown"
                    ? t("friendship.projection.none")
                    : t("friendship.projection.grandpa", { hearts: projection.projectedHearts.toFixed(1) });
              return (
                <article
                  className={`${friend.talkedToday ? "talked" : ""} ${expanded ? "expanded" : ""}`}
                  key={friend.name}
                >
                  <button
                    type="button"
                    className="friend-summary"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedFriend(expanded ? null : friend.name)
                    }
                  >
                    <div className="friend-identity">
                      <NpcArtwork
                        name={friend.id || friend.name}
                        kind="sprite"
                      />
                      <span>
                        <strong>{friend.name}</strong>
                        <small>
                          {friend.hearts} ♥ · {friend.points}{t("web.planning.pointsNow")}</small>
                      </span>
                    </div>
                    <span
                      className={`friend-card-projection ${projectionStatus}`}
                    >
                      {projectionLabel}
                    </span>
                    <div className="friend-daily-status">
                      <span className={friend.talkedToday ? "done" : "pending"}>
                        <i>{friend.talkedToday ? "✓" : "○"}</i>
                        {friend.talkedToday
                          ? t("friendship.talked")
                          : t("friendship.notTalked")}
                      </span>
                      <span className={giftsToday > 0 ? "done" : "pending"}>
                        <i>{giftsToday > 0 ? "✓" : "○"}</i>
                        {giftsToday > 0 ? t("friendship.giftToday") : t("friendship.noGiftToday")}
                      </span>
                      <span
                        className={`weekly-gifts ${friend.giftsThisWeek >= 2 ? "complete" : ""}`}
                        aria-label={t("friendship.weeklyGifts", { count: friend.giftsThisWeek })}
                      >
                        <i
                          className={friend.giftsThisWeek >= 1 ? "filled" : ""}
                        >
                          ◆
                        </i>
                        <i
                          className={friend.giftsThisWeek >= 2 ? "filled" : ""}
                        >
                          ◆
                        </i>
                        {friend.giftsThisWeek}{t("web.planning.2ThisWeek")}</span>
                    </div>
                    <div className="heart-track">
                      <i>
                        <b
                          style={{
                            width: `${Math.min(100, (friend.points / 2500) * 100)}%`,
                          }}
                        />
                      </i>
                    </div>
                    {friend.daysToBirthday === 0 ? (
                      <small>{t("web.planning.birthdayToday")}</small>
                    ) : friend.daysToBirthday !== null &&
                      friend.daysToBirthday <= 14 ? (
                      <small>{t("friendship.birthdayIn", { days: friend.daysToBirthday })}</small>
                    ) : null}
                    <b className="friend-expand-symbol">
                      {expanded ? "−" : "+"}
                    </b>
                  </button>
                  {expanded && (
                    <div className="friend-details">
                      <WikiLink name={friend.name} label={t("wiki.named", { name: friend.name })} />
                      <section
                        className={
                          projection.projectedPoints >= 1975
                            ? "friend-projection on-track"
                            : "friend-projection needs-attention"
                        }
                      >
                        <div className="friend-portrait-summary">
                          <NpcArtwork
                            name={friend.id || friend.name}
                            kind="portrait"
                          />
                          <div>
                            <p className="eyebrow">{t("web.planning.year3Spring1Projection")}</p>
                            <strong>
                              {projection.projectedHearts.toFixed(1)}{t("web.planning.hearts")}{" "}
                              {projection.projectedPoints}{t("web.planning.points")}</strong>
                            <span>
                              {projection.projectedPoints >= 1975
                                ? t("friendship.projection.onTrack")
                                : t("friendship.projection.pointsShort", { count: 1975 - projection.projectedPoints })}
                            </span>
                          </div>
                        </div>
                        <small>
                          {projection.sampleDays > 0
                            ? t("friendship.projection.observedPace", { rate: projection.dailyGain.toFixed(1), tracked: projection.sampleDays, remaining: projection.daysRemaining })
                            : t("friendship.projection.notEnoughHistory")}
                        </small>
                      </section>
                      <div className="friend-gifts">
                        <GiftGroup
                          label={t("friendship.lovedAvailable")}
                          tone="love"
                          items={friend.gifts.love}
                        />
                        <GiftGroup
                          label={t("friendship.likedAvailable")}
                          tone="like"
                          items={friend.gifts.like}
                        />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function DailyBriefModal({
  current,
  onClose,
  onOpenAgenda,
}: {
  current: Snapshot;
  onClose: () => void;
  onOpenAgenda: () => void;
}) {
  const { t, text, date } = useI18n();
  const brief = current.dailyBrief;
  const birthday = brief.birthdays[0];
  const extraTv = brief.tv.find((program) => !isCoreTvProgram(program));
  const quest = brief.boardQuest ?? brief.dailyQuest;
  const readyCrops = brief.crops
    .filter((item) => item.ready)
    .reduce((sum, item) => sum + item.count, 0);
  return (
    <div
      className="daily-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="daily-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-title"
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label={t("today.brief.closeLabel")}
        >
          ×
        </button>
        <p className="eyebrow">{t("today.automaticAgenda")} · {date(current)}</p>
        <h1 id="daily-title">{t("today.goodMorning", { farmer: current.farmer })}</h1>
        <p className="daily-lead">{text(brief.summary)}</p>
        <div className="daily-modal-grid">
          <div>
            <span>☀</span>
            <strong>{t("today.brief.tomorrow")}</strong>
            <p>{t(`weather.${brief.weatherTomorrow.code}`)}</p>
          </div>
          <div>
            <span>✦</span>
            <strong>{t("today.brief.luck")}</strong>
            <p>{text(brief.luck.label)}</p>
          </div>
          <div>
            <span>▣</span>
            <strong>{t("today.brief.channel")}</strong>
            <p>{extraTv ? text(extraTv.title) : t("common.none")}</p>
          </div>
          <div>
            <span>♟</span>
            <strong>{t("today.brief.birthday")}</strong>
            <p>
              {birthday
                ? t("today.brief.birthdayValue", {
                    when: birthdayWhenLabel(birthday.when, t),
                    person: birthday.person,
                  })
                : t("today.brief.noBirthday")}
            </p>
          </div>
          <div>
            <span>!</span>
            <strong>{t("today.brief.helpWanted")}</strong>
            <p>
              {quest.available || quest.accepted ? text(quest.title) : t("common.none")}
            </p>
          </div>
        </div>
        <div className="modal-tv">
          <strong>{t("today.brief.onTv")}</strong>
          {brief.tv.map((program) => (
            <p key={program.id}>
              <b>{text(program.channel)}:</b> {text(program.title)}
            </p>
          ))}
        </div>
        {(brief.toolUpgrade || brief.fruitCave.count > 0 || readyCrops > 0) && (
          <div className="daily-priority-list">
            <strong>{t("today.brief.beforeLeaving")}</strong>
            {brief.toolUpgrade && (
              <p className={brief.toolUpgrade.ready ? "urgent" : ""}>
                ⚒{" "}
                {brief.toolUpgrade.ready
                  ? t("today.brief.collectTool", { tool: brief.toolUpgrade.displayName || brief.toolUpgrade.name })
                  : t("today.brief.toolDays", {
                      tool: brief.toolUpgrade.displayName || brief.toolUpgrade.name,
                      count: brief.toolUpgrade.daysRemaining,
                    })}
              </p>
            )}
            {brief.fruitCave.count > 0 && (
              <p>
                ♣ {t("today.brief.caveCollectibles", {
                  count: brief.fruitCave.count,
                  cave: caveTypeLabel(brief.fruitCave.type, t),
                })}
              </p>
            )}
            {readyCrops > 0 && (
              <p>♨ {t("today.brief.readyCrops", { count: readyCrops })}</p>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button onClick={onClose}>{t("today.brief.close")}</button>
          <button className="primary" onClick={onOpenAgenda}>
            {t("today.brief.viewAgenda")}
          </button>
        </div>
      </section>
    </div>
  );
}

type SectionVisibilityOption = { id: string; label: string };

function useSectionVisibility(storageKey: string, sectionIds: readonly string[]) {
  const defaults = () => ({
    visible: Object.fromEntries(sectionIds.map((id) => [id, true])) as Record<string, boolean>,
    order: [...sectionIds],
  });
  const [preferences, setPreferences] = useState(() => {
    const initial = defaults();
    if (typeof window === "undefined") return initial;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
      for (const id of sectionIds)
        if (typeof (saved.visible?.[id] ?? saved[id]) === "boolean")
          initial.visible[id] = saved.visible?.[id] ?? saved[id];
      if (Array.isArray(saved.order)) {
        initial.order = [
          ...saved.order.filter((id: unknown) => sectionIds.includes(String(id))),
          ...sectionIds.filter((id) => !saved.order.includes(id)),
        ];
      }
    } catch {
      // A damaged preference should never prevent the page from opening.
    }
    return initial;
  });
  const persist = (next: typeof preferences) => {
    setPreferences(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const setSectionVisible = (id: string, value: boolean) =>
    persist({ ...preferences, visible: { ...preferences.visible, [id]: value } });
  const showAll = () =>
    persist({ ...preferences, visible: defaults().visible });
  const moveSection = (id: string, direction: -1 | 1) => {
    const index = preferences.order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= preferences.order.length) return;
    const order = [...preferences.order];
    [order[index], order[target]] = [order[target], order[index]];
    persist({ ...preferences, order });
  };
  return [preferences.visible, setSectionVisible, showAll, preferences.order, moveSection] as const;
}

function SectionVisibilityMenu({
  label,
  options,
  visible,
  order,
  onChange,
  onShowAll,
  onMove,
}: {
  label: string;
  options: readonly SectionVisibilityOption[];
  visible: Record<string, boolean>;
  order: readonly string[];
  onChange: (id: string, value: boolean) => void;
  onShowAll: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);
  const orderedOptions = [...options].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );
  const visibleCount = options.filter((option) => visible[option.id]).length;
  return (
    <div className="section-visibility" ref={root}>
      <button
        type="button"
        className="section-visibility-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">⚙</span>{t("shell.sections")}</button>
      {open && (
        <div className="section-visibility-panel" role="dialog" aria-label={label}>
          <header>
            <div>
              <strong>{t("web.sectionVisibilityMenu.visibleSections")}</strong>
              <small>{visibleCount}/{options.length}{t("web.sectionVisibilityMenu.shown")}</small>
            </div>
            <button type="button" onClick={onShowAll}>{t("web.sectionVisibilityMenu.showAll")}</button>
          </header>
          <div>
            {orderedOptions.map((option, index) => (
              <div className="section-visibility-row" key={option.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={visible[option.id] !== false}
                    onChange={(event) => onChange(option.id, event.target.checked)}
                  />
                  <i aria-hidden="true">{visible[option.id] !== false ? "✓" : ""}</i>
                  <span>{option.label}</span>
                </label>
                <span className="section-order-buttons">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={t("sections.moveUp", { section: option.label })}
                    onClick={() => onMove(option.id, -1)}
                  >↑</button>
                  <button
                    type="button"
                    disabled={index === orderedOptions.length - 1}
                    aria-label={t("sections.moveDown", { section: option.label })}
                    onClick={() => onMove(option.id, 1)}
                  >↓</button>
                </span>
              </div>
            ))}
          </div>
          <p>{t("web.sectionVisibilityMenu.savedAutomaticallyOnThisDevice")}</p>
        </div>
      )}
    </div>
  );
}

function DailyBriefView({
  current,
  previous,
  history,
  live,
  sessionBaseline,
  onOpenCommunityCenter,
}: {
  current: Snapshot;
  previous: Snapshot | null;
  history: FarmHistory;
  live: LiveState;
  sessionBaseline: SessionSummary | null;
  onOpenCommunityCenter: () => void;
}) {
  const { t, text, date, locale } = useI18n();
  const todaySectionOptions = [
    { id: "overview", label: t("today.section.overview") },
    { id: "priorities", label: t("today.section.priorities") },
    { id: "completable", label: t("today.section.completable") },
    { id: "session", label: t("today.section.session") },
    { id: "yesterday", label: t("today.section.yesterday") },
    { id: "quests", label: t("today.section.quests") },
    { id: "special-orders", label: t("today.section.specialOrders") },
    { id: "live-map", label: t("today.section.liveMap") },
    { id: "route", label: t("today.section.route") },
    { id: "crops", label: t("today.section.crops") },
    { id: "birthdays", label: t("today.section.birthdays") },
  ] as const;
  const [visibleSections, setSectionVisible, showAllSections, sectionOrder, moveSection] =
    useSectionVisibility(
      "stardew-tool-visible-sections-today-v1",
      todaySectionOptions.map((option) => option.id),
    );
  const brief = current.dailyBrief;
  const specialOrders = live.active && live.specialOrders
    ? live.specialOrders
    : brief.specialOrders || [];
  const savedReadyCrops = brief.crops
    .filter((item) => item.ready)
    .reduce((sum, item) => sum + item.count, 0);
  const savedReadyMachines = current.objects.filter((item) => item.ready);
  const liveReadyMachines = (live.machines || []).filter((item) => item.ready);
  const readyCrops = live.active
    ? live.routeState?.readyCrops || 0
    : savedReadyCrops;
  const readyMachinesCount = live.active
    ? liveReadyMachines.length
    : savedReadyMachines.length;
  const extraTv = brief.tv.filter((program) => !isCoreTvProgram(program));
  const currentEconomy = history.entries.find(
    (entry) => entry.dateKey === current.dateKey,
  );
  const newBuildings = previous
    ? current.buildings.filter(
        (building) =>
          !previous.buildings.some(
            (old) =>
              old.name === building.name &&
              old.x === building.x &&
              old.y === building.y,
          ),
      )
    : [];
  const completedBuildings = previous
    ? current.buildings.filter(
        (building) =>
          (building.daysOfConstructionLeft || 0) <= 0 &&
          previous.buildings.some(
            (old) =>
              old.name === building.name &&
              old.x === building.x &&
              old.y === building.y &&
              (old.daysOfConstructionLeft || 0) > 0,
          ),
      )
    : [];
  const newlyReadyMachines = previous
    ? savedReadyMachines.filter(
        (item) =>
          !previous.objects.some(
            (old) =>
              old.x === item.x &&
              old.y === item.y &&
              old.id === item.id &&
              old.ready,
          ),
      )
    : savedReadyMachines;
  const previousReadyCrops =
    previous?.dailyBrief.crops
      .filter((item) => item.ready)
      .reduce((sum, item) => sum + item.count, 0) || 0;
  const dailyChanges = previous
    ? [
        {
          label: t("today.change.balance"),
          value: `${current.money - previous.money >= 0 ? "+" : ""}${(current.money - previous.money).toLocaleString("en-US")}g`,
          detail: t("today.change.balanceDetail", { earned: (currentEconomy?.income || 0).toLocaleString(locale), spent: (currentEconomy?.spending || 0).toLocaleString(locale) }),
          tone: current.money >= previous.money ? "positive" : "negative",
        },
        {
          label: t("today.change.production"),
          value: t("today.change.newCount", { count: newlyReadyMachines.length }),
          detail: newlyReadyMachines.length
            ? newlyReadyMachines
                .map((item) => item.output || item.name)
                .slice(0, 4)
                .join(" · ")
            : t("today.change.noNewMachines"),
          tone: newlyReadyMachines.length ? "positive" : "neutral",
        },
        {
          label: t("today.change.readyCrops"),
          value: `${readyCrops}`,
          detail:
            readyCrops > previousReadyCrops
              ? t("today.change.moreCropsReady", { count: readyCrops - previousReadyCrops })
              : readyCrops < previousReadyCrops
                ? t("today.change.cropsCollected", { count: previousReadyCrops - readyCrops })
                : t("today.change.noChangeYesterday"),
          tone: readyCrops > previousReadyCrops ? "positive" : "neutral",
        },
        {
          label: t("today.change.construction"),
          value:
            newBuildings.length || completedBuildings.length
              ? t("today.change.changeCount", { count: newBuildings.length + completedBuildings.length })
              : t("today.change.noChange"),
          detail:
            [
              ...newBuildings.map((item) => t("today.change.buildingAdded", { building: item.name })),
              ...completedBuildings.map((item) => t("today.change.buildingCompleted", { building: item.name })),
            ].join(" · ") || t("today.change.noBuildings"),
          tone:
            newBuildings.length || completedBuildings.length
              ? "positive"
              : "neutral",
        },
      ]
    : [];
  const routeOrder = [
    "Farm",
    "BusStop",
    "Town",
    "Beach",
    "Mountain",
    "Railroad",
    "Backwoods",
    "Cindersap Forest",
    "Secret Woods",
    "Desert",
  ];
  const currentRouteLocation = live.active
    ? LIVE_ROUTE_LOCATION_NAMES[live.locationId || ""] || live.locationId || ""
    : "";
  const liveWorldItems = new Map(
    (live.active ? live.routeState?.worldTasks || [] : []).map((stop) => [
      LIVE_ROUTE_LOCATION_NAMES[stop.location] || stop.location,
      stop.items.map((item) => ({
        ...item,
        displayName:
          item.displayName || resolveGameDisplayName(
            current.localizedNamesByQualifiedId || {},
            current.localizedObjectNamesByEnglish || {},
            item.name,
          ),
      })),
    ]),
  );
  const routeSource = brief.world
    .filter((stop) => stop.location !== "Farm Cave")
    .map((stop) => ({ ...stop, items: [...stop.items] }));
  const liveFarmTasks =
    (live.routeState?.readyCrops || 0) + (live.routeState?.readyMachines || 0);
  if (
    (readyCrops ||
      readyMachinesCount ||
      brief.fruitCave.count ||
      liveFarmTasks) &&
    !routeSource.some((stop) => stop.location === "Farm")
  )
    routeSource.push({ location: "Farm", items: [] });
  if (
    (brief.toolUpgrade || live.routeState?.toolPickupReady) &&
    !routeSource.some((stop) => stop.location === "Town")
  )
    routeSource.push({ location: "Town", items: [] });
  const routeWorld = routeSource.sort((a, b) => {
    const ai = routeOrder.indexOf(a.location),
      bi = routeOrder.indexOf(b.location);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  const liveAcceptedQuests = live.active
    ? (live.acceptedQuests || []).map((quest) =>
        liveQuestStatus(
          quest,
          live,
          t,
          matchingSavedQuest(quest, brief.acceptedQuests || []),
        ),
      )
    : [];
  const liveDailyQuest = liveAcceptedQuests.find((quest) => quest.daily);
  const liveBoardQuest =
    live.active && live.boardQuest
      ? liveQuestStatus(live.boardQuest, live, t)
      : null;
  const inactiveQuest: DailyQuest = {
    accepted: false,
    available: false,
    daily: true,
    title: live.dailyQuestCompleted
      ? t("today.quest.helpWantedCompleted")
      : t("today.quest.noActiveRequest"),
    description: live.dailyQuestCompleted
      ? t("today.quest.completedDescription")
      : t("today.quest.noActiveDescription"),
    objective: live.dailyQuestCompleted
      ? t("today.quest.deliveredCompleted")
      : t("today.quest.checkTomorrow"),
    type: "None",
    requester: null,
    reward: 0,
    daysLeft: 0,
    progress: live.dailyQuestCompleted ? 1 : 0,
    target: live.dailyQuestCompleted ? 1 : 0,
    ready: Boolean(live.dailyQuestCompleted),
    owned: 0,
    hasRequestedItems: false,
    stock: [],
    stockNote: null,
  };
  const activeDailyQuest = live.active
    ? (liveDailyQuest ?? inactiveQuest)
    : brief.dailyQuest;
  const routeNotes = (location: string) => {
    const notes: string[] = [];
    if (location === "Farm") {
      if (readyCrops) notes.push(t("today.route.cropsReady", { count: readyCrops }));
      if (readyMachinesCount)
        notes.push(t("today.route.machinesReady", { count: readyMachinesCount }));
    }
    if (location === "Town") {
      if ((live.active ? liveBoardQuest : brief.boardQuest)?.available)
        notes.push(t("today.route.helpWantedAvailable"));
      if (activeDailyQuest.accepted) notes.push(t("today.route.helpWantedAccepted"));
      if (live.active && live.dailyQuestCompleted)
        notes.push(t("today.route.helpWantedCompleted"));
      if (brief.toolUpgrade)
        notes.push(
          brief.toolUpgrade.ready
            ? t("today.route.toolReady", { tool: brief.toolUpgrade.displayName || brief.toolUpgrade.name })
            : t("today.route.toolWaiting", { tool: brief.toolUpgrade.displayName || brief.toolUpgrade.name }),
        );
    }
    return notes;
  };
  const displayedQuest = live.active
    ? (liveDailyQuest ?? liveBoardQuest ?? inactiveQuest)
    : (brief.boardQuest ?? brief.dailyQuest);
  const acceptedQuests =
    live.active && live.acceptedQuests
      ? liveAcceptedQuests
      : brief.acceptedQuests || [];
  const hasSeparateAcceptedQuest =
    !live.active && Boolean(brief.boardQuest && brief.dailyQuest.accepted);
  const questCompletedNow = live.active && Boolean(live.dailyQuestCompleted);
  const questVisible =
    displayedQuest.accepted || displayedQuest.available || questCompletedNow;
  const questPossession = questCompletedNow
    ? t("today.quest.deliveredCompletedCheck")
    : displayedQuest.hasRequestedItems
      ? t("today.quest.haveNeededCheck")
      : displayedQuest.target > 0
        ? t("today.quest.availableCount", { owned: displayedQuest.owned, target: displayedQuest.target })
        : t("today.quest.reviewObjective");
  const worldStorageKey = `stardew-tool-world-checklist-${current.farmName}-${current.dateKey}`;
  const manualWorldStorageKey = `${worldStorageKey}-manual`;
  const [manualCompletedWorld, setManualCompletedWorld] = useState<string[]>(
    () => {
      if (typeof window === "undefined") return [];
      const savedManual = window.localStorage.getItem(manualWorldStorageKey);
      if (savedManual) return JSON.parse(savedManual);
      const legacyCompleted: string[] = JSON.parse(
        window.localStorage.getItem(worldStorageKey) || "[]",
      );
      const legacyAutomatic: string[] = JSON.parse(
        window.localStorage.getItem(`${worldStorageKey}-automatic`) || "[]",
      );
      return routeWorld
        .filter(
          (location) =>
            (legacyCompleted.includes(location.location) ||
              (location.items.length > 0 &&
                location.items.every((item) =>
                  legacyCompleted.includes(`${location.location}:${item.name}`),
                ))) &&
            !legacyAutomatic.includes(location.location),
        )
        .map((location) => location.location);
    },
  );
  const automaticallyCompletedWorld = useMemo(() => {
    if (!live.active || !live.routeState) return [];
    const remainingByLocation = new Map(
      live.routeState.worldTasks.map((stop) => [
        LIVE_ROUTE_LOCATION_NAMES[stop.location] || stop.location,
        stop.items.reduce((sum, item) => sum + item.count, 0),
      ]),
    );
    const automaticallyCompleted: string[] = [];
    for (const stop of routeWorld) {
      if (stop.location === "Farm") {
        const caveRemaining =
          brief.fruitCave.count > 0
            ? (remainingByLocation.get("Farm Cave") ?? brief.fruitCave.count)
            : 0;
        if (
          live.routeState.readyCrops === 0 &&
          live.routeState.readyMachines === 0 &&
          caveRemaining === 0
        )
          automaticallyCompleted.push("Farm");
      } else if (stop.location === "Town") {
        if (
          (remainingByLocation.get("Town") || 0) === 0 &&
          !live.routeState.toolPickupReady
        )
          automaticallyCompleted.push("Town");
      } else if (
        stop.items.length > 0 &&
        (remainingByLocation.get(stop.location) || 0) === 0
      ) {
        automaticallyCompleted.push(stop.location);
      }
    }
    return automaticallyCompleted;
  }, [brief.fruitCave.count, live.active, live.routeState, routeWorld]);
  const completedWorld = useMemo(
    () => [
      ...new Set([...manualCompletedWorld, ...automaticallyCompletedWorld]),
    ],
    [automaticallyCompletedWorld, manualCompletedWorld],
  );
  const worldTaskCount = routeWorld.length;
  const unwateredCrops =
    live.active && live.farmMap
      ? live.farmMap.terrain.filter((tile) => tile.hasCrop && !tile.watered)
          .length
      : brief.crops.reduce(
          (sum, crop) => sum + Math.max(0, crop.count - crop.watered),
          0,
        );
  const bundleDeliveries = liveReadyBundleDeliveries(
    current.planningBrief.communityCenter,
    live,
  );
  const bundleDeliveryDetail = bundleDeliveries
    .map(
      (item) => `${formatBundleRequirement(item, t, locale)} → ${communityRoomName(item.roomId, t)} · ${communityBundleName(item.bundleId, item.bundle, t)}`,
    )
    .join(" · ");
  const priorityItems = [
    unwateredCrops > 0 && !live.raining
      ? {
          level: "urgent",
          title: t("today.priority.waterCrops", { count: unwateredCrops }),
          detail:
            live.active && (live.timeOfDay || 0) >= 1800
              ? t("today.priority.gettingLate")
              : t("today.priority.needWater"),
        }
      : null,
    readyCrops > 0
      ? {
          level: "ready",
          title: t("today.priority.harvestCrops", { count: readyCrops }),
          detail: t("today.priority.harvestUpdates"),
        }
      : null,
    readyMachinesCount > 0
      ? {
          level: "ready",
          title: t("today.priority.collectMachines", { count: readyMachinesCount }),
          detail: live.active
            ? summarizeReadyLiveMachines(liveReadyMachines)
            : summarizeReadyMachines(savedReadyMachines),
        }
      : null,
    (live.active ? live.routeState?.toolPickupReady : brief.toolUpgrade?.ready)
      ? {
          level: "urgent",
          title: t("today.priority.collectTool", { tool: brief.toolUpgrade?.displayName || brief.toolUpgrade?.name || t("today.priority.upgradedTool") }),
          detail: t("today.priority.readyAtClint"),
        }
      : null,
    activeDailyQuest.accepted && activeDailyQuest.daysLeft <= 1
      ? {
          level: "urgent",
          title: activeDailyQuest.title,
          detail: t("today.priority.finalDay", { objective: text(activeDailyQuest.objective) }),
        }
      : null,
    bundleDeliveries.length > 0
      ? {
          level: "ready",
          title: t("today.priority.bundleDeliveries", { count: bundleDeliveries.length }),
          detail: bundleDeliveryDetail,
          action: "community" as const,
        }
      : null,
    live.active && (live.energy || 0) < (live.maxEnergy || 1) * 0.2
      ? {
          level: "warning",
          title: t("today.priority.lowEnergy"),
          detail: t("today.priority.lowEnergyDetail", { energy: Math.round(live.energy || 0), max: Math.round(live.maxEnergy || 0) }),
        }
      : null,
  ].filter(Boolean) as {
    level: string;
    title: string;
    detail: string;
    action?: "community";
  }[];

  const currentSession = sessionSummary(current, live);
  const sessionChanges = sessionBaseline
    ? [
        currentSession.money !== sessionBaseline.money
          ? t("today.session.balance", { amount: `${currentSession.money - sessionBaseline.money >= 0 ? "+" : ""}${(currentSession.money - sessionBaseline.money).toLocaleString(locale)}` })
          : null,
        currentSession.totalMoneyEarned !== sessionBaseline.totalMoneyEarned
          ? t("today.session.earned", { amount: Math.max(0, currentSession.totalMoneyEarned - sessionBaseline.totalMoneyEarned).toLocaleString(locale) })
          : null,
        currentSession.readyCrops !== sessionBaseline.readyCrops
          ? t("today.session.readyCrops", { count: `${currentSession.readyCrops - sessionBaseline.readyCrops >= 0 ? "+" : ""}${currentSession.readyCrops - sessionBaseline.readyCrops}` })
          : null,
        currentSession.readyMachines !== sessionBaseline.readyMachines
          ? t("today.session.readyMachines", { count: `${currentSession.readyMachines - sessionBaseline.readyMachines >= 0 ? "+" : ""}${currentSession.readyMachines - sessionBaseline.readyMachines}` })
          : null,
        ...currentSession.buildings
          .filter((building) => !sessionBaseline.buildings.includes(building))
          .map((building) => t("today.session.buildingAdded", { building: building.split("@")[0] })),
        currentSession.completedBundles > sessionBaseline.completedBundles
          ? t("today.session.bundlesCompleted", { count: currentSession.completedBundles - sessionBaseline.completedBundles })
          : null,
        ...currentSession.completedAchievements
          .filter((achievement) => !sessionBaseline.completedAchievements.includes(achievement))
          .map((achievement) => t("today.session.achievementCompleted", { achievement })),
        ...Object.entries(currentSession.friendships)
          .filter(([name, points]) => points > (sessionBaseline.friendships[name] || 0))
          .slice(0, 5)
          .map(([name, points]) => t("today.session.friendship", { name, count: points - (sessionBaseline.friendships[name] || 0) })),
        ...sessionBaseline.activeQuests
          .filter((quest) => !currentSession.activeQuests.includes(quest))
          .map((quest) => t("today.session.questLeft", { quest })),
      ].filter(Boolean) as string[]
    : [];
  const completableToday: { kind: string; title: string; detail: string; action?: "community" }[] = [
    ...acceptedQuests
      .filter((quest) => quest.ready || (quest.target > 0 && quest.progress >= quest.target))
      .map((quest) => ({
        kind: t("today.kind.quest"),
        title: localizedQuestTitle(quest, t, text),
        detail: quest.requester ? t("today.completable.deliverTo", { requester: quest.requester }) : t("today.completable.claimNow"),
      })),
    ...bundleDeliveries.map((delivery) => ({
      kind: t("today.kind.bundle"),
      title: `${delivery.id === "-1" ? t("community.gold") : delivery.displayName || delivery.name} → ${communityBundleName(delivery.bundleId, delivery.bundle, t)}`,
      detail: t("today.completable.bundleReady", { room: communityRoomName(delivery.roomId, t) }),
      action: "community" as const,
    })),
    ...((live.active ? live.routeState?.toolPickupReady : brief.toolUpgrade?.ready)
      ? [{ kind: t("today.kind.pickup"), title: brief.toolUpgrade?.displayName || brief.toolUpgrade?.name || t("today.priority.upgradedTool"), detail: t("today.completable.readyAtClint") }]
      : []),
    ...(readyCrops
      ? [{ kind: t("today.kind.farm"), title: t("today.priority.harvestCrops", { count: readyCrops }), detail: t("today.completable.availableFarm") }]
      : []),
    ...(readyMachinesCount
      ? [{ kind: t("today.kind.production"), title: t("today.priority.collectMachines", { count: readyMachinesCount }), detail: live.active ? summarizeReadyLiveMachines(liveReadyMachines) : summarizeReadyMachines(savedReadyMachines) }]
      : []),
  ];

  const toggleWorldLocation = (location: string) => {
    if (automaticallyCompletedWorld.includes(location)) return;
    const next = manualCompletedWorld.includes(location)
      ? manualCompletedWorld.filter((item) => item !== location)
      : [...manualCompletedWorld, location];
    setManualCompletedWorld(next);
    window.localStorage.setItem(manualWorldStorageKey, JSON.stringify(next));
  };

  return (
    <section className="daily-page">
      <div className="daily-heading">
        <div>
          <p className="eyebrow">{t("today.savedBrief")}</p>
          <h1>{t("today.goodMorning", { farmer: current.farmer })}</h1>
          <p>
            {date(current)} · {text(brief.summary)}
          </p>
        </div>
        <div className="page-heading-actions">
          <div className="daily-date">
            <span>{t("today.year", { year: current.year })}</span>
            <strong>
              {t(`season.${current.season}`)} {current.day}
            </strong>
          </div>
          <SectionVisibilityMenu
            label={t("today.customizeSections")}
            options={todaySectionOptions}
            visible={visibleSections}
            order={sectionOrder}
            onChange={setSectionVisible}
            onShowAll={showAllSections}
            onMove={moveSection}
          />
        </div>
      </div>
      {visibleSections.overview && <div className="daily-summary-grid" style={{ order: sectionOrder.indexOf("overview") + 1 }}>
        <article>
          <span className="daily-symbol">☀</span>
          <div>
            <p className="eyebrow">{t("today.tomorrowWeather")}</p>
            <h2>{t(`weather.${brief.weatherTomorrow.code}`)}</h2>
            <small>{t("today.forecast")}</small>
          </div>
        </article>
        <button
          type="button"
          className="luck-summary-card"
          aria-describedby="luck-summary-tooltip"
        >
          <span className="daily-symbol">✦</span>
          <div>
            <p className="eyebrow">{t("today.luck")}</p>
            <h2>
              {brief.luck.value >= 0.02
                ? t("today.favorable")
                : brief.luck.value <= -0.02
                  ? t("today.unfavorable")
                  : t("today.normal")}
            </h2>
            <small>{text(brief.luck.label)}</small>
          </div>
          <div
            className="luck-summary-tooltip"
            id="luck-summary-tooltip"
            role="tooltip"
          >
            <strong>{text(brief.luck.advice)}</strong>
            <span>
              {brief.luck.value > 0 ? "+" : ""}
              {brief.luck.value.toFixed(3)}
            </span>
            {brief.luck.recommendations.map((item, index) => (
              <p key={index}>{text(item)}</p>
            ))}
            <small>{text(brief.luck.explanation)}</small>
          </div>
        </button>
        <button
          type="button"
          className="summary-tooltip-card tv-summary-card"
          aria-describedby={extraTv.length ? "tv-summary-tooltip" : undefined}
        >
          <span className="daily-symbol">▣</span>
          <div>
            <p className="eyebrow">{t("web.dailyBrief.extraChannel")}</p>
            <h2>{extraTv[0] ? text(extraTv[0].title) : t("common.none")}</h2>
            <small>
              {extraTv.length
                ? extraTv.map((program) => text(program.channel)).join(" · ")
                : t("today.noAdditionalProgram")}
            </small>
          </div>
          {extraTv.length > 0 && (
            <div
              className="summary-card-tooltip"
              id="tv-summary-tooltip"
              role="tooltip"
            >
              {extraTv.map((program) => (
                <div key={program.id}>
                  <strong>
                    {text(program.channel)} · {text(program.title)}
                  </strong>
                  <p>{text(program.detail)}</p>
                </div>
              ))}
            </div>
          )}
        </button>
        <button
          type="button"
          className="daily-summary-link birthday-summary-link"
          onClick={() =>
            document
              .getElementById("birthday-gifts")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        >
          {brief.birthdays[0] ? (
            <NpcArtwork
              name={brief.birthdays[0].id || brief.birthdays[0].person}
              kind="sprite"
            />
          ) : (
            <span className="daily-symbol">♟</span>
          )}
          <div>
            <p className="eyebrow">{t("today.brief.birthday")}</p>
            <h2>{brief.birthdays[0]?.person || t("common.none")}</h2>
            <small>
              {brief.birthdays[0]
                ? t("today.birthday.viewGifts", {
                    when: birthdayWhenLabel(brief.birthdays[0].when, t),
                  })
                : t("today.birthday.viewCalendar")}
            </small>
          </div>
        </button>
        <button
          type="button"
          className={`summary-tooltip-card quest-summary-card ${displayedQuest.ready ? "ready" : ""}`}
          aria-describedby="quest-summary-tooltip"
        >
          <span className="daily-symbol">!</span>
          <div>
            <p className="eyebrow">{t("today.brief.helpWanted")}</p>
            <h2>{questVisible ? localizedQuestTitle(displayedQuest, t, text) : t("common.none")}</h2>
            <small>
              {questVisible ? questPossession : t("today.quest.noNotice")}
            </small>
          </div>
          <div
            className="summary-card-tooltip quest-summary-tooltip"
            id="quest-summary-tooltip"
            role="tooltip"
          >
            {questVisible ? (
              <>
                <strong>{text(displayedQuest.objective)}</strong>
                <p>
                  {questCompletedNow
                    ? t("today.quest.completedToday")
                    : displayedQuest.accepted
                      ? t("today.quest.acceptedDays", { days: displayedQuest.daysLeft })
                      : t("today.quest.availablePierre")}{" "}
                  · {displayedQuest.reward.toLocaleString(locale)}g
                </p>
                <p
                  className={
                    displayedQuest.hasRequestedItems
                      ? "quest-have"
                      : "quest-missing"
                  }
                >
                  {questPossession}
                </p>
                {displayedQuest.stock.map((item, index) => (
                  <small key={`${item.name}-${index}`}>
                    {item.count}× {item.displayName || item.name} · {item.sources.join(" · ")}
                  </small>
                ))}
                {displayedQuest.stockNote && (
                  <small>{text(displayedQuest.stockNote)}</small>
                )}
                {hasSeparateAcceptedQuest && (
                  <small>{t("web.dailyBrief.also")}{localizedQuestTitle(brief.dailyQuest, t, text)} ·{" "}
                    {text(brief.dailyQuest.objective)}
                  </small>
                )}
              </>
            ) : (
              <>
                <strong>{t("web.dailyBrief.thereIsNoNewHelpWantedToday")}</strong>
                <p>{t("web.dailyBrief.youCanContinueAnyPreviousRequestFromYourJournal")}</p>
              </>
            )}
          </div>
        </button>
      </div>}
      {visibleSections.priorities && <section className={`priority-center ${live.active ? "live" : ""}`} style={{ order: sectionOrder.indexOf("priorities") + 1 }}>
        <div className="priority-title">
          <div>
            <p className="eyebrow">{t("web.dailyBrief.priorities")} {live.active ? t("today.priority.realtime") : t("today.priority.latestSave")}
            </p>
            <h2>
              {priorityItems.length
                ? t("today.priority.mostImportant")
                : t("today.priority.underControl")}
            </h2>
          </div>
          {live.active && (
            <div className="live-position">
              <strong>{formatLiveTime(live.timeOfDay)}</strong>
              <span>
                {live.location}{t("web.dailyBrief.energy")}{Math.round(live.energy || 0)}/
                {Math.round(live.maxEnergy || 0)}
              </span>
            </div>
          )}
        </div>
        {priorityItems.length ? (
          <div className="priority-grid">
            {priorityItems.slice(0, 6).map((item, index) => {
              const content = (
                <>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </div>
                </>
              );
              return item.action === "community" ? (
                <button
                  type="button"
                  className={`${item.level} interactive`}
                  key={`${item.title}-${index}`}
                  onClick={onOpenCommunityCenter}
                  aria-label={t("today.openCommunity", { item: item.title })}
                >
                  {content}
                </button>
              ) : (
                <article className={item.level} key={`${item.title}-${index}`}>
                  {content}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="priority-empty">{t("web.dailyBrief.youCanSpendTheRestOfTheDayFishing")}</p>
        )}
      </section>}
      {visibleSections.completable && <section className="completable-today" style={{ order: sectionOrder.indexOf("completable") + 1 }}>
        <div className="daily-changes-title">
          <div><p className="eyebrow">{t("web.dailyBrief.reachableWithYourCurrentState")}</p><h2>{t("web.dailyBrief.whatCanICompleteToday")}</h2></div>
          <span>{completableToday.length}{t("web.dailyBrief.actionableNow")}</span>
        </div>
        {completableToday.length ? (
          <div className="completable-grid">
            {completableToday.map((item, index) => {
              const content = <><small>{item.kind}</small><strong>{item.title}</strong><span>{item.detail}</span></>;
              return item.action === "community" ? (
                <button type="button" key={`${item.title}-${index}`} onClick={onOpenCommunityCenter}>{content}</button>
              ) : <article key={`${item.title}-${index}`}>{content}</article>;
            })}
          </div>
        ) : <p className="empty-daily">{t("web.dailyBrief.nothingCanBeConfirmedAsFinishableFromTheCurrent")}</p>}
      </section>}
      {visibleSections.session && <section className="session-changes" style={{ order: sectionOrder.indexOf("session") + 1 }}>
        <div className="daily-changes-title">
          <div><p className="eyebrow">{t("web.dailyBrief.sinceThePreviousAppOpening")}</p><h2>{t("web.dailyBrief.whatChangedSinceMyLastSession")}</h2></div>
          <span>{sessionBaseline ? new Date(sessionBaseline.capturedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : t("today.session.baselineCreated")}</span>
        </div>
        {sessionBaseline ? (
          sessionChanges.length ? <div className="session-change-list">{sessionChanges.map((change) => <span key={change}>{change}</span>)}</div>
          : <p className="empty-daily">{t("web.dailyBrief.noMeasurableChangeSinceThePreviousAppSession")}</p>
        ) : <p className="empty-daily">{t("web.dailyBrief.thisOpeningEstablishesTheFirstBaselineTheNextSession")}</p>}
      </section>}
      {visibleSections.yesterday && <section className="daily-changes" style={{ order: sectionOrder.indexOf("yesterday") + 1 }}>
        <div className="daily-changes-title">
          <div>
            <p className="eyebrow">{t("web.dailyBrief.automaticComparison")}</p>
            <h2>{t("web.dailyBrief.whatChangedSinceYesterday")}</h2>
          </div>
          <span>
            {previous
              ? t("today.change.dateToToday", { date: formatGameDate(previous, t) })
              : t("today.change.waitingSnapshot")}
          </span>
        </div>
        {dailyChanges.length ? (
          <div className="daily-changes-grid">
            {dailyChanges.map((change) => (
              <article className={change.tone} key={change.label}>
                <span>{change.label}</span>
                <strong>{change.value}</strong>
                <small>{change.detail}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-daily">{t("web.dailyBrief.thereIsNoComparablePreviousDaySavedYet")}</p>
        )}
      </section>}
      {visibleSections.quests && <section className="accepted-quests-section" style={{ order: sectionOrder.indexOf("quests") + 1 }}>
        <div className="accepted-quests-heading">
          <div>
            <p className="eyebrow">{t("web.dailyBrief.yourJournal")}</p>
            <h2>{t("web.dailyBrief.acceptedQuests")}</h2>
            <p>{t("web.dailyBrief.activeStoryQuestsAndTimedRequestsReadDirectlyFrom")}</p>
          </div>
          <strong>{acceptedQuests.length}</strong>
        </div>
        {acceptedQuests.length ? (
          <div className="accepted-quest-list">
            {acceptedQuests.map((acceptedQuest) => {
              const hasMeasuredProgress =
                acceptedQuest.daily ||
                [
                  "ItemDelivery",
                  "ResourceCollection",
                  "Fishing",
                  "SlayMonster",
                  "Socialize",
                ].includes(acceptedQuest.type);
              const progress =
                acceptedQuest.target > 0
                  ? Math.min(
                      100,
                      (acceptedQuest.progress / acceptedQuest.target) * 100,
                    )
                  : 0;
              return (
                <article
                  className={acceptedQuest.ready ? "ready" : ""}
                  key={`${acceptedQuest.id}-${localizedQuestTitle(acceptedQuest, t, text)}`}
                >
                  <div className="accepted-quest-title">
                    <div>
                      <span>
                        {acceptedQuest.daily
                          ? t("today.quest.timedDays", { days: acceptedQuest.daysLeft })
                          : t("today.quest.story")}
                      </span>
                      <h3>{localizedQuestTitle(acceptedQuest, t, text)}</h3>
                    </div>
                    {acceptedQuest.reward > 0 && (
                      <strong>
                        {acceptedQuest.reward.toLocaleString(locale)}g
                      </strong>
                    )}
                  </div>
                  <p>{text(acceptedQuest.objective)}</p>
                  {hasMeasuredProgress && (
                    <div className="accepted-quest-progress">
                      <i>
                        <b style={{ width: `${progress}%` }} />
                      </i>
                      <span>
                        {acceptedQuest.progress}/{acceptedQuest.target}
                      </span>
                    </div>
                  )}
                  {acceptedQuest.stock.length > 0 && (
                    <div
                      className={
                        acceptedQuest.hasRequestedItems
                          ? "quest-stock has-items"
                          : "quest-stock"
                      }
                    >
                      <strong>
                        {acceptedQuest.hasRequestedItems
                          ? t("today.quest.haveRequestedItems")
                          : t("today.quest.itemsInStorage")}
                      </strong>
                      {acceptedQuest.stock.map((item, index) => (
                        <p
                          className="locatable-item-card"
                          data-storage-item={item.name}
                          title={t("storage.clickToLocate", { item: item.displayName || item.name })}
                          key={`${item.name}-${index}`}
                        >
                          <ItemMentionArtwork name={item.name} />
                          <span>{item.count}× {item.displayName || item.name} · {item.sources.join(" · ")}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {acceptedQuest.stockNote && (
                    <small className="accepted-quest-note">
                      {text(acceptedQuest.stockNote)}
                    </small>
                  )}
                  <details className="quest-spoilers">
                    <summary>{t("web.dailyBrief.showGuidanceAndPossibleSpoilers")}</summary>
                    {acceptedQuest.description && (
                      <p>{text(acceptedQuest.description)}</p>
                    )}
                    <ol>
                      {(acceptedQuest.tips || []).map((tip, index) => (
                        <li key={index}>{text(tip)}</li>
                      ))}
                    </ol>
                  </details>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-daily">{t("web.dailyBrief.yourJournalHasNoActiveQuests")}</p>
        )}
      </section>}
      {visibleSections["special-orders"] &&
        (brief.specialOrdersUnlocked || specialOrders.length > 0) && (
        <section className="special-orders-section" style={{ order: sectionOrder.indexOf("special-orders") + 1 }}>
          <div className="accepted-quests-heading">
            <div>
              <p className="eyebrow">{t("web.dailyBrief.weeklyBoards")}</p>
              <h2>{t("web.dailyBrief.specialOrders")}</h2>
              <p>{t("web.dailyBrief.longerRequestsFromTheTownBoardAndOnceAvailable")}</p>
            </div>
            <strong>{specialOrders.length}</strong>
          </div>
          {specialOrders.length ? (
            <div className="special-order-list">
              {specialOrders.map((order) => (
                <article key={order.id}>
                  <header>
                    <div>
                      <span>{order.requester} · {order.duration}</span>
                      <h3>{order.title}</h3>
                    </div>
                    <strong>{order.daysLeft}{t("web.home.day.944c27")}{order.daysLeft === 1 ? "" : "s"}{t("web.dailyBrief.left")}</strong>
                  </header>
                  {order.description && <p>{order.description}</p>}
                  <ul>
                    {order.objectives.map((objective, index) => (
                      <li key={`${order.id}-${index}`}>
                        <span>{objective.description}</span>
                        <b>{objective.progress}/{objective.target}</b>
                      </li>
                    ))}
                  </ul>
                  {order.reward && <small>{t("web.dailyBrief.reward")}{order.reward}</small>}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-daily">{t("web.dailyBrief.theTownSpecialOrdersBoardIsUnlockedButNo")}</p>
          )}
        </section>
      )}
      <div className="daily-content-grid">
        {visibleSections["live-map"] && live.active && (
          <article
            className="daily-card live-map-card"
            style={{ order: sectionOrder.indexOf("live-map") + 1 }}
          >
            <div className="card-title">
              <div>
                <p className="eyebrow">{t("web.dailyBrief.liveLocation")}</p>
                <h2>{live.location || live.locationId}</h2>
              </div>
              <small>{formatLiveTime(live.timeOfDay)}</small>
            </div>
            <LiveWorldMap live={live} season={current.season} />
          </article>
        )}
        {visibleSections.route && <article className="daily-card world-card" style={{ order: sectionOrder.indexOf("route") + 1 }}>
          <div className="card-title">
            <div>
              <p className="eyebrow">{t("web.dailyBrief.suggestedRoute")}</p>
              <h2>{t("web.dailyBrief.tripAroundStardewValley")}</h2>
            </div>
            <div className="world-progress">
              <strong>
                {completedWorld.length}/{worldTaskCount}
              </strong>
              <span>{t("web.dailyBrief.stopsCompleted")}</span>
            </div>
          </div>
          <div className="world-list route-list">
            {routeWorld.map((location, index) => {
              const checked = completedWorld.includes(location.location);
              const automatic = automaticallyCompletedWorld.includes(
                location.location,
              );
              const currentLocation =
                currentRouteLocation === location.location;
              const notes = routeNotes(location.location);
              const displayedItems =
                liveWorldItems.get(location.location) ?? location.items;
              return (
                <section
                  className={`${checked ? "checked" : ""} ${automatic ? "automatic" : ""} ${currentLocation ? "current-location" : ""}`}
                  key={location.location}
                >
                  <span className="route-number">{index + 1}</span>
                  <label className="world-location-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={automatic}
                      onChange={() => toggleWorldLocation(location.location)}
                    />
                    <i>{checked ? "✓" : ""}</i>
                    <span>
                      <b>{routeLocationName(location.location, t)}</b>
                      <small>
                        {currentLocation
                          ? t("today.route.youAreHere", { time: formatLiveTime(live.timeOfDay) })
                          : automatic
                            ? t("today.route.completedLive")
                            : checked
                              ? t("today.route.completedManual")
                              : t("today.route.nextStop")}
                      </small>
                    </span>
                  </label>
                  {displayedItems.length > 0 && (
                    <div className="world-items">
                      {displayedItems.map((item, itemIndex) => (
                        <span
                          key={`${item.name}-${itemIndex}`}
                        >
                          <ItemMentionArtwork name={item.name} locatable={false} />
                          <b>{item.count}×</b> {routeItemName(item, t)}
                        </span>
                      ))}
                    </div>
                  )}
                  {notes.length > 0 && (
                    <p className="route-notes">{notes.join(" · ")}</p>
                  )}
                  {location.location === "Farm" &&
                    brief.fruitCave.count > 0 && (
                      <div className="route-detail">
                        <strong>
                          {t("today.cave.routeTitle", {
                            cave: caveTypeLabel(brief.fruitCave.type, t),
                          })}
                        </strong>
                        <span>
                          {brief.fruitCave.items
                            .map((item) => `${item.count}× ${item.displayName || item.name}`)
                            .join(" · ")}
                        </span>
                      </div>
                    )}
                  {location.location === "Town" && brief.toolUpgrade?.ready && (
                    <div className="route-tool-alert">
                      <span>⚒</span>
                      <div>
                        <strong>{t("web.dailyBrief.collectYour")}{brief.toolUpgrade.displayName || brief.toolUpgrade.name}{t("web.dailyBrief.today")}</strong>
                        <small>
                          {
                            t("today.route.clintReadyDetail")
                          }
                        </small>
                      </div>
                    </div>
                  )}
                  {currentLocation && (
                    <span
                      className="route-player-marker"
                      title={t("today.route.farmerHere", { farmer: current.farmer })}
                      aria-label={t("today.route.farmerHere", { farmer: current.farmer })}
                    >
                      <i />
                      <b />
                    </span>
                  )}
                </section>
              );
            })}
          </div>
          {manualCompletedWorld.length > 0 && (
            <button
              className="reset-world"
              onClick={() => {
                setManualCompletedWorld([]);
                window.localStorage.removeItem(manualWorldStorageKey);
              }}
            >{t("web.dailyBrief.resetManualChecks")}</button>
          )}
          <small className="daily-caveat">{t("web.dailyBrief.manualChecksRemainSavedForThisDayLIVEChecks")}</small>
        </article>}
        {visibleSections.crops && <article className="daily-card crop-forecast-card" style={{ order: sectionOrder.indexOf("crops") + 1 }}>
          <div className="card-title">
            <div>
              <p className="eyebrow">{t("web.dailyBrief.forecastWithDailyWatering")}</p>
              <h2>{t("web.dailyBrief.whenYourCropsWillBeReady")}</h2>
            </div>
            <strong className="big-count">
              {brief.crops.reduce((sum, item) => sum + item.count, 0)}
            </strong>
          </div>
          <div className="crop-forecast-list">
            {brief.crops.map((crop, index) => (
              <div
                className={
                  crop.ready ? "ready" : crop.willWither ? "danger" : ""
                }
                key={`${crop.id}-${crop.daysRemaining}-${index}`}
              >
                <SheetArtwork id={crop.id} kind="object" label={crop.displayName || crop.name} />
                <span className="crop-forecast-copy">
                  <strong>
                    {crop.count}× {crop.displayName || crop.name}
                  </strong>
                  <span>
                    {crop.ready
                      ? t("today.crop.readyToday")
                      : t(crop.regrowing ? "today.crop.regrowsIn" : "today.crop.harvestIn", {
                          days: crop.daysRemaining,
                          date: formatHarvestDate(crop.harvestDate, t),
                        })}
                  </span>
                  <small>
                    {crop.watered}/{crop.count}{t("web.dailyBrief.wateredInTheSave")}{crop.willWither
                      ? t("today.crop.willWither")
                      : ""}
                  </small>
                </span>
              </div>
            ))}
          </div>
          <p className="daily-caveat">
            {
              t("today.crop.explanation")
            }
          </p>
        </article>}
        {visibleSections.birthdays && <article className="daily-card birthday-card" id="birthday-gifts" style={{ order: sectionOrder.indexOf("birthdays") + 1 }}>
          <div className="card-title">
            <div>
              <p className="eyebrow">{t("web.dailyBrief.calendarAndAvailableGifts")}</p>
              <h2>{t("web.dailyBrief.birthdays")}</h2>
            </div>
            <span className="checked-items">
              {brief.inventoryItemsChecked}{t("web.dailyBrief.typesChecked")}</span>
          </div>
          {brief.birthdays.length ? (
            brief.birthdays.map((birthday) => (
              <div
                className="birthday-person"
                key={`${birthday.when}-${birthday.person}`}
              >
                <div className="birthday-title">
                  <NpcArtwork
                    name={birthday.id || birthday.person}
                    kind="portrait"
                  />
                  <div>
                    <span>{birthdayWhenLabel(birthday.when, t)}</span>
                    <strong>{birthday.person}</strong>
                  </div>
                </div>
                <GiftGroup
                  label={t("gift.loved")}
                  tone="love"
                  items={birthday.gifts.love}
                />
                <GiftGroup
                  label={t("gift.liked")}
                  tone="like"
                  items={birthday.gifts.like}
                />
                <GiftGroup
                  label={t("gift.neutral")}
                  tone="neutral"
                  items={birthday.gifts.neutral}
                />
              </div>
            ))
          ) : (
            <p className="empty-daily">{t("web.dailyBrief.thereAreNoBirthdaysTodayOrTomorrow")}</p>
          )}
          <p className="daily-caveat">{t("web.dailyBrief.onlyItemsCurrentlyInYourBackpackOrSavedChests")}</p>
        </article>}
      </div>
    </section>
  );
}

function GiftGroup({
  label,
  tone,
  items,
}: {
  label: string;
  tone: string;
  items: GiftItem[];
}) {
  const { t } = useI18n();
  const quality = ["normal", "silver", "gold", "iridium", "iridium"];
  return (
    <div className={`gift-group ${tone}`}>
      <h3>
        {label} <span>{items.length}</span>
      </h3>
      {items.length ? (
        <div className="gift-list">
          {items.map((item, index) => (
            <div
              className="locatable-item-card"
              data-storage-item={item.name}
              title={t("storage.clickToLocate", { item: item.displayName || item.name })}
              key={`${item.name}-${item.quality}-${index}`}
            >
              <ItemMentionArtwork
                id={item.id}
                name={item.name}
                item={item.id ? { ...item, id: item.id } : undefined}
              />
              <strong>{item.displayName || item.name}</strong>
              <span>
                {item.count}× · {t(`quality.${quality[item.quality] || "normal"}`)}
              </span>
              <small>{item.sources.map((source) => localizedStorageSource(source, t)).join(" · ")}</small>
            </div>
          ))}
        </div>
      ) : (
        <p>{t("web.giftGroup.youDoNotHaveAnyAvailable")}</p>
      )}
    </div>
  );
}

function LiveWorldMap({
  live,
  season,
  compact = false,
}: {
  live: LiveState;
  season: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const region = worldMapRegion(live.locationId);
  const crop = worldMapCrop(region);
  const cropStyle = {
    aspectRatio: `${crop.width} / ${crop.height}`,
    "--world-map-width": `${(300 / crop.width) * 100}%`,
    "--world-map-left": `${(-crop.x / crop.width) * 100}%`,
    "--world-map-top": `${(-crop.y / crop.height) * 100}%`,
  } as CSSProperties;
  return (
    <div className={`live-world-map focused ${compact ? "compact" : ""}`}>
      <div className="live-world-map-viewport" style={cropStyle}>
        {/* This is extracted from the user's own Stardew installation. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/assets/maps/world-${season}.png`}
          alt={t("map.focusedOn", { location: live.location || live.locationId || t("map.currentArea") })}
        />
        <span className={`world-pin location-${region}`}>
          <i />
          <b>{live.location || live.locationId}</b>
        </span>
      </div>
      <small>{t("web.liveWorldMap.liveAreaTile")}{live.tileX}, {live.tileY}{t("web.liveWorldMap.in")}{live.locationId}
      </small>
    </div>
  );
}

function worldMapCrop(region: string) {
  const crops: Record<string, { x: number; y: number; width: number; height: number }> = {
    farm: { x: 0, y: 45, width: 145, height: 105 },
    busstop: { x: 45, y: 25, width: 135, height: 90 },
    town: { x: 95, y: 25, width: 135, height: 100 },
    mountain: { x: 75, y: 0, width: 155, height: 85 },
    beach: { x: 105, y: 85, width: 165, height: 90 },
    forest: { x: 0, y: 55, width: 155, height: 110 },
    island: { x: 125, y: 360, width: 105, height: 64 },
    desert: { x: 0, y: 0, width: 300, height: 180 },
    unknown: { x: 0, y: 0, width: 300, height: 180 },
  };
  return crops[region] || crops.unknown;
}

function worldMapRegion(locationId = "") {
  const id = locationId.toLowerCase();
  if (/island|volcano/.test(id)) return "island";
  if (/desert|skullcave/.test(id)) return "desert";
  if (/farm|greenhouse/.test(id)) return "farm";
  if (/busstop|tunnel/.test(id)) return "busstop";
  if (/beach|fishshop|elliotthouse/.test(id)) return "beach";
  if (/forest|woods|wizard|animalshop|sewer/.test(id)) return "forest";
  if (/mountain|mine|railroad|adventureguild|bathhouse|quarry/.test(id))
    return "mountain";
  if (
    /town|seedshop|saloon|hospital|blacksmith|manorhouse|museum|trailer|joja/.test(
      id,
    )
  )
    return "town";
  return "unknown";
}

function NpcArtwork({
  name,
  kind,
}: {
  name: string;
  kind: "sprite" | "portrait";
}) {
  return (
    <span className={`npc-artwork ${kind}`} aria-hidden="true">
      <b>{name.slice(0, 1)}</b>
      {/* Local spritesheets must retain their original pixels and are not candidates for web image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/${kind === "sprite" ? "characters" : "portraits"}/${encodeURIComponent(name)}.png`}
        alt=""
        onError={(event) => {
          event.currentTarget.hidden = true;
          event.currentTarget.parentElement?.classList.add("missing");
        }}
      />
    </span>
  );
}

function GrandpaShrineArtwork({ candles }: { candles: number }) {
  // Farm.addGrandpaCandles uses this order and these offsets relative to the
  // vanilla shrine: lower-left, upper-left, upper-right, lower-right.
  const candlePositions = [
    { baseLeft: 74, baseTop: 106, flameLeft: 70, flameTop: 94 },
    { baseLeft: 84, baseTop: 76, flameLeft: 82, flameTop: 64 },
    { baseLeft: 138, baseTop: 76, flameLeft: 136, flameTop: 64 },
    { baseLeft: 148, baseTop: 106, flameLeft: 146, flameTop: 94 },
  ];
  return (
    <span className="grandpa-altar" aria-hidden="true">
      {/* All three images are extracted privately from the local game files. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/sprites/Grandpa%20Shrine%20Scene.png" alt="" />
      {candlePositions.slice(0, candles).map((position, index) => (
        <span className="grandpa-candle" key={index}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="grandpa-candle-base"
            src="/assets/sprites/Grandpa%20Candle%20Base.png"
            alt=""
            style={{ left: position.baseLeft, top: position.baseTop }}
          />
          <span
            className="grandpa-candle-flame"
            style={{
              left: position.flameLeft,
              top: position.flameTop,
              animationDelay: `${index * -50}ms`,
            }}
          />
        </span>
      ))}
    </span>
  );
}

function GrowthView({
  history,
  current,
  previous: previousSnapshot,
  live,
}: {
  history: FarmHistory;
  current: Snapshot;
  previous: Snapshot | null;
  live: LiveState;
}) {
  const { t, text, locale } = useI18n();
  const growthSectionOptions = [
    { id: "metrics", label: t("growth.section.metrics") },
    { id: "milestones", label: t("growth.section.milestones") },
    { id: "evaluation", label: t("growth.section.evaluation") },
    { id: "economy", label: t("growth.section.economy") },
    { id: "cash-flow", label: t("growth.section.cashFlow") },
    { id: "activity", label: t("growth.section.activity") },
    { id: "snapshots", label: t("growth.section.snapshots") },
  ] as const;
  const [visibleSections, setSectionVisible, showAllSections, sectionOrder, moveSection] =
    useSectionVisibility(
      "stardew-tool-visible-sections-growth-v1",
      growthSectionOptions.map((option) => option.id),
    );
  const entries = history.entries;
  const annotatedEntries = entries
    .filter((entry) => entry.annotations?.length)
    .slice(-12)
    .reverse();
  const latest = entries.at(-1);
  const previous = entries.at(-2);
  const balanceDelta = latest && previous ? latest.money - previous.money : 0;
  const skillTotal = Object.values(current.progress)
    .slice(0, 5)
    .reduce((sum, value) => sum + value, 0);
  const maxFlow = Math.max(
    1,
    ...entries.flatMap((entry) => [entry.income, entry.spending]),
  );
  const evaluationDayIndex = 225;
  const earningDaysAvailable = 224;
  const daysToEvaluation = Math.max(0, evaluationDayIndex - current.dayIndex);
  const remainingEvaluationDays = Math.max(
    0,
    earningDaysAvailable - current.dayIndex,
  );
  const currentEarningRate =
    current.totalMoneyEarned / Math.max(1, current.dayIndex);
  const plantedCropValue = current.dailyBrief.crops.reduce((sum, crop) => {
    const plan = current.planningBrief.crops.find(
      (option) => option.name === crop.name,
    );
    return sum + crop.count * (plan?.sell || 0);
  }, 0);
  const projectedLow = Math.round(
    current.totalMoneyEarned +
      currentEarningRate * remainingEvaluationDays * 0.7 +
      plantedCropValue * 0.8,
  );
  const projectedEarnings = Math.round(
    current.totalMoneyEarned +
      currentEarningRate * remainingEvaluationDays +
      plantedCropValue,
  );
  const projectedHigh = Math.round(
    current.totalMoneyEarned +
      currentEarningRate * remainingEvaluationDays * 1.35 +
      plantedCropValue * 1.25,
  );
  const earningsPoints = (value: number) =>
    [
      [50000, 1],
      [100000, 1],
      [200000, 1],
      [300000, 1],
      [500000, 1],
      [1000000, 2],
    ].reduce(
      (points, [threshold, reward]) =>
        points + (value >= threshold ? reward : 0),
      0,
    );
  const projectedSkillTotal = Math.min(
    50,
    Math.round(
      (current.grandpa.skillTotal / Math.max(1, current.dayIndex)) *
        earningDaysAvailable,
    ),
  );
  const projectedSkillPoints =
    Number(projectedSkillTotal >= 30) + Number(projectedSkillTotal >= 50);
  const museumCount =
    live.active && live.collections
      ? live.collections.museumItems.length
      : current.museumBrief.donated.length;
  const fishCount =
    live.active && live.collections
      ? live.collections.caughtFish.length
      : current.fishingBrief.caughtCount;
  const fishTarget = Math.max(1, current.fishingBrief.fish.length);
  const liveBundles = new Map(
    ((live.active ? live.collections?.bundleProgress : []) || []).map(
      (bundle) => [String(bundle.id), bundle.donated],
    ),
  );
  const completedBundles = current.planningBrief.communityCenter.rooms.reduce(
    (sum, room) =>
      sum +
      room.bundles.filter((bundle) => {
        const donated = liveBundles.get(bundle.id);
        return donated
          ? donated.slice(0, bundle.requirements.length).filter(Boolean)
              .length >= bundle.required
          : bundle.complete;
      }).length,
    0,
  );
  const bundleTarget = current.planningBrief.communityCenter.total;
  const museumCompleteLive = museumCount >= 95;
  const grandpaMilestones = current.grandpa.milestones.map((item) => ({
    ...(item.id === "museum" && museumCompleteLive ? { ...item, done: true } : item),
    label: t(`growth.milestone.${item.id}.label`),
    how: t(`growth.milestone.${item.id}.how`),
  }));
  const achievedMilestonePoints = grandpaMilestones
    .filter((item) => item.done)
    .reduce((sum, item) => sum + item.points, 0);
  const projectAtEvaluation = (value: number) =>
    (value / Math.max(1, current.dayIndex)) * earningDaysAvailable;
  const currentFriendships = (
    live.active && live.friendships?.length
      ? live.friendships
      : current.planningBrief.friendships
  ).filter(isVanillaFriend);
  const projectedFriendPoints = currentFriendships.map((friend) => {
    const samples = entries
      .filter((entry) => current.dayIndex - entry.dayIndex <= 28)
      .map((entry) => ({
        dayIndex: entry.dayIndex,
        points: entry.friendships?.find((item) => item.name === friend.name)
          ?.points,
      }))
      .filter(
        (sample): sample is { dayIndex: number; points: number } =>
          sample.points !== undefined,
      );
    const recentRate =
      samples.length >= 2
        ? Math.max(
            0,
            (samples.at(-1)!.points - samples[0].points) /
              Math.max(1, samples.at(-1)!.dayIndex - samples[0].dayIndex),
          )
        : friend.points / Math.max(1, current.dayIndex);
    return Math.min(2500, friend.points + recentRate * remainingEvaluationDays);
  });
  const projectedFriendsAtEight = projectedFriendPoints.filter(
    (points) => points >= 1975,
  ).length;
  const petSamples = entries.filter(
    (entry) =>
      current.dayIndex - entry.dayIndex <= 28 &&
      entry.petFriendship !== undefined,
  );
  const petRecentRate =
    petSamples.length >= 2
      ? Math.max(
          0,
          ((petSamples.at(-1)!.petFriendship || 0) -
            (petSamples[0].petFriendship || 0)) /
            Math.max(1, petSamples.at(-1)!.dayIndex - petSamples[0].dayIndex),
        )
      : current.grandpa.petFriendship / Math.max(1, current.dayIndex);
  const projectedPetFriendship = Math.min(
    1000,
    current.grandpa.petFriendship + petRecentRate * remainingEvaluationDays,
  );
  const milestoneForecasts = grandpaMilestones.map((item) => {
    let projected = item.done;
    let basis = item.done
      ? t("growth.forecast.completed")
      : t("growth.forecast.insufficient");
    if (!item.done && item.id === "museum") {
      projected = projectAtEvaluation(museumCount) >= 95;
      basis = t("growth.forecast.museum", { current: museumCount, projected: Math.min(95, Math.round(projectAtEvaluation(museumCount))) });
    }
    if (!item.done && item.id === "angler") {
      projected = projectAtEvaluation(fishCount) >= fishTarget;
      basis = t("growth.forecast.fishing", { current: fishCount, target: fishTarget, projected: Math.min(fishTarget, Math.round(projectAtEvaluation(fishCount))) });
    }
    if (!item.done && item.id === "friends5") {
      projected = projectedFriendsAtEight >= 5;
      basis = t("growth.forecast.friends", { current: current.grandpa.friendsAtEightHearts, target: 5, projected: projectedFriendsAtEight });
    }
    if (!item.done && item.id === "friends10") {
      projected = projectedFriendsAtEight >= 10;
      basis = t("growth.forecast.friends", { current: current.grandpa.friendsAtEightHearts, target: 10, projected: projectedFriendsAtEight });
    }
    if (!item.done && item.id === "pet") {
      projected = projectedPetFriendship >= 999;
      basis = t("growth.forecast.pet", { current: current.grandpa.petFriendship, projected: Math.round(projectedPetFriendship) });
    }
    if (!item.done && item.id === "community") {
      projected =
        bundleTarget > 0 &&
        projectAtEvaluation(completedBundles) >= bundleTarget;
      basis = t("growth.forecast.community", { current: completedBundles, target: bundleTarget, projected: Math.min(bundleTarget, Math.round(projectAtEvaluation(completedBundles))) });
    }
    if (!item.done && item.id === "skull") {
      projected = projectAtEvaluation(current.progress.deepestMineLevel) >= 120;
      basis = t("growth.forecast.skull", { current: current.progress.deepestMineLevel, projected: Math.min(120, Math.round(projectAtEvaluation(current.progress.deepestMineLevel))) });
    }
    if (!item.done && item.id === "rusty") {
      projected = projectAtEvaluation(museumCount) >= 60;
      basis = t("growth.forecast.rusty", { current: museumCount, projected: Math.min(60, Math.round(projectAtEvaluation(museumCount))) });
    }
    return {
      ...item,
      forecast: item.done
        ? ("achieved" as const)
        : projected
          ? ("projected" as const)
          : ("not-projected" as const),
      basis,
    };
  });
  const forecastMilestonePoints = milestoneForecasts
    .filter((item) => item.forecast !== "not-projected")
    .reduce((sum, item) => sum + item.points, 0);
  const projectedScore =
    earningsPoints(projectedEarnings) +
    projectedSkillPoints +
    forecastMilestonePoints;
  const projectedCandles =
    projectedScore >= 12
      ? 4
      : projectedScore >= 8
        ? 3
        : projectedScore >= 4
          ? 2
          : 1;
  const nextMoneyThreshold = [
    50000, 100000, 200000, 300000, 500000, 1000000,
  ].find((value) => value > current.totalMoneyEarned);
  const nextSkillThreshold = [30, 50].find(
    (value) => value > current.grandpa.skillTotal,
  );
  const earningRate = current.totalMoneyEarned / Math.max(1, current.dayIndex);
  const skillRate = current.grandpa.skillTotal / Math.max(1, current.dayIndex);
  const measurablePoints = [
    nextMoneyThreshold
      ? {
          id: "money",
          label: t("growth.point.earnings", { amount: nextMoneyThreshold.toLocaleString(locale) }),
          remaining: t("growth.point.moneyRemaining", { amount: (nextMoneyThreshold - current.totalMoneyEarned).toLocaleString(locale) }),
          reward: nextMoneyThreshold === 1000000 ? 2 : 1,
          how: t("growth.point.earningsHow"),
          estimate:
            (nextMoneyThreshold - current.totalMoneyEarned) /
            Math.max(1, earningRate),
        }
      : null,
    nextSkillThreshold
      ? {
          id: "skills",
          label: t("growth.point.skillLevels", { count: nextSkillThreshold }),
          remaining: t("growth.point.skillRemaining", { count: nextSkillThreshold - current.grandpa.skillTotal }),
          reward: 1,
          how: t("growth.point.skillsHow"),
          estimate:
            (nextSkillThreshold - current.grandpa.skillTotal) /
            Math.max(0.05, skillRate),
        }
      : null,
    !current.grandpa.milestones.find((item) => item.id === "pet")?.done
      ? {
          id: "pet",
          label: t("growth.point.petFriendship"),
          remaining: t("growth.point.friendshipRemaining", { count: Math.max(0, 999 - current.grandpa.petFriendship) }),
          reward: 1,
          how: t("growth.point.petHow"),
          estimate: Math.max(0, 999 - current.grandpa.petFriendship) / 18,
        }
      : null,
    !current.grandpa.milestones.find((item) => item.id === "skull")?.done
      ? {
          id: "skull",
          label: t("growth.point.skullKey"),
          remaining: t("growth.point.floorsRemaining", { count: Math.max(0, 120 - current.progress.deepestMineLevel) }),
          reward: 1,
          how: t("growth.point.skullHow"),
          estimate:
            Math.max(0, 120 - current.progress.deepestMineLevel) /
            Math.max(
              0.5,
              current.progress.deepestMineLevel / Math.max(1, current.dayIndex),
            ),
        }
      : null,
  ]
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.estimate - b.estimate);
  const nextPoint = measurablePoints[0];
  const earnedSources = [
    current.grandpa.earningsPoints
      ? t("growth.score.fromEarnings", { count: current.grandpa.earningsPoints })
      : null,
    current.grandpa.skillPoints
      ? t("growth.score.fromSkills", { count: current.grandpa.skillPoints })
      : null,
    achievedMilestonePoints
      ? t("growth.score.fromMilestones", { count: achievedMilestonePoints })
      : null,
  ].filter(Boolean);
  const currentActualScore =
    current.grandpa.earningsPoints +
    current.grandpa.skillPoints +
    achievedMilestonePoints;
  const previousMilestones = new Map(
    (previousSnapshot?.grandpa.milestones || []).map((item) => [
      item.id,
      item.done,
    ]),
  );
  const scoreEvents = previousSnapshot
    ? [
        current.grandpa.earningsPoints > previousSnapshot.grandpa.earningsPoints
          ? {
              label: t("growth.score.earningsThreshold"),
              points:
                current.grandpa.earningsPoints -
                previousSnapshot.grandpa.earningsPoints,
            }
          : null,
        current.grandpa.skillPoints > previousSnapshot.grandpa.skillPoints
          ? {
              label: t("growth.score.skillThreshold"),
              points:
                current.grandpa.skillPoints -
                previousSnapshot.grandpa.skillPoints,
            }
          : null,
        ...grandpaMilestones
          .filter((item) => item.done && !previousMilestones.get(item.id))
          .map((item) => ({ label: item.label, points: item.points })),
      ].filter((item): item is { label: string; points: number } =>
        Boolean(item),
      )
    : [];
  const pointsEarnedToday = scoreEvents.reduce(
    (sum, item) => sum + item.points,
    0,
  );
  const actualCandles =
    currentActualScore >= 12
      ? 4
      : currentActualScore >= 8
        ? 3
        : currentActualScore >= 4
          ? 2
          : 1;
  return (
    <section className="growth-page">
      <div className="growth-heading">
        <div>
          <p className="eyebrow">{t("growth.localHistory")}</p>
          <h1>{t("growth.title", { farm: current.farmName })}</h1>
          <p>{t("growth.description")}</p>
        </div>
        <div className="page-heading-actions">
          <div className="history-count">
            <strong>{entries.length}</strong>
            <span>{t("growth.daysRecorded")}</span>
          </div>
          <SectionVisibilityMenu
            label={t("growth.customizeSections")}
            options={growthSectionOptions}
            visible={visibleSections}
            order={sectionOrder}
            onChange={setSectionVisible}
            onShowAll={showAllSections}
            onMove={moveSection}
          />
        </div>
      </div>
      {visibleSections.metrics && <div className="metric-grid" style={{ order: sectionOrder.indexOf("metrics") + 1 }}>
        <Metric
          label={t("growth.metric.balance")}
          value={`${current.money.toLocaleString(locale)}g`}
          delta={balanceDelta}
        />
        <Metric
          label={t("web.economyChart.totalEarnings")}
          value={`${current.totalMoneyEarned.toLocaleString(locale)}g`}
        />
        <Metric
          label={t("growth.metric.latestIncome")}
          value={`${(latest?.income || 0).toLocaleString(locale)}g`}
        />
        <Metric
          label={t("growth.metric.latestSpending")}
          value={`${(latest?.spending || 0).toLocaleString(locale)}g`}
        />
        <Metric label={t("growth.metric.skillLevels")} value={`${skillTotal}/50`} />
        <Metric
          label={t("growth.metric.deepestMine")}
          value={t("growth.metric.level", { level: current.progress.deepestMineLevel })}
        />
      </div>}
      {visibleSections.milestones && <details className="history-timeline" style={{ order: sectionOrder.indexOf("milestones") + 1 }}>
        <summary>
          <div>
            <p className="eyebrow">{t("web.growth.automaticHistoryAnnotations")}</p>
            <h2>{t("web.growth.farmMilestones")}</h2>
            <p>{t("web.growth.detectedFromChangesBetweenConsecutiveLocalSnapshots")}</p>
          </div>
          <span>{annotatedEntries.length}{t("web.growth.recordedDays")}<b aria-hidden="true">⌄</b></span>
        </summary>
        <div className="history-timeline-content">
          {annotatedEntries.length ? (
            <div className="history-event-list">
              {annotatedEntries.map((entry) => (
                <article key={entry.dateKey}>
                  <time>{formatGameDate(entry, t)}</time>
                  <div>{entry.annotations!.map((annotation, index) => (
                    <span key={`${entry.dateKey}-${index}`}>{localizedHistoryAnnotation(annotation, t, text)}</span>
                  ))}</div>
                </article>
              ))}
            </div>
          ) : <p className="empty-daily">{t("web.growth.newMilestonesWillAppearAfterTheNextSavedChange")}</p>}
        </div>
      </details>}
      {visibleSections.evaluation && <div className="growth-evaluation-group" style={{ order: sectionOrder.indexOf("evaluation") + 1 }}>
      <article className="grandpa-card">
        <div className="grandpa-summary">
          <p className="eyebrow">{t("web.growth.forecastForSpring1Year3")}</p>
          <h2>{t("growth.section.evaluation")}</h2>
          <div className="grandpa-number">
            <strong>{daysToEvaluation}</strong>
            <span>{t("web.growth.inGameDaysRemaining")}</span>
          </div>
          <div
            className="grandpa-shrine"
            aria-label={t("growth.projectedCandles", { count: projectedCandles })}
          >
            <GrandpaShrineArtwork candles={projectedCandles} />
          </div>
          <p>{t("web.growth.likelyScenario")}<b>{projectedScore}{t("web.growth.measurablePoints")}</b>{t("web.growth.equivalentTo")}<b>{projectedCandles}{t("web.home.candles")}</b>{t("web.growth.theHighestEvaluationStartsAt12Points")}</p>
          <small>{t("web.growth.estimateCombinesProjectedEarningsAndSkillsWithMilestonesMarked")}</small>
        </div>
        <div className="forecast-numbers">
          <div>
            <span>{t("web.growth.projectedEarnings")}</span>
            <strong>{projectedEarnings.toLocaleString(locale)}g</strong>
            <small>
              {projectedLow.toLocaleString(locale)}–
              {projectedHigh.toLocaleString(locale)}{t("web.growth.gLowHighScenario")}</small>
          </div>
          <div>
            <span>{t("web.growth.projectedSkills")}</span>
            <strong>{projectedSkillTotal}/50</strong>
            <small>{projectedSkillPoints}{t("web.growth.2SkillPoints")}</small>
          </div>
          <div>
            <span>{t("web.growth.confirmedScoreNow")}</span>
            <strong>{currentActualScore}/21</strong>
            <small>{t("web.growth.currentlyEquals")}{actualCandles}{t("web.growth.candle")}{actualCandles === 1 ? "" : "s"}
            </small>
          </div>
        </div>
        <div className="milestone-list">
          {milestoneForecasts.map((item) => (
            <div className={item.forecast} key={item.id}>
              <i>
                {item.forecast === "achieved"
                  ? "✓"
                  : item.forecast === "projected"
                    ? "↗"
                    : "○"}
              </i>
              <span>
                {item.label}
                <small>
                  {item.forecast === "achieved"
                    ? t("growth.status.achieved")
                    : item.forecast === "projected"
                      ? t("growth.status.projected")
                      : t("growth.status.notProjected")}
                </small>
              </span>
              <span className="milestone-score-tip">
                <button
                  type="button"
                  aria-label={t("growth.forecastDetails", { name: item.label })}
                >
                  +{item.points}
                </button>
                <span role="tooltip">
                  <b>
                    {item.forecast === "achieved"
                      ? t("growth.status.achieved")
                      : item.forecast === "projected"
                        ? t("growth.status.projectedPace")
                        : t("growth.status.notProjected")}
                  </b>
                  <br />
                  {item.basis}
                  <br />
                  <br />
                  {item.how}
                </span>
              </span>
            </div>
          ))}
        </div>
      </article>
      <article className="grandpa-explainer">
        <div className="candle-explanation">
          <span className="candle-icon">+{pointsEarnedToday}</span>
          <div>
            <p className="eyebrow">{t("web.growth.yourScoreToday")}</p>
            <h2>
              {pointsEarnedToday
                ? t("growth.score.newPoints", { count: pointsEarnedToday })
                : t("growth.score.noNewPoints")}
            </h2>
            <p>
              {previousSnapshot ? (
                <>{t("web.growth.comparedWith")}<b>{formatGameDate(previousSnapshot, t)}</b>{t("web.growth.yourConfirmedTotalIs")}<b>{currentActualScore}/21</b>
                  {earnedSources.length ? (
                    <> ({earnedSources.join(" · ")})</>
                  ) : null}
                  .
                </>
              ) : (
                <>{t("web.growth.aPreviousDailySnapshotIsNotAvailableForComparison")}<b>{currentActualScore}/21</b>.
                </>
              )}
            </p>
            {scoreEvents.length > 0 && (
              <div className="score-events">
                {scoreEvents.map((event) => (
                  <span key={event.label}>
                    +{event.points} {event.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {nextPoint && (
          <div className="next-grandpa-point">
            <div>
              <p className="eyebrow">{t("web.growth.nearestNextPoint")}</p>
              <h3>{nextPoint.label}</h3>
              <strong>{nextPoint.remaining}</strong>
            </div>
            <span>
              +{nextPoint.reward}{t("web.growth.point")}{nextPoint.reward === 1 ? "" : "s"}
            </span>
            <p>{nextPoint.how}</p>
            <small>{t("web.growth.proximityIsEstimatedFromYourCurrentEarningsSkillsMine")}</small>
          </div>
        )}
        <div className="score-breakdown">
          <div>
            <span>{t("web.home.money")}</span>
            <strong>{current.grandpa.earningsPoints}{t("web.growth.7Pt")}</strong>
            <small>
              {nextMoneyThreshold
                ? t("growth.score.nextMoneyThreshold", { amount: nextMoneyThreshold.toLocaleString(locale) })
                : t("growth.score.allEarningsReached")}
            </small>
          </div>
          <div>
            <span>{t("web.growth.skills")}</span>
            <strong>{current.grandpa.skillPoints}{t("web.growth.2Pt")}</strong>
            <small>
              {nextSkillThreshold
                ? t("growth.score.nextSkillThreshold", { count: nextSkillThreshold })
                : t("growth.score.allSkillsReached")}
            </small>
          </div>
          <div>
            <span>{t("web.growth.otherMilestones")}</span>
            <strong>{achievedMilestonePoints}{t("web.growth.12Pt")}</strong>
            <small>{t("web.growth.museumFishingShippingFriendshipsPetKeysAndCommunityCenter")}</small>
          </div>
        </div>
        <p className="candle-thresholds">
          <b>{t("web.growth.reference")}</b>{t("web.growth.03Points1Candle4728")}</p>
      </article>
      </div>}
      <div className="growth-grid">
        {visibleSections.economy && <article className="chart-card wide" style={{ order: sectionOrder.indexOf("economy") + 1 }}>
          <div className="card-title">
            <div>
              <p className="eyebrow">{t("web.growth.economy")}</p>
              <h2>{t("web.growth.balanceAndTotalEarnings")}</h2>
            </div>
            <div className="chart-key">
              <span>
                <i className="balance-key" />{t("web.growth.balance")}</span>
              <span>
                <i className="earned-key" />{t("web.growth.earnings")}</span>
            </div>
          </div>
          <EconomyChart entries={entries} />
        </article>}
        {visibleSections["cash-flow"] && <article className="chart-card" style={{ order: sectionOrder.indexOf("cash-flow") + 1 }}>
          <div className="card-title">
            <div>
              <p className="eyebrow">{t("web.growth.dailyCashFlow")}</p>
              <h2>{t("web.growth.incomeAndSpending")}</h2>
            </div>
          </div>
          <div className="flow-list">
            {entries.slice(-10).map((entry) => (
              <div className="flow-row" key={entry.dateKey}>
                <span>
                  {entry.seasonLabel.slice(0, 3)} {entry.day}
                </span>
                <div className="flow-bars">
                  <i
                    className="income-bar"
                    style={{ width: `${(entry.income / maxFlow) * 100}%` }}
                  />
                  <i
                    className="spending-bar"
                    style={{ width: `${(entry.spending / maxFlow) * 100}%` }}
                  />
                </div>
                <strong>
                  {entry.income.toLocaleString(locale)} /{" "}
                  {entry.spending.toLocaleString(locale)}g
                </strong>
              </div>
            ))}
          </div>
          <p className="chart-note">{t("web.growth.greenIncomeOrangeSpendingInferredFromIncomeAndThe")}</p>
        </article>}
        {visibleSections.activity && <article className="chart-card" style={{ order: sectionOrder.indexOf("activity") + 1 }}>
          <div className="card-title">
            <div>
              <p className="eyebrow">{t("nav.progress")}</p>
              <h2>{t("web.growth.skillsAndActivity")}</h2>
            </div>
          </div>
          <div className="skills">
            <Skill label={t("skill.farming")} value={current.progress.farming} />
            <Skill label={t("skill.mining")} value={current.progress.mining} />
            <Skill label={t("skill.foraging")} value={current.progress.foraging} />
            <Skill label={t("skill.fishing")} value={current.progress.fishing} />
            <Skill label={t("skill.combat")} value={current.progress.combat} />
          </div>
          <div className="activity-grid">
            <span>
              <b>{current.progress.itemsShipped}</b>{t("web.growth.itemsShipped")}</span>
            <span>
              <b>{current.progress.cropsShipped}</b>{t("web.growth.cropsShipped")}</span>
            <span>
              <b>{current.progress.fishCaught}</b>{t("fishing.fish")}</span>
            <span>
              <b>{current.progress.monstersKilled}</b>{t("web.growth.monsters")}</span>
          </div>
        </article>}
        {visibleSections.snapshots && <article className="chart-card wide" style={{ order: sectionOrder.indexOf("snapshots") + 1 }}>
          <div className="card-title">
            <div>
              <p className="eyebrow">{t("web.growth.snapshots")}</p>
              <h2>{t("web.growth.dailySummary")}</h2>
            </div>
          </div>
          <div className="history-table">
            <div className="history-row head">
              <span>{t("web.growth.day")}</span>
              <span>{t("web.growth.balance")}</span>
              <span>{t("web.growth.income")}</span>
              <span>{t("web.growth.inferredSpending")}</span>
              <span>{t("planning.buildings")}</span>
              <span>{t("planning.crops")}</span>
              <span>{t("web.growth.mine")}</span>
            </div>
            {[...entries].reverse().map((entry) => (
              <div className="history-row" key={entry.dateKey}>
                <strong>{formatGameDate(entry, t)}</strong>
                <span>{entry.money.toLocaleString("en-US")}g</span>
                <span className="positive">
                  +{entry.income.toLocaleString("en-US")}g
                </span>
                <span className="negative">
                  −{entry.spending.toLocaleString("en-US")}g
                </span>
                <span>{entry.buildings}</span>
                <span>{entry.crops}</span>
                <span>{entry.progress.deepestMineLevel}</span>
              </div>
            ))}
          </div>
        </article>}
      </div>
      <p className="history-help">{t("web.growth.historyStartsWithTheSavesStardewStillRetainsAnd")}</p>
    </section>
  );
}

function AchievementsView({
  current,
  live,
}: {
  current: Snapshot;
  live: LiveState;
}) {
  const { t } = useI18n();
  const customAchievementIds = new Set([
    "the-bottom", "singular-talent", "five-ways", "local-legend", "joja",
    "full-house", "stardrops", "protector", "prairie-king", "fector",
  ]);
  const achievementName = (item: Achievement) =>
    customAchievementIds.has(item.id) ? t(`achievement.${item.id}.name`) : item.name;
  const achievementRequirement = (item: Achievement) =>
    customAchievementIds.has(item.id) ? t(`achievement.${item.id}.requirement`) : item.requirement;
  const achievementCategory = (category: string) =>
    t(`achievement.category.${category.toLowerCase()}`);
  const achievementUnit = (unit: string) =>
    unit ? t(`achievement.unit.${unit.replace(/\s+/g, "-").toLowerCase()}`) : "";
  const achievementTiming = (timing?: string | null) => {
    if (!timing) return "";
    if (timing === "Exclusive route") return t("achievement.timing.exclusive");
    const match = /^(Summer|Fall) (\d+) · annual$/.exec(timing);
    return match
      ? t("achievement.timing.annual", { season: t(`season.${match[1].toLowerCase()}`), day: match[2] })
      : timing;
  };
  const gameDisplayName = (name: string, id?: string) => {
    return resolveGameDisplayName(
      current.localizedNamesByQualifiedId || {},
      current.localizedObjectNamesByEnglish || {},
      name,
      id,
    );
  };
  const achievementSectionOptions = [
    { id: "overview", label: t("achievement.section.overview") },
    { id: "collections", label: t("achievement.section.collections") },
    { id: "museum", label: t("achievement.section.museum") },
    { id: "achievements", label: t("achievement.section.cards") },
  ] as const;
  const [visibleSections, setSectionVisible, showAllSections, sectionOrder, moveSection] =
    useSectionVisibility(
      "stardew-tool-visible-sections-achievements-v1",
      achievementSectionOptions.map((option) => option.id),
    );
  const [filter, setFilter] = useState<"pending" | "all" | "done" | "timed">(
    "pending",
  );
  const [collectionFilter, setCollectionFilter] = useState<
    "all" | "missing" | "complete" | "available"
  >("all");
  const [openCollectionId, setOpenCollectionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [focusedAchievementId, setFocusedAchievementId] = useState<string | null>(null);
  useEffect(() => {
    if (!openCollectionId) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenCollectionId(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [openCollectionId]);
  const focusAchievement = useCallback((id: string) => {
    setFilter("all");
    setQuery("");
    setFocusedAchievementId(id);
  }, []);
  useEffect(() => {
    const focus = (event: Event) =>
      focusAchievement((event as CustomEvent<{ id: string }>).detail.id);
    window.addEventListener("stardew:focus-achievement", focus);
    return () => window.removeEventListener("stardew:focus-achievement", focus);
  }, [focusAchievement]);
  useEffect(() => {
    if (!focusedAchievementId) return;
    const frame = window.requestAnimationFrame(() =>
      document.getElementById(`achievement-${focusedAchievementId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      }),
    );
    const timer = window.setTimeout(() => setFocusedAchievementId(null), 2400);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusedAchievementId, filter, query]);
  const museumCount =
    live.active && live.collections
      ? live.collections.museumItems.length
      : null;
  const donatedMuseum = new Set(
    live.active && live.collections
      ? live.collections.museumItems
      : current.museumBrief.donated,
  );
  const artifactDonated = current.museumBrief.artifactIds.filter((id) =>
    donatedMuseum.has(id),
  ).length;
  const mineralDonated = current.museumBrief.mineralIds.filter((id) =>
    donatedMuseum.has(id),
  ).length;
  const achievementItems = current.achievements.items.map((item) =>
    item.id === "treasure-trove" && museumCount !== null
      ? { ...item, current: museumCount, done: museumCount >= 40 }
      : item.id === "complete-collection" && museumCount !== null
        ? { ...item, current: museumCount, done: museumCount >= 95 }
        : item,
  );
  const achievements = {
    ...current.achievements,
    items: achievementItems,
    completed: achievementItems.filter((item) => item.done).length,
  };
  const achievementById = new Map(
    achievements.items.map((item) => [item.id, item]),
  );
  const caughtFish = new Set(
    live.active && live.collections
      ? live.collections.caughtFish
      : current.fishingBrief.fish
          .filter((fish) => fish.caught)
          .map((fish) => fish.id),
  );
  const fishAvailableNow = current.fishingBrief.fish.filter(
    (fish) =>
      !caughtFish.has(fish.id) &&
      fish.seasons.includes(current.season) &&
      fish.accessibleLocations.length > 0 &&
      (fish.weather === "both" ||
        fish.weather === current.fishingBrief.weather),
  ).length;
  const liveBundles = new Map(
    ((live.active ? live.collections?.bundleProgress : []) || []).map(
      (bundle) => [String(bundle.id), bundle.donated],
    ),
  );
  const bundleProgress = current.planningBrief.communityCenter.rooms.flatMap(
    (room) => room.bundles,
  );
  const completedBundles = bundleProgress.filter((bundle) => {
    const donated = liveBundles.get(bundle.id);
    return donated
      ? donated.filter(Boolean).length >= bundle.required
      : bundle.complete;
  }).length;
  const readyBundleItems = current.planningBrief.communityCenter.readyItems;
  const availableMuseumItems = new Set(
    current.museumBrief.sources
      .filter((source) => source.available)
      .flatMap((source) => source.itemIds)
      .filter((id) => !donatedMuseum.has(id)),
  ).size;
  const collectionCards = [
    {
      id: "achievements",
      label: t("collection.achievements.label"),
      current: achievements.completed,
      total: achievements.total,
      available: achievements.items.filter((item) => !item.done && item.nextStep).length,
      detail: t("collection.achievements.detail"),
    },
    {
      id: "museum",
      label: t("collection.museum.label"),
      current: donatedMuseum.size,
      total: 95,
      available: availableMuseumItems,
      detail: t("collection.museum.detail"),
    },
    {
      id: "fish",
      label: t("collection.fish.label"),
      current: caughtFish.size,
      total: current.fishingBrief.fish.length,
      available: fishAvailableNow,
      detail: t("collection.fish.detail"),
    },
    {
      id: "bundles",
      label: t("collection.bundles.label"),
      current: completedBundles,
      total: bundleProgress.length,
      available: readyBundleItems,
      detail: t("collection.bundles.detail"),
    },
    {
      id: "shipping",
      label: t("collection.shipping.label"),
      current: achievementById.get("full-shipment")?.current || 0,
      total: achievementById.get("full-shipment")?.target || null,
      available: 0,
      detail: t("collection.shipping.detail"),
    },
    {
      id: "cooking",
      label: t("collection.cooking.label"),
      current: achievementById.get("gourmet")?.current || 0,
      total: achievementById.get("gourmet")?.target || null,
      available: 0,
      detail: t("collection.cooking.detail"),
    },
    {
      id: "crafting",
      label: t("collection.crafting.label"),
      current: achievementById.get("craft-master")?.current || 0,
      total: achievementById.get("craft-master")?.target || null,
      available: 0,
      detail: t("collection.crafting.detail"),
    },
    {
      id: "stardrops",
      label: t("collection.stardrops.label"),
      current: achievementById.get("stardrops")?.current || 0,
      total: 7,
      available: 0,
      detail: t("collection.stardrops.detail"),
    },
  ];
  type CollectionChecklistEntry = {
    key: string;
    name: string;
    detail: string;
    item?: ItemArtwork;
  };
  const museumNames = new Map(
    current.museumBrief.sources.flatMap((source) => source.items || []).map((item) => [item.id, item.displayName || gameDisplayName(item.name, item.id)]),
  );
  const missingMuseum: CollectionChecklistEntry[] = [
    ...current.museumBrief.artifactIds,
    ...current.museumBrief.mineralIds,
  ]
    .filter((id) => !donatedMuseum.has(id))
    .map((id) => ({
      key: `museum-${id}`,
      name: museumNames.get(id) || t("collection.museum.item", { id }),
      detail: t("collection.museum.notDonated"),
      item: { id, name: museumNames.get(id) || `Museum item ${id}`, spriteKind: "object", spriteIndex: id },
    }));
  const missingFish: CollectionChecklistEntry[] = current.fishingBrief.fish
    .filter((fish) => !caughtFish.has(fish.id))
    .map((fish) => ({
      key: `fish-${fish.id}`,
      name: fish.displayName || gameDisplayName(fish.name, fish.id),
      detail: `${fish.seasons.join(" / ")} · ${fish.locations.join(" / ")}`,
      item: { id: fish.id, name: fish.name, spriteKind: "object", spriteIndex: fish.id },
    }));
  const missingBundles: CollectionChecklistEntry[] = bundleProgress.flatMap((bundle) => {
    const liveDonated = liveBundles.get(bundle.id);
    if ((liveDonated ? liveDonated.filter(Boolean).length >= bundle.required : bundle.complete)) return [];
    return bundle.requirements.flatMap((requirement, index) => {
      const donated = liveDonated?.[index] ?? requirement.donated;
      if (donated) return [];
      const item = requirement.id === "-1"
        ? undefined
        : {
            id: requirement.id,
            name: requirement.name,
            spriteKind: "object" as const,
            spriteIndex: requirement.id,
          };
      return [{
        key: `bundle-${bundle.id}-${requirement.id}-${index}`,
        name: requirement.displayName || gameDisplayName(requirement.name, requirement.id),
        detail: t(requirement.quality ? "community.storedQuality" : "community.stored", {
          owned: requirement.owned,
          count: requirement.count,
          quality: t(`quality.${requirement.quality >= 4 ? "iridium" : requirement.quality === 2 ? "gold" : "silver"}`),
        }),
        item,
      }];
    });
  });
  const recipeEntries = (items: CollectionRecipeItem[] | undefined, kind: "cooking" | "crafting") =>
    (items || [])
      .filter((item) => !item.complete)
      .map((item) => ({
        key: `${kind}-${item.name}`,
        name: item.displayName || gameDisplayName(item.name, item.id),
        detail: item.learned
          ? t(kind === "cooking" ? "collection.recipe.notCooked" : "collection.recipe.notCrafted")
          : t("collection.recipe.notLearned"),
        item,
      }));
  const shippingCatalog = live.active && live.collections?.shipping?.length
    ? live.collections.shipping
    : current.collectionBrief?.shipping;
  const missingShipping = (shippingCatalog || [])
    .filter((item) => !item.complete)
    .map((item) => ({
      key: `shipping-${item.id}`,
      name: item.displayName || gameDisplayName(item.name, item.id),
      detail: t("collection.shipping.notShipped"),
      item,
    }));
  const stardropSources = Array.from({ length: 7 }, (_, index) => t(`collection.stardrops.source${index + 1}`));
  const collectionChecklists: Record<string, { items: CollectionChecklistEntry[]; note: string }> = {
    achievements: {
      items: achievements.items.filter((item) => !item.done).map((item) => ({
        key: `achievement-${item.id}`,
        name: achievementName(item),
        detail: achievementRequirement(item),
      })),
      note: t("collection.achievements.note"),
    },
    museum: { items: missingMuseum, note: t("collection.museum.note") },
    fish: { items: missingFish, note: t("collection.fish.note") },
    bundles: { items: missingBundles, note: t("collection.bundles.note") },
    shipping: {
      items: missingShipping,
      note: shippingCatalog?.length
        ? t("collection.shipping.note")
        : t("collection.shipping.unavailable", { count: Math.max(0, (achievementById.get("full-shipment")?.target || 154) - (achievementById.get("full-shipment")?.current || 0)) }),
    },
    cooking: {
      items: recipeEntries(current.collectionBrief?.cooking, "cooking"),
      note: current.collectionBrief?.cooking
        ? t("collection.cooking.note")
        : t("collection.cooking.unavailable"),
    },
    crafting: {
      items: recipeEntries(current.collectionBrief?.crafting, "crafting"),
      note: current.collectionBrief?.crafting
        ? t("collection.crafting.note")
        : t("collection.crafting.unavailable"),
    },
    stardrops: {
      items: stardropSources.map((name, index) => ({
        key: `stardrop-${index}`,
        name,
        detail: t("collection.stardrops.sourceDetail"),
      })),
      note: t("collection.stardrops.note", { count: Math.max(0, 7 - (achievementById.get("stardrops")?.current || 0)) }),
    },
  };
  const openCollection = collectionCards.find((card) => card.id === openCollectionId);
  const openChecklist = openCollectionId ? collectionChecklists[openCollectionId] : null;
  const visibleCollectionCards = collectionCards.filter((card) => {
    const complete = card.total !== null && card.current >= card.total;
    return (
      collectionFilter === "all" ||
      (collectionFilter === "missing" && !complete) ||
      (collectionFilter === "complete" && complete) ||
      (collectionFilter === "available" && card.available > 0)
    );
  });
  const completion = Math.round(
    (achievements.completed / achievements.total) * 100,
  );
  const annualEventDay = (timing?: string | null) => {
    if (!timing?.includes("annual")) return null;
    const target = timing.startsWith("Summer")
      ? 28 + 11
      : timing.startsWith("Fall")
        ? 56 + 16
        : null;
    if (!target) return null;
    const today = ((current.dayIndex - 1) % 112) + 1;
    return target >= today ? target - today : 112 - today + target;
  };
  const visible = achievements.items.filter((item) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "done" && item.done) ||
      (filter === "pending" && !item.done) ||
      (filter === "timed" && Boolean(item.timing));
    const haystack =
      `${achievementName(item)} ${achievementRequirement(item)} ${achievementCategory(item.category)}`.toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  });
  const nextEvents = achievements.items
    .filter((item) => !item.done && annualEventDay(item.timing) !== null)
    .sort((a, b) => annualEventDay(a.timing)! - annualEventDay(b.timing)!);

  return (
    <section className="achievements-page">
      <div className="achievements-heading">
        <div>
          <p className="eyebrow">
            {live.active ? t("achievements.liveCollections") : t("achievements.currentSave")}{t("web.achievements.steamCatalog")}</p>
          <h1>{t("achievements.title")}</h1>
          <p>{t("achievements.description")}</p>
        </div>
        <div className="page-heading-actions">
          <div className="achievement-total">
            <strong>
              {achievements.completed}/{achievements.total}
            </strong>
            <span>{t("achievements.complete", { percent: completion })}</span>
          </div>
          <SectionVisibilityMenu
            label={t("achievement.customizeSections")}
            options={achievementSectionOptions}
            visible={visibleSections}
            order={sectionOrder}
            onChange={setSectionVisible}
            onShowAll={showAllSections}
            onMove={moveSection}
          />
        </div>
      </div>
      {visibleSections.overview && <div className="achievement-overview" style={{ order: sectionOrder.indexOf("overview") + 1 }}>
        <div className="overall-progress">
          <span>
            <b style={{ width: `${completion}%` }} />
          </span>
          <small>
            {achievements.total - achievements.completed}{t("web.achievements.achievementsRemaining")}</small>
        </div>
        <div className="achievement-note">
          <b>{t("web.achievements.noCalendarMissableAchievements")}</b> {t("achievement.note")}
        </div>
        {nextEvents[0] && (
          <button
            type="button"
            className="next-event"
            onClick={() => focusAchievement(nextEvents[0].id)}
            title={t("web.achievements.openThisAchievement")}
          >
            <span>{t("web.achievements.nextOpportunity")}</span>
            <strong>{achievementName(nextEvents[0])}</strong>
            <small>
              {achievementTiming(nextEvents[0].timing)} · {t("web.achievements.in")} {t("planning.daysCount", { count: annualEventDay(nextEvents[0].timing) || 0 })}</small>
          </button>
        )}
      </div>}
      {visibleSections.collections && <section className="completion-explorer" style={{ order: sectionOrder.indexOf("collections") + 1 }}>
        <div className="completion-explorer-heading">
          <div>
            <p className="eyebrow">{t("web.achievements.completionExplorer")}</p>
            <h2>{t("web.achievements.everyLongTermCollectionInOnePlace")}</h2>
          </div>
          <nav aria-label={t("web.achievements.collectionFilters")}>
            {(
              [
                ["all", t("filter.all")],
                ["missing", t("filter.missing")],
                ["complete", t("filter.complete")],
                ["available", t("filter.available")],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                className={collectionFilter === value ? "active" : ""}
                onClick={() => setCollectionFilter(value)}
                key={value}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="completion-card-grid">
          {visibleCollectionCards.map((card) => {
            const complete = card.total !== null && card.current >= card.total;
            const percentage = card.total
              ? Math.min(100, (card.current / card.total) * 100)
              : null;
            return (
              <button
                type="button"
                className={`completion-card ${complete ? "complete" : ""}`}
                key={card.id}
                onClick={() => setOpenCollectionId(card.id)}
                aria-label={t("collection.openMissing", { collection: card.label })}
              >
                <div>
                  <span>{card.label}</span>
                  <strong>
                    {card.current}
                    {card.total !== null ? `/${card.total}` : t("collection.tracked")}
                  </strong>
                </div>
                {percentage !== null && <i><b style={{ width: `${percentage}%` }} /></i>}
                <p>{card.detail}</p>
                <small>
                  {complete
                    ? t("filter.complete")
                    : card.available > 0
                      ? t("collection.actionable", { count: card.available })
                      : t("collection.inProgress")}
                </small>
                <em>{t("web.achievements.viewMissingItems")}</em>
              </button>
            );
          })}
        </div>
        {!visibleCollectionCards.length && (
          <p className="empty-daily">{t("web.achievements.noCollectionMatchesThisFilter")}</p>
        )}
      </section>}
      {openCollection && openChecklist && (
        <div className="item-locator-backdrop" onPointerDown={() => setOpenCollectionId(null)}>
          <section
            className="item-locator-dialog collection-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("collection.missingFor", { collection: openCollection.label })}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="help-close"
              onClick={() => setOpenCollectionId(null)}
              aria-label={t("web.achievements.closeCollectionDetails")}
            >
              ×
            </button>
            <p className="eyebrow">{t("web.achievements.longTermCollection")}</p>
            <header>
              <div>
                <h2>{openCollection.label}</h2>
                <span>
                  {openCollection.current}
                  {openCollection.total !== null ? `/${openCollection.total}` : t("collection.tracked")}
                </span>
              </div>
            </header>
            <p className="collection-detail-note">{openChecklist.note}</p>
            {openChecklist.items.length ? (
              <div className="collection-checklist">
                {openChecklist.items.map((entry) => (
                  <article key={entry.key}>
                    {entry.item ? (
                      <ItemMentionArtwork
                        id={entry.item.id}
                        name={entry.item.name}
                        item={entry.item}
                        locatable={false}
                      />
                    ) : (
                      <i aria-hidden="true">○</i>
                    )}
                    <div>
                      <strong>{entry.name}</strong>
                      <small>{entry.detail}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : openCollection.total !== null && openCollection.current >= openCollection.total ? (
              <p className="empty-daily">{t("web.achievements.thisCollectionIsComplete")}</p>
            ) : (
              <p className="empty-daily">{t("web.achievements.theExactMissingEntriesAreNotAvailableFromThis")}</p>
            )}
          </section>
        </div>
      )}
      {visibleSections.museum && <section className="museum-guide" aria-labelledby="museum-guide-title" style={{ order: sectionOrder.indexOf("museum") + 1 }}>
        <div className="museum-guide-heading">
          <div>
            <p className="eyebrow">{t("web.achievements.progressiveGuidance")}</p>
            <h2 id="museum-guide-title">{t("web.achievements.spoilerFreeMuseum")}</h2>
            <p>{t("museum.note")}</p>
          </div>
          <div className="museum-totals">
            <span>
              <b>{artifactDonated}/42</b>{t("web.achievements.artifacts")}</span>
            <span>
              <b>{mineralDonated}/53</b>{t("web.achievements.minerals")}</span>
          </div>
        </div>
        <div className="museum-source-grid">
          {current.museumBrief.sources.map((source) => {
            const remaining = source.itemIds.filter(
              (id) => !donatedMuseum.has(id),
            ).length;
            const exhausted = remaining === 0;
            return (
              <article
                className={`museum-source ${exhausted ? "exhausted" : ""} ${!source.available ? "locked" : ""}`}
                key={source.id}
              >
                <div>
                  <i>{exhausted ? "✓" : source.available ? "·" : "○"}</i>
                  <h3>{t(`museum.source.${source.id}.label`)}</h3>
                </div>
                <strong>
                  {exhausted ? t("museum.nothingNew") : t("museum.possible", { count: remaining })}
                </strong>
                <p>
                  {exhausted
                    ? t("museum.exhausted")
                    : source.available
                      ? t(`museum.source.${source.id}.hint`)
                      : t(`museum.source.${source.id}.unavailable`)}
                </p>
                {!exhausted && source.items && (
                  <details className="museum-spoilers">
                    <summary>{t("web.achievements.revealMissingPiecesSpoilers")}</summary>
                    <div>
                      {source.items
                        .filter((item) => !donatedMuseum.has(item.id))
                        .map((item) => (
                          <span key={item.id}>
                            <SheetArtwork id={item.id} kind="object" label={item.displayName || item.name} />
                            <b>{item.displayName || item.name}</b>
                          </span>
                        ))}
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </div>
        <p className="museum-live-note">
          <b>{live.active ? t("status.liveColon") : t("status.latestSaveColon")}</b> {t("web.achievements.afterDonatingAPieceItImmediatelyDisappearsFromEvery")}</p>
      </section>}
      {visibleSections.achievements && <div className="achievement-list-section" style={{ order: sectionOrder.indexOf("achievements") + 1 }}>
      <div className="achievement-controls">
        <div className="filter-buttons">
          {(
            [
              ["pending", t("filter.pending")],
              ["all", t("filter.all")],
              ["done", t("filter.completed")],
              ["timed", t("filter.timed")],
            ] as const
          ).map(([value, label]) => (
            <button
              className={filter === value ? "active" : ""}
              key={value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("web.achievements.searchAchievementsOrCategories")}
          aria-label={t("web.achievements.searchAchievements")}
        />
      </div>
      <div className="achievement-grid">
        {visible.map((item) => {
          const hasProgress =
            item.current !== null && item.current !== undefined;
          const hasTarget = item.target !== null && item.target !== undefined;
          const ratio = item.done
            ? 100
            : hasProgress && hasTarget
              ? Math.min(100, (item.current! / item.target!) * 100)
              : 0;
          const remaining =
            hasProgress && hasTarget
              ? Math.max(0, item.target! - item.current!)
              : null;
          const days = annualEventDay(item.timing);
          return (
            <article
              id={`achievement-${item.id}`}
              className={`achievement-card ${item.done ? "done" : ""} ${focusedAchievementId === item.id ? "focused" : ""}`}
              key={item.id}
            >
              <div className="achievement-card-head">
                <i>{item.done ? "✓" : "○"}</i>
                <div>
                  <span>{achievementCategory(item.category)}</span>
                  <h2>{achievementName(item)}</h2>
                </div>
                {item.timing && <em>{achievementTiming(item.timing)}</em>}
              </div>
              <p>{achievementRequirement(item)}</p>
              {hasProgress && (
                <div className="item-progress">
                  <div>
                    <span>
                      {item.current!.toLocaleString()}
                      {hasTarget
                        ? ` / ${item.target!.toLocaleString()}`
                        : ""}{" "}
                      {achievementUnit(item.unit)}
                    </span>
                    {remaining !== null && !item.done && (
                      <small>
                        {remaining.toLocaleString()} {t("web.achievements.remaining")}</small>
                    )}
                  </div>
                  <i>
                    <b style={{ width: `${ratio}%` }} />
                  </i>
                </div>
              )}
              {days !== null && !item.done && (
                <div className="timing-alert">{t("web.achievements.nextOpportunityIn")}<b>{days}{t("web.planning.days")}</b>.
                </div>
              )}
              {item.nextStep && (
                <div className="achievement-guide">
                  <b>{t("web.achievements.howToCompleteIt")}</b>
                  <span>{t(`achievement.${item.id}.nextStep`)}</span>
                </div>
              )}
              {!hasProgress && !item.nextStep && !item.done && (
                <small className="next-step">{t("web.achievements.itWillBeMarkedAutomaticallyWhenTheSaveRecords")}</small>
              )}
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <p className="empty-achievements">{t("web.achievements.noAchievementsMatchThisFilter")}</p>
      )}
      <p className="history-help">{t("web.achievements.standardAchievementsAreReadDirectlyFromTheSaveSteam")}</p>
      </div>}
    </section>
  );
}

function EconomyChart({ entries }: { entries: HistoryEntry[] }) {
  const { t } = useI18n();
  const ref = useRef<HTMLCanvasElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const width = 920;
  const height = 270;
  const pad = { left: 58, right: 20, top: 18, bottom: 34 };
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !entries.length) return;
    const draw = () => {
    const chartWidth = Math.max(320, canvas.clientWidth || width);
    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const backingWidth = Math.round(chartWidth * pixelRatio);
    const backingHeight = Math.round(height * pixelRatio);
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, chartWidth, height);
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.fillStyle = "#817560";
    const maximum = Math.max(
      1,
      ...entries.flatMap((entry) => [entry.money, entry.totalMoneyEarned]),
    );
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + ((height - pad.top - pad.bottom) * i) / 4;
      ctx.strokeStyle = "#dfd4c2";
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(chartWidth - pad.right, y);
      ctx.stroke();
      ctx.fillText(
        `${Math.round((maximum * (4 - i)) / 4 / 1000)}k`,
        pad.left - 8,
        y + 4,
      );
    }
    const paint = (key: "money" | "totalMoneyEarned", color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      entries.forEach((entry, index) => {
        const x =
          pad.left +
          (chartWidth - pad.left - pad.right) *
            (entries.length === 1 ? 0.5 : index / (entries.length - 1));
        const y =
          pad.top +
          (height - pad.top - pad.bottom) * (1 - entry[key] / maximum);
        if (!index) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        ctx.fillStyle = color;
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      });
      ctx.stroke();
    };
    paint("totalMoneyEarned", "#d39a35");
    paint("money", "#557b4d");
    ctx.textAlign = "center";
    ctx.fillStyle = "#817560";
    const labels =
      entries.length > 7
        ? entries.filter(
            (_, i) =>
              i % Math.ceil(entries.length / 7) === 0 ||
              i === entries.length - 1,
          )
        : entries;
    labels.forEach((entry) => {
      const index = entries.indexOf(entry);
      const x =
        pad.left +
        (chartWidth - pad.left - pad.right) *
          (entries.length === 1 ? 0.5 : index / (entries.length - 1));
      ctx.fillText(
        `${entry.seasonLabel.slice(0, 3)} ${entry.day}`,
        x,
        height - 10,
      );
    });
    if (hoverIndex !== null && entries[hoverIndex]) {
      const entry = entries[hoverIndex];
      const x =
        pad.left +
        (chartWidth - pad.left - pad.right) *
          (entries.length === 1 ? 0.5 : hoverIndex / (entries.length - 1));
      ctx.strokeStyle = "#5d5140";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, height - pad.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ([
        [entry.totalMoneyEarned, "#d39a35"],
        [entry.money, "#557b4d"],
      ] as const).forEach(([value, color]) => {
        const y = pad.top + (height - pad.top - pad.bottom) * (1 - value / maximum);
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#fff9ed";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.stroke();
      });
    }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [entries, hoverIndex, pad.bottom, pad.left, pad.right, pad.top]);
  const selectNearest = (clientX: number) => {
    const canvas = ref.current;
    if (!canvas || !entries.length) return;
    const bounds = canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    const ratio = Math.max(0, Math.min(1, (x - pad.left) / (bounds.width - pad.left - pad.right)));
    setHoverIndex(entries.length === 1 ? 0 : Math.round(ratio * (entries.length - 1)));
  };
  const hovered = hoverIndex === null ? null : entries[hoverIndex];
  const hoverLeft = hoverIndex === null
    ? 0
    : 5 + 90 * (entries.length === 1 ? 0.5 : hoverIndex / (entries.length - 1));
  return (
    <div className="economy-chart-wrap">
      <canvas
        className="economy-chart"
        ref={ref}
        width={width}
        height={height}
        tabIndex={0}
        aria-label={t("web.economyChart.balanceAndTotalEarningsHistoryMoveThePointerOr")}
        onMouseMove={(event) => selectNearest(event.clientX)}
        onMouseLeave={() => setHoverIndex(null)}
        onFocus={() => setHoverIndex((index) => index ?? Math.max(0, entries.length - 1))}
        onBlur={() => setHoverIndex(null)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          setHoverIndex((index) => {
            const current = index ?? entries.length - 1;
            return Math.max(0, Math.min(entries.length - 1, current + (event.key === "ArrowLeft" ? -1 : 1)));
          });
        }}
      />
      {hovered && (
        <div
          className={`economy-chart-tooltip ${hoverLeft > 72 ? "align-right" : ""}`}
          style={{ left: `${hoverLeft}%` }}
          role="status"
        >
          <strong>{formatGameDate(hovered, t)}</strong>
          <span><i className="balance-key" />{t("web.growth.balance")}<b>{hovered.money.toLocaleString("en-US")}g</b></span>
          <span><i className="earned-key" />{t("web.economyChart.totalEarnings")}<b>{hovered.totalMoneyEarned.toLocaleString("en-US")}g</b></span>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number;
}) {
  const { t } = useI18n();
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {delta !== undefined && (
        <small className={delta >= 0 ? "positive" : "negative"}>
          {delta >= 0 ? "+" : "−"}
          {Math.abs(delta).toLocaleString("en-US")}{t("web.metric.gSinceYesterday")}</small>
      )}
    </div>
  );
}
function Skill({ label, value }: { label: string; value: number }) {
  return (
    <div className="skill-row">
      <span>{label}</span>
      <i>
        <b style={{ width: `${value * 10}%` }} />
      </i>
      <strong>{value}</strong>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  color,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  color: string;
}) {
  return (
    <label className="toggle-row">
      <span className="swatch" style={{ background: color }} />
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i />
    </label>
  );
}
