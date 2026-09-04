export const ROUTE_PROFILES = ["fastest", "income", "social", "mining", "relaxed"];

const PROFILE_ORDERS = {
  fastest: ["Farm", "BusStop", "Town", "Beach", "Mountain", "Railroad", "Backwoods", "Cindersap Forest", "Secret Woods", "Desert", "Ginger Island"],
  income: ["Farm", "Beach", "Cindersap Forest", "Secret Woods", "Town", "Mountain", "Railroad", "BusStop", "Desert", "Ginger Island"],
  social: ["Town", "Beach", "Mountain", "Cindersap Forest", "Backwoods", "Farm", "BusStop", "Railroad", "Desert", "Ginger Island"],
  mining: ["Farm", "Mountain", "Railroad", "Desert", "BusStop", "Town", "Backwoods", "Cindersap Forest", "Secret Woods", "Beach", "Ginger Island"],
  relaxed: ["Farm", "Backwoods", "Mountain", "Railroad", "Town", "Beach", "Cindersap Forest", "Secret Woods", "BusStop", "Desert", "Ginger Island"],
};

export function normalizeRouteProfile(value) {
  return ROUTE_PROFILES.includes(value) ? value : "fastest";
}

export function orderRouteStops(stops, profile, currentLocation = "") {
  const normalized = normalizeRouteProfile(profile);
  const order = PROFILE_ORDERS[normalized];
  return stops.map((stop, originalIndex) => ({ stop, originalIndex })).sort((left, right) => {
    if (normalized === "fastest" && currentLocation) {
      if (left.stop.location === currentLocation) return -1;
      if (right.stop.location === currentLocation) return 1;
    }
    const leftIndex = order.indexOf(left.stop.location);
    const rightIndex = order.indexOf(right.stop.location);
    const leftRank = leftIndex < 0 ? order.length : leftIndex;
    const rightRank = rightIndex < 0 ? order.length : rightIndex;
    return leftRank - rightRank || left.originalIndex - right.originalIndex;
  }).map(({ stop }) => stop);
}

export function estimateRouteMinutes(stopCount, { horse = false, minecarts = false } = {}, profile = "fastest") {
  if (stopCount <= 0) return 0;
  const taskMinutes = normalizeRouteProfile(profile) === "relaxed" ? 40 : 30;
  const base = stopCount * taskMinutes + Math.max(0, stopCount - 1) * 20;
  const adjusted = base * (horse ? 0.8 : 1) * (minecarts ? 0.9 : 1);
  return Math.max(20, Math.round(adjusted / 10) * 10);
}

const FISHING_ROUTE_LOCATIONS = [
  [/ocean|beach/i, "Beach"],
  [/mountain|lake|mine/i, "Mountain"],
  [/forest|cindersap/i, "Cindersap Forest"],
  [/town|river/i, "Town"],
  [/secret woods/i, "Secret Woods"],
  [/desert/i, "Desert"],
  [/ginger|island/i, "Ginger Island"],
];

export function fishingQuestRouteStop(fish, { season, weather, time = 600 } = {}) {
  if (!fish || !fish.seasons?.includes(season)) return null;
  if (fish.weather && fish.weather !== "both" && fish.weather !== weather) return null;
  const futureWindow = (fish.windows || []).find(([, end]) => end > time);
  if (!futureWindow) return null;
  for (const rawLocation of fish.accessibleLocations || []) {
    const match = FISHING_ROUTE_LOCATIONS.find(([pattern]) => pattern.test(rawLocation));
    if (match) return { location: match[1], start: Math.max(time, futureWindow[0]), end: futureWindow[1] };
  }
  return null;
}
