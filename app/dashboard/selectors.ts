import packageMetadata from "../../package.json";
import { type LiveStorageItem, type Snapshot, type LiveState, type LiveQuest, type DailyQuest, type FarmObject, type CommunityRoom, type LiveMachine } from "./snapshot-types";
import { type SessionSummary, type Translate, type FeedbackKind, type DesktopDiagnostics, type ActiveView } from "./ui-types";
import { normalizeObjectId, inventoryItemId } from "./identity";

export const APPLICATION_VERSION = packageMetadata.version;

export const liveStorageSource = (item: LiveStorageItem) =>
  item.source || `chest:${item.containerLocation || "unknown"}:${item.containerX ?? "?"}:${item.containerY ?? "?"}`;

export function stardewWikiUrl(name: string) {
  return `https://stardewvalleywiki.com/${encodeURIComponent(name.trim().replaceAll(" ", "_"))}`;
}

export function sessionSummary(snapshot: Snapshot, live?: LiveState): SessionSummary {
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

export const LIVE_ROUTE_LOCATION_NAMES: Record<string, string> = {
  Farm: "Farm",
  FarmCave: "Farm Cave",
  Beach: "Beach",
  Town: "Town",
  Mountain: "Mountain",
  Forest: "Cindersap Forest",
  BusStop: "Bus Stop",
  Backwoods: "Backwoods",
};

export function matchingSavedQuest(quest: LiveQuest, savedQuests: DailyQuest[]) {
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

export function liveQuestStatus(
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

export function feedbackIssueUrl(
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
    `- Mod compatibility: ${diagnostics?.modCompatibility?.status || "Not available"}`,
    `- Installed mods: ${diagnostics?.modCompatibility?.installedModCount ?? "Not available"}`,
    `- Content packs: ${diagnostics?.modCompatibility?.contentPackCount ?? "Not available"}`,
    `- Altered domains: ${diagnostics?.modCompatibility?.alteredDomains.join(", ") || "None detected"}`,
    `- Uncertain domains: ${diagnostics?.modCompatibility?.uncertainDomains.join(", ") || "None detected"}`,
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

export function summarizeReadyMachines(items: FarmObject[]) {
  const grouped = new Map<string, number>();
  for (const item of items) {
    const label = item.output || item.name;
    grouped.set(label, (grouped.get(label) || 0) + 1);
  }
  return [...grouped].map(([label, count]) => `${count}× ${label}`).join(" · ");
}

export function readyBundleDeliveries(community: { rooms: CommunityRoom[] }) {
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

export function liveReadyBundleDeliveries(
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

export function summarizeReadyLiveMachines(items: LiveMachine[]) {
  const grouped = new Map<string, number>();
  for (const item of items) {
    const label = item.output || item.name;
    grouped.set(label, (grouped.get(label) || 0) + 1);
  }
  return [...grouped].map(([label, count]) => `${count}× ${label}`).join(" · ");
}
