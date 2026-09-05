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

export function sameInventoryIdentity(left: Pick<ItemArtwork, "id" | "spriteKind">, right: Pick<ItemArtwork, "id" | "spriteKind">) {
  const id = inventoryItemId(left);
  return Boolean(id) && id === inventoryItemId(right);
}
