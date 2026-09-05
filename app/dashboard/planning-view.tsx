"use client";
import { formatNumber, formatDecimal } from "./formatting";

import { commonCraftingGoals } from "./planning-goals";

import { summarizeLiveMachines } from "./machine-selectors";

import { useI18n } from "../i18n";
import { useState } from "react";
import { useEffect } from "react";
import { ProductionCalculator } from "../planning/production-calculator";
import { type Snapshot, type LiveState, type BuildingPlan, type StorageInventoryItem, type StorageSourceDetail, type BundleRequirement, type FriendshipPlan } from "./snapshot-types";
import { type FarmHistory, type PlanningSection, type PersonalGoal, type StrategicGoalTarget } from "./ui-types";
import { resolveGameDisplayName, isVanillaFriend } from "./game-names";
import { inventoryItemId, inventoryQuantity, inventoryToolTier, normalizeObjectId, sameInventoryIdentity } from "./identity";
import { liveStorageSource, readyBundleDeliveries } from "./selectors";
import { localizedStorageSource, formatHarvestDate, buildingPlanText, communityRoomName, communityBundleName, formatLiveTime, formatBundleRequirement, communityRoomReward, cropPlanNote, buildingCategoryName, buildingProjectTypeName, routeLocationName, formatMachineDuration } from "./formatting";
import { readableStorageSource, readableStorageLocation, StorageLocationPreview } from "./storage";
import { ItemMentionArtwork, CommunityRoomArtwork, ModdedItemArtwork, SheetArtwork, AnimalArtwork, StorageArtwork, StorageContainerArtwork, GoalRequirements, NpcArtwork, GiftGroup } from "./artwork";
import { BuildingPreview } from "./farm-rendering";
import { WikiLink } from "./ui";

