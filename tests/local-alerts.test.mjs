import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveLocalAlertCandidates,
  isQuietHour,
  normalizeLocalAlertSettings,
  selectLocalAlerts,
} from "../desktop/local-alerts.mjs";

const now = Date.parse("2026-09-11T10:00:00Z");
const settings = normalizeLocalAlertSettings({ enabled: true, cooldownMinutes: 30 });

function live(overrides = {}) {
  return {
    active: true,
    updatedAt: new Date(now - 1000).toISOString(),
    dateKey: "1-fall-11",
    routeState: { readyCrops: 0, toolPickupReady: false },
    machines: [],
    acceptedQuests: [],
    ...overrides,
  };
}

test("local alerts only derive from fresh LIVE state and matching-day saved context", () => {
  const snapshot = {
    dateKey: "1-fall-11",
    dailyBrief: { birthdays: [{ id: "abigail", person: "Abigail", when: "Today" }] },
    planningBrief: { communityCenter: { readyItems: 2 } },
    fishingBrief: { fish: [{ id: "catfish", caught: false, windows: [[600, 1200]] }] },
  };
  const candidates = deriveLocalAlertCandidates(live({
    machines: [{ id: "m1", name: "Keg", location: "Farm", ready: true }],
    routeState: { readyCrops: 3, toolPickupReady: true },
    timeOfDay: 1100,
  }), snapshot, now);
  assert.deepEqual(candidates.map(item => item.category), ["machines", "crops", "tool", "birthdays", "bundles", "fishing"]);
  assert.equal(deriveLocalAlertCandidates(live({ updatedAt: new Date(now - 10_000).toISOString() }), snapshot, now).length, 0);
  assert.equal(deriveLocalAlertCandidates(live(), { ...snapshot, dateKey: "1-fall-10" }, now).some(item => item.category === "birthdays"), false);
});

test("local alerts establish a quiet baseline, group machines, honor categories and cooldowns", () => {
  const candidates = deriveLocalAlertCandidates(live({
    machines: [
      { id: "m1", name: "Keg", location: "Farm", ready: true },
      { id: "m2", name: "Keg", location: "Farm", ready: true },
    ],
  }), {}, now);
  let result = selectLocalAlerts({ candidates, settings, now });
  assert.equal(result.alerts.length, 0, "existing ready machines do not create a startup burst");
  result = selectLocalAlerts({ candidates: [], settings, state: result.state, now: now + 1000 });
  result = selectLocalAlerts({ candidates, settings, state: result.state, now: now + 2000 });
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0].count, 2, "machines are grouped into one notification");
  result = selectLocalAlerts({ candidates: [], settings, state: result.state, now: now + 3000 });
  result = selectLocalAlerts({ candidates, settings, state: result.state, now: now + 4000 });
  assert.equal(result.alerts.length, 0, "the cooldown prevents a repeated notification");
  const disabled = normalizeLocalAlertSettings({ enabled: true, categories: { machines: false } });
  const disabledResult = selectLocalAlerts({ candidates, settings: disabled, state: { initialized: true, present: [] }, now });
  assert.equal(disabledResult.alerts.length, 0);
});

test("quiet hours support schedules that cross midnight", () => {
  const quietSettings = normalizeLocalAlertSettings({ enabled: true, quietHours: { enabled: true, start: "22:00", end: "08:00" } });
  assert.equal(isQuietHour(quietSettings, new Date("2026-09-11T23:00:00")), true);
  assert.equal(isQuietHour(quietSettings, new Date("2026-09-11T12:00:00")), false);
});
