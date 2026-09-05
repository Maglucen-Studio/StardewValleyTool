import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import JSON5 from "json5";

const DICTIONARIES = {
  "data/objects": "objects", "data/crops": "crops", "data/fish": "fish",
  "data/cookingrecipes": "cookingRecipes", "data/craftingrecipes": "craftingRecipes",
  "data/buildings": "buildings", "data/locations": "locations",
  "data/characters": "characters", "data/npcgifttastes": "npcGiftTastes",
  "data/bigcraftables": "bigCraftables", "data/machines": "machines",
  "data/farmanimals": "farmAnimals", "data/fruittrees": "fruitTrees",
  "data/wildtrees": "wildTrees", "data/fishponddata": "fishPondData",
};
const STRING_TARGETS = new Set(["data/fish", "data/cookingrecipes", "data/craftingrecipes", "data/npcgifttastes"]);
const hasRuntimeTokens = (value) => /\{\{/.test(JSON.stringify(value));
const plainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const values = (value) => (Array.isArray(value) ? value : String(value || "").split(",")).map(String).map((entry) => entry.trim()).filter(Boolean);
const normalize = (value) => String(value).replace(/\\/g, "/").toLowerCase();
const inside = (root, path) => { const rel = relative(root, path); return rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\") && !/^[A-Za-z]:/.test(rel); };

export function supportedDataEdit(change, target) {
  if (!plainObject(change) || String(change.Action || "").toLowerCase() !== "editdata") return false;
  // Only additions are interpreted. Other directives can change entry identity or order.
  const allowed = new Set(["Action", "Target", "Entries", "TargetField", "LogName"]);
  if (Object.keys(change).some((key) => !allowed.has(key)) || hasRuntimeTokens(change)) return false;
  if (!plainObject(change.Entries)) return false;
  if (change.TargetField !== undefined && !Array.isArray(change.TargetField)) return false;
  const field = change.TargetField || [];
  if (field.length) {
    return ["data/shops", "data/locations"].includes(target) && field.length === 2 &&
      typeof field[0] === "string" && field[0].length > 0 && typeof field[1] === "string" &&
      field[1].toLowerCase() === (target === "data/shops" ? "items" : "fish") &&
      Object.values(change.Entries).every(plainObject);
  }
  if (!DICTIONARIES[target]) return false;
  return Object.values(change.Entries).every((entry) => STRING_TARGETS.has(target) ? typeof entry === "string" : plainObject(entry));
}

export function supportedAssetLoad(change, target) {
  return plainObject(change) && String(change.Action || "").toLowerCase() === "load" &&
    Object.keys(change).every((key) => ["Action", "Target", "FromFile", "LogName"].includes(key)) &&
    (/^mods\//i.test(target) || /^(characters|portraits)\/[^/]+$/i.test(target)) &&
    typeof change.FromFile === "string" && !hasRuntimeTokens(change) && /\.png$/i.test(change.FromFile);
}

export function createCatalogState() {
  return {
    overlay: { ...Object.fromEntries(Object.values(DICTIONARIES).map((key) => [key, {}])), locationFish: [], shopItems: [], textures: {}, npcTextures: {} },
    changes: [], claims: new Map(), unsupportedChangeCount: 0, parseFailureCount: 0,
  };
}

function claim(state, identity, destination, key, value, record) {
  const previous = state.claims.get(identity);
  if (previous) {
    previous.record.supported = false;
    record.supported = false;
    delete previous.destination[previous.key];
    return;
  }
  // Define an own property even for a mod identifier named __proto__.
  Object.defineProperty(destination, key, { value, writable: true, configurable: true, enumerable: true });
  state.claims.set(identity, { destination, key, record });
}

export function inspectContentPatcherPack(packRoot, state, path = join(packRoot, "content.json"), visited = new Set(), depth = 0, uncertain = false) {
  const resolved = resolve(path);
  if (depth > 8 || !inside(packRoot, resolved) || visited.has(resolved)) { state.unsupportedChangeCount++; return; }
  visited.add(resolved);
  let content;
  try {
    if (statSync(resolved).size > 4 * 1024 * 1024) throw new Error("Too large");
    content = JSON5.parse(readFileSync(resolved, "utf8"));
    if (!plainObject(content) || !Array.isArray(content.Changes)) throw new Error("Invalid Changes");
  } catch { state.parseFailureCount++; return; }
  for (const change of content.Changes) {
    if (!plainObject(change)) { state.unsupportedChangeCount++; continue; }
    if (String(change.Action || "").toLowerCase() === "include") {
      const includes = values(change.FromFile);
      const skipped = uncertain || Object.keys(change).some((key) => !["Action", "FromFile", "LogName"].includes(key));
      if (skipped) state.unsupportedChangeCount++;
      if (!includes.length || hasRuntimeTokens(change.FromFile)) { state.unsupportedChangeCount++; continue; }
      // Traverse static conditional includes only to identify affected domains, never to consume data.
      for (const include of includes) inspectContentPatcherPack(packRoot, state, resolve(dirname(resolved), include), new Set(visited), depth + 1, skipped);
      continue;
    }
    const targets = values(change.Target);
    if (!targets.length) { state.unsupportedChangeCount++; continue; }
    for (const originalTarget of targets) {
      const target = normalize(originalTarget);
      const asset = supportedAssetLoad(change, target);
      const record = { target, supported: !uncertain && (asset || supportedDataEdit(change, target)), asset };
      state.changes.push(record);
      if (!record.supported) continue;
      if (asset) {
        const source = resolve(packRoot, change.FromFile);
        if (!inside(packRoot, source) || !existsSync(source)) { record.supported = false; continue; }
        const destination = /^mods\//.test(target) ? state.overlay.textures : state.overlay.npcTextures;
        claim(state, target, destination, destination === state.overlay.npcTextures ? originalTarget.replace(/\\/g, "/") : target, source, record);
      } else if (change.TargetField?.length) {
        const [parentId] = change.TargetField;
        const destination = {};
        const list = target === "data/shops" ? state.overlay.shopItems : state.overlay.locationFish;
        const entry = { [target === "data/shops" ? "shopId" : "locationId"]: parentId };
        Object.defineProperty(entry, "items", { enumerable: true, get: () => Object.values(destination) });
        list.push(entry);
        for (const [id, value] of Object.entries(change.Entries))
          claim(state, JSON.stringify([target, parentId, value.Id || id]), destination, id, { ...value, Id: value.Id || id }, record);
      } else {
        for (const [id, value] of Object.entries(change.Entries))
          claim(state, JSON.stringify([target, id]), state.overlay[DICTIONARIES[target]], id, value, record);
      }
    }
  }
}

function manifestPaths(root, depth = 0) {
  if (!root || depth > 4) return [];
  const found = [];
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      const directory = join(root, entry.name);
      const manifest = join(directory, "manifest.json");
      if (existsSync(manifest)) found.push(manifest);
      else found.push(...manifestPaths(directory, depth + 1));
    }
  } catch { /* Diagnostics report unreadable input separately. */ }
  return found;
}

export async function buildContentPatcherCatalogOverlay(modsRoot) {
  const state = createCatalogState();
  for (const manifestPath of manifestPaths(modsRoot)) {
    try {
      const manifest = JSON5.parse(readFileSync(manifestPath, "utf8"));
      if (String(manifest?.ContentPackFor?.UniqueID || "").toLowerCase() === "pathoschild.contentpatcher")
        inspectContentPatcherPack(dirname(manifestPath), state);
    } catch { /* Compatibility scanner reports parse failures. */ }
  }
  return state.overlay;
}