export function PlanningView({
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
    const allowed = mode === "farm" ? ["crops", "production", "animals", "storage"] : ["community", "calculators", "crops", "buildings", "friends", "goals"];
    if (!allowed.includes(String(saved))) return mode === "farm" ? "crops" : "community";
    return saved === "community" ||
      saved === "calculators" ||
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
                sameInventoryIdentity(candidate, item),
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
                    sameInventoryIdentity(candidate, item),
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
  const inventoryCount = (id?: string) =>
    inventoryQuantity(inventory, id);
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
      // Legacy inventory payloads lack preserve metadata; retain distinct product variants.
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
  const artworkForItem = (id?: string) =>
    storageIndex.find((item) => Boolean(id) && inventoryItemId(item) === normalizeObjectId(id));
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
      owned: live.active ? inventoryCount(material.id) : material.owned,
    }));
    const resourcesReady =
      buildingMoney >= building.money &&
      materials.every((item) => item.owned >= item.needed);
    const ready =
      !building.completed && building.verified !== false && building.prerequisiteMet && resourcesReady;
    const status = building.verified === false
      ? t("building.status.unverified")
      : building.completed
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
    .filter((building) => !building.completed && building.verified !== false)
    .map((building) => {
      const materials = building.materials.map((material) => ({
        ...material,
        owned: inventoryCount(material.id),
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
            ? t("goal.goldNeeded", { amount: formatNumber(moneyMissing, locale) })
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
            artwork: artworkForItem(material.id),
          })),
        ],
      };
    });
  const toolTiers = ["", "Copper", "Steel", "Gold", "Iridium"];
  const upgradeBars = ["", "(O)334", "(O)335", "(O)336", "(O)337"];
  const upgradeCosts = [0, 2000, 5000, 10000, 25000];
  const toolTargets: StrategicGoalTarget[] = [
    "Axe",
    "Pickaxe",
    "Hoe",
    "Watering Can",
  ].flatMap((tool) => {
    const currentTier = inventoryToolTier(storageIndex, tool.replaceAll(" ", ""));
    const targetTier = currentTier + 1;
    if (targetTier >= toolTiers.length) return [];
    const bar = upgradeBars[targetTier];
    const localizedBar = gameName(bar, bar);
    const localizedTool = gameName(`${toolTiers[targetTier]} ${tool}`, `(T)${toolTiers[targetTier]}${tool.replaceAll(" ", "")}`);
    const barMissing = Math.max(0, 5 - inventoryCount(bar));
    const moneyMissing = Math.max(0, upgradeCosts[targetTier] - buildingMoney);
    const ready = barMissing === 0 && moneyMissing === 0;
    return [{
      id: `tool:${tool}:${targetTier}`,
      category: t("goal.category.toolUpgrade"),
      title: localizedTool,
      progress: `${inventoryCount(bar)}/5 ${localizedBar} · ${formatNumber(buildingMoney, locale)}/${formatNumber(upgradeCosts[targetTier], locale)}g`,
      bottleneck: ready
        ? t("goal.tool.takeToClint")
        : [
            barMissing ? `${barMissing} ${localizedBar}` : "",
            moneyMissing ? `${formatNumber(moneyMissing, locale)}g` : "",
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
      const materials = recipe.materials.map(
        ({ id, name, quantity }) => ({
          id,
          name,
          displayName: gameName(name, id),
          needed: quantity * craftingQuantity,
          owned: inventoryCount(id),
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
          artwork: artworkForItem(material.id),
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
            artwork: artworkForItem(item.id),
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
            {formatNumber((live.active
              ? (live.money ?? current.money)
              : current.money
            ), locale)}
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
            ["calculators", t("planning.calculators")],
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
              <button type="button" className="locate-item-action" data-storage-item={item.name} aria-label={t("storage.clickToLocateNamed", { name: item.name })}>⌖</button>
                    <ItemMentionArtwork
                      id={item.id}
                      name={item.name}
                      item={artworkForItem(item.id)}
                    locatable={false} />
                    <div>
                      <strong>{formatBundleRequirement(item, t, locale)}</strong>
                      <span>
                        {communityRoomName(item.roomId, t)} · {communityBundleName(item.bundleId, item.bundle, t)}
                      </span>
                      <small>
                        {t("community.ownedAvailable", {
                          count: `${formatNumber(item.owned, locale)}${item.id === "-1" ? "g" : ""}`,
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
              <button type="button" className="locate-item-action" data-storage-item={item.name} aria-label={t("storage.clickToLocateNamed", { name: item.name })}>⌖</button>
                            <span className="bundle-item-status">
                              {item.donated ? "✓" : item.ready ? "→" : "·"}
                            </span>
                            <ItemMentionArtwork
                              id={item.id}
                              name={item.name}
                              item={artworkForItem(item.id)}
                            locatable={false} />
                            <span className="bundle-item-copy">
                              <strong>{formatBundleRequirement(item, t, locale)}</strong>
                              <small>
                                {item.donated
                                  ? t("community.donated")
                                  : item.id === "-1"
                                    ? t("community.goldAvailable", { count: formatNumber(item.owned, locale) })
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

      {section === "calculators" && mode === "plan" && (
        <div className="crop-planning-sections calculator-planning-sections">
          <ProductionCalculator
            catalog={current.productionCatalog}
            currentDate={{ year: current.year, season: current.season as "spring" | "summer" | "fall" | "winter", day: current.day }}
            currentMoney={current.money}
            currentFarmingLevel={current.progress.farming}
            currentProfessionIds={current.professionIds || []}
            currentInventory={current.planningBrief.inventory}
            currentMachines={current.planningBrief.machines}
            currentHouseUpgradeLevel={current.progress.houseUpgradeLevel}
            currentAnimals={current.planningBrief.animals}
            currentBuildings={current.planningBrief.buildings.map((building) => ({ ...building, cost: building.money }))}
            currentPonds={current.planningBrief.fishPonds}
            profileId={current.profileId || `${current.farmName}-${current.farmer}`}
            resolveGameName={gameName}
            renderItemArtwork={(id, name, spriteIndex, artworkUrl, artworkColumns) => artworkUrl
              ? <ModdedItemArtwork url={artworkUrl} label={name} spriteIndex={spriteIndex} columns={artworkColumns} />
              : <SheetArtwork id={String(spriteIndex ?? id.replace(/^\((?:O|BC)\)/, ""))} kind={id.startsWith("(BC)") ? "craftable" : "object"} label={name} fit />}
            renderAnimalArtwork={(animal) => <AnimalArtwork animal={animal} label={gameName(animal.name)} />}
            modCompatibility={current.modCompatibility}
          />
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
                                  <span className={building.prerequisiteMet ? "met" : ""}>{building.prerequisiteMet ? "✓ " : ""} {buildingPlanText(building, "prerequisite", t)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="building-price">
                            <strong>
                              {formatNumber(building.money, locale)}g
                            </strong>
                            <small>
                              {buildingMoney >= building.money
                                ? t("building.money.enough")
                                : t("building.money.missing", { amount: formatNumber((building.money - buildingMoney), locale) })}
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
                                    item={artworkForItem(material.id)}
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
                  const isObjectMachine = machine.id?.startsWith("(O)");
                  const isCrabPot = machine.id === "(O)710";
                  return (
                    <details
                      className={
                        machine.ready ? "has-ready" : idle ? "has-idle" : ""
                      }
                      key={machine.id || machine.name}
                    >
                      <summary>
                        <SheetArtwork
                          id={machine.id}
                          kind={isObjectMachine ? "object" : "craftable"}
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
              {machines.some((machine) => machine.id === "(BC)12")
                ? t("web.production.fillKegsFirst")
                : t("web.production.preserveJarsFirst")}
            </h2>
            <p>
              {machines.some((machine) => machine.id === "(BC)12")
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
                {inventoryCount("(O)258")}{t("web.planning.stored")}</span>
              <span>
                <b>{t("web.planning.melon")}</b>
                {inventoryCount("(O)254")}{t("web.planning.stored")}</span>
              <span>
                <b>{t("web.planning.hops")}</b>
                {inventoryCount("(O)304")}{t("web.planning.stored")}</span>
              <span>
                <b>{t("web.planning.starfruit")}</b>
                {inventoryCount("(O)268")}{t("web.planning.stored")}</span>
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
              <b>{t("storage.units", { count: formatNumber(inventory.reduce((sum, item) => sum + item.count, 0), locale) })}</b>
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
              <button type="button" className="locate-item-action" data-storage-item={item.name} aria-label={t("storage.clickToLocateNamed", { name: item.name })}>⌖</button>
                  <StorageArtwork item={item} />
                  <div>
                    <strong>{item.displayName || item.name}</strong>
                    <span>{item.sources.map(displayStorageSource).join(" · ")}</span>
                  </div>
                  <b>{formatNumber(item.count, locale)}</b>
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
                      <span>{t("storage.groupSummary", { types: group.items.length, units: formatNumber(group.items.reduce((sum, item) => sum + item.count, 0), locale) })}</span>
                    </div>
                  </header>
                  <div className="storage-results">
                    {group.items.map((item) => (
                      <article key={`${group.source}:${item.id}:${item.name}`}>
                        <StorageArtwork item={item} />
                        <div><strong>{item.displayName || item.name}</strong></div>
                        <b>{formatNumber(item.count, locale)}</b>
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
                  ? t("friendship.pet.projection", { rate: formatDecimal(petDailyGain, locale, 1), days: petElapsed, points: projectedPetPoints, date: t("date.game", { year: 3, season: t("season.spring"), day: 1 }) })
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
                    : t("friendship.projection.grandpa", { hearts: formatDecimal(projection.projectedHearts, locale, 1) });
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
                              {formatDecimal(projection.projectedHearts, locale, 1)}{t("web.planning.hearts")}{" "}
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
                            ? t("friendship.projection.observedPace", { rate: formatDecimal(projection.dailyGain, locale, 1), tracked: projection.sampleDays, remaining: projection.daysRemaining })
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
