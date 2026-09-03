import type { StardewDate } from "./production-engine.mjs";
type Scenario = { units: number; grossRevenue: number; netProfit: number; profitPerDay: number };
export type AnimalPlan = {
  startDate: StardewDate; endDate: StardewDate; durationDays: number; count: number; cycles: number; processedCycles: number;
  purchaseCost: number; feedCost: number; totalCosts: number; firstIncomeDate: StardewDate | null; breakEvenDate: StardewDate | null;
  scenarios: Record<"conservative" | "expected" | "optimistic", Scenario>; warnings: string[];
  outputs: Array<{ item: { id: string; name: string; price: number; spriteIndex?: number }; quantity: number }>;
};
export function calculateAnimalPlan(input: Record<string, unknown> & { animal: unknown; startDate: StardewDate; durationDays?: number; endDate?: StardewDate }): AnimalPlan;
