"use client";

import { useFarmCanvas } from "./dashboard/use-farm-canvas";

import { useDashboardNavigation } from "./dashboard/use-dashboard-navigation";

import { reconcileProposals, buildingType, buildingSignature } from "./dashboard/farm-model";

import { useI18n } from "./i18n";
import { useRef } from "react";
import { useState } from "react";
import { useCallback } from "react";
import { useEffect } from "react";
import type { AppLanguageMode } from "./i18n";
import { useMemo } from "react";
import type { CSSProperties } from "react";
import { ChangelogHistory } from "./changelog";
import { type Snapshot, type LiveState, type Tile, type Suggestion, type Terrain, type StorageInventoryItem } from "./dashboard/snapshot-types";
import { type FarmHistory, type ActiveView, type SessionSummary, type LiveAlertSettings, type DesktopDiagnostics, type FarmOption, type UpdateState, type DesktopUpdates } from "./dashboard/ui-types";
import { defaultLiveAlertSettings, deriveLiveAlerts, LiveDataPanel, LiveAlertCenter } from "./dashboard/live-view";
import { localizedUpdateMessage, seasonName, localizedTerrainFeature, buildingDisplayName, communityBundleName, communityRoomName, buildingPlanText, buildingCategoryName, formatGameDate, formatLiveTime, localizedInteriorName } from "./dashboard/formatting";
import { APPLICATION_VERSION, sessionSummary, liveStorageSource, feedbackIssueUrl } from "./dashboard/selectors";
import { localizeSnapshotGameNames } from "./dashboard/game-names";
import { spritePaths, tileKey, TILE, tools, BuildingPreview, InteriorView } from "./dashboard/farm-rendering";
import { ItemArtworkCatalogContext } from "./dashboard/artwork";
import { LanguageModeIcon, Toggle } from "./dashboard/ui";
import { ItemLocationDialog } from "./dashboard/storage";
import { FishingView } from "./dashboard/fishing-view";
import { PlanningView } from "./dashboard/planning-view";
import { GrowthView, AchievementsView } from "./dashboard/progress-view";
import { DailyBriefView, DailyBriefModal } from "./dashboard/today-view";

