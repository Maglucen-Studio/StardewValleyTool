"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveView, AppNavigationTarget, DesktopUpdates } from "./ui-types";

export function useDashboardNavigation() {
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window === "undefined") return "map";
    const saved =
      window.localStorage.getItem("stardew-tool-active-view") ||
      window.localStorage.getItem("aincrad-active-view");
    return saved === "map" ||
      saved === "growth" ||
      saved === "achievements" ||
      saved === "farm" ||
      saved === "agenda" ||
      saved === "fishing" ||
      saved === "planning"
      ? saved
      : "map";
  });

  const activeViewRef = useRef(activeView);

  const navigationBackRef = useRef<AppNavigationTarget[]>([]);

  const navigationForwardRef = useRef<AppNavigationTarget[]>([]);

  const lastHardwareNavigationRef = useRef({ direction: "", at: 0 });

  const [navigationAvailability, setNavigationAvailability] = useState({ back: false, forward: false });

  const currentNavigationTarget = useCallback((): AppNavigationTarget => {
    const view = activeViewRef.current;
    if (view === "farm")
      return { view, section: window.localStorage.getItem("stardew-tool-farm-section") || "crops" };
    if (view === "planning")
      return { view, section: window.localStorage.getItem("stardew-tool-plan-section") || "community" };
    return { view };
  }, []);

  const applyNavigationTarget = useCallback((target: AppNavigationTarget) => {
    activeViewRef.current = target.view;
    if (target.view === "growth" || target.view === "achievements")
      window.localStorage.setItem("stardew-tool-progress-section", target.view);
    if ((target.view === "farm" || target.view === "planning") && target.section) {
      const mode = target.view === "farm" ? "farm" : "plan";
      window.localStorage.setItem(`stardew-tool-${mode}-section`, target.section);
      window.dispatchEvent(new CustomEvent("stardew:open-planning-section", {
        detail: { mode, section: target.section },
      }));
    }
    setActiveView(target.view);
  }, []);

  const navigateTo = useCallback((target: AppNavigationTarget) => {
    const current = currentNavigationTarget();
    if (current.view === target.view && current.section === target.section) return;
    navigationBackRef.current.push(current);
    navigationForwardRef.current = [];
    applyNavigationTarget(target);
    setNavigationAvailability({ back: true, forward: false });
  }, [applyNavigationTarget, currentNavigationTarget]);

  const navigateHistory = useCallback((direction: "back" | "forward") => {
    const source = direction === "back" ? navigationBackRef : navigationForwardRef;
    const destination = direction === "back" ? navigationForwardRef : navigationBackRef;
    const target = source.current.pop();
    if (!target) return;
    destination.current.push(currentNavigationTarget());
    applyNavigationTarget(target);
    setNavigationAvailability({
      back: navigationBackRef.current.length > 0,
      forward: navigationForwardRef.current.length > 0,
    });
  }, [applyNavigationTarget, currentNavigationTarget]);

  const navigateHardwareHistory = useCallback((direction: "back" | "forward") => {
    const now = performance.now();
    const previous = lastHardwareNavigationRef.current;
    if (previous.direction === direction && now - previous.at < 120) return;
    lastHardwareNavigationRef.current = { direction, at: now };
    navigateHistory(direction);
  }, [navigateHistory]);

  useEffect(() => {
    window.localStorage.setItem("stardew-tool-active-view", activeView);
  }, [activeView]);

  useEffect(() => {
    const desktop = (window as Window & { stardewDesktop?: DesktopUpdates })
      .stardewDesktop;
    return desktop?.onNavigateHistory?.(navigateHardwareHistory);
  }, [navigateHardwareHistory]);

  useEffect(() => {
    const mouseHistoryShortcut = (event: MouseEvent) => {
      if (event.button !== 3 && event.button !== 4) return;
      event.preventDefault();
      navigateHardwareHistory(event.button === 3 ? "back" : "forward");
    };
    const preventNativeHistory = (event: MouseEvent) => {
      if (event.button === 3 || event.button === 4) event.preventDefault();
    };
    window.addEventListener("mousedown", mouseHistoryShortcut, true);
    window.addEventListener("auxclick", preventNativeHistory, true);
    return () => {
      window.removeEventListener("mousedown", mouseHistoryShortcut, true);
      window.removeEventListener("auxclick", preventNativeHistory, true);
    };
  }, [navigateHardwareHistory]);

  useEffect(() => {
    const historyShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      navigateHistory(event.key === "ArrowLeft" ? "back" : "forward");
    };
    window.addEventListener("keydown", historyShortcut);
    return () => window.removeEventListener("keydown", historyShortcut);
  }, [navigateHistory]);
  return { activeView, navigateTo, navigateHistory, navigationAvailability };
}
