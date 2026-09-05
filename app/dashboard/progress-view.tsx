"use client";

import { useI18n } from "../i18n";
import { useState } from "react";
import { useEffect } from "react";
import { useCallback } from "react";
import { useRef } from "react";
import { type FarmHistory, type HistoryEntry } from "./ui-types";
import { type Snapshot, type LiveState, type Achievement, type ItemArtwork, type CollectionRecipeItem } from "./snapshot-types";
import { useSectionVisibility, SectionVisibilityMenu, Metric, Skill } from "./ui";
import { isVanillaFriend, resolveGameDisplayName } from "./game-names";
import { formatGameDate, localizedHistoryAnnotation } from "./formatting";
import { GrandpaShrineArtwork, ItemMentionArtwork, SheetArtwork } from "./artwork";

export function GrowthView({
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
  previousSnapshot = previousSnapshot?.profileId === current.profileId
    ? previousSnapshot
    : null;
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
  const entries = history.profileId === current.profileId ? history.entries : [];
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

export function AchievementsView({
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

export function EconomyChart({ entries }: { entries: HistoryEntry[] }) {
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
