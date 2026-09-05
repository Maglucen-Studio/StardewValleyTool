"use client";
import { sameInventoryIdentity } from "./identity";

import { formatNumber, formatDecimal } from "./formatting";

import { useI18n } from "../i18n";
import { useState } from "react";
import type { RouteProfile } from "../route-planner.mjs";
import { normalizeRouteProfile } from "../route-planner.mjs";
import { useCallback } from "react";
import { useEffect } from "react";
import { fishingQuestRouteStop } from "../route-planner.mjs";
import { orderRouteStops } from "../route-planner.mjs";
import { estimateRouteMinutes } from "../route-planner.mjs";
import { ROUTE_PROFILES } from "../route-planner.mjs";
import { type DailyBrief, type Snapshot, type LiveState, type DailyQuest } from "./snapshot-types";
import { type Translate, type FarmHistory, type SessionSummary, type TodayTaskRecord, type PersonalGoal, type TodayTaskStatus } from "./ui-types";
import { useSectionVisibility, SectionVisibilityMenu } from "./ui";
import { LIVE_ROUTE_LOCATION_NAMES, liveReadyBundleDeliveries, liveQuestStatus, matchingSavedQuest, summarizeReadyLiveMachines, summarizeReadyMachines, sessionSummary } from "./selectors";
import { resolveGameDisplayName } from "./game-names";
import { inventoryItemId, normalizeObjectId } from "./identity";
import { fishTime, formatBundleRequirement, communityRoomName, communityBundleName, localizedQuestTitle, formatLiveTime, formatGameDate, routeLocationName, routeItemName, formatHarvestDate } from "./formatting";
import { NpcArtwork, ItemMentionArtwork, LiveWorldMap, SheetArtwork, GiftGroup } from "./artwork";

export const isCoreTvProgram = (program: DailyBrief["tv"][number]) => {
  if (program.id === "weather" || program.id === "fortune") return true;
  if (typeof program.channel === "object")
    return program.channel.key === "today.tv.weather.channel" ||
      program.channel.key === "today.tv.fortune.channel";
  return ["Weather Report", "Fortune Teller", "El tiempo", "La adivina"].includes(program.channel);
};

export const caveTypeLabel = (type: string, translate: Translate) => {
  const normalized = type.replace(/\s+/g, "").toLocaleLowerCase("en-US");
  const key = normalized === "fruitbats"
    ? "today.cave.fruitBats"
    : normalized === "mushrooms"
      ? "today.cave.mushrooms"
      : "today.cave.notSelected";
  return translate(key);
};

export const birthdayWhenLabel = (when: string, translate: Translate) =>
  translate(`today.when.${when.toLocaleLowerCase("en-US")}`);

