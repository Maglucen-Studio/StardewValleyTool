import type { GameLocalizationCatalog } from "../i18n";
import { type GameNameIndex, type Translate, type DisplayNamedGameValue } from "./ui-types";
import { type Snapshot, type BirthdayBrief, type FriendshipPlan } from "./snapshot-types";

export const QUALIFIED_GAME_NAME_KEYS: Record<string, string> = {
  "(O)174": "gameName.largeEggWhite",
  "(O)182": "gameName.largeEggBrown",
};

export const normalizedGameName = (value: string) =>
  value
    .replace(/\bL\.\s*/g, "Large ")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");

export const gameNameIndexes = new WeakMap<Record<string, string>, GameNameIndex>();

export function gameNameIndex(byEnglish: Record<string, string>): GameNameIndex {
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

export function resolveGameDisplayName(
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
  if (identityName && (name === id || name === qualifiedId)) return localizeEnglishName(identityName);
  for (const candidate of [identityName, name]) {
    if (!candidate) continue;
    const localized = localizeEnglishName(candidate);
    if (localized !== candidate) return localized;
    if (candidate === name && !identityName) return localized;
  }
  if (identityName && /^Item\s+\S+$/i.test(name)) return identityName;
  return name;
}

export function localizeSnapshotGameNames(
  snapshot: Snapshot,
  translate: Translate = (key, variables) => String(variables?.item ?? key),
  gameCatalog: GameLocalizationCatalog = {},
): Snapshot {
  const byId = {
    ...(gameCatalog.localizedNamesByQualifiedId || snapshot.localizedNamesByQualifiedId || {}),
  };
  const byEnglish = {
    ...(gameCatalog.localizedObjectNamesByEnglish || snapshot.localizedObjectNamesByEnglish || {}),
  };
  snapshot.localizedNamesByQualifiedId = byId;
  snapshot.localizedObjectNamesByEnglish = byEnglish;
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
    if (object.output) object.output = localizedName(object.output, object.outputId || undefined);
    if (object.input) object.input = localizedName(object.input, object.inputId || undefined);
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
    const localizedQuest = quest.id === undefined || quest.daily
      ? undefined
      : gameCatalog.localizedQuestsById?.[String(quest.id)];
    if (localizedQuest?.title) quest.title = localizedQuest.title;
    if (localizedQuest?.description) quest.description = localizedQuest.description;
    if (localizedQuest?.objective) quest.objective = localizedQuest.objective;
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
  snapshot.achievements.items.forEach((achievement) => {
    if (achievement.gameId === undefined || achievement.gameId === null) return;
    const localized = gameCatalog.localizedAchievementsById?.[String(achievement.gameId)];
    if (localized?.name) achievement.name = localized.name;
    if (localized?.requirement) achievement.requirement = localized.requirement;
  });
  return snapshot;
}

export const VANILLA_FRIENDSHIP_NPCS = new Set([
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

export const isVanillaFriend = (friend: { id?: string; name: string }) =>
  VANILLA_FRIENDSHIP_NPCS.has(friend.id || friend.name);
