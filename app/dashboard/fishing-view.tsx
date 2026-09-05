"use client";

import { useI18n } from "../i18n";
import { useState } from "react";
import { type FishingFish, type Snapshot, type LiveState } from "./snapshot-types";
import { fishTime, localizedQuestTitle } from "./formatting";
import { ModdedItemArtwork, SheetArtwork } from "./artwork";
import { normalizeObjectId, inventoryItemId } from "./identity";
import { type DisplayFishingFish } from "./ui-types";
import { WikiLink } from "./ui";

export const fishingHours = [
  600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500,
  1600, 1700, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500,
];

export function fishWindow(fish: FishingFish) {
  return fish.windows
    .map(([start, end]) => `${fishTime(start)}–${fishTime(end)}`)
    .join(" / ");
}

export function FishingView({
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
  const fishArtwork = (fish: FishingFish, label: string) => fish.artworkUrl
    ? <ModdedItemArtwork url={fish.artworkUrl} label={label} spriteIndex={fish.spriteIndex} columns={fish.artworkColumns} />
    : <SheetArtwork id={fish.id} kind="object" label={label} />;
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
                    {fish.verified === false && (
                      <span className="mod-rule-badge" title={t("fishing.modRuleDetail")}>
                        {t("fishing.modRuleUnverified")}
                      </span>
                    )}
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
                    {fishArtwork(fish, fish.displayName)}
                    <div>
                      <strong>
                        {fish.displayName}
                        {mission && <em>{t("fishing.mission")}</em>}
                        {here && <em className="here-badge">{t("fishing.here")}</em>}
                        {fishListMode === "all" && fish.caught && (
                          <em className="caught-badge">{t("fishing.caught")}</em>
                        )}
                        {fish.verified === false && (
                          <em className="mod-rule-badge" title={t("fishing.modRuleDetail")}>
                            {t("fishing.modRuleUnverified")}
                          </em>
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
                  {fishArtwork(fish, fish.displayName)}
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
