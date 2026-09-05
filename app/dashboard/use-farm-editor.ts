"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "../i18n";
import type { Snapshot, LiveState, Tile, Suggestion } from "./snapshot-types";
import type { ActiveView } from "./ui-types";
import { reconcileProposals, buildingType, validateFarmPlacement, mergeLiveTerrain } from "./farm-model";
import { tileKey, TILE, tools } from "./farm-rendering";

export function useFarmEditor(data: Snapshot | null, live: LiveState, activeView: ActiveView) {
  const { t } = useI18n();
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

  const mapViewportRef = useRef<HTMLDivElement>(null);

  const hasCenteredFarmRef = useRef(false);

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
    if (!data || mapLocation === "farm") return;
    if (!data.interiors.some((interior) => interior.id === mapLocation)) {
      const frame = window.requestAnimationFrame(() => setMapLocation("farm"));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [data, mapLocation]);

  const persist = useCallback((next: Suggestion[], remember = true) => {
    if (remember) setProposalUndo(localSuggestions);
    setLocalSuggestions(next);
    fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suggestions: next }),
    }).catch(() => undefined);
  }, [localSuggestions]);

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
    const terrain = live.farmMap.terrain.map((feature) =>
      mergeLiveTerrain(savedTerrain.get(tileKey(feature.x, feature.y)), feature),
    );
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

  const validatePlacement = useCallback((point: Tile, width: number, height: number) =>
    validateFarmPlacement(mapData, proposalStates, point, width, height, t), [mapData, proposalStates, t]);

  const pointFromEvent = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * 80),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * 65),
    };
  }, []);

  const openProposalMenu = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
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
  }, [localSuggestions, pointFromEvent]);


  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
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
    if (!proposalEditMode || tool === "inspect") {
      openProposalMenu(event);
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
  }, [localSuggestions, movingProposalId, openProposalMenu, persist, proposalEditMode, tool, validatePlacement, pointFromEvent]);


  useEffect(() => {
    if (!proposalMenu) return;
    const close = () => setProposalMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [proposalMenu]);

  return { hover, movingProposalId, mapData, selected, mapLocation, showState, setShowState, showProduction, setShowProduction, proposalStates, showSuggestions, setShowSuggestions, showGrid, setShowGrid, showBlocked, setShowBlocked, proposalEditMode, setProposalEditMode, setTool, setMovingProposalId, tool, proposalUndo, setProposalUndo, localSuggestions, persist, setMapLocation, setSelected, setPlacementError, centerOnFarmhouse, setZoom, zoom, mapViewportRef, canvasRef, setHover, pointFromEvent, handleClick, openProposalMenu, proposalMenu, setProposalMenu, placementError, persistProposalResolutions, proposalResolutions, persistProposalLinks, proposalLinks };
}
