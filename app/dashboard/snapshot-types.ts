import type { ProductionCatalog } from "../planning/production-types";
import type { ModCompatibilitySummary } from "../compatibility";
import type { MessageDescriptor } from "../i18n";

export type Tile = { x: number; y: number };

export type Terrain = Tile & {
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

export type FarmObject = Tile & {
  name: string;
  displayName?: string;
  kind: string;
  id: string;
  big: boolean;
  ready?: boolean;
  processing?: boolean;
  output?: string | null;
  outputId?: string | null;
  outputVariant?: string | null;
  input?: string | null;
  inputId?: string | null;
  inputVariant?: string | null;
  minutesUntilReady?: number;
  readyInDays?: number;
  color?: string | null;
};

export type Building = Tile & {
  width: number;
  height: number;
  name: string;
  daysOfConstructionLeft?: number;
  daysUntilUpgrade?: number;
};

export type Interior = {
  id: string;
  name: string;
  label: string;
  width: number;
  height: number;
  background?: string;
  foreground?: string;
  objects: FarmObject[];
  furniture: (Tile & {
    name: string;
    sourceX?: number;
    sourceY?: number;
    sourceWidth?: number;
    sourceHeight?: number;
    footprintHeight?: number;
  })[];
};

export type Suggestion = Building & { id: string; kind: string; color: string };

export type Snapshot = {
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
  professionIds?: number[];
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
    { background: string; foreground?: string; width: number; height: number }
  >;
  suggestions: Suggestion[];
  productionCatalog?: ProductionCatalog;
  modCompatibility?: ModCompatibilitySummary;
};

export type LocalizedValue = string | MessageDescriptor;

export type Progress = {
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

export type GrandpaMilestone = {
  id: string;
  label: string;
  points: number;
  done: boolean;
  how: string;
};

export type GrandpaProgress = {
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

export type Achievement = {
  id: string;
  gameId?: number | null;
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

export type AchievementTracking = {
  total: number;
  completed: number;
  items: Achievement[];
  note: string;
};

export type MuseumSource = {
  id: string;
  label: string;
  itemIds: string[];
  items?: { id: string; name: string; displayName?: string }[];
  available: boolean;
  hint: string;
  unavailableHint?: string | null;
};

export type MuseumBrief = {
  donated: string[];
  artifactIds: string[];
  mineralIds: string[];
  sources: MuseumSource[];
  note: string;
};

export type GiftItem = {
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

export type CollectionRecipeItem = ItemArtwork & {
  complete: boolean;
  count: number;
  learned: boolean;
};

export type LongTermCollectionBrief = {
  shipping?: CollectionRecipeItem[];
  cooking: CollectionRecipeItem[];
  crafting: CollectionRecipeItem[];
};

export type BirthdayBrief = {
  id?: string;
  person: string;
  when: string;
  gifts: { love: GiftItem[]; like: GiftItem[]; neutral: GiftItem[] };
};

export type CropForecast = {
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

export type DailyQuest = {
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

export type DailyBrief = {
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
  routeContext?: {
    weekday: string;
    festival?: string | null;
    access: Record<string, boolean>;
    transport: Record<"minecarts" | "bus" | "boat" | "horse", boolean>;
    services: {
      blacksmithOpenToday: boolean;
      blacksmithOpensAt: number;
      blacksmithClosesAt: number;
    };
  };
  inventoryItemsChecked: number;
  summary: LocalizedValue;
};

export type FishingFish = {
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
  modded?: boolean;
  verified?: boolean;
  uncertainLocations?: string[];
  spriteIndex?: number;
  artworkUrl?: string;
  artworkColumns?: number;
};

export type FishingBrief = {
  season: string;
  day: number;
  weather: "sunny" | "rainy";
  caughtCount: number;
  fish: FishingFish[];
  note: string;
};

export type BundleRequirement = {
  id: string;
  name: string;
  displayName?: string;
  count: number;
  quality: number;
  donated: boolean;
  owned: number;
  ready: boolean;
};

export type BundlePlan = {
  id: string;
  name: string;
  required: number;
  donated: number;
  ready: number;
  complete: boolean;
  requirements: BundleRequirement[];
};

export type CommunityRoom = {
  id: string;
  name: string;
  completed: number;
  total: number;
  reward?: { name: string; description: string };
  bundles: BundlePlan[];
};

export type BuildingPlan = {
  id?: string;
  modded?: boolean;
  verified?: boolean;
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
  materials: { id?: string; name: string; displayName?: string; owned: number; needed: number }[];
};

export type CropPlan = {
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

export type FriendshipPlan = {
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

export type PetPlan = { name: string; type: string; points: number };

export type MachineOutput = { id?: string; variant?: string; name: string; displayName?: string; count: number };

export type MachinePlan = {
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

export type PlanningBrief = {
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
  fishPonds?: Array<{ id: string; fishId: string; population: number; capacity: number }>;
  inventory: StorageInventoryItem[];
};

export type SpecialOrderBrief = {
  id: string;
  title: string;
  description: string;
  requester: string;
  daysLeft: number;
  duration: string;
  reward: string;
  objectives: { description: string; progress: number; target: number }[];
};

export type LiveInventoryItem = {
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

export type ItemArtwork = Pick<
  LiveInventoryItem,
  "id" | "name" | "spriteKind" | "spriteIndex" | "spriteWidth" | "spriteHeight"
> & { displayName?: string };

export type StorageSourceDetail = {
  source: string;
  kind: "backpack" | "chest";
  name?: string;
  itemId?: string;
  color?: string | null;
  location?: string;
  x?: number | null;
  y?: number | null;
};

export type StorageInventoryItem = LiveInventoryItem & {
  sources: string[];
  sourceCounts?: { source: string; count: number; quality?: number }[];
  sourceDetails?: StorageSourceDetail[];
};

export type LiveStorageItem = LiveInventoryItem & {
  source?: string;
  containerKind?: "chest";
  containerName?: string;
  containerItemId?: string;
  containerColor?: string | null;
  containerLocation?: string;
  containerX?: number;
  containerY?: number;
};

export type LiveMachine = {
  id?: string;
  name: string;
  location: string;
  ready: boolean;
  processing: boolean;
  output?: string | null;
  outputId?: string | null;
  outputVariant?: string | null;
  input?: string | null;
  inputId?: string | null;
  inputVariant?: string | null;
  minutesUntilReady?: number;
};

export type LiveFriendship = {
  id?: string;
  name: string;
  points: number;
  hearts: number;
  talkedToday: boolean;
  giftsToday: number;
  giftsThisWeek: number;
};

export type LiveRouteState = {
  worldTasks: { location: string; items: { name: string; displayName?: string; count: number }[] }[];
  readyCrops: number;
  readyMachines: number;
  toolPickupReady: boolean;
};

export type LiveCollections = {
  caughtFish: string[];
  bundleProgress: { id: number; donated: boolean[] }[];
  museumItems: string[];
  shipping?: CollectionRecipeItem[];
};

export type LiveTerrainState = Tile & {
  kind: string;
  hasCrop: boolean;
  watered: boolean;
  ready: boolean;
};

export type LiveFarmMap = {
  terrain: LiveTerrainState[];
  objects: FarmObject[];
  buildings: Building[];
};

export type LiveQuest = {
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

export type LiveState = {
  active: boolean;
  profileId?: string;
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
  bridgeWarnings?: string[];
};

export type FarmAnimal = {
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

export type ItemSpriteKind =
  | "object"
  | "object2"
  | "craftable"
  | "furniture"
  | "weapon"
  | "tool"
  | "hat"
  | "shirt"
  | "fallback";
