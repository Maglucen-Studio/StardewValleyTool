export const alertKinds = [
  "machines",
  "crops",
  "birthdays",
  "deadlines",
  "fishing",
  "events",
  "energy",
  "tool",
  "bundles",
];

export const defaultLocalAlertSettings = {
  enabled: false,
  categories: Object.fromEntries(alertKinds.map((kind) => [kind, true])),
  quietHours: { enabled: false, start: "22:00", end: "08:00" },
  cooldownMinutes: 30,
};

function timeValue(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "") ? value : fallback;
}

export function normalizeLocalAlertSettings(value) {
  const incoming = value && typeof value === "object" ? value : {};
  const categories = incoming.categories && typeof incoming.categories === "object"
    ? incoming.categories
    : {};
  const quietHours = incoming.quietHours && typeof incoming.quietHours === "object"
    ? incoming.quietHours
    : {};
  const cooldown = Number(incoming.cooldownMinutes);
  return {
    enabled: incoming.enabled === true,
    categories: Object.fromEntries(alertKinds.map((kind) => [
      kind,
      categories[kind] !== false,
    ])),
    quietHours: {
      enabled: quietHours.enabled === true,
      start: timeValue(quietHours.start, defaultLocalAlertSettings.quietHours.start),
      end: timeValue(quietHours.end, defaultLocalAlertSettings.quietHours.end),
    },
    cooldownMinutes: [5, 15, 30, 60, 120].includes(cooldown) ? cooldown : 30,
  };
}

export function isQuietHour(settings, date = new Date()) {
  if (!settings.quietHours.enabled) return false;
  const now = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const { start, end } = settings.quietHours;
  if (start === end) return true;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

function liveIsFresh(live, now) {
  const source = live?.updatedAt;
  const updatedAt = typeof source === "number" ? source : new Date(source || 0).getTime();
  return Boolean(live?.active && updatedAt && now - updatedAt >= 0 && now - updatedAt < 9000);
}

export function deriveLocalAlertCandidates(live, snapshot, now = Date.now()) {
  if (!liveIsFresh(live, now)) return [];
  const dateKey = String(live.dateKey || "live");
  const sameDaySnapshot = snapshot?.dateKey === live.dateKey;
  const candidates = [];
  const machines = (live.machines || []).filter((machine) => machine.ready);
  if (machines.length)
    candidates.push({
      category: "machines",
      id: `${dateKey}:machines:${machines.map((machine) => machine.id || `${machine.location}:${machine.name}`).sort().join(",")}`,
      count: machines.length,
      target: { view: "farm", section: "machines" },
    });
  const crops = Number(live.routeState?.readyCrops || 0);
  if (crops)
    candidates.push({
      category: "crops",
      id: `${dateKey}:crops:${crops}`,
      count: crops,
      target: { view: "farm", section: "crops" },
    });
  const toolReady = live.routeState?.toolPickupReady === true;
  if (toolReady)
    candidates.push({ category: "tool", id: `${dateKey}:tool`, target: { view: "agenda" } });
  const lowEnergy = Number(live.maxEnergy || 0) > 0 && Number(live.energy || 0) < Number(live.maxEnergy) * 0.2;
  if (lowEnergy)
    candidates.push({
      category: "energy",
      id: `${dateKey}:energy`,
      energy: Math.round(Number(live.energy || 0)),
      maxEnergy: Math.round(Number(live.maxEnergy || 0)),
      target: { view: "agenda" },
    });
  const deadlines = (live.acceptedQuests || []).filter(
    (quest) => quest.accepted !== false && Number(quest.daysLeft || 0) <= 1,
  );
  if (deadlines.length)
    candidates.push({
      category: "deadlines",
      id: `${dateKey}:deadlines:${deadlines.map((quest) => quest.id || quest.title).sort().join(",")}`,
      count: deadlines.length,
      target: { view: "agenda" },
    });
  if (sameDaySnapshot) {
    const birthday = (snapshot?.dailyBrief?.birthdays || []).find((item) => item.when === "Today");
    if (birthday)
      candidates.push({
        category: "birthdays",
        id: `${dateKey}:birthday:${birthday.id || birthday.person}`,
        person: birthday.person,
        target: { view: "agenda" },
      });
    const bundles = Number(snapshot?.planningBrief?.communityCenter?.readyItems || 0);
    if (bundles)
      candidates.push({
        category: "bundles",
        id: `${dateKey}:bundles:${bundles}`,
        count: bundles,
        target: { view: "planning", section: "community" },
      });
    const timeOfDay = Number(live.timeOfDay || 0);
    const closingFish = (snapshot?.fishingBrief?.fish || []).filter(
      (fish) => !fish.caught && (fish.windows || []).some(
        ([start, end]) => timeOfDay >= start && timeOfDay <= end && end - timeOfDay <= 100,
      ),
    );
    if (closingFish.length)
      candidates.push({
        category: "fishing",
        id: `${dateKey}:fishing:${closingFish.map((fish) => fish.id).sort().join(",")}`,
        count: closingFish.length,
        target: { view: "fishing" },
      });
    const festival = snapshot?.dailyBrief?.routeContext?.festival;
    if (festival)
      candidates.push({
        category: "events",
        id: `${dateKey}:event:${festival}`,
        event: festival,
        target: { view: "agenda" },
      });
  }
  return candidates;
}

export function selectLocalAlerts({ candidates, settings, state = {}, now = Date.now(), quiet = false }) {
  const previous = new Set(Array.isArray(state.present) ? state.present : []);
  const present = candidates.map((candidate) => candidate.id);
  if (!state.initialized)
    return { alerts: [], state: { initialized: true, present, notifiedAt: state.notifiedAt || {} } };
  const notifiedAt = { ...(state.notifiedAt || {}) };
  const alerts = [];
  for (const candidate of candidates) {
    if (previous.has(candidate.id) || !settings.enabled || !settings.categories[candidate.category] || quiet) continue;
    const last = Number(notifiedAt[candidate.category] || 0);
    if (now - last < settings.cooldownMinutes * 60_000) continue;
    notifiedAt[candidate.category] = now;
    alerts.push(candidate);
  }
  return { alerts, state: { initialized: true, present, notifiedAt } };
}
