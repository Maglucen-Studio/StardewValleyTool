import type { StardewDate } from "./production-engine.mjs";

export type MachineConversion = {
  id: string;
  machine: { id: string; name: string; spriteIndex?: number; opportunityCost: number; materials?: Array<{ item: MachineItem; quantity: number }> };
  input: MachineItem;
  output: MachineItem;
  inputCount: number;
  outputCount: { min: number; expected: number; max: number };
  outputQuality: number;
  cycleMinutes: number;
  priceFormula: "fixed" | "wine" | "juice" | "jelly" | "pickles" | "dried-fruit" | "dried-mushroom" | "smoked-fish" | "cask";
  agingMultiplier?: number;
  locationRequirement?: "cellar";
  artisanEligible: boolean;
  additionalInputs?: Array<{ item: MachineItem; quantity: number }>;
  additionalInputCost: number;
  verified: boolean;
};
export type MachineItem = { id: string; name: string; price: number; category?: number; spriteIndex?: number; source?: { id: string; name: string; price: number; spriteIndex?: number } };
export function machineOutputUnitPrice(conversion: MachineConversion, inputQuality?: number, artisan?: boolean): number;
export function calculateMachinePlan(input: {
  conversion: MachineConversion;
  machineCount: number;
  initialInput: number;
  recurringInputPerDay?: number;
  inputEvents?: Array<{ day?: number; minute?: number; quantity: number }>;
  inputQuality?: number;
  artisan?: boolean;
  existing?: boolean;
  collectionEveryDays?: number;
  hasCellar?: boolean;
  linkedUpstream?: boolean;
  startDate: StardewDate;
  durationDays?: number;
  endDate?: StardewDate;
}): {
  startDate: StardewDate; endDate: StardewDate; durationDays: number;
  machineCount: number; effectiveCycleMinutes: number; cyclesPerMachine: number; capacityBatches: number; batches: number;
  availableInput: number; consumedInput: number; surplusInput: number; idleBatches: number;
  directSaleValue: number; additionalInputCost: number; setupCost: number; outputPrice: number;
  outputEvents: Array<{ day: number; minute: number; quantity: number }>;
  scenarios: Record<"conservative" | "expected" | "optimistic", { units: number; grossRevenue: number; netProfit: number; profitPerDay: number }>;
  firstIncomeDate: StardewDate | null; breakEvenDate: StardewDate | null; warnings: string[];
};
