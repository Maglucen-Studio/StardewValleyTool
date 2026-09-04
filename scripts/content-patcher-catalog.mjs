import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import JSON5 from "json5";

const MAX_DEPTH = 8;

async function readJson5(path) {
  return JSON5.parse(await readFile(path, "utf8"));
}

async function manifestPaths(root, depth = 0) {
  if (!root || depth > 4) return [];
  const found = [];
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      const directory = join(root, entry.name);
      const manifest = join(directory, "manifest.json");
      if (existsSync(manifest)) found.push(manifest);
      else found.push(...await manifestPaths(directory, depth + 1));
    }
  } catch {
    // A missing or unreadable Mods directory is equivalent to no overlays.
  }
  return found;
}

function plainEntries(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.values(value).every((entry) => entry && typeof entry === "object" && !Array.isArray(entry)) ? value : null;
}

function hasRuntimeTokens(value) {
  return /\{\{/.test(JSON.stringify(value));
}

function targets(value) {
  return (Array.isArray(value) ? value : String(value || "").split(","))
    .map((entry) => String(entry).trim().replace(/\\/g, "/").toLowerCase())
    .filter(Boolean);
}

function filePaths(value) {
  return (Array.isArray(value) ? value : String(value || "").split(","))
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

function supportedDataEdit(change, target) {
  if (String(change?.Action || "").toLowerCase() !== "editdata" || change.When || change.Fields || change.MoveEntries)
    return false;
  const entries = plainEntries(change.Entries);
  if (!entries || hasRuntimeTokens(entries)) return false;
  const targetField = Array.isArray(change.TargetField) ? change.TargetField.map(String) : [];
  if (target === "data/objects" || target === "data/crops") return targetField.length === 0;
  return target === "data/shops" && targetField.length === 2 && targetField[1].toLowerCase() === "items";
}

function supportedAssetLoad(change, target) {
  return String(change?.Action || "").toLowerCase() === "load" &&
    !change.When &&
    /^mods\//i.test(target) &&
    typeof change.FromFile === "string" &&
    !hasRuntimeTokens(change.FromFile) &&
    /\.png$/i.test(change.FromFile);
}

function addEdit(overlay, change, target) {
  if (!supportedDataEdit(change, target)) return false;
  if (target === "data/objects") Object.assign(overlay.objects, change.Entries);
  else if (target === "data/crops") Object.assign(overlay.crops, change.Entries);
  else {
    overlay.shopItems.push({
      shopId: String(change.TargetField[0]),
      items: Object.entries(change.Entries).map(([id, item]) => ({ ...item, Id: item.Id || id })),
    });
  }
  return true;
}

async function inspectContentFile(path, packRoot, overlay, visited, depth = 0) {
  const resolved = resolve(path);
  if (depth > MAX_DEPTH || relative(packRoot, resolved).startsWith("..") || visited.has(resolved)) return;
  visited.add(resolved);
  const content = await readJson5(resolved);
  for (const change of Array.isArray(content.Changes) ? content.Changes : []) {
    const action = String(change?.Action || "").toLowerCase();
    if (action === "include" && !change.When && !hasRuntimeTokens(change.FromFile)) {
      for (const include of filePaths(change.FromFile))
        await inspectContentFile(resolve(dirname(resolved), include), packRoot, overlay, visited, depth + 1);
      continue;
    }
    for (const target of targets(change?.Target)) {
      if (supportedAssetLoad(change, target)) {
        const source = resolve(packRoot, change.FromFile);
        if (!relative(packRoot, source).startsWith("..")) overlay.textures[target] = source;
      } else addEdit(overlay, change, target);
    }
  }
}

export async function buildContentPatcherCatalogOverlay(modsRoot) {
  const overlay = { objects: {}, crops: {}, shopItems: [], textures: {} };
  for (const manifestPath of await manifestPaths(modsRoot)) {
    try {
      const manifest = await readJson5(manifestPath);
      if (String(manifest?.ContentPackFor?.UniqueID || "").toLowerCase() !== "pathoschild.contentpatcher") continue;
      const packRoot = dirname(manifestPath);
      const contentPath = join(packRoot, "content.json");
      if (existsSync(contentPath)) await inspectContentFile(contentPath, packRoot, overlay, new Set());
    } catch {
      // Compatibility diagnostics report unreadable packs; extraction stays usable.
    }
  }
  return overlay;
}

export { supportedAssetLoad, supportedDataEdit };
