import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { PNG } from "pngjs";
import { unpackToFiles } from "xnb";
import { loadConfig, runtimeRoot, runtimePaths } from "./config.mjs";
import { blockedMapTiles, readMap, renderMap } from "./render-community-rooms.mjs";

const config = loadConfig();
const { contentRoot } = runtimePaths(config);
const snapshotPath = resolve(runtimeRoot, "public/data/farm-state.json");
const liveStatePath = resolve(runtimeRoot, "public/data/live-state.json");
const cacheRoot = resolve(runtimeRoot, "assetbuild/storage-location-maps");
const publicRoot = resolve(runtimeRoot, "public/assets/location-maps");

function safeName(value) {
  return String(value || "location")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "location";
}

function legacyLocationName(location) {
  return String(location || "")
    .split("_")[0]
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}$/i, "")
    .replace(/[-_]+$/, "");
}

async function unpackXnb(path, wantedExtension) {
  const outputs = await unpackToFiles(await readFile(path), {
    fileName: basename(path),
  });
  const output = outputs.find((candidate) => candidate.extension === wantedExtension);
  if (!output) throw new Error(`${basename(path)} does not contain ${wantedExtension} data.`);
  return Buffer.from(await output.data.arrayBuffer());
}

function mapPathFor(name) {
  const candidates = [
    resolve(contentRoot, "Maps", `${name}.xnb`),
    resolve(contentRoot, `${name}.xnb`),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function seasonalSheetName(imageSource, season) {
  return String(imageSource).replace(/^spring_/i, `${season}_`);
}

function sheetPathFor(imageSource, season) {
  const seasonal = seasonalSheetName(imageSource, season).replace(/\\/g, "/");
  const original = String(imageSource).replace(/\\/g, "/");
  const candidates = [
    resolve(contentRoot, "Maps", `${seasonal}.xnb`),
    resolve(contentRoot, `${seasonal}.xnb`),
    resolve(contentRoot, "Maps", `${original}.xnb`),
    resolve(contentRoot, `${original}.xnb`),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

async function cachedTexture(source, imageSource, season) {
  const destination = resolve(
    cacheRoot,
    "sheets",
    `${safeName(seasonalSheetName(imageSource, season))}.png`,
  );
  const sourceTime = (await stat(source)).mtimeMs;
  const destinationTime = existsSync(destination) ? (await stat(destination)).mtimeMs : 0;
  if (destinationTime < sourceTime) {
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, await unpackXnb(source, "png"));
  }
  return destination;
}

async function renderLocation(mapName, season, { includeBlocked = false } = {}) {
  const source = mapPathFor(mapName);
  if (!source) return null;
  const tbinPath = resolve(cacheRoot, "maps", `${safeName(mapName)}.tbin`);
  const sourceTime = (await stat(source)).mtimeMs;
  const tbinTime = existsSync(tbinPath) ? (await stat(tbinPath)).mtimeMs : 0;
  if (tbinTime < sourceTime) {
    await mkdir(dirname(tbinPath), { recursive: true });
    await writeFile(tbinPath, await unpackXnb(source, "tbin"));
  }
  const map = readMap(await readFile(tbinPath));
  const sheets = {};
  for (const sheet of map.sheets.values()) {
    const sheetSource = sheetPathFor(sheet.imageSource, season);
    if (sheetSource)
      sheets[sheet.imageSource] = await cachedTexture(
        sheetSource,
        sheet.imageSource,
        season,
      );
  }
  const fileName = `${safeName(mapName)}-${safeName(season)}.png`;
  const destination = resolve(publicRoot, fileName);
  const destinationTime = existsSync(destination) ? (await stat(destination)).mtimeMs : 0;
  const newestInput = Math.max(
    sourceTime,
    ...await Promise.all(Object.values(sheets).map(async (path) => (await stat(path)).mtimeMs)),
  );
  if (destinationTime < newestInput) {
    await mkdir(publicRoot, { recursive: true });
    const image = await renderMap(tbinPath, sheets);
    await writeFile(destination, PNG.sync.write(image));
  }
  const firstLayer = map.layers[0];
  return {
    background: `/assets/location-maps/${fileName}`,
    width: firstLayer.size.width,
    height: firstLayer.size.height,
    ...(includeBlocked ? { blocked: blockedMapTiles(map) } : {}),
  };
}

async function renderGrandpaShrineScene(season) {
  if (!await renderLocation("Farm", season)) return;
  const background = `/assets/location-maps/Farm-${safeName(season)}.png`;
  const sourcePath = resolve(runtimeRoot, "public", background.replace(/^\//, ""));
  const destination = resolve(runtimeRoot, "public/assets/sprites/Grandpa Shrine Scene.png");
  if (
    existsSync(destination) &&
    (await stat(destination)).mtimeMs >= (await stat(sourcePath)).mtimeMs
  ) return;
  const source = PNG.sync.read(
    await readFile(sourcePath),
  );
  const scene = new PNG({ width: 7 * 16, height: 7 * 16 });
  PNG.bitblt(source, scene, 5 * 16, 3 * 16, scene.width, scene.height, 0, 0);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, PNG.sync.write(scene));
}

const farmMapNames = {
  0: "Farm",
  1: "Farm_Fishing",
  2: "Farm_Foraging",
  3: "Farm_Mining",
  4: "Farm_Combat",
  5: "Farm_FourCorners",
  6: "Farm_Island",
  7: "Farm_Ranching",
};

function interiorMapName(interior) {
  if (interior.mapName) return interior.mapName;
  const contextualName = /\/location-maps\/([^/]+)-(?:spring|summer|fall|winter)\.png$/i
    .exec(interior.background || "")?.[1];
  if (contextualName) return contextualName;
  const fileName = /\/([^/]+)\.png$/i.exec(interior.background || "")?.[1];
  if (fileName?.startsWith("FarmHouse-"))
    return ["FarmHouse", "FarmHouse1", "FarmHouse2"][Number(fileName.at(-1))] || null;
  if (fileName) return fileName;
  if (interior.name === "FarmCave") return "FarmCave";
  if (interior.name === "Greenhouse" || interior.label === "Greenhouse") return "Greenhouse";
  if (interior.name?.startsWith("Cellar") || interior.label === "Cellar")
    return "FarmHouse_Cellar";
  return null;
}

async function main() {
  if (!existsSync(snapshotPath)) return;
  const snapshotSource = await readFile(snapshotPath, "utf8");
  const snapshot = JSON.parse(snapshotSource);
  const liveState = existsSync(liveStatePath)
    ? JSON.parse(await readFile(liveStatePath, "utf8"))
    : {};
  const knownInteriors = new Set(
    (snapshot.interiors || []).flatMap((interior) => [interior.id, interior.name]),
  );
  const locations = new Set();
  for (const item of snapshot.planningBrief?.inventory || [])
    for (const detail of item.sourceDetails || [])
      if (
        detail.kind === "chest" &&
        detail.location &&
        detail.location !== "Farm" &&
        !knownInteriors.has(detail.location)
      ) locations.add(detail.location);
  for (const item of liveState.storage || [])
    if (
      item.containerKind === "chest" &&
      item.containerLocation &&
      item.containerLocation !== "Farm" &&
      !knownInteriors.has(item.containerLocation)
    ) locations.add(item.containerLocation);

  const locationMaps = { ...(snapshot.locationMaps || {}) };
  const season = snapshot.season || "spring";
  const farmMapName = farmMapNames[snapshot.farmType] || "Farm";
  try {
    const farm = await renderLocation(farmMapName, season, { includeBlocked: true });
    if (farm) {
      locationMaps.Farm = farm;
      snapshot.map = {
        ...snapshot.map,
        width: farm.width,
        height: farm.height,
        blocked: farm.blocked,
      };
    }
  } catch (error) {
    console.warn(`Could not render Farm: ${error.message}`);
  }
  try {
    await renderGrandpaShrineScene(season);
  } catch (error) {
    console.warn(`Could not render Grandpa's Shrine scene: ${error.message}`);
  }

  for (const interior of snapshot.interiors || []) {
    const mapName = interiorMapName(interior);
    if (!mapName) continue;
    try {
      const rendered = await renderLocation(mapName, season);
      if (!rendered) continue;
      locationMaps[interior.id] = rendered;
      interior.background = rendered.background;
      interior.width = rendered.width;
      interior.height = rendered.height;
    } catch (error) {
      console.warn(`Could not render ${interior.id}: ${error.message}`);
    }
  }

  for (const location of locations) {
    try {
      const mapName = legacyLocationName(location);
      const rendered = await renderLocation(mapName, season);
      if (rendered) locationMaps[location] = rendered;
    } catch (error) {
      console.warn(`Could not render ${location}: ${error.message}`);
    }
  }
  snapshot.locationMaps = locationMaps;
  const serialized = JSON.stringify(snapshot);
  if (serialized === snapshotSource) return;
  const temporary = `${snapshotPath}.location-maps.tmp`;
  await writeFile(temporary, serialized, "utf8");
  await rename(temporary, snapshotPath);
}

await main();
