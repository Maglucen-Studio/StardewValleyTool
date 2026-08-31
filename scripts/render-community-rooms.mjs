import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PNG } from "pngjs";

class TbinReader {
  constructor(buffer) { this.buffer = buffer; this.offset = 0; }
  bytes(length) { const value = this.buffer.subarray(this.offset, this.offset + length); this.offset += length; return value; }
  byte() { return this.buffer[this.offset++]; }
  int() { const value = this.buffer.readInt32LE(this.offset); this.offset += 4; return value; }
  float() { const value = this.buffer.readFloatLE(this.offset); this.offset += 4; return value; }
  string() { return this.bytes(this.int()).toString("utf8"); }
  size() { return { width: this.int(), height: this.int() }; }
  properties() {
    const properties = {};
    for (let count = this.int(); count > 0; count -= 1) {
      const name = this.string();
      const type = this.byte();
      if (type === 0) properties[name] = this.byte() > 0;
      else if (type === 1) properties[name] = this.int();
      else if (type === 2) properties[name] = this.float();
      else if (type === 3) properties[name] = this.string();
      else throw new Error(`Unsupported tBIN property type ${type}`);
    }
    return properties;
  }
  staticTile(sheetId) {
    const tile = { sheetId, index: this.int() };
    this.byte();
    tile.properties = this.properties();
    return tile;
  }
  animatedTile() {
    this.int();
    let frameCount = this.int();
    let sheetId = null;
    let firstFrame = null;
    while (frameCount > 0) {
      const marker = String.fromCharCode(this.byte());
      if (marker === "T") sheetId = this.string();
      else if (marker === "S") {
        const frame = this.staticTile(sheetId);
        firstFrame ||= frame;
        frameCount -= 1;
      }
      else throw new Error(`Unexpected animated tile marker ${marker}`);
    }
    firstFrame.properties = { ...firstFrame.properties, ...this.properties() };
    return firstFrame;
  }
}

export function readMap(buffer) {
  const reader = new TbinReader(buffer);
  if (reader.bytes(6).toString("ascii") !== "tBIN10") throw new Error("Unsupported tBIN map version");
  reader.string(); reader.string(); reader.properties();
  const sheets = new Map();
  for (let count = reader.int(); count > 0; count -= 1) {
    const id = reader.string();
    reader.string();
    const imageSource = reader.string();
    const sheetSize = reader.size();
    const tileSize = reader.size();
    const margin = reader.size();
    const spacing = reader.size();
    const properties = reader.properties();
    sheets.set(id, { id, imageSource, sheetSize, tileSize, margin, spacing, properties });
  }
  const layers = [];
  for (let count = reader.int(); count > 0; count -= 1) {
    const id = reader.string();
    const visible = reader.byte() > 0;
    reader.string();
    const size = reader.size();
    reader.size();
    const properties = reader.properties();
    const tiles = Array(size.width * size.height).fill(null);
    let currentSheet = null;
    for (let y = 0; y < size.height; y += 1) {
      let x = 0;
      while (x < size.width) {
        const marker = String.fromCharCode(reader.byte());
        if (marker === "T") currentSheet = reader.string();
        else if (marker === "N") x += reader.int();
        else if (marker === "S") { tiles[y * size.width + x] = reader.staticTile(currentSheet); x += 1; }
        else if (marker === "A") { tiles[y * size.width + x] = reader.animatedTile(); x += 1; }
        else throw new Error(`Unexpected layer marker ${marker} in ${id}`);
      }
    }
    layers.push({ id, visible, size, tiles, properties });
  }
  return { sheets, layers };
}

export function blockedMapTiles(map) {
  const firstLayer = map.layers[0];
  const buildings = map.layers.find((layer) => layer.id === "Buildings");
  const back = map.layers.find((layer) => layer.id === "Back");
  if (!firstLayer) return [];
  const blocked = new Set();
  const mark = (x, y) => blocked.add(`${x},${y}`);
  if (buildings) {
    for (let y = 0; y < buildings.size.height; y += 1)
      for (let x = 0; x < buildings.size.width; x += 1) {
        const tile = buildings.tiles[y * buildings.size.width + x];
        const passable = [true, "T", "t", "true"].includes(tile?.properties?.Passable);
        if (tile && !passable) mark(x, y);
      }
  }
  if (back) {
    for (let y = 0; y < back.size.height; y += 1)
      for (let x = 0; x < back.size.width; x += 1) {
        const tile = back.tiles[y * back.size.width + x];
        if ([false, "F", "f", "false"].includes(tile?.properties?.Buildable)) mark(x, y);
      }
  }
  return [...blocked].map((cell) => cell.split(",").map(Number));
}

