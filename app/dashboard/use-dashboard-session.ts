"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { Snapshot, LiveState } from "./snapshot-types";
import type { FarmHistory, SessionSummary } from "./ui-types";
import { localizeSnapshotGameNames } from "./game-names";
import { seasonName } from "./formatting";
import { sessionSummary } from "./selectors";

export function useDashboardSession() {
  const { t, gameCatalog } = useI18n();
  const [data, setData] = useState<Snapshot | null>(null);
  const [previousDay, setPreviousDay] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<FarmHistory>({
    profileId: "",
    farmName: "Farm",
    entries: [],
  });
  const [sessionBaseline, setSessionBaseline] = useState<SessionSummary | null>(null);
  const sessionProfileRef = useRef("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [live, setLive] = useState<LiveState>({ active: false });
  const [dataLoadError, setDataLoadError] = useState("");
  useEffect(() => {
    let disposed = false;
    let loading = false;
    const expectedProfileId = data?.profileId;
    const loadLive = () => {
      if (document.hidden || loading) return Promise.resolve();
      loading = true;
      return fetch(`/data/live-state.json?live=${Date.now()}`, {
        cache: "no-store",
      })
        .then((response) => response.json())
        .then((payload: LiveState) => {
          if (disposed) return;
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
          !disposed && setLive((previous) =>
            previous.active ? { active: false } : previous,
          ),
        ).finally(() => { loading = false; });
    };
    loadLive();
    const timer = window.setInterval(loadLive, 1000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [data?.profileId]);

  useEffect(() => {
    let disposed = false;
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
          if (disposed) return;
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
          !disposed && setDataLoadError(
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
    return () => { disposed = true; window.clearInterval(refreshTimer); };
  }, [t, gameCatalog]);

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
    let disposed = false;
    fetch(`/data/days/${data.profileId || "default"}--${previous.dateKey}.json?save=${Date.now()}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((snapshot) =>
        !disposed && setPreviousDay(
          snapshot && snapshot.profileId === expectedProfileId
            ? localizeSnapshotGameNames(
                { ...snapshot, seasonLabel: seasonName(snapshot.season) },
                t,
                gameCatalog,
              )
            : null,
        ),
      )
      .catch(() => { if (!disposed) setPreviousDay(null); });
    return () => { disposed = true; };
  }, [data, gameCatalog, history, t]);

  return { data, previousDay, history, sessionBaseline, live, lastRefresh, dataLoadError, setDataLoadError };
}
