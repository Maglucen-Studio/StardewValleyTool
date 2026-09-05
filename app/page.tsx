"use client";
import { AccessibleDialog } from "./dashboard/accessible-dialog";

import { AccessibilitySettings, DashboardTour } from "./dashboard/accessibility";
import { useMenuKeyboard } from "./dashboard/use-menu-keyboard";
import { FarmEditorView } from "./dashboard/farm-editor-view";
import { useDashboardSession } from "./dashboard/use-dashboard-session";
import { useFarmAssets } from "./dashboard/use-farm-assets";

import { useDashboardNavigation } from "./dashboard/use-dashboard-navigation";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChangelogHistory } from "./changelog";
import { ItemArtworkCatalogContext } from "./dashboard/artwork";
import { FishingView } from "./dashboard/fishing-view";
import { buildingCategoryName, buildingPlanText, communityBundleName, communityRoomName, formatGameDate, formatLiveTime, localizedUpdateMessage } from "./dashboard/formatting";
import { defaultLiveAlertSettings, deriveLiveAlerts, LiveAlertCenter, LiveDataPanel } from "./dashboard/live-view";
import { PlanningView } from "./dashboard/planning-view";
import { AchievementsView, GrowthView } from "./dashboard/progress-view";
import { APPLICATION_VERSION, feedbackIssueUrl, liveStorageSource } from "./dashboard/selectors";
import { type StorageInventoryItem } from "./dashboard/snapshot-types";
import { ItemLocationDialog } from "./dashboard/storage";
import { DailyBriefModal, DailyBriefView } from "./dashboard/today-view";
import { LanguageModeIcon } from "./dashboard/ui";
import { type ActiveView, type DesktopDiagnostics, type DesktopUpdates, type FarmOption, type LiveAlertSettings, type UpdateState } from "./dashboard/ui-types";
import type { AppLanguageMode } from "./i18n";
import { useI18n } from "./i18n";

