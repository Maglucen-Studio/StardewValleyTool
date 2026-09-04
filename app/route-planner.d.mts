export type RouteProfile = "fastest" | "income" | "social" | "mining" | "relaxed";
export type RouteStop = { location: string; [key: string]: unknown };

export const ROUTE_PROFILES: RouteProfile[];
export function normalizeRouteProfile(value: unknown): RouteProfile;
export function orderRouteStops<T extends RouteStop>(stops: T[], profile: RouteProfile, currentLocation?: string): T[];
export function estimateRouteMinutes(
  stopCount: number,
  transport?: { horse?: boolean; minecarts?: boolean },
  profile?: RouteProfile,
): number;
export function fishingQuestRouteStop(
  fish: {
    seasons: string[];
    weather: string;
    windows: number[][];
    accessibleLocations: string[];
  } | undefined,
  context: { season?: string; weather?: string; time?: number },
): { location: string; start: number; end: number } | null;
