import { type ItemSpriteKind, type ItemArtwork } from "./snapshot-types";

export const qualifyItemId = (
  id?: string | null,
  spriteKind: ItemSpriteKind = "object",
) => {
  const value = String(id || "").trim();
  if (!value || /^\([A-Z]+\)/.test(value) || value.startsWith("-"))
    return value;
  const qualifier: Partial<Record<ItemSpriteKind, string>> = {
    object: "O",
    object2: "O",
    craftable: "BC",
    furniture: "F",
    weapon: "W",
    tool: "T",
    hat: "H",
    shirt: "S",
  };
  return qualifier[spriteKind] ? `(${qualifier[spriteKind]})${value}` : value;
};

export const normalizeObjectId = (id?: string | null) => qualifyItemId(id, "object");

export const inventoryItemId = (item: Pick<ItemArtwork, "id" | "spriteKind">) =>
  qualifyItemId(item.id, item.spriteKind || "object");

export function sameInventoryIdentity(left: Partial<Pick<ItemArtwork, "id" | "spriteKind">>, right: Partial<Pick<ItemArtwork, "id" | "spriteKind">>) {
  const id = qualifyItemId(left.id, left.spriteKind);
  return Boolean(id) && id === qualifyItemId(right.id, right.spriteKind);
}

export function inventoryQuantity(items: (Partial<Pick<ItemArtwork, "id" | "spriteKind">> & { count: number })[], id?: string) {
  return items.filter((item) => sameInventoryIdentity(item, { id }))
    .reduce((total, item) => total + item.count, 0);
}

export function inventoryToolTier(items: Partial<Pick<ItemArtwork, "id" | "spriteKind">>[], toolId: string) {
  // Data/Tools keys from the installed game; these are identifiers, not labels.
  return ["", "Copper", "Steel", "Gold", "Iridium"].reduce((highest, prefix, tier) =>
    items.some((item) => sameInventoryIdentity(item, { id: `(T)${prefix}${toolId}` })) ? tier : highest, 0);
}
