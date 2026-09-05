import { type Translate, type UpdateState, type DisplayNamedGameValue } from "./ui-types";
import { type BundleRequirement, type DailyQuest, type LiveQuest, type LocalizedValue, type Terrain, type Interior, type BuildingPlan, type CropPlan } from "./snapshot-types";

export const seasonName = (season: string) =>
  ({ spring: "Spring", summer: "Summer", fall: "Fall", winter: "Winter" })[
    season
  ] || season;

export const formatGameDate = (
  date: { year: number; season: string; day: number },
  t: (key: string, variables?: Record<string, string | number>) => string,
) => t("date.game", { year: date.year, season: t(`season.${date.season}`), day: date.day });

export const formatHarvestDate = (value: string, t: Translate) => {
  if (value === "Today") return t("crops.today");
  const match = /^(?:Year (\d+), )?(Spring|Summer|Fall|Winter) (\d+)$/.exec(value);
  if (!match) return value;
  const season = t(`season.${match[2].toLowerCase()}`);
  return match[1]
    ? t("date.game", { year: match[1], season, day: match[3] })
    : t("date.seasonDay", { season, day: match[3] });
};

export function localizedUpdateMessage(state: UpdateState, t: Translate) {
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

export function formatMachineDuration(minutes?: number | null) {
  if (!minutes) return null;
  if (minutes >= 1440) return `${Math.ceil(minutes / 1440)} in-game days`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours
    ? `${hours}h${remainder ? ` ${remainder}m` : ""}`
    : `${remainder}m`;
}

export function formatBundleRequirement(
  item: Pick<BundleRequirement, "id" | "count" | "name" | "displayName">,
  t: Translate,
  locale: string,
) {
  return item.id === "-1"
    ? t("community.payment", { count: item.count.toLocaleString(locale) })
    : `${item.count}× ${item.displayName || item.name}`;
}

export function localizedQuestTitle(
  quest: DailyQuest | LiveQuest,
  t: Translate,
  text: (value: LocalizedValue | null | undefined) => string,
) {
  if (quest.daily && quest.requester)
    return t(`quest.dailyTitle.${quest.type || "Quest"}`, { requester: quest.requester });
  return text(quest.title);
}

export function formatLiveTime(value = 600) {
  const hour = Math.floor(value / 100);
  const minute = value % 100;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function fishTime(value: number) {
  const normalized = value >= 2400 ? value - 2400 : value;
  return `${String(Math.floor(normalized / 100)).padStart(2, "0")}:00${value >= 2400 ? " (+1)" : ""}`;
}

export const communityRoomKeys: Record<string, string> = {
  Pantry: "pantry",
  "Crafts Room": "craftsRoom",
  "Fish Tank": "fishTank",
  "Boiler Room": "boilerRoom",
  Vault: "vault",
  "Bulletin Board": "bulletinBoard",
  "Abandoned Joja Mart": "abandonedJojaMart",
};

export function routeLocationName(location: string, t: Translate) {
  const key = location.replace(/\s+/g, "").toLowerCase();
  const known = new Set([
    "farm", "farmcave", "beach", "town", "mountain", "railroad",
    "backwoods", "cindersapforest", "secretwoods", "desert", "busstop",
  ]);
  return known.has(key) ? t(`location.${key}`) : location;
}

export function localizedTerrainFeature(feature: Terrain, t: Translate) {
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

export function localizedStorageSource(source: string, t: Translate) {
  return source
    .replace(/^Backpack\b/, t("storage.backpack"))
    .replace(/^Chest\b/, t("storage.chest"))
    .replace(/\bFarmHouse\b|\bFarmhouse\b/g, t("storage.farmhouse"))
    .replace(/\bFarm\b/g, t("nav.farm"))
    .replace(/ · tile /g, ` · ${t("storage.tile")} `);
}

export function routeItemName(item: DisplayNamedGameValue, t: Translate) {
  if (item.name === "Artifact Spot") return t("world.artifactSpot");
  if (item.name === "Seed Spot") return t("world.seedSpot");
  return item.displayName || item.name;
}

export const CROP_PLAN_KEYS: Record<string, string> = {
  "400": "strawberry", "190": "cauliflower", "192": "potato",
  "258": "blueberry", "254": "melon", "304": "hops", "256": "tomato",
  "268": "starfruit", "282": "cranberry", "276": "pumpkin",
};

export const BUILDING_PLAN_KEYS: Record<string, string> = {
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

export function buildingDisplayName(name: string, t: Translate) {
  const key = BUILDING_PLAN_KEYS[name];
  return key ? t(`building.${key}.name`) : name;
}

export function localizedInteriorName(interior: Interior, t: Translate) {
  const compact = interior.name.replace(/[\s_-]+/g, "").toLowerCase();
  if (compact === "farmhouse") return t("storage.farmhouse");
  if (compact === "farmcave") return t("location.farmcave");
  const buildingName = Object.keys(BUILDING_PLAN_KEYS).find(
    (name) => name.replace(/[\s_-]+/g, "").toLowerCase() === compact,
  );
  return buildingName ? buildingDisplayName(buildingName, t) : interior.label;
}

export function localizedHistoryAnnotation(
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

export function buildingPlanText(building: BuildingPlan, field: "name" | "why" | "prerequisite" | "unlock", t: Translate) {
  const key = BUILDING_PLAN_KEYS[building.name];
  const fallback = field === "name" ? buildingDisplayName(building.name, t) : building[field] || "";
  return key ? t(`building.${key}.${field}`) : fallback;
}

export function buildingCategoryName(category: string, t: Translate) {
  const key = category.toLowerCase();
  return ["all", "robin", "upgrades", "wizard", "community"].includes(key)
    ? t(`building.category.${key}`)
    : category;
}

export function buildingProjectTypeName(projectType: string, t: Translate) {
  const key: Record<string, string> = {
    "Farm building": "farmBuilding", "Building upgrade": "buildingUpgrade",
    "Home upgrade": "homeUpgrade", "Magical building": "magicalBuilding",
    "Community upgrade": "communityUpgrade", "Multiplayer cabin · 7 styles": "multiplayerCabin",
  };
  return key[projectType] ? t(`building.projectType.${key[projectType]}`) : projectType;
}

export function cropPlanNote(crop: CropPlan, t: Translate) {
  const key = crop.id && CROP_PLAN_KEYS[crop.id];
  return key ? t(`cropPlan.${key}.note`) : crop.note;
}

export const communityBundleKeys: Record<string, string> = {
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

export const communityRoomName = (id: string, translate: Translate) =>
  translate(`community.room.${communityRoomKeys[id] || "restoration"}.name`);

export const communityRoomReward = (id: string, translate: Translate) => {
  const key = communityRoomKeys[id] || "restoration";
  return {
    name: translate(`community.room.${key}.reward`),
    description: translate(`community.room.${key}.description`),
  };
};

export const communityBundleName = (id: string, fallback: string, translate: Translate) => {
  const key = communityBundleKeys[id];
  return key ? translate(`community.bundle.${key}`) : fallback;
};