export default function Home() {
  const { t, text, locale, gameCatalog, mode: languageMode } = useI18n();
  const { activeView, navigateTo, navigateHistory, navigationAvailability } = useDashboardNavigation();
  const appShellRef = useRef<HTMLElement>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const [progressTabsTop, setProgressTabsTop] = useState(82);
  const [initialMapPreferences] = useState<Record<string, unknown>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(
        window.localStorage.getItem("stardew-tool-map-preferences") ||
          window.localStorage.getItem("aincrad-map-preferences") ||
          "{}",
      );
    } catch {
      return {};
    }
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const hasCenteredFarmRef = useRef(false);
  const [data, setData] = useState<Snapshot | null>(null);
  const [previousDay, setPreviousDay] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<FarmHistory>({
    profileId: "",
    farmName: "Farm",
    entries: [],
  });

  const [showDailyBrief, setShowDailyBrief] = useState(false);
  const [showLiveAlerts, setShowLiveAlerts] = useState(false);
  const [sessionBaseline, setSessionBaseline] = useState<SessionSummary | null>(null);
  const sessionProfileRef = useRef("");
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
  const [layersCollapsed, setLayersCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("stardew-tool-layers-collapsed") === "true",
  );
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 230;
    return Math.max(180, Math.min(420, Number(window.localStorage.getItem("stardew-tool-left-panel-width")) || 230));
  });
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
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 230;
    return Math.max(180, Math.min(420, Number(window.localStorage.getItem("stardew-tool-right-panel-width")) || 230));
  });
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
      if (target?.closest("button, a, summary, input, select, textarea, [role='button']")) {
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
    window.localStorage.setItem(
      "stardew-tool-layers-collapsed",
      String(layersCollapsed),
    );
  }, [layersCollapsed]);
  useEffect(() => {
    window.localStorage.setItem("stardew-tool-left-panel-width", String(leftPanelWidth));
  }, [leftPanelWidth]);
  useEffect(() => {
    window.localStorage.setItem("stardew-tool-right-panel-width", String(rightPanelWidth));
  }, [rightPanelWidth]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [live, setLive] = useState<LiveState>({ active: false });
  const [base, setBase] = useState<HTMLImageElement | null>(null);
  const [sprites, setSprites] = useState<Record<string, HTMLImageElement>>({});
  const [assetError, setAssetError] = useState("");
  const [dataLoadError, setDataLoadError] = useState("");
  const [zoom, setZoom] = useState(() =>
    typeof initialMapPreferences.zoom === "number"
      ? Math.max(0.65, Math.min(2.1, initialMapPreferences.zoom))
      : 1,
  );
  const [hover, setHover] = useState<Tile | null>(null);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [tool, setTool] = useState("inspect");
  const [proposalEditMode, setProposalEditMode] = useState(false);
  const [movingProposalId, setMovingProposalId] = useState<string | null>(null);
  const [proposalMenu, setProposalMenu] = useState<{
    id: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const [proposalUndo, setProposalUndo] = useState<Suggestion[] | null>(null);
  const [showGrid, setShowGrid] = useState(() =>
    typeof initialMapPreferences.showGrid === "boolean"
      ? initialMapPreferences.showGrid
      : false,
  );
  const [showState, setShowState] = useState(() =>
    typeof initialMapPreferences.showState === "boolean"
      ? initialMapPreferences.showState
      : true,
  );
  const [showProduction, setShowProduction] = useState(() =>
    typeof initialMapPreferences.showProduction === "boolean"
      ? initialMapPreferences.showProduction
      : true,
  );
  const [showBlocked, setShowBlocked] = useState(() =>
    typeof initialMapPreferences.showBlocked === "boolean"
      ? initialMapPreferences.showBlocked
      : false,
  );
  const [showSuggestions, setShowSuggestions] = useState(() =>
    typeof initialMapPreferences.showSuggestions === "boolean"
      ? initialMapPreferences.showSuggestions
      : true,
  );
  const [localSuggestions, setLocalSuggestions] = useState<Suggestion[]>([]);
  const [proposalLinks, setProposalLinks] = useState<Record<string, string>>({});
  const [proposalResolutions, setProposalResolutions] = useState<
    Record<string, "resolved">
  >({});
  const [placementError, setPlacementError] = useState("");
  const [mapLocation, setMapLocation] = useState(() =>
    typeof initialMapPreferences.location === "string"
      ? initialMapPreferences.location
      : "farm",
  );

  useEffect(() => {
    fetch("/api/preferences", { cache: "no-store" })
      .then((response) => response.json())
      .then((preferences) => {
        if (Array.isArray(preferences.suggestions))
          setLocalSuggestions(preferences.suggestions);
        if (
          preferences.proposalLinks &&
          typeof preferences.proposalLinks === "object" &&
          !Array.isArray(preferences.proposalLinks)
        )
          setProposalLinks(preferences.proposalLinks);
        if (
          preferences.proposalResolutions &&
          typeof preferences.proposalResolutions === "object" &&
          !Array.isArray(preferences.proposalResolutions)
        )
          setProposalResolutions(preferences.proposalResolutions);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const expectedProfileId = data?.profileId;
    const loadLive = () => {
      if (document.hidden) return Promise.resolve();
      return fetch(`/data/live-state.json?live=${Date.now()}`, {
        cache: "no-store",
      })
        .then((response) => response.json())
        .then((payload: LiveState) => {
          const fresh =
            Boolean(payload.updatedAt) &&
            Date.now() -
              new Date(payload.updatedAt as string | number).getTime() <
              6500;
          setLive((previous) => {
            const next = {
              ...payload,
              active: Boolean(
                payload.active &&
                fresh &&
                expectedProfileId &&
                payload.profileId === expectedProfileId
              ),
            };
            return previous.updatedAt === next.updatedAt &&
              previous.active === next.active &&
              previous.profileId === next.profileId
              ? previous
              : next;
          });
        })
        .catch(() =>
          setLive((previous) =>
            previous.active ? { active: false } : previous,
          ),
        );
    };
    loadLive();
    const timer = window.setInterval(loadLive, 1000);
    return () => window.clearInterval(timer);
  }, [data?.profileId]);

  useEffect(() => {
    window.localStorage.setItem(
      "stardew-tool-map-preferences",
      JSON.stringify({
        zoom,
        location: mapLocation,
        showGrid,
        showState,
        showProduction,
        showBlocked,
        showSuggestions,
      }),
    );
  }, [
    mapLocation,
    showBlocked,
    showGrid,
    showProduction,
    showState,
    showSuggestions,
    zoom,
  ]);

  useEffect(() => {
    let loadingLatest = false;
    const loadLatest = () => {
      if (document.hidden || loadingLatest) return Promise.resolve();
      loadingLatest = true;
      return Promise.all([
        fetch(`/data/farm-state.json?save=${Date.now()}`, {
          cache: "no-store",
        }).then((r) => {
          if (!r.ok) throw new Error(`Farm data returned ${r.status}`);
          return r.json();
        }),
        fetch(`/data/farm-history.json?save=${Date.now()}`, {
          cache: "no-store",
        }).then((r) => {
          if (!r.ok) throw new Error(`Farm history returned ${r.status}`);
          return r.json();
        }),
      ])
        .then(([snapshot, farmHistory]: [Snapshot, FarmHistory]) => {
          snapshot = localizeSnapshotGameNames(snapshot, t, gameCatalog);
          const profileId = snapshot.profileId || "default";
          if (farmHistory.profileId !== profileId) return;
          const sessionStorageKey = `stardew-tool-last-session-${profileId}`;
          if (sessionProfileRef.current !== profileId) {
            sessionProfileRef.current = profileId;
            setPreviousDay(null);
            setLive({ active: false, profileId });
            try {
              const saved = JSON.parse(
                window.localStorage.getItem(sessionStorageKey) || "null",
              );
              setSessionBaseline(
                saved && saved.profileId === profileId ? saved : null,
              );
            } catch {
              setSessionBaseline(null);
            }
          }
          setData((previous) =>
            previous && JSON.stringify(previous) === JSON.stringify(snapshot)
              ? previous
              : snapshot,
          );
          setHistory((previous) =>
            previous && JSON.stringify(previous) === JSON.stringify(farmHistory)
              ? previous
              : farmHistory,
          );
          setDataLoadError("");
          setLastRefresh(new Date());
        })
        .catch((error) =>
          setDataLoadError(
            error instanceof Error
              ? error.message
              : t("error.farmDataLoad"),
          ),
        )
        .finally(() => {
          loadingLatest = false;
        });
    };
    loadLatest();
    const refreshTimer = window.setInterval(loadLatest, 5000);
    Object.entries(spritePaths).forEach(([name, path]) => {
      const asset = new Image();
      let settled = false;
      const finish = (loaded: HTMLImageElement | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (loaded) setSprites((previous) => ({ ...previous, [name]: loaded }));
      };
      const timeout = window.setTimeout(() => finish(null), 8000);
      asset.onload = () => finish(asset);
      asset.onerror = () => finish(null);
      asset.src = path;
    });
    return () => window.clearInterval(refreshTimer);
  }, [t, gameCatalog]);

  useEffect(() => {
    const path = data?.locationMaps?.Farm?.background;
    if (!path) return;
    const image = new Image();
    image.src = path;
    image.onload = () => {
      setBase(image);
      setAssetError("");
    };
    image.onerror = () =>
      setAssetError(
        t("error.farmBackground"),
      );
  }, [data?.locationMaps?.Farm?.background, t]);

  useEffect(() => {
    if (!data || !sessionProfileRef.current) return;
    window.localStorage.setItem(
      `stardew-tool-last-session-${sessionProfileRef.current}`,
      JSON.stringify(sessionSummary(data, live)),
    );
  }, [data, live]);

  useEffect(() => {
    if (!data || history.profileId !== data.profileId) {
      const frame = window.requestAnimationFrame(() => setPreviousDay(null));
      return () => window.cancelAnimationFrame(frame);
    }
    const previous = history.entries
      .filter((entry) => entry.dayIndex < data.dayIndex)
      .at(-1);
    if (!previous) {
      const frame = window.requestAnimationFrame(() => setPreviousDay(null));
      return () => window.cancelAnimationFrame(frame);
    }
    const expectedProfileId = data.profileId;
    fetch(`/data/days/${data.profileId || "default"}--${previous.dateKey}.json?save=${Date.now()}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((snapshot) =>
        setPreviousDay(
          snapshot && snapshot.profileId === expectedProfileId
            ? localizeSnapshotGameNames(
                { ...snapshot, seasonLabel: seasonName(snapshot.season) },
                t,
                gameCatalog,
              )
            : null,
        ),
      )
      .catch(() => setPreviousDay(null));
  }, [data, gameCatalog, history, t]);

  useEffect(() => {
    if (!data || mapLocation === "farm") return;
    if (!data.interiors.some((interior) => interior.id === mapLocation)) {
      const frame = window.requestAnimationFrame(() => setMapLocation("farm"));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [data, mapLocation]);

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

  const persist = (next: Suggestion[], remember = true) => {
    if (remember) setProposalUndo(localSuggestions);
    setLocalSuggestions(next);
    fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suggestions: next }),
    }).catch(() => undefined);
  };

  const persistProposalLinks = (next: Record<string, string>) => {
    setProposalLinks(next);
    fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalLinks: next }),
    }).catch(() => undefined);
  };

  const persistProposalResolutions = (next: Record<string, "resolved">) => {
    setProposalResolutions(next);
    fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalResolutions: next }),
    }).catch(() => undefined);
  };

  const mapData = useMemo(() => {
    if (!data || !live.active || !live.farmMap) return data;
    const savedTerrain = new Map(
      data.terrain.map((feature) => [tileKey(feature.x, feature.y), feature]),
    );
    const terrain = live.farmMap.terrain.map((feature) => {
      const saved = savedTerrain.get(tileKey(feature.x, feature.y));
      if (!saved)
        return {
          x: feature.x,
          y: feature.y,
          kind: feature.kind,
          watered: feature.watered,
        } as Terrain;
      if (feature.kind === "HoeDirt" && !feature.hasCrop) {
        const soil = { ...saved };
        delete soil.crop;
        delete soil.phase;
        delete soil.cropRow;
        return { ...soil, watered: feature.watered };
      }
      return { ...saved, watered: feature.watered };
    });
    return {
      ...data,
      terrain,
      objects: live.farmMap.objects,
      buildings: live.farmMap.buildings,
    };
  }, [data, live.active, live.farmMap]);

  const proposalStates = useMemo(
    () =>
      mapData
        ? reconcileProposals(
            [...mapData.suggestions, ...localSuggestions],
            mapData.buildings,
            proposalLinks,
            proposalResolutions,
          )
        : [],
    [localSuggestions, mapData, proposalLinks, proposalResolutions],
  );

  const centerOnFarmhouse = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const viewport = mapViewportRef.current;
      const farmhouse = mapData?.buildings.find(
        (building) => buildingType(building) === "farmhouse",
      );
      if (!viewport || !farmhouse) return;
      const centerX = (farmhouse.x + farmhouse.width / 2) * TILE * zoom;
      const centerY = (farmhouse.y + farmhouse.height / 2) * TILE * zoom;
      viewport.scrollTo({
        left: Math.max(0, centerX - viewport.clientWidth / 2),
        top: Math.max(0, centerY - viewport.clientHeight / 2),
        behavior,
      });
    },
    [mapData, zoom],
  );

  useEffect(() => {
    if (activeView !== "map" || mapLocation !== "farm") return;
    if (hasCenteredFarmRef.current) return;
    if (
      !mapData ||
      !mapViewportRef.current ||
      !mapData.buildings.some(
        (building) => buildingType(building) === "farmhouse",
      )
    )
      return;
    hasCenteredFarmRef.current = true;
    const frame = window.requestAnimationFrame(() => centerOnFarmhouse("auto"));
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, centerOnFarmhouse, mapData, mapLocation]);

  const validatePlacement = (point: Tile, width: number, height: number) => {
    if (!mapData) return t("map.error.unavailable");
    const cells = Array.from({ length: width * height }, (_, index) => ({
      x: point.x + (index % width),
      y: point.y + Math.floor(index / width),
    }));
    if (
      cells.some(
        (cell) =>
          cell.x < 0 ||
          cell.y < 0 ||
          cell.x >= mapData.map.width ||
          cell.y >= mapData.map.height,
      )
    )
      return t("map.error.outsideFarm");
    if (
      cells.some((cell) =>
        mapData.map.blocked.some(([x, y]) => x === cell.x && y === cell.y),
      )
    )
      return t("map.error.nonBuildable");
    if (
      cells.some((cell) =>
        mapData.buildings.some(
          (building) =>
            cell.x >= building.x &&
            cell.x < building.x + building.width &&
            cell.y >= building.y &&
            cell.y < building.y + building.height,
        ),
      )
    )
      return t("map.error.existingBuilding");
    if (
      cells.some((cell) =>
        mapData.objects.some(
          (object) => {
            if (object.x !== cell.x || object.y !== cell.y) return false;
            if (object.kind === "Litter" || object.name === "Artifact Spot")
              return false;
            return !mapData.terrain.some(
              (feature) =>
                feature.x === object.x &&
                feature.y === object.y &&
                ["Tree", "FruitTree"].includes(feature.kind),
            );
          },
        ),
      )
    )
      return t("map.error.placedObject");
    if (
      cells.some((cell) =>
        proposalStates.some(
          (proposal) =>
            proposal.status === "pending" &&
            cell.x >= proposal.x &&
            cell.x < proposal.x + proposal.width &&
            cell.y >= proposal.y &&
            cell.y < proposal.y + proposal.height,
        ),
      )
    )
      return t("map.error.pendingProposal");
    return "";
  };

  const draw = useFarmCanvas({ canvasRef, base, hover, mapData, localSuggestions, movingProposalId, proposalEditMode, proposalStates, showBlocked, showGrid, showProduction, showState, showSuggestions, sprites, tool, activeView, mapLocation });

  const pointFromEvent = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * 80),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * 65),
    };
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setProposalMenu(null);
    const point = pointFromEvent(event);
    setSelected(point);
    if (movingProposalId) {
      const moving = localSuggestions.find((item) => item.id === movingProposalId);
      if (!moving) return setMovingProposalId(null);
      const invalid = validatePlacement(point, moving.width, moving.height);
      if (invalid) return setPlacementError(invalid);
      persist(localSuggestions.map((item) =>
        item.id === movingProposalId ? { ...item, x: point.x, y: point.y } : item,
      ));
      setMovingProposalId(null);
      setPlacementError("");
      return;
    }
    if (proposalEditMode && tool !== "inspect") {
      const active = tools.find((item) => item.id === tool)!;
      const invalid = validatePlacement(point, active.width, active.height);
      if (invalid) {
        setPlacementError(invalid);
        return;
      }
      setPlacementError("");
      persist([
        ...localSuggestions,
        {
          id: `${tool}-${Date.now()}`,
          kind: tool,
          name: `Proposed ${active.label}`,
          x: point.x,
          y: point.y,
          width: active.width,
          height: active.height,
          color: "#ffcf5c",
        },
      ]);
      setTool("inspect");
    }
  };

  const openProposalMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = pointFromEvent(event);
    const proposal = [...localSuggestions].reverse().find(
      (item) =>
        point.x >= item.x &&
        point.x < item.x + item.width &&
        point.y >= item.y &&
        point.y < item.y + item.height,
    );
    if (!proposal) {
      setProposalMenu(null);
      return;
    }
    setProposalMenu({
      id: proposal.id,
      name: proposal.name.replace(/^(Proposed|Future|Optional) /, ""),
      x: event.clientX,
      y: event.clientY,
    });
  };

  useEffect(() => {
    if (!proposalMenu) return;
    const close = () => setProposalMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [proposalMenu]);

  const beginPanelResize = (
    side: "left" | "right",
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const resize = (pointer: PointerEvent) => {
      const bounds = workspace.getBoundingClientRect();
      const width = side === "left"
        ? pointer.clientX - bounds.left
        : bounds.right - pointer.clientX;
      const next = Math.max(180, Math.min(420, Math.round(width)));
      if (side === "left") setLeftPanelWidth(next);
      else setRightPanelWidth(next);
    };
    const finish = () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", finish, { once: true });
  };

  const details = (() => {
    if (!mapData || !selected) return [];
    const key = tileKey(selected.x, selected.y);
    const result: string[] = [];
    const feature = mapData.terrain.find((t) => tileKey(t.x, t.y) === key);
    if (feature) result.push(localizedTerrainFeature(feature, t));
    const object = mapData.objects.find((o) => tileKey(o.x, o.y) === key);
    if (object)
      result.push(
        object.ready
          ? t("map.objectReady", { machine: object.displayName || object.name, output: object.output || t("map.collect") })
          : object.processing
            ? t("map.objectProcessing", { machine: object.displayName || object.name, output: object.output || t("map.product"), days: object.readyInDays || 0 })
            : object.displayName || object.name,
      );
    const building = mapData.buildings.find(
      (b) =>
        selected.x >= b.x &&
        selected.x < b.x + b.width &&
        selected.y >= b.y &&
        selected.y < b.y + b.height,
    );
    if (building) result.push(buildingDisplayName(building.name, t));
    if (
      mapData.map.blocked.some(([x, y]) => x === selected.x && y === selected.y)
    )
      result.push(t("map.nonBuildableTerrain"));
    return result.length ? result : [t("map.emptyTile")];
  })();

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

  const selectedInterior = data.interiors?.find(
    (item) => item.id === mapLocation,
  );
  const visibleObjects = selectedInterior
    ? selectedInterior.objects
    : mapData!.objects;
  const treeCount = mapData!.terrain.filter((t) => t.kind === "Tree").length;
  const cropCount = mapData!.terrain.filter(
    (t) => t.kind === "HoeDirt" && t.crop,
  ).length;
  const readyMachines = visibleObjects.filter((item) => item.ready);
  const processingMachines = visibleObjects.filter((item) => item.processing);
  const selectedInteriorDetails =
    selectedInterior && selected
      ? [
          ...selectedInterior.objects
            .filter((item) => item.x === selected.x && item.y === selected.y)
            .map((item) =>
              item.ready
                ? t("map.objectReady", { machine: item.displayName || item.name, output: item.output || t("map.collect") })
                : item.processing
                  ? t("map.objectProcessing", { machine: item.displayName || item.name, output: item.output || t("map.product"), days: item.readyInDays || 0 })
                  : item.displayName || item.name,
            ),
          ...selectedInterior.furniture
            .filter((item) => item.x === selected.x && item.y === selected.y)
            .map((item) => item.name),
        ]
      : [];

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
              window.requestAnimationFrame(() =>
                window.requestAnimationFrame(draw),
              );
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
      {showAppSearch && (
        <div className="app-search-backdrop" onPointerDown={() => setShowAppSearch(false)}>
          <section
            className="app-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("web.home.searchTheCompanion")}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">{t("web.home.jumpToAnything")}</p>
                <h2>{t("web.home.searchTheCompanion")}</h2>
              </div>
              <kbd>{t("web.home.esc")}</kbd>
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
          </section>
        </div>
      )}
      {releaseNotes && (
        <div className="help-backdrop" onPointerDown={closeReleaseNotes}>
          <section
            className="help-dialog release-notes-dialog"
            role="dialog"
            aria-modal="true"
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
          </section>
        </div>
      )}
      {showHelp && (
        <div className="help-backdrop" onPointerDown={() => setShowHelp(false)}>
          <section
            className="help-dialog"
            role="dialog"
            aria-modal="true"
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
          </section>
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

      <section
        ref={workspaceRef}
        className={`workspace ${layersCollapsed ? "layers-collapsed" : ""} ${activeView === "map" ? "" : "view-hidden"}`}
        style={{
          "--left-panel-width": `${leftPanelWidth}px`,
          "--right-panel-width": `${rightPanelWidth}px`,
        } as Record<string, string>}
        aria-hidden={activeView !== "map"}
      >
        <aside className="panel left-panel">
          <button
            className="layers-collapse"
            onClick={() => setLayersCollapsed((value) => !value)}
            aria-expanded={!layersCollapsed}
            title={layersCollapsed ? t("map.openLayers") : t("map.collapseLayers")}
          >
            {layersCollapsed ? "›" : "‹"}
            <span>{t("web.home.layers")}</span>
          </button>
          <div className="layers-content">
            <p className="eyebrow">{t("web.home.layers")}</p>
            <h2>{t("web.home.whatToDisplay")}</h2>
            <Toggle
              label={t("map.dailyState")}
              hint={t("map.objectCount", { count: visibleObjects.length })}
              checked={showState}
              onChange={setShowState}
              color="#6b8f43"
            />
            <Toggle
              label={t("web.home.processing")}
              hint={t("map.productionCount", { ready: readyMachines.length, working: processingMachines.length })}
              checked={showProduction}
              onChange={setShowProduction}
              color="#e5a83e"
            />
            {!selectedInterior && (
              <Toggle
                label={t("map.proposals")}
                hint={t("map.proposalCount", { pending: proposalStates.filter((item) => item.status === "pending").length, building: proposalStates.filter((item) => item.status === "building").length })}
                checked={showSuggestions}
                onChange={setShowSuggestions}
                color="#ffcf5c"
              />
            )}
            <Toggle
              label={t("map.grid")}
              hint={
                selectedInterior
                  ? t("map.tileDimensions", { width: selectedInterior.width, height: selectedInterior.height })
                  : t("map.tileDimensions", { width: 80, height: 65 })
              }
              checked={showGrid}
              onChange={setShowGrid}
              color="#e8dcc4"
            />
            {!selectedInterior && (
              <Toggle
                label={t("map.nonBuildable")}
                hint={t("map.edgesAndWater")}
                checked={showBlocked}
                onChange={setShowBlocked}
                color="#6f496d"
              />
            )}

            {!selectedInterior && (
              <>
                <div className="divider" />
                <button
                  type="button"
                  className={`proposal-edit-toggle ${proposalEditMode ? "active" : ""}`}
                  onClick={() => {
                    setProposalEditMode((value) => !value);
                    setTool("inspect");
                    setMovingProposalId(null);
                  }}
                >
                  {proposalEditMode ? t("map.finishEditing") : t("map.editProposals")}
                </button>
                {proposalEditMode && <>
                <p className="eyebrow">{t("web.home.buildingPalette")}</p>
                <div className="tool-grid proposal-palette">
                  {tools.map((item) => (
                    <button
                      key={item.id}
                      className={tool === item.id ? "tool active" : "tool"}
                      onClick={() => setTool(item.id)}
                    >
                      {item.id !== "inspect" && item.id !== "marker" && spritePaths[item.label] ? (
                        <BuildingPreview name={item.label} />
                      ) : (
                        <span className="tool-preview-placeholder" aria-hidden="true">{item.id === "inspect" ? "⌖" : "+"}</span>
                      )}
                      <span>{t(`map.tool.${item.id}`)}<small>{item.width}×{item.height}</small></span>
                    </button>
                  ))}
                </div>
                <p className="proposal-save-note">{t("web.home.chooseAFootprintAndClickTheMapSelectMove")}</p>
                {proposalUndo && (
                  <button className="clear" onClick={() => {
                    const previous = proposalUndo;
                    setProposalUndo(localSuggestions);
                    persist(previous, false);
                  }}>{t("web.home.undoLastProposalChange")}</button>
                )}
                {localSuggestions.length > 0 && (
                  <button className="clear" onClick={() => persist([])}>{t("web.home.clearMyDrawings")}</button>
                )}
                </>}
              </>
            )}
          </div>
        </aside>

        <div
          className="column-resizer left-column-resizer"
          role="separator"
          aria-label={t("web.home.resizeLayersColumn")}
          aria-orientation="vertical"
          onPointerDown={(event) => beginPanelResize("left", event)}
        />

        <section className="map-column">
          <div className="map-toolbar">
            <div className="location-picker">
              <label htmlFor="map-location">{t("storage.view")}</label>
              <select
                id="map-location"
                value={mapLocation}
                onChange={(event) => {
                  setMapLocation(event.target.value);
                  setSelected(null);
                  setPlacementError("");
                }}
              >
                <option value="farm">{t("web.home.farmExterior")}</option>
                {(data.interiors || []).map((interior) => (
                  <option key={interior.id} value={interior.id}>
                    {localizedInteriorName(interior, t)}
                  </option>
                ))}
              </select>
              <span className="crumb">{t("web.home.day")}{data.day}</span>
            </div>
            <div className="map-actions">
              {mapLocation === "farm" && (
                <button
                  className="home-button"
                  onClick={() => centerOnFarmhouse("smooth")}
                  title={t("web.home.centerTheMapOnTheFarmhouse")}
                >{t("web.home.home")}</button>
              )}
              <div className="zoom-control">
                <button onClick={() => setZoom(Math.max(0.65, zoom - 0.15))}>
                  −
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(Math.min(2.1, zoom + 0.15))}>
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="map-viewport" ref={mapViewportRef}>
            {mapLocation === "farm" ? (
              <canvas
                ref={canvasRef}
                width={1280}
                height={1040}
                style={{
                  width: `${1280 * zoom}px`,
                  height: `${1040 * zoom}px`,
                }}
                onMouseMove={(e) => setHover(pointFromEvent(e))}
                onMouseLeave={() => setHover(null)}
                onClick={handleClick}
                onContextMenu={openProposalMenu}
              />
            ) : selectedInterior ? (
              <InteriorView
                interior={selectedInterior}
                zoom={zoom}
                showState={showState}
                showProduction={showProduction}
                showGrid={showGrid}
                sprites={sprites}
                selected={selected}
                onSelect={setSelected}
              />
            ) : null}
            <div className="map-legend">
              <span>
                <i className="current" />
                {live.active && live.farmMap ? t("status.live") : t("map.lastSave")}
              </span>
              {mapLocation === "farm" && (
                <span>
                  <i className="proposal" />{t("web.home.proposal")}</span>
              )}
              <span>
                <i className="ready" />{t("web.home.ready")}</span>
              <span>
                <i className="working" />{t("web.home.processing")}</span>
            </div>
            {proposalMenu && (
              <div
                className="proposal-context-menu"
                role="menu"
                tabIndex={-1}
                style={{ left: proposalMenu.x, top: proposalMenu.y }}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setProposalMenu(null);
                }}
              >
                <strong>{proposalMenu.name}</strong>
                <button
                  type="button"
                  onClick={() => {
                    persist(localSuggestions.filter((item) => item.id !== proposalMenu.id));
                    setProposalMenu(null);
                  }}
                >{t("web.home.deleteProposal")}</button>
              </div>
            )}
          </div>
          <div className="tile-strip">
            <div>
              <span>
                {mapLocation === "farm"
                  ? t("storage.tile")
                  : selectedInterior?.label || t("map.interior")}
              </span>
              <strong>{selected ? `${selected.x}, ${selected.y}` : "—"}</strong>
            </div>
            <p className={placementError ? "placement-error" : ""}>
              {mapLocation === "farm"
                ? placementError ||
                  (selected
                    ? details.join(" · ")
                    : t("map.clickPoint"))
                : selected
                  ? selectedInteriorDetails.join(" · ") || t("map.emptyInteriorTile")
                  : t("map.clickInteriorTile")}
            </p>
          </div>
        </section>

        <div
          className="column-resizer right-column-resizer"
          role="separator"
          aria-label={t("web.home.resizeAtAGlanceColumn")}
          aria-orientation="vertical"
          onPointerDown={(event) => beginPanelResize("right", event)}
        />

        <aside className="panel right-panel">
          <p className="eyebrow">{t("web.home.atAGlance")}</p>
          <h2>
            {selectedInterior ? selectedInterior.label : t("map.day", { day: data.day })}
          </h2>
          {selectedInterior ? (
            <>
              <div className="stat">
                <span>{t("web.home.objects")}</span>
                <strong>{selectedInterior.objects.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.furniture")}</span>
                <strong>{selectedInterior.furniture.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.ready")}</span>
                <strong>{readyMachines.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.processing")}</span>
                <strong>{processingMachines.length}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="stat">
                <span>{t("web.home.trees")}</span>
                <strong>{treeCount}</strong>
              </div>
              <div className="stat">
                <span>{t("planning.crops")}</span>
                <strong>{cropCount}</strong>
              </div>
              <div className="stat">
                <span>{t("planning.buildings")}</span>
                <strong>{mapData!.buildings.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.money")}</span>
                <strong>{data.money.toLocaleString(locale)}g</strong>
              </div>
              {(data.grandpa.actualCandles || 0) > 0 && (
                <div className="stat">
                  <span>{t("web.home.grandpasShrine")}</span>
                  <strong>{data.grandpa.actualCandles}{t("web.home.candles")}</strong>
                </div>
              )}
            </>
          )}
          <div className="production-summary">
            <span className="eyebrow">{t("web.home.readyToCollect")}</span>
            {readyMachines.length ? (
              readyMachines.map((item, index) => (
                <div
                  className="machine-row ready-machine"
                  key={`${item.x}-${item.y}-${index}`}
                >
                  <strong>{item.output || item.name}</strong>
                  <small>
                    {item.displayName || item.name}{t("web.home.tile")}{item.x}, {item.y})
                  </small>
                </div>
              ))
            ) : (
              <p>{t("web.home.nothingIsReadyInTheCurrentReading")}</p>
            )}
            {processingMachines.length > 0 && (
              <span className="eyebrow production-working-title">{t("web.home.processing")}</span>
            )}
            {processingMachines.slice(0, 8).map((item, index) => (
              <div className="machine-row" key={`${item.x}-${item.y}-${index}`}>
                <strong>{item.output || item.name}</strong>
                <small>
                  {t("map.machineReadyIn", { machine: item.displayName || item.name, days: item.readyInDays || 0 })}
                </small>
              </div>
            ))}
          </div>
          {!selectedInterior && (
            <div className="proposal-list">
              {proposalStates.map((proposal) => {
                const alternatives = mapData!.buildings.filter(
                  (building) =>
                    buildingType(building) === buildingType(proposal) &&
                    (building.x !== proposal.x || building.y !== proposal.y),
                );
                return (
                  <div
                    className={`callout ${proposal.status}`}
                    key={proposal.id}
                  >
                    <span>
                      {proposal.status === "pending"
                        ? t("map.proposal.pending")
                        : proposal.status === "building"
                          ? t("map.proposal.building")
                          : proposal.status === "resolved"
                            ? t("map.proposal.resolved")
                            : t("map.proposal.completed")}
                    </span>
                    <strong>{t(`map.tool.${proposal.kind}`)}</strong>
                    <p>
                      {proposal.status === "building"
                        ? t("map.proposal.robinWorking", { x: proposal.actual?.x || 0, y: proposal.actual?.y || 0, days: proposal.actual?.daysOfConstructionLeft || 0 })
                        : proposal.status === "resolved"
                          ? t("map.proposal.manuallyResolved")
                          : proposal.status === "completed"
                            ? proposal.matchedBy === "manual"
                            ? t("map.proposal.completedElsewhere", { building: buildingDisplayName(proposal.actual?.name || "", t), x: proposal.actual?.x || 0, y: proposal.actual?.y || 0 })
                            : t("map.proposal.detectedAtTiles")
                          : t("map.proposal.position", { x: proposal.x, y: proposal.y, width: proposal.width, height: proposal.height })}
                    </p>
                    {proposalEditMode && proposal.status === "pending" && (
                      <div className="proposal-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setMovingProposalId(proposal.id);
                            setTool("inspect");
                            setPlacementError(t("map.proposal.chooseNewPosition"));
                          }}
                        >{t("web.home.move")}</button>
                        <button
                          type="button"
                          onClick={() =>
                            persist(localSuggestions.filter((item) => item.id !== proposal.id))
                          }
                        >{t("web.home.delete")}</button>
                        <button
                          type="button"
                          onClick={() =>
                            persistProposalResolutions({
                              ...proposalResolutions,
                              [proposal.id]: "resolved",
                            })
                          }
                        >{t("web.home.markPlanDone")}</button>
                      </div>
                    )}
                    {proposal.status === "resolved" && proposalEditMode && (
                      <button
                        className="proposal-reopen"
                        onClick={() => {
                          const next = { ...proposalResolutions };
                          delete next[proposal.id];
                          persistProposalResolutions(next);
                        }}
                      >{t("web.home.reopenPlan")}</button>
                    )}
                    {proposal.status === "pending" &&
                      alternatives.length > 0 && (
                        <div className="proposal-match">
                          <small>{t("web.home.alreadyBuiltElsewhere")}</small>
                          {alternatives.map((building) => (
                            <button
                              key={buildingSignature(building)}
                              onClick={() =>
                                persistProposalLinks({
                                  ...proposalLinks,
                                  [proposal.id]: buildingSignature(building),
                                })
                              }
                            >{t("web.home.use")}{buildingDisplayName(building.name, t)}{t("web.home.at")}{building.x}, {building.y}
                              )
                            </button>
                          ))}
                        </div>
                      )}
                    {proposal.matchedBy === "manual" && (
                      <button
                        className="proposal-reopen"
                        onClick={() => {
                          const next = { ...proposalLinks };
                          delete next[proposal.id];
                          persistProposalLinks(next);
                        }}
                      >{t("web.home.reopenProposal")}</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="fine-print">{t("web.home.thisViewOnlyReadsACopyOfTheSave")}{" "}
            {selectedInterior
              ? t("map.interiorReadOnlyNote")
              : t("map.drawingsReadOnlyNote")}
          </p>
        </aside>
      </section>
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
