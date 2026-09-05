import type { ProductionProducer } from "./production-engine.mjs";
import type { MachineConversion } from "./machine-engine.mjs";

export type ProductionItem = { id: string; name: string; price: number; category?: number; spriteIndex?: number; artworkUrl?: string; artworkColumns?: number };
export type ProductionCatalogEntry = Omit<ProductionProducer, "outputValue"> & {
  output: ProductionItem;
  growthPhases?: number[];
  yieldRules?: { maxIncreasePerFarmingLevel: number; extraHarvestChance: number };
  clearance?: number;
  family?: "farming" | "forestry" | "machine" | "animal" | "pond";
  materials?: Array<{ item: { id: string; name: string; price: number; spriteIndex?: number }; quantity: number }>;
  machineConversion?: MachineConversion;
  animal?: ProductionAnimal;
  pond?: ProductionPond;
};
export type ProductionAnimal = {
  verified?: boolean;
  id: string; name: string; texture?: string; artworkUrl?: string; spriteWidth?: number; spriteHeight?: number; purchasePrice: number; purchasable: boolean; requiredBuilding: string; buildingCapacity: number; buildingCost: number; daysToMature: number; daysToProduce: number;
  harvestType: string; produceOnMature: boolean; deluxeProduceMinimumFriendship: number; deluxeProduceCareDivisor: number;
  produce: Array<{ item: { id: string; name: string; price: number; spriteIndex?: number } }>;
  deluxeProduce: Array<{ item: { id: string; name: string; price: number; spriteIndex?: number } }>;
};
export type ProductionPond = {
  verified?: boolean;
  id: string; fish: { id: string; name: string; price: number; spriteIndex?: number }; ruleId: string; maxPopulation: number; spawnTime: number;
  processedRoe?: { id: string; name: string; price: number; spriteIndex?: number };
  baseMinProduceChance: number; baseMaxProduceChance: number; populationGates?: Record<string, string[]>;
  producedItems: Array<{ requiredPopulation: number; chance: number; precedence: number; condition?: string | null; item: { id: string; name: string; price: number; spriteIndex?: number }; minStack: number; maxStack: number }>;
};
export type ProductionFertilizer = {
  id: string;
  name: string;
  kind: "quality" | "speed";
  qualityBoost: number;
  speedBoost: number;
  startupCost: number;
  verified: boolean;
  verifiedCost: boolean;
};
export type ProductionCatalog = {
  catalogVersion: number;
  source?: "local-game";
  crops: ProductionCatalogEntry[];
  fruitTrees: ProductionCatalogEntry[];
  fertilizers?: ProductionFertilizer[];
  tappedTrees?: Array<{ verified?: boolean; id: string; treeType: string; seed: { id: string; name: string; price: number; spriteIndex?: number }; growthChance: number; fertilizedGrowthChance: number; growsInWinter: boolean; tapItems: Array<{ itemId: string; item: { id: string; name: string; price: number; spriteIndex?: number } | null; daysUntilReady: number; condition?: string | null; season?: string | null; hasTimeModifiers?: boolean }> }>;
  mushroomLogOutputs?: Array<{ id: string; name: string; price: number; spriteIndex?: number }>;
  forestryEquipment?: Array<{ id: string; name: string; spriteIndex?: number; opportunityCost: number; materials: Array<{ item: { id: string; name: string; price: number; spriteIndex?: number }; quantity: number }> }>;
  artisanMachines?: MachineConversion[];
  farmAnimals?: ProductionAnimal[];
  fishPonds?: ProductionPond[];
  feedUnitCost?: number;
};