export function DailyBriefModal({
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

export function DailyBriefView({
  current,
  previous: candidatePrevious,
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
  const previous = candidatePrevious?.profileId === current.profileId
    ? candidatePrevious
    : null;
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
  const routeProfileId = current.profileId || current.farmName;
  const routeProfilesStorageKey = "stardew-tool-route-profiles-v1";
  const [routeProfiles, setRouteProfiles] = useState<Record<string, RouteProfile>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(routeProfilesStorageKey) || "{}");
    } catch {
      return {};
    }
  });
  const routeProfile = normalizeRouteProfile(routeProfiles[routeProfileId]);
  const chooseRouteProfile = (profile: RouteProfile) => {
    const next = { ...routeProfiles, [routeProfileId]: profile };
    setRouteProfiles(next);
    window.localStorage.setItem(routeProfilesStorageKey, JSON.stringify(next));
  };
  const [todayTaskRecords, setTodayTaskRecords] = useState<Record<string, TodayTaskRecord>>({});
  const [todayTasksDateKey, setTodayTasksDateKey] = useState<string | null>(null);
  const [pinnedGoals, setPinnedGoals] = useState<PersonalGoal[]>([]);
  const persistTodayTaskRecords = useCallback((tasks: Record<string, TodayTaskRecord>) => {
    setTodayTaskRecords(tasks);
    fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ todayTaskDay: { dateKey: current.dateKey, tasks } }),
    }).catch(() => undefined);
  }, [current.dateKey]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/preferences", { cache: "no-store" })
      .then((response) => response.json())
      .then((preferences) => {
        if (cancelled) return;
        setPinnedGoals(Array.isArray(preferences.goals) ? preferences.goals.filter((goal: PersonalGoal) => !goal.done) : []);
        const days = preferences.todayTasks?.days || {};
        const currentTasks = days[current.dateKey]?.tasks;
        if (currentTasks && typeof currentTasks === "object") {
          setTodayTaskRecords(currentTasks);
        } else {
          const previousDay = Object.entries(days)
            .filter(([dateKey]) => dateKey !== current.dateKey)
            .sort(([, a], [, b]) => String((a as { updatedAt?: string }).updatedAt || "").localeCompare(String((b as { updatedAt?: string }).updatedAt || "")))
            .at(-1)?.[1] as { tasks?: Record<string, TodayTaskRecord> } | undefined;
          const carried = Object.fromEntries(
            Object.values(previousDay?.tasks || {})
              .filter((task) => task.status === "postponed")
              .map((task) => [task.id, { ...task, status: "active" as const, carriedFrom: task.updatedAt, updatedAt: new Date().toISOString() }]),
          );
          setTodayTaskRecords(carried);
          if (Object.keys(carried).length) persistTodayTaskRecords(carried);
        }
        setTodayTasksDateKey(current.dateKey);
      })
      .catch(() => setTodayTasksDateKey(current.dateKey));
    return () => { cancelled = true; };
  }, [current.dateKey, persistTodayTaskRecords]);
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
          value: `${current.money - previous.money >= 0 ? "+" : ""}${formatNumber((current.money - previous.money), locale)}g`,
          detail: t("today.change.balanceDetail", { earned: formatNumber((currentEconomy?.income || 0), locale), spent: formatNumber((currentEconomy?.spending || 0), locale) }),
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
  const bundleDeliveries = liveReadyBundleDeliveries(
    current.planningBrief.communityCenter,
    live,
  );
  const liveInventoryCounts = new Map<string, number>();
  for (const item of live.inventory || []) {
    const id = inventoryItemId(item);
    liveInventoryCounts.set(id, (liveInventoryCounts.get(id) || 0) + item.count);
  }
  const routeBundleDeliveries = live.active
    ? bundleDeliveries.filter((item) => (liveInventoryCounts.get(normalizeObjectId(item.id)) || 0) >= item.count)
    : bundleDeliveries;
  const routeQuestCandidates = live.active
    ? live.acceptedQuests || []
    : [brief.dailyQuest, ...(brief.acceptedQuests || [])];
  const routeFishingQuest = routeQuestCandidates.find((quest) =>
    quest.type.toLocaleLowerCase("en-US").includes("fishing") &&
    (quest.progress || 0) < (quest.target || 1),
  );
  const routeFish = routeFishingQuest
    ? current.fishingBrief.fish.find((fish) =>
        sameInventoryIdentity(fish, { id: String(routeFishingQuest.requestedId || "") }))
    : undefined;
  const fishingRouteOpportunity = fishingQuestRouteStop(routeFish, {
    season: live.active ? live.season || current.season : current.season,
    weather: live.active ? (live.raining ? "rainy" : "sunny") : current.fishingBrief.weather,
    time: live.active ? live.timeOfDay || 600 : 600,
  });
  const routeSource = brief.world
    .filter((stop) => stop.location !== "Farm Cave")
    .map((stop) => ({ ...stop, items: [...stop.items] }));
  for (const [location, items] of liveWorldItems) {
    if (location === "Farm Cave" || routeSource.some((stop) => stop.location === location)) continue;
    routeSource.push({ location, items });
  }
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
  const blacksmith = brief.routeContext?.services;
  const blacksmithAvailable = !blacksmith || (
    blacksmith.blacksmithOpenToday &&
    (!live.active || !live.timeOfDay || live.timeOfDay < blacksmith.blacksmithClosesAt)
  );
  const toolPickupWaiting = Boolean(brief.toolUpgrade || live.routeState?.toolPickupReady);
  if (
    toolPickupWaiting && blacksmithAvailable &&
    !routeSource.some((stop) => stop.location === "Town")
  )
    routeSource.push({ location: "Town", items: [] });
  if (routeBundleDeliveries.length && !routeSource.some((stop) => stop.location === "Town"))
    routeSource.push({ location: "Town", items: [] });
  if (fishingRouteOpportunity && !routeSource.some((stop) => stop.location === fishingRouteOpportunity.location))
    routeSource.push({ location: fishingRouteOpportunity.location, items: [] });
  const routeAccess = brief.routeContext?.access || {};
  const unavailableRouteStops = routeSource.filter(
    (stop) => routeAccess[stop.location] === false,
  );
  const accessibleRouteStops = routeSource.filter(
    (stop) => routeAccess[stop.location] !== false,
  );
  const routeWorld = orderRouteStops(accessibleRouteStops, routeProfile, currentRouteLocation);
  const activeRouteTransport = Object.entries(brief.routeContext?.transport || {})
    .filter(([, unlocked]) => unlocked)
    .map(([transport]) => t(`today.route.transport.${transport}`));
  const unknownRouteStops = routeWorld.filter(
    (stop) => !routeOrder.includes(stop.location) && routeAccess[stop.location] === undefined,
  );
  const routeEstimateMinutes = estimateRouteMinutes(
    routeWorld.length,
    brief.routeContext?.transport,
    routeProfile,
  );
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
      if (routeBundleDeliveries.length)
        notes.push(t("today.route.bundleDeliveries", { count: routeBundleDeliveries.length }));
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
    if (location === fishingRouteOpportunity?.location && routeFish)
      notes.push(t("today.route.fishingQuestWindow", {
        fish: routeFish.displayName || resolveGameDisplayName(
          current.localizedNamesByQualifiedId || {},
          current.localizedObjectNamesByEnglish || {},
          routeFish.name,
          `(O)${routeFish.id}`,
        ),
        start: fishTime(fishingRouteOpportunity.start),
        end: fishTime(fishingRouteOpportunity.end),
      }));
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
  const automaticallyCompletedWorld = (() => {
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
  })();
  const completedWorld = [
    ...new Set([...manualCompletedWorld, ...automaticallyCompletedWorld]),
  ];
  const worldTaskCount = routeWorld.length;
  const unwateredCrops =
    live.active && live.farmMap
      ? live.farmMap.terrain.filter((tile) => tile.hasCrop && !tile.watered)
          .length
      : brief.crops.reduce(
          (sum, crop) => sum + Math.max(0, crop.count - crop.watered),
          0,
        );
  const bundleDeliveryDetail = bundleDeliveries
    .map(
      (item) => `${formatBundleRequirement(item, t, locale)} → ${communityRoomName(item.roomId, t)} · ${communityBundleName(item.bundleId, item.bundle, t)}`,
    )
    .join(" · ");
  const todayBirthday = brief.birthdays.find((item) => item.when.toLowerCase() === "today");
  const birthdayFriend = todayBirthday
    ? (live.friendships || []).find((friend) =>
        (todayBirthday.id && friend.id === todayBirthday.id) || friend.name === todayBirthday.person)
    : undefined;
  const liveCompletedBundleCount = live.active
    ? current.planningBrief.communityCenter.rooms.reduce((sum, room) => {
        const liveBundles = new Map(
          (live.collections?.bundleProgress || []).map((bundle) => [String(bundle.id), bundle.donated]),
        );
        return sum + room.bundles.filter((bundle) => {
          const donated = liveBundles.get(bundle.id);
          return donated
            ? donated.slice(0, bundle.requirements.length).filter(Boolean).length >= bundle.required
            : bundle.complete;
        }).length;
      }, 0)
    : current.planningBrief.communityCenter.completed;
  const priorityItems = [
    unwateredCrops > 0 && !live.raining
      ? {
          id: "water-crops",
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
          id: "harvest-crops",
          level: "ready",
          title: t("today.priority.harvestCrops", { count: readyCrops }),
          detail: t("today.priority.harvestUpdates"),
        }
      : null,
    readyMachinesCount > 0
      ? {
          id: "collect-machines",
          level: "ready",
          title: t("today.priority.collectMachines", { count: readyMachinesCount }),
          detail: live.active
            ? summarizeReadyLiveMachines(liveReadyMachines)
            : summarizeReadyMachines(savedReadyMachines),
        }
      : null,
    (live.active ? live.routeState?.toolPickupReady : brief.toolUpgrade?.ready)
      ? {
          id: "collect-tool",
          level: "urgent",
          title: t("today.priority.collectTool", { tool: brief.toolUpgrade?.displayName || brief.toolUpgrade?.name || t("today.priority.upgradedTool") }),
          detail: t("today.priority.readyAtClint"),
        }
      : null,
    activeDailyQuest.accepted && activeDailyQuest.daysLeft <= 1
      ? {
          id: "daily-quest",
          level: "urgent",
          title: activeDailyQuest.title,
          detail: t("today.priority.finalDay", { objective: text(activeDailyQuest.objective) }),
        }
      : null,
    todayBirthday && (!live.active || !birthdayFriend?.giftsToday)
      ? {
          id: "birthday-gift",
          level: "ready",
          title: t("today.priority.birthdayGift", { person: todayBirthday.person }),
          detail: t("today.priority.birthdayGiftDetail"),
        }
      : null,
    bundleDeliveries.length > 0
      ? {
          id: "bundle-deliveries",
          level: "ready",
          title: t("today.priority.bundleDeliveries", { count: bundleDeliveries.length }),
          detail: bundleDeliveryDetail,
          action: "community" as const,
        }
      : null,
    live.active && (live.energy || 0) < (live.maxEnergy || 1) * 0.2
      ? {
          id: "low-energy",
          level: "warning",
          title: t("today.priority.lowEnergy"),
          detail: t("today.priority.lowEnergyDetail", { energy: Math.round(live.energy || 0), max: Math.round(live.maxEnergy || 0) }),
        }
      : null,
  ].filter(Boolean) as {
    id: string;
    level: string;
    title: string;
    detail: string;
    action?: "community";
  }[];

  useEffect(() => {
    if (todayTasksDateKey !== current.dateKey) return;
    const next = { ...todayTaskRecords };
    let changed = false;
    const now = new Date().toISOString();
    for (const item of priorityItems) {
      if (next[item.id]) continue;
      next[item.id] = {
        id: item.id,
        status: "active",
        title: item.title,
        detail: item.detail,
        level: item.level,
        baseline: item.id === "bundle-deliveries" ? liveCompletedBundleCount : undefined,
        updatedAt: now,
      };
      changed = true;
    }
    if (live.active) {
      const satisfied: Record<string, boolean> = {
        "water-crops": unwateredCrops === 0 || Boolean(live.raining),
        "harvest-crops": readyCrops === 0,
        "collect-machines": readyMachinesCount === 0,
        "collect-tool": !live.routeState?.toolPickupReady,
        "daily-quest": Boolean(live.dailyQuestCompleted),
        "birthday-gift": Boolean(birthdayFriend?.giftsToday),
        "low-energy": (live.energy || 0) >= (live.maxEnergy || 1) * 0.2,
      };
      for (const task of Object.values(next)) {
        const bundleCompleted = task.id === "bundle-deliveries"
          && liveCompletedBundleCount > (task.baseline ?? liveCompletedBundleCount);
        if (task.status !== "active" || (!satisfied[task.id] && !bundleCompleted)) continue;
        next[task.id] = { ...task, status: "completed", completionMode: "automatic", evidence: task.id, updatedAt: now };
        changed = true;
      }
    }
    if (changed) queueMicrotask(() => persistTodayTaskRecords(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayTasksDateKey, current.dateKey, live, readyCrops, readyMachinesCount, unwateredCrops, liveCompletedBundleCount, birthdayFriend?.giftsToday]);

  const checklistItems: { id: string; level: string; title: string; detail: string; action?: "community" }[] = [
    ...priorityItems,
    ...Object.values(todayTaskRecords)
      .filter((task) => task.status === "active" && !priorityItems.some((item) => item.id === task.id))
      .map((task) => ({ id: task.id, level: task.level, title: task.title, detail: task.detail })),
  ].filter((item) => (todayTaskRecords[item.id]?.status || "active") === "active");
  const checklistHistory = Object.values(todayTaskRecords).filter((task) => task.status !== "active");
  const checklistEvidence: Record<string, string> = {
    "water-crops": t("today.checklist.evidence.water"),
    "harvest-crops": t("today.checklist.evidence.harvest"),
    "collect-machines": t("today.checklist.evidence.machines"),
    "collect-tool": t("today.checklist.evidence.tool"),
    "daily-quest": t("today.checklist.evidence.quest"),
    "birthday-gift": t("today.checklist.evidence.gift"),
    "bundle-deliveries": t("today.checklist.evidence.bundles"),
    "low-energy": t("today.checklist.evidence.energy"),
  };
  const updateTodayTask = (id: string, status: TodayTaskStatus) => {
    const task = todayTaskRecords[id] || priorityItems.find((item) => item.id === id);
    if (!task) return;
    persistTodayTaskRecords({
      ...todayTaskRecords,
      [id]: {
        ...task,
        id,
        status,
        completionMode: status === "completed" ? "manual" : undefined,
        evidence: undefined,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const currentSession = sessionSummary(current, live);
  const sessionChanges = sessionBaseline
    ? [
        currentSession.money !== sessionBaseline.money
          ? t("today.session.balance", { amount: `${currentSession.money - sessionBaseline.money >= 0 ? "+" : ""}${formatNumber((currentSession.money - sessionBaseline.money), locale)}` })
          : null,
        currentSession.totalMoneyEarned !== sessionBaseline.totalMoneyEarned
          ? t("today.session.earned", { amount: formatNumber(Math.max(0, currentSession.totalMoneyEarned - sessionBaseline.totalMoneyEarned), locale) })
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
              {formatDecimal(brief.luck.value, locale, 3)}
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
                  · {formatNumber(displayedQuest.reward, locale)}g
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
              {checklistItems.length
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
        {checklistItems.length ? (
          <div className="priority-grid">
            {checklistItems.map((item, index) => (
              <article className={`${item.level} checklist-task`} key={item.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                  <div className="checklist-actions">
                    <button type="button" onClick={() => updateTodayTask(item.id, "completed")}>{t("today.checklist.complete")}</button>
                    <button type="button" onClick={() => updateTodayTask(item.id, "postponed")}>{t("today.checklist.postpone")}</button>
                    <button type="button" onClick={() => updateTodayTask(item.id, "dismissed")}>{t("today.checklist.dismiss")}</button>
                    {item.action === "community" && (
                      <button type="button" onClick={onOpenCommunityCenter}>{t("today.openCommunity", { item: item.title })}</button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="priority-empty">{t("web.dailyBrief.youCanSpendTheRestOfTheDayFishing")}</p>
        )}
        {checklistHistory.length > 0 && (
          <div className="checklist-history">
            {checklistHistory.map((task) => (
              <article key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <small>
                    {task.status === "completed"
                      ? task.completionMode === "automatic"
                        ? t("today.checklist.completedAutomatic")
                        : t("today.checklist.completedManual")
                      : task.status === "postponed"
                        ? t("today.checklist.postponed")
                        : t("today.checklist.dismissed")}
                  </small>
                  {task.completionMode === "automatic" && task.evidence && <small>{checklistEvidence[task.evidence]}</small>}
                </div>
                <button type="button" onClick={() => updateTodayTask(task.id, "active")}>{t("today.checklist.restore")}</button>
              </article>
            ))}
          </div>
        )}
        <small className="checklist-sidecar-note">{t("today.checklist.savedSidecar")}</small>
        {pinnedGoals.length > 0 && (
          <aside className="today-personal-goals">
            <div>
              <strong>{t("today.checklist.personalGoals")}</strong>
              <small>{t("today.checklist.personalGoalsDetail")}</small>
            </div>
            {pinnedGoals.map((goal) => (
              <article key={goal.id}>
                <strong>{goal.title}</strong>
                {goal.deadline && <small>{t("goal.deadline", { date: goal.deadline })}</small>}
              </article>
            ))}
          </aside>
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
                        {formatNumber(acceptedQuest.reward, locale)}g
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
          <div className="route-profile-control">
            <label htmlFor="route-profile">{t("today.route.profile.label")}</label>
            <select id="route-profile" value={routeProfile} onChange={(event) => chooseRouteProfile(event.target.value as RouteProfile)}>
              {ROUTE_PROFILES.map((profile) => (
                <option key={profile} value={profile}>{t(`today.route.profile.${profile}`)}</option>
              ))}
            </select>
            <small>{t(`today.route.profile.${routeProfile}.detail`)}</small>
          </div>
          <div className="route-assumptions" aria-label={t("today.route.assumptionsLabel")}>
            <span>{t("today.route.roughEstimate", { minutes: routeEstimateMinutes })}</span>
            {activeRouteTransport.map((transport) => <span key={transport}>{transport}</span>)}
            {brief.routeContext?.festival && <span>{t("today.route.festivalToday")}</span>}
          </div>
          {toolPickupWaiting && !blacksmithAvailable && (
            <p className="route-access-warning">{
              brief.routeContext?.festival
                ? t("today.route.blacksmithFestivalClosed")
                : t("today.route.blacksmithUnavailable")
            }</p>
          )}
          {unavailableRouteStops.length > 0 && (
            <p className="route-access-warning">
              {t("today.route.inaccessibleSkipped", {
                locations: unavailableRouteStops.map((stop) => routeLocationName(stop.location, t)).join(" · "),
              })}
            </p>
          )}
          {unknownRouteStops.length > 0 && (
            <p className="route-access-note">
              {t("today.route.unknownAccess", {
                locations: unknownRouteStops.map((stop) => routeLocationName(stop.location, t)).join(" · "),
              })}
            </p>
          )}
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
