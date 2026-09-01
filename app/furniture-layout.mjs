const SOURCE_TILE_SIZE = 16;

/**
 * Match Stardew Valley's furniture anchoring: tileLocation is the top-left of
 * the collision footprint, while the sprite is anchored to its bottom edge.
 *
 * @param {{
 *   x: number,
 *   y: number,
 *   sourceWidth?: number,
 *   sourceHeight?: number,
 *   footprintHeight?: number,
 * }} item
 * @param {number} [tileSize]
 * @returns {[number, number, number, number]}
 */
export function furnitureDestination(item, tileSize = SOURCE_TILE_SIZE) {
  const sourceWidth = Math.max(0, Number(item.sourceWidth) || 0);
  const sourceHeight = Math.max(0, Number(item.sourceHeight) || 0);
  const footprintHeight = Math.max(1, Number(item.footprintHeight) || 1);
  const scale = tileSize / SOURCE_TILE_SIZE;

  return [
    item.x * tileSize,
    (item.y + footprintHeight) * tileSize - sourceHeight * scale,
    sourceWidth * scale,
    sourceHeight * scale,
  ];
}
