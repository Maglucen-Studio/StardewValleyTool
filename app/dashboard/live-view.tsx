"use client";
import { AccessibleDialog } from "./accessible-dialog";
import { formatNumber } from "./formatting";

import { useI18n } from "../i18n";
import { type LiveAlertSettings, type Translate, type LiveAlert, type LiveAlertKind } from "./ui-types";
import { type Snapshot, type LiveState, type LocalizedValue } from "./snapshot-types";
import { summarizeReadyLiveMachines, matchingSavedQuest, liveReadyBundleDeliveries } from "./selectors";
import { resolveGameDisplayName, isVanillaFriend } from "./game-names";
import { formatLiveTime, routeLocationName } from "./formatting";
import { LiveWorldMap } from "./artwork";

export const defaultLiveAlertSettings: LiveAlertSettings = {
  machines: true,
  crops: true,
  birthdays: true,
  deadlines: true,
  energy: true,
  tool: true,
  bundles: true,
};

export function deriveLiveAlerts(
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

export function LiveAlertCenter({
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
      <AccessibleDialog
        className="live-alert-dialog"
            onDismiss={onClose}
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
      </AccessibleDialog>
    </div>
  );
}

export function LiveDataPanel({
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
          {Boolean(live.bridgeWarnings?.length) && (
            <p className="live-offline">
              {t("live.partialConnection", { sections: live.bridgeWarnings!.join(", ") })}
            </p>
          )}
          <div className="live-stat-grid">
            <div>
              <span>{t("web.liveDataPanel.time")}</span>
              <strong>{formatLiveTime(live.timeOfDay)}</strong>
            </div>
            <div>
              <span>{t("web.home.money")}</span>
              <strong>{formatNumber((live.money || 0), locale)}g</strong>
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
          <span>{live.active ? live.bridgeWarnings?.length ? t("live.partialConnectionStatus") : t("live.healthyConnection") : t("live.safeMode")}</span>
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
