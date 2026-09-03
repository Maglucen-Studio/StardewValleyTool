import type { StardewDate } from "./production-engine.mjs";
type Scenario = { units: number; grossRevenue: number; netProfit: number; profitPerDay: number };
export type FishPondPlan = {
  startDate: StardewDate; endDate: StardewDate; durationDays: number; pondCount: number; endPopulation: number;
  purchaseCost: number; totalCosts: number; firstIncomeDate: StardewDate | null; breakEvenDate: StardewDate | null;
  scenarios: Record<"conservative" | "expected" | "optimistic", Scenario>; warnings: string[];
};
export function roePrice(fishPrice: number): number;
export function calculateFishPondPlan(input: Record<string, unknown> & { pond: unknown; startDate: StardewDate; durationDays?: number; endDate?: StardewDate }): FishPondPlan;
