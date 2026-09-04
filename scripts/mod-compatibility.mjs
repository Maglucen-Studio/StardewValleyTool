import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import JSON5 from "json5";
import { supportedAssetLoad, supportedDataEdit } from "./content-patcher-catalog.mjs";

const SAFE_CODE_MODS = new Set([
  "maglucen.stardewvalleytoolbridge",
  "pathoschild.consolecommands",
  "pathoschild.contentpatcher",
  "smapi.savebackup",
]);
const SUPPORTED_CONTENT_PACK_DOMAINS = new Set(["items", "crops", "npcs"]);
const DOMAIN_ORDER = ["items", "crops", "fish", "recipes", "machines", "animals", "npcs", "buildings", "locations", "maps", "quests", "other"];

function domainForTarget(target) {
  const normalized = String(target || "").replace(/\\/g, "/").toLowerCase();
  if (!normalized || normalized.includes("{{")) return "other";
  if (/^data\/(objects|bigcraftables|furniture|hats|shirts|pants|boots)/.test(normalized)) return "items";
  if (/^data\/shops/.test(normalized)) return "items";
  if (/^data\/(crops|wildtrees|fruittrees)/.test(normalized)) return "crops";
  if (/^data\/(fish|fishponddata)/.test(normalized)) return "fish";
  if (/^data\/(cookingrecipes|craftingrecipes)/.test(normalized)) return "recipes";
  if (/^data\/(machines|machineoutputrules)/.test(normalized)) return "machines";
  if (/^data\/farmanimals/.test(normalized) || /^animals\//.test(normalized)) return "animals";
  if (/^data\/(characters|npcdispositions|npcgifttastes)/.test(normalized) || /^(characters|portraits|characters\/dialogue)\//.test(normalized)) return "npcs";
  if (/^data\/(buildings|blueprints)/.test(normalized) || /^buildings\//.test(normalized)) return "buildings";
  if (/^data\/locations/.test(normalized)) return "locations";
  if (/^maps\//.test(normalized)) return "maps";
  if (/^data\/(quests|specialorders)/.test(normalized)) return "quests";
  return "other";
}

function supportedContentChange(change, target) {
  const action = String(change?.Action || "").toLowerCase();
  const normalized = String(target || "").replace(/\\/g, "/").toLowerCase();
  if (supportedDataEdit(change, normalized)) return true;
  return (
    !change?.When &&
    (action === "editdata" && ["data/characters", "data/npcgifttastes"].includes(normalized)) ||
    (!change?.When && action === "load" && /^(characters|portraits)\/[^/]+$/.test(normalized))
  );
}

function safeReadJson5(path, failures) {
  try {
    if (statSync(path).size > 4 * 1024 * 1024) throw new Error("File exceeds compatibility scan limit.");
    return JSON5.parse(readFileSync(path, "utf8"));
  } catch {
    failures.count += 1;
    return null;
  }
}

function manifestPaths(root, depth = 0) {
  if (!root || !existsSync(root) || depth > 4) return [];
  const found = [];
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
      const directory = join(root, entry.name);
      const manifest = join(directory, "manifest.json");
      if (existsSync(manifest)) found.push(manifest);
      else found.push(...manifestPaths(directory, depth + 1));
    }
  } catch {
    // An unreadable Mods directory behaves like an empty one.
  }
  return found;
}

function targetsFromValue(value) {
  if (Array.isArray(value)) return value.flatMap(targetsFromValue);
  return String(value || "").split(",").map((target) => target.trim()).filter(Boolean);
}

function inspectContentFile(path, packRoot, state, visited, depth = 0) {
  const resolvedPath = resolve(path);
  const relativePath = relative(packRoot, resolvedPath);
  if (depth > 8 || relativePath.startsWith("..") || visited.has(resolvedPath)) {
    state.unsupportedChangeCount += 1;
    return;
  }
  visited.add(resolvedPath);
  const content = safeReadJson5(resolvedPath, state.failures);
  if (!content) return;
  const changes = Array.isArray(content.Changes) ? content.Changes : [];
  for (const change of changes) {
    if (!change || typeof change !== "object") continue;
    const action = String(change.Action || "").toLowerCase();
    if (action === "include") {
      const includes = targetsFromValue(change.FromFile);
      if (!includes.length || includes.some((entry) => entry.includes("{{"))) {
        state.unsupportedChangeCount += 1;
        continue;
      }
      for (const included of includes)
        inspectContentFile(join(dirname(resolvedPath), included), packRoot, state, visited, depth + 1);
      continue;
    }
    const targets = targetsFromValue(change.Target);
    if (!targets.length) {
      state.unsupportedChangeCount += 1;
      continue;
    }
    for (const target of targets) {
      if (supportedAssetLoad(change, target)) continue;
      const domain = domainForTarget(target);
      state.alteredDomains.add(domain);
      if (domain === "other" || !SUPPORTED_CONTENT_PACK_DOMAINS.has(domain) || !supportedContentChange(change, target))
        state.uncertainDomains.add(domain);
      else
        state.supportedDomains.add(domain);
    }
  }
}

export function scanModCompatibility(modsRoot) {
  const state = {
    installedModCount: 0,
    contentPackCount: 0,
    codeModCount: 0,
    unclassifiedCodeModCount: 0,
    unsupportedChangeCount: 0,
    failures: { count: 0 },
    alteredDomains: new Set(),
    supportedDomains: new Set(),
    uncertainDomains: new Set(),
  };
  for (const manifestPath of manifestPaths(modsRoot)) {
    const manifest = safeReadJson5(manifestPath, state.failures);
    if (!manifest || typeof manifest !== "object") continue;
    state.installedModCount += 1;
    const uniqueId = String(manifest.UniqueID || "").toLowerCase();
    const contentPackFor = String(manifest.ContentPackFor?.UniqueID || "").toLowerCase();
    if (contentPackFor) {
      state.contentPackCount += 1;
      if (contentPackFor === "pathoschild.contentpatcher") {
        const packRoot = dirname(manifestPath);
        const contentPath = join(packRoot, "content.json");
        if (existsSync(contentPath)) inspectContentFile(contentPath, packRoot, state, new Set());
        else state.failures.count += 1;
      } else {
        state.unsupportedChangeCount += 1;
        state.uncertainDomains.add("other");
      }
      continue;
    }
    state.codeModCount += 1;
    if (!SAFE_CODE_MODS.has(uniqueId)) state.unclassifiedCodeModCount += 1;
  }
  if (state.unclassifiedCodeModCount > 0) state.uncertainDomains.add("other");
  const sortDomains = (values) => [...values].sort((left, right) => DOMAIN_ORDER.indexOf(left) - DOMAIN_ORDER.indexOf(right));
  const uncertain = state.failures.count > 0 || state.unsupportedChangeCount > 0 || state.uncertainDomains.size > 0;
  const modAware = state.alteredDomains.size > 0;
  return {
    status: uncertain ? "uncertain" : modAware ? "mod-aware" : "vanilla",
    installedModCount: state.installedModCount,
    contentPackCount: state.contentPackCount,
    codeModCount: state.codeModCount,
    unclassifiedCodeModCount: state.unclassifiedCodeModCount,
    alteredDomains: sortDomains(state.alteredDomains),
    supportedDomains: sortDomains(state.supportedDomains),
    uncertainDomains: sortDomains(state.uncertainDomains),
    unsupportedChangeCount: state.unsupportedChangeCount,
    parseFailureCount: state.failures.count,
  };
}