function blendPixel(target, targetOffset, source, sourceOffset) {
  const sourceAlpha = source[sourceOffset + 3] / 255;
  if (sourceAlpha <= 0) return;
  const targetAlpha = target[targetOffset + 3] / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  for (let channel = 0; channel < 3; channel += 1) {
    target[targetOffset + channel] = Math.round((source[sourceOffset + channel] * sourceAlpha + target[targetOffset + channel] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  }
  target[targetOffset + 3] = Math.round(outputAlpha * 255);
}

export async function renderMap(mapPath, sheetPaths) {
  const map = readMap(await readFile(mapPath));
  const firstLayer = map.layers[0];
  const output = new PNG({ width: firstLayer.size.width * 16, height: firstLayer.size.height * 16 });
  const images = new Map();
  for (const sheet of map.sheets.values()) {
    const path = sheetPaths[sheet.imageSource];
    if (path) images.set(sheet.id, PNG.sync.read(await readFile(path)));
  }
  for (const layer of map.layers) {
    if (!layer.visible || layer.id === "Paths") continue;
    for (let y = 0; y < layer.size.height; y += 1) for (let x = 0; x < layer.size.width; x += 1) {
      const tile = layer.tiles[y * layer.size.width + x];
      const sheet = tile && map.sheets.get(tile.sheetId);
      const image = tile && images.get(tile.sheetId);
      if (!tile || !sheet || !image) continue;
      const columns = sheet.sheetSize.width;
      const sourceX = sheet.margin.width + (tile.index % columns) * (sheet.tileSize.width + sheet.spacing.width);
      const sourceY = sheet.margin.height + Math.floor(tile.index / columns) * (sheet.tileSize.height + sheet.spacing.height);
      for (let pixelY = 0; pixelY < 16; pixelY += 1) for (let pixelX = 0; pixelX < 16; pixelX += 1) {
        const sourceOffset = ((sourceY + pixelY) * image.width + sourceX + pixelX) * 4;
        const targetOffset = ((y * 16 + pixelY) * output.width + x * 16 + pixelX) * 4;
        blendPixel(output.data, targetOffset, image.data, sourceOffset);
      }
    }
  }
  return output;
}

function crop(image, { x, y, width, height }) {
  const output = new PNG({ width, height });
  PNG.bitblt(image, output, x, y, width, height, 0, 0);
  return output;
}

export async function renderCommunityRooms(runtimeRoot) {
  const unpacked = resolve(runtimeRoot, "assetbuild/unpacked");
  const destination = resolve(runtimeRoot, "public/assets/community-rooms");
  await mkdir(destination, { recursive: true });
  const sheets = {
    townInterior: resolve(unpacked, "townInterior.png"),
    townInterior_2: resolve(unpacked, "townInterior_2.png"),
    paths: resolve(unpacked, "paths.png"),
    JojaRuins_TileSheet: resolve(unpacked, "JojaRuins_TileSheet.png"),
  };
  const restored = await renderMap(resolve(unpacked, "CommunityCenter_Refurbished.tbin"), sheets);
  const ruined = await renderMap(resolve(unpacked, "CommunityCenter_Ruins.tbin"), sheets);
  const rooms = {
    "Fish Tank": { x: 0, y: 0, width: 176, height: 224 },
    Pantry: { x: 160, y: 0, width: 192, height: 192 },
    "Crafts Room": { x: 112, y: 224, width: 224, height: 256 },
    "Bulletin Board": { x: 336, y: 0, width: 384, height: 384 },
    Vault: { x: 704, y: 0, width: 256, height: 176 },
    "Boiler Room": { x: 944, y: 144, width: 176, height: 224 },
  };
  for (const [name, bounds] of Object.entries(rooms)) {
    await writeFile(resolve(destination, `${name}-complete.png`), PNG.sync.write(crop(restored, bounds)));
    await writeFile(resolve(destination, `${name}-ruined.png`), PNG.sync.write(crop(ruined, bounds)));
  }
  const joja = await renderMap(resolve(unpacked, "AbandonedJojaMart.tbin"), sheets);
  await writeFile(resolve(destination, "Abandoned Joja Mart-ruined.png"), PNG.sync.write(joja));
  await writeFile(resolve(destination, "Abandoned Joja Mart-complete.png"), PNG.sync.write(joja));
}