export default function Home() {
  const { t, text, locale, mode: languageMode } = useI18n();
  const { activeView, navigateTo, navigateHistory, navigationAvailability } = useDashboardNavigation();
  const { data, previousDay, history, sessionBaseline, live, lastRefresh, dataLoadError, setDataLoadError } = useDashboardSession();
  const { base, sprites, assetError } = useFarmAssets(data);
  const appShellRef = useRef<HTMLElement>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const [progressTabsTop, setProgressTabsTop] = useState(82);

  const [showDailyBrief, setShowDailyBrief] = useState(false);
  const [showLiveAlerts, setShowLiveAlerts] = useState(false);

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

  const [showLivePanel, setShowLivePanel] = useState(false);
  const livePanelCloseTimer = useRef<number | null>(null);
  const [showFarmSwitcher, setShowFarmSwitcher] = useState(false);
  const farmSwitcherRef = useRef<HTMLDivElement>(null);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const languageSwitchingRef = useRef(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  useMenuKeyboard(showLanguageMenu, languageMenuRef);
  const [showHelp, setShowHelp] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<{
    currentVersion: string;
    previousVersion: string | null;
  } | null>(null);
  const [showAppSearch, setShowAppSearch] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const appSearchInputRef = useRef<HTMLInputElement>(null);
  const [locatedItemName, setLocatedItemName] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DesktopDiagnostics | null>(null);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const [farmOptions, setFarmOptions] = useState<FarmOption[]>([]);
  const [activeSavePath, setActiveSavePath] = useState("");
  const [switchingFarm, setSwitchingFarm] = useState("");

  const [updateState, setUpdateState] = useState<UpdateState>({
    status: "idle",
  });
  const updateFeedbackMessage =
    localizedUpdateMessage(updateState, t) || updateState.message || "";

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

  const [uiScale, setUiScale] = useState(() => {
    if (typeof window === "undefined") return 1;
    const saved = Number(window.localStorage.getItem("stardew-tool-ui-scale"));
    if ([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(saved)) return saved;
    if (window.innerWidth >= 3000) return 1.5;
    if (window.innerWidth >= 2200) return 1.25;
    return 1;
  });

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
    desktop?.getReleaseNotesState?.()
      .then((state) => {
        if (state.shouldShow) {
          setReleaseNotes({
            currentVersion: state.currentVersion,
            previousVersion: state.previousVersion,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  const closeReleaseNotes = useCallback(() => {
    setReleaseNotes(null);
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates })
      .stardewDesktop;
    desktop?.acknowledgeReleaseNotes?.().catch(() => undefined);
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
      const interactive = target?.closest("button, a, summary, input, select, textarea, [role='button']");
      if (interactive && !interactive.hasAttribute("data-storage-item")) {
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
      } else if (releaseNotes) {
        closeReleaseNotes();
      } else if (showHelp) {
        setShowHelp(false);
      } else if (locatedItemName) {
        setLocatedItemName(null);
      } else if (showDailyBrief) {
        setShowDailyBrief(false);
      } else if (showFarmSwitcher) {
        setShowFarmSwitcher(false);
      } else if (showLanguageMenu) {
        setShowLanguageMenu(false);
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", closePopup);
    return () => window.removeEventListener("keydown", closePopup);
  }, [closeReleaseNotes, locatedItemName, releaseNotes, showAppSearch, showDailyBrief, showFarmSwitcher, showHelp, showLanguageMenu, showLiveAlerts]);

  useEffect(() => {
    const openSection = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, select, textarea, [contenteditable='true']") ||
        releaseNotes ||
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
  }, [locatedItemName, navigateTo, releaseNotes, showAppSearch, showDailyBrief, showHelp, showLiveAlerts]);

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
    const closeHeaderMenus = (event: PointerEvent) => {
      if (
        showFarmSwitcher &&
        !farmSwitcherRef.current?.contains(event.target as Node)
      )
        setShowFarmSwitcher(false);
      if (
        showLanguageMenu &&
        !languageMenuRef.current?.contains(event.target as Node)
      )
        setShowLanguageMenu(false);
    };
    document.addEventListener("pointerdown", closeHeaderMenus);
    return () => {
      document.removeEventListener("pointerdown", closeHeaderMenus);
    };
  }, [showFarmSwitcher, showLanguageMenu]);

  const switchLanguage = async (nextMode: AppLanguageMode) => {
    setShowLanguageMenu(false);
    if (nextMode === languageMode || languageSwitchingRef.current) return;
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates }).stardewDesktop;
    if (!desktop?.setLanguageMode) return;
    languageSwitchingRef.current = true;
    try {
      await desktop.setLanguageMode(nextMode);
    } catch (error) {
      setDataLoadError(error instanceof Error ? error.message : t("language.switchFailed"));
    } finally {
      languageSwitchingRef.current = false;
    }
  };

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
    if (!data?.dailyBrief) return;
    const storageKey = `stardew-tool-daily-brief-${data.profileId}`;
    if (window.localStorage.getItem(storageKey) !== data.dateKey) {
      const frame = window.requestAnimationFrame(() => {
        window.localStorage.setItem(storageKey, data.dateKey);
        setShowDailyBrief(true);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [data]);

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
      <a className="skip-link" href="#dashboard-content">{t("accessibility.skipContent")}</a>
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
        <AccessibilitySettings />
        <div className="language-selector" ref={languageMenuRef}>
          <button
            type="button"
            className="language-selector-trigger"
            aria-label={t("language.current", { language: t(`language.mode.${languageMode}`) })}
            aria-expanded={showLanguageMenu}
            aria-haspopup="menu"
            title={t("language.current", { language: t(`language.mode.${languageMode}`) })}
            onClick={() => setShowLanguageMenu((open) => !open)}
          >
            <LanguageModeIcon mode={languageMode} />
          </button>
          {showLanguageMenu && (
            <div className="language-selector-menu" role="menu" aria-label={t("language.selector")}>
              {(["game", "es", "en"] as AppLanguageMode[]).map((option) => (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-label={t(`language.mode.${option}`)}
                  aria-checked={languageMode === option}
                  className={languageMode === option ? "active" : ""}
                  key={option}
                  title={t(`language.mode.${option}`)}
                  onClick={() => void switchLanguage(option)}
                >
                  <LanguageModeIcon mode={option} />
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      <DashboardTour navigate={navigateTo} />
      {showAppSearch && (
        <div className="app-search-backdrop" onPointerDown={() => setShowAppSearch(false)}>
          <AccessibleDialog
            className="app-search-dialog"
            onDismiss={() => setShowAppSearch(false)}
            aria-label={t("web.home.searchTheCompanion")}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">{t("web.home.jumpToAnything")}</p>
                <h2>{t("web.home.searchTheCompanion")}</h2>
              </div>
              <button type="button" onClick={() => setShowAppSearch(false)} aria-label={t("accessibility.close")}>×</button>
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
          </AccessibleDialog>
        </div>
      )}
      {releaseNotes && (
        <div className="help-backdrop" onPointerDown={closeReleaseNotes}>
          <AccessibleDialog
            className="help-dialog release-notes-dialog"
            onDismiss={closeReleaseNotes}
            aria-labelledby="release-notes-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button className="help-close" onClick={closeReleaseNotes} aria-label={t("releaseNotes.close")}>×</button>
            <p className="eyebrow">{t("releaseNotes.whatsNew")}</p>
            <h2 id="release-notes-title">{t("releaseNotes.updatedTo", { version: releaseNotes.currentVersion })}</h2>
            <p>{t("releaseNotes.intro")}</p>
            <ChangelogHistory
              fromVersion={releaseNotes.previousVersion}
              throughVersion={releaseNotes.currentVersion}
              headingId="release-notes-changelog-title"
              compact
            />
            <div className="release-notes-actions">
              <button type="button" onClick={closeReleaseNotes}>{t("releaseNotes.continue")}</button>
            </div>
          </AccessibleDialog>
        </div>
      )}
      {showHelp && (
        <div className="help-backdrop" onPointerDown={() => setShowHelp(false)}>
          <AccessibleDialog
            className="help-dialog"
            onDismiss={() => setShowHelp(false)}
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
                  <span>{t("compatibility.modsDetected")}<b>{diagnostics.modCompatibility?.installedModCount ?? 0}</b></span>
                  <span>{t("compatibility.contentPacks")}<b>{diagnostics.modCompatibility?.contentPackCount ?? 0}</b></span>
                  <span>{t("compatibility.unclassifiedMods")}<b>{diagnostics.modCompatibility?.unclassifiedCodeModCount ?? 0}</b></span>
                  <span>{t("compatibility.scanFailures")}<b>{diagnostics.modCompatibility?.parseFailureCount ?? 0}</b></span>
                  <span>{t("compatibility.confidence")}<b>{t(`compatibility.status.${diagnostics.modCompatibility?.status || "vanilla"}`)}</b></span>
                  <span>{t("compatibility.alteredDomains")}<b>{diagnostics.modCompatibility?.alteredDomains.length ? diagnostics.modCompatibility.alteredDomains.map((domain) => t(`compatibility.domain.${domain}`)).join(", ") : t("compatibility.noneDetected")}</b></span>
                  <button type="button" onClick={async () => {
                    const text = JSON.stringify({
                      version: diagnostics.version,
                      packaged: diagnostics.packaged,
                      development: diagnostics.development,
                      osVersion: diagnostics.osVersion,
                      architecture: diagnostics.architecture,
                      gameFound: diagnostics.gameFound,
                      saveFound: diagnostics.saveFound,
                      smapiFound: diagnostics.smapiFound,
                      bridgeInstalled: diagnostics.bridgeInstalled,
                      bridgeManifestFound: diagnostics.bridgeManifestFound,
                      bridgeVersion: diagnostics.bridgeVersion,
                      bridgeDllFound: diagnostics.bridgeDllFound,
                      gameRunning: diagnostics.gameRunning,
                      liveStateFound: diagnostics.liveStateFound,
                      liveStateFresh: diagnostics.liveStateFresh,
                      liveStateAgeSeconds: diagnostics.liveStateAgeSeconds,
                      modCompatibility: diagnostics.modCompatibility,
                      live: live.active,
                      liveLocation: live.locationId || null,
                      liveWarnings: live.bridgeWarnings || [],
                    }, null, 2);
                    await (window as Window & { stardewDesktop?: DesktopUpdates }).stardewDesktop?.copyText(text);
                    setDiagnosticsCopied(true);
                  }}>{diagnosticsCopied ? t("diagnostics.copied") : t("diagnostics.copy")}</button>
                </>
              ) : (
                <p>{t("web.home.desktopDiagnosticsAreUnavailableInThisBrowserSession")}</p>
              )}
            </div>
            <ChangelogHistory />
          </AccessibleDialog>
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

      <div id="dashboard-content" tabIndex={-1} className="content-focus-anchor" />
      <FarmEditorView data={data} live={live} activeView={activeView} base={base} sprites={sprites} />
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
