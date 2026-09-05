// Existing crafting goals; ingredient identifiers checked against local Data/CraftingRecipes.
export const commonCraftingGoals = [
  { name: "Quality Sprinkler", materials: [{ id: "(O)335", name: "Iron Bar", quantity: 1 }, { id: "(O)336", name: "Gold Bar", quantity: 1 }, { id: "(O)338", name: "Refined Quartz", quantity: 1 }] },
  { name: "Iridium Sprinkler", materials: [{ id: "(O)336", name: "Gold Bar", quantity: 1 }, { id: "(O)337", name: "Iridium Bar", quantity: 1 }, { id: "(O)787", name: "Battery Pack", quantity: 1 }] },
  { name: "Keg", materials: [{ id: "(O)388", name: "Wood", quantity: 30 }, { id: "(O)334", name: "Copper Bar", quantity: 1 }, { id: "(O)335", name: "Iron Bar", quantity: 1 }, { id: "(O)725", name: "Oak Resin", quantity: 1 }] },
  { name: "Preserves Jar", materials: [{ id: "(O)388", name: "Wood", quantity: 50 }, { id: "(O)390", name: "Stone", quantity: 40 }, { id: "(O)382", name: "Coal", quantity: 8 }] },
  { name: "Mayonnaise Machine", materials: [{ id: "(O)388", name: "Wood", quantity: 15 }, { id: "(O)390", name: "Stone", quantity: 15 }, { id: "(O)86", name: "Earth Crystal", quantity: 1 }, { id: "(O)334", name: "Copper Bar", quantity: 1 }] },
  { name: "Cheese Press", materials: [{ id: "(O)388", name: "Wood", quantity: 45 }, { id: "(O)390", name: "Stone", quantity: 45 }, { id: "(O)709", name: "Hardwood", quantity: 10 }, { id: "(O)334", name: "Copper Bar", quantity: 1 }] },
  { name: "Loom", materials: [{ id: "(O)388", name: "Wood", quantity: 60 }, { id: "(O)771", name: "Fiber", quantity: 30 }, { id: "(O)726", name: "Pine Tar", quantity: 1 }] },
  { name: "Oil Maker", materials: [{ id: "(O)766", name: "Slime", quantity: 50 }, { id: "(O)709", name: "Hardwood", quantity: 20 }, { id: "(O)336", name: "Gold Bar", quantity: 1 }] },
  { name: "Cask", materials: [{ id: "(O)388", name: "Wood", quantity: 20 }, { id: "(O)709", name: "Hardwood", quantity: 1 }] },
  { name: "Crystalarium", materials: [{ id: "(O)390", name: "Stone", quantity: 99 }, { id: "(O)336", name: "Gold Bar", quantity: 5 }, { id: "(O)337", name: "Iridium Bar", quantity: 2 }, { id: "(O)787", name: "Battery Pack", quantity: 1 }] },
  { name: "Seed Maker", materials: [{ id: "(O)388", name: "Wood", quantity: 25 }, { id: "(O)382", name: "Coal", quantity: 10 }, { id: "(O)336", name: "Gold Bar", quantity: 1 }] },
  { name: "Lightning Rod", materials: [{ id: "(O)335", name: "Iron Bar", quantity: 1 }, { id: "(O)338", name: "Refined Quartz", quantity: 1 }, { id: "(O)767", name: "Bat Wing", quantity: 5 }] },
  { name: "Bee House", materials: [{ id: "(O)388", name: "Wood", quantity: 40 }, { id: "(O)382", name: "Coal", quantity: 8 }, { id: "(O)335", name: "Iron Bar", quantity: 1 }, { id: "(O)724", name: "Maple Syrup", quantity: 1 }] },
] as const;
