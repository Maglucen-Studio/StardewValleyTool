import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { unpackToFiles } from "xnb";
import JSON5 from "json5";
import { loadConfig, projectRoot, runtimeRoot, runtimePaths, validateConfig } from "./config.mjs";
import { ensureRuntimeDirectories, syncRuntimePublic } from "./runtime-files.mjs";
import { renderCommunityRooms } from "./render-community-rooms.mjs";
import { localizedXnbPath } from "./localization.mjs";

const config = loadConfig();
const errors = validateConfig(config, { requireSave: false });
if (errors.length) throw new Error(errors.join(" "));
const project = runtimeRoot;
const { contentRoot, modsRoot } = runtimePaths(config);
ensureRuntimeDirectories();

async function unpack(relativePath) {
  const source = resolve(contentRoot, relativePath);
  const fileName = relativePath.split(/[\\/]/).at(-1);
  const outputs = await unpackToFiles(await readFile(source), { fileName });
  const jsonOutput = outputs.find(output => output.extension === "json");
  if (!jsonOutput) throw new Error(`Could not extract ${relativePath}`);
  const parsed = JSON.parse(await jsonOutput.data.text());
  return parsed.content;
}

async function unpackLocalized(relativePath, suffix = "") {
  return unpack(localizedXnbPath(contentRoot, relativePath, suffix));
}

async function unpackTexture(relativePath, destination) {
  const source = resolve(contentRoot, relativePath);
  const fileName = relativePath.split(/[\\/]/).at(-1);
  const outputs = await unpackToFiles(await readFile(source), { fileName });
  const png = outputs.find(output => output.extension === "png");
  if (!png) throw new Error(`Could not extract texture ${relativePath}`);
  await mkdir(resolve(project, destination, ".."), { recursive: true });
  await writeFile(resolve(project, destination), Buffer.from(await png.data.arrayBuffer()));
}

async function unpackBinary(relativePath, extension, destination) {
  const source = resolve(contentRoot, relativePath);
  const fileName = relativePath.split(/[\\/]/).at(-1);
  const outputs = await unpackToFiles(await readFile(source), { fileName });
  const output = outputs.find(candidate => candidate.extension === extension);
  if (!output) throw new Error(`Could not extract ${extension} from ${relativePath}`);
  await mkdir(resolve(project, destination, ".."), { recursive: true });
  await writeFile(resolve(project, destination), Buffer.from(await output.data.arrayBuffer()));
}

async function localizedNamesByEnglish(relativePath, includeKey, suffix) {
  const base = await unpack(relativePath);
  const localized = await unpackLocalized(relativePath, suffix);
  return Object.fromEntries(
    Object.entries(base).flatMap(([key, english]) =>
      includeKey(key) && typeof english === "string" && localized[key]
        ? [[english, localized[key]]]
        : [],
    ),
  );
}

async function localizedLegacyRecordNames(relativePath, suffix) {
  const base = await unpack(relativePath);
  const localized = await unpackLocalized(relativePath, suffix);
  return Object.fromEntries(
    Object.entries(base).flatMap(([key, raw]) => {
      const localizedRaw = localized[key];
      if (typeof raw !== "string" || typeof localizedRaw !== "string") return [];
      const englishFields = raw.split("/");
      const localizedFields = localizedRaw.split("/");
      const englishName = englishFields.at(-1) || englishFields[0];
      const localizedName = localizedFields.at(-1) || localizedFields[0];
      return englishName && localizedName ? [[englishName, localizedName]] : [];
    }),
  );
}

const nameCatalogs = [
  ["Strings/Objects.xnb", key => key.endsWith("_Name")],
  ["Strings/BigCraftables.xnb", key => key.endsWith("_Name")],
  ["Strings/Tools.xnb", key => key.endsWith("_Name")],
  ["Strings/Weapons.xnb", key => key.endsWith("_Name")],
  ["Strings/Pants.xnb", key => key.endsWith("_Name")],
  ["Strings/Shirts.xnb", key => key.endsWith("_Name")],
  ["Strings/Furniture.xnb", () => true],
  ["Strings/FarmAnimals.xnb", key => key.includes("DisplayType_")],
];
const fish = await unpack("Data/Fish.xnb");
function extractProductionCatalog() {
  const executable = resolve(projectRoot, "desktop", "resources", "game-data-extractor", "StardewDataExtractor.exe");
  if (!existsSync(executable))
    throw new Error("The local game data extractor is missing. Run npm run desktop:game-data.");
  const result = spawnSync(executable, [config.stardewPath], {
    cwd: projectRoot,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`The local game data extractor exited with code ${result.status}: ${result.stderr || "unknown error"}`);
  return JSON.parse(result.stdout);
}
const productionCatalog = extractProductionCatalog();
async function buildGameLocalizationCatalog(catalogLanguage, catalogLocale, catalogSuffix) {
  const localizedObjectNamesByEnglish = Object.assign(
    {},
    ...(await Promise.all(
      nameCatalogs.map(([path, includeKey]) =>
        localizedNamesByEnglish(path, includeKey, catalogSuffix),
      ),
    )),
    await localizedLegacyRecordNames("Data/Boots.xnb", catalogSuffix),
    await localizedLegacyRecordNames("Data/hats.xnb", catalogSuffix),
  );
  const objectNames = await unpackLocalized("Strings/Objects.xnb", catalogSuffix);
  const localizedAchievementRecords = await unpackLocalized("Data/Achievements.xnb", catalogSuffix);
  const localizedQuestRecords = await unpackLocalized("Data/Quests.xnb", catalogSuffix);
  const localizedAchievementsById = Object.fromEntries(
    Object.entries(localizedAchievementRecords).map(([id, raw]) => {
      const fields = String(raw).split("^");
      const name = fields[0].replace(/\s+\([^)]*\)$/, "");
      const requirement = (fields[1] || "").replace(/(\d)o\b/g, "$1g");
      return [id, { name, requirement }];
    }),
  );
  const localizedQuestsById = Object.fromEntries(
    Object.entries(localizedQuestRecords).map(([id, raw]) => {
      const fields = String(raw).split("/");
      return [id, { title: fields[1] || "", description: fields[2] || "", objective: fields[3] || "" }];
    }),
  );
  const localizedNamesByQualifiedId = Object.fromEntries(
    Object.entries(fish).flatMap(([id, raw]) => {
      const englishName = typeof raw === "string" ? raw.split("/", 1)[0] : "";
      const localizedName = localizedObjectNamesByEnglish[englishName];
      return localizedName ? [[`(O)${id}`, localizedName]] : [];
    }),
  );
  return {
    language: catalogLanguage,
    locale: catalogLocale,
    catalogVersion: 9,
    objectNames,
    localizedObjectNamesByEnglish,
    localizedNamesByQualifiedId,
    localizedAchievementsById,
    localizedQuestsById,
    specialOrderStrings: await unpackLocalized("Strings/SpecialOrderStrings.xnb", catalogSuffix),
  };
}

const gameLocalizationCatalogs = Object.fromEntries(
  await Promise.all([
    ["en", "en-US", ""],
    ["es", "es-ES", "es-ES"],
  ].map(async ([catalogLanguage, catalogLocale, catalogSuffix]) => [
    catalogLanguage,
    await buildGameLocalizationCatalog(catalogLanguage, catalogLocale, catalogSuffix),
  ])),
);
// Snapshot generation always consumes the stable English/base catalog. The
// renderer selects a cached game catalog independently from the save logic.
const activeLocalization = gameLocalizationCatalogs.en;

const gameData = {
  _localization: { language: "neutral", catalogVersion: 9 },
  giftTastes: await unpack("Data/NPCGiftTastes.xnb"),
  cookingRecipes: await unpack("Data/CookingRecipes.xnb"),
  craftingRecipes: await unpack("Data/CraftingRecipes.xnb"),
  cookingChannel: await unpack("Data/TV/CookingChannel.xnb"),
  tipChannel: await unpack("Data/TV/TipChannel.xnb"),
  fish,
  productionCatalog,
  hair: await unpack("Data/HairData.xnb"),
  hats: await unpack("Data/hats.xnb"),
  furniture: await unpack("Data/Furniture.xnb"),
  objectNames: activeLocalization.objectNames,
  localizedObjectNamesByEnglish: activeLocalization.localizedObjectNamesByEnglish,
  localizedNamesByQualifiedId: activeLocalization.localizedNamesByQualifiedId,
  localizedAchievementsById: activeLocalization.localizedAchievementsById,
  localizedQuestsById: activeLocalization.localizedQuestsById,
  specialOrderStrings: activeLocalization.specialOrderStrings,
};

const textures = {
  "Maps/springobjects.xnb": "public/assets/sprites/springobjects.png",
  "TileSheets/Objects_2.xnb": "public/assets/sprites/Objects_2.png",
  "TileSheets/Craftables.xnb": "public/assets/sprites/Craftables.png",
  "TileSheets/furniture.xnb": "public/assets/sprites/furniture.png",
  "TileSheets/weapons.xnb": "public/assets/sprites/weapons.png",
  "TileSheets/tools.xnb": "public/assets/sprites/tools.png",
  "TileSheets/crops.xnb": "public/assets/sprites/crops.png",
  "TileSheets/fruitTrees.xnb": "public/assets/sprites/fruitTrees.png",
  "TerrainFeatures/grass.xnb": "public/assets/sprites/grass.png",
  "TerrainFeatures/hoeDirt.xnb": "public/assets/sprites/hoeDirt.png",
  "TerrainFeatures/tree1_spring.xnb": "public/assets/sprites/tree1_spring.png",
  "TerrainFeatures/tree2_spring.xnb": "public/assets/sprites/tree2_spring.png",
  "TerrainFeatures/tree3_spring.xnb": "public/assets/sprites/tree3_spring.png",
  "TerrainFeatures/tree8_spring.xnb": "public/assets/sprites/tree8_spring.png",
  "Characters/Farmer/farmer_base.xnb": "assetbuild/unpacked/farmer/farmer_base.png",
  "Characters/Farmer/farmer_base_bald.xnb": "assetbuild/unpacked/farmer/farmer_base_bald.png",
  "Characters/Farmer/farmer_girl_base.xnb": "assetbuild/unpacked/farmer/farmer_girl_base.png",
  "Characters/Farmer/farmer_girl_base_bald.xnb": "assetbuild/unpacked/farmer/farmer_girl_base_bald.png",
  "Characters/Farmer/hairstyles.xnb": "assetbuild/unpacked/farmer/hairstyles.png",
  "Characters/Farmer/hairstyles2.xnb": "assetbuild/unpacked/farmer/hairstyles2.png",
  "Characters/Farmer/shirts.xnb": "assetbuild/unpacked/farmer/shirts.png",
  "Characters/Farmer/pants.xnb": "assetbuild/unpacked/farmer/pants.png",
  "Characters/Farmer/hats.xnb": "assetbuild/unpacked/farmer/hats.png",
  "Characters/Farmer/accessories.xnb": "assetbuild/unpacked/farmer/accessories.png",
  "Characters/Farmer/skinColors.xnb": "assetbuild/unpacked/farmer/skinColors.png",
  "Characters/Farmer/shoeColors.xnb": "assetbuild/unpacked/farmer/shoeColors.png",
  "LooseSprites/Cursors.xnb": "assetbuild/unpacked/Cursors.png",
  "LooseSprites/map.xnb": "public/assets/maps/world-spring.png",
  "LooseSprites/map_summer.xnb": "public/assets/maps/world-summer.png",
  "LooseSprites/map_fall.xnb": "public/assets/maps/world-fall.png",
  "LooseSprites/map_winter.xnb": "public/assets/maps/world-winter.png",
  "Buildings/Barn.xnb": "public/assets/sprites/Barn.png",
  "Buildings/Big Barn.xnb": "public/assets/sprites/Big Barn.png",
  "Buildings/Deluxe Barn.xnb": "public/assets/sprites/Deluxe Barn.png",
  "Buildings/Coop.xnb": "public/assets/sprites/Coop.png",
  "Buildings/Big Coop.xnb": "public/assets/sprites/Big Coop.png",
  "Buildings/Deluxe Coop.xnb": "public/assets/sprites/Deluxe Coop.png",
  "Buildings/Greenhouse.xnb": "public/assets/sprites/Greenhouse.png",
  "Buildings/houses.xnb": "public/assets/sprites/houses.png",
  "Buildings/Pet Bowl.xnb": "public/assets/sprites/Pet Bowl.png",
  "Buildings/Shipping Bin.xnb": "public/assets/sprites/Shipping Bin.png",
  "Buildings/Silo.xnb": "public/assets/sprites/Silo.png",
  "Buildings/Stable.xnb": "public/assets/sprites/Stable.png",
  "Buildings/Shed.xnb": "public/assets/sprites/Shed.png",
  "Buildings/Big Shed.xnb": "public/assets/sprites/Big Shed.png",
  "Buildings/Fish Pond.xnb": "public/assets/sprites/Fish Pond.png",
  "Buildings/Slime Hutch.xnb": "public/assets/sprites/Slime Hutch.png",
  "Buildings/Well.xnb": "public/assets/sprites/Well.png",
  "Buildings/Mill.xnb": "public/assets/sprites/Mill.png",
  "Buildings/Junimo Hut.xnb": "public/assets/sprites/Junimo Hut.png",
  "Buildings/Earth Obelisk.xnb": "public/assets/sprites/Earth Obelisk.png",
  "Buildings/Water Obelisk.xnb": "public/assets/sprites/Water Obelisk.png",
  "Buildings/Desert Obelisk.xnb": "public/assets/sprites/Desert Obelisk.png",
  "Buildings/Island Obelisk.xnb": "public/assets/sprites/Island Obelisk.png",
  "Buildings/Gold Clock.xnb": "public/assets/sprites/Gold Clock.png",
  "Buildings/Log Cabin.xnb": "public/assets/sprites/Log Cabin.png",
  "Maps/paths.xnb": "assetbuild/unpacked/paths.png",
  "Maps/townInterior.xnb": "assetbuild/unpacked/townInterior.png",
  "Maps/townInterior_2.xnb": "assetbuild/unpacked/townInterior_2.png",
  "Maps/JojaRuins_TileSheet.xnb": "assetbuild/unpacked/JojaRuins_TileSheet.png",
};

const animalsByTexture = new Map();
for (const animal of productionCatalog.farmAnimals || []) {
  if (!animal.texture) continue;
  const assetKey = String(animal.id || animal.name || animal.texture).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "animal";
  const destination = `public/assets/animals/${assetKey}.png`;
  const source = `${String(animal.texture).replace(/\\/g, "/")}.xnb`;
  textures[source] = destination;
  animal.artworkUrl = `/${destination.replace(/^public\//, "")}`;
  animalsByTexture.set(source, [...(animalsByTexture.get(source) || []), animal]);
}

const friendshipCharacters = [
  "Abigail", "Alex", "Caroline", "Clint", "Demetrius", "Dwarf", "Elliott", "Emily", "Evelyn", "George", "Gus",
  "Haley", "Harvey", "Jas", "Jodi", "Kent", "Krobus", "Leah", "Leo", "Lewis", "Linus", "Marnie", "Maru", "Pam", "Penny",
  "Pierre", "Robin", "Sam", "Sandy", "Sebastian", "Shane", "Vincent", "Willy", "Wizard"
];
const optionalFriendshipCharacters = new Set(["Leo"]);
for (const name of friendshipCharacters) {
  textures[`Characters/${name}.xnb`] = `public/assets/characters/${name}.png`;
  textures[`Portraits/${name}.xnb`] = `public/assets/portraits/${name}.png`;
}

// xnb's texture decoder can terminate the Windows process when many files are
// decompressed concurrently. Asset extraction only runs when the game or a
// content pack changes, so process the files serially for a reliable cold start.
for (const [source, destination] of Object.entries(textures)) {
  try { await unpackTexture(source, destination); }
  catch (error) {
    const animals = animalsByTexture.get(source);
    if (animals) {
      for (const animal of animals) delete animal.artworkUrl;
      console.warn(`Animal artwork unavailable for ${source}; using the generated placeholder.`);
      continue;
    }
    const character = /^(?:Characters|Portraits)\/([^/]+)\.xnb$/i.exec(source)?.[1];
    if (!character || !optionalFriendshipCharacters.has(character) || error?.code !== "ENOENT") throw error;
  }
}
await Promise.all([
  copyFile(resolve(project, "assetbuild/unpacked/farmer/hats.png"), resolve(project, "public/assets/sprites/hats.png")),
  copyFile(resolve(project, "assetbuild/unpacked/farmer/shirts.png"), resolve(project, "public/assets/sprites/shirts.png")),
]);

await Promise.all([
  unpackBinary("Maps/CommunityCenter_Refurbished.xnb", "tbin", "assetbuild/unpacked/CommunityCenter_Refurbished.tbin"),
  unpackBinary("Maps/CommunityCenter_Ruins.xnb", "tbin", "assetbuild/unpacked/CommunityCenter_Ruins.tbin"),
  unpackBinary("Maps/AbandonedJojaMart.xnb", "tbin", "assetbuild/unpacked/AbandonedJojaMart.tbin"),
]);
await renderCommunityRooms(project);

async function findContentPacks(directory) {
  const found = [];
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) found.push(...await findContentPacks(path));
      else if (entry.name.toLowerCase() === "content.json") found.push(path);
    }
  } catch {
    // A missing or unreadable Mods directory simply means there are no content packs to inspect.
  }
  return found;
}

async function readJson5(path, fallback = {}) {
  try { return JSON5.parse(await readFile(path, "utf8")); }
  catch { return fallback; }
}

function conditionMatches(when, configValues) {
  return Object.entries(when || {}).every(([key, expected]) => !(key in configValues) || String(configValues[key]).toLowerCase() === String(expected).toLowerCase());
}

function resolveTokens(value, tokens) {
  let resolved = String(value || "");
  for (let pass = 0; pass < 5; pass += 1) {
    const next = resolved.replace(/\{\{([^}:]+)(?::[^}]*)?\}\}/g, (match, name) => tokens[name] ?? match);
    if (next === resolved) break;
    resolved = next;
  }
  return resolved;
}

async function discoverModdedNpcs() {
  const metadata = {};
  const giftTastes = {};
  let artworkCount = 0;
  for (const contentPath of await findContentPacks(modsRoot)) {
    const packRoot = resolve(contentPath, "..");
    const content = await readJson5(contentPath);
    const savedConfig = await readJson5(resolve(packRoot, "config.json"));
    const configValues = Object.fromEntries(Object.entries(content.ConfigSchema || {}).map(([key, schema]) => [key, schema?.Default]));
    Object.assign(configValues, savedConfig);
    const tokens = {};
    for (const token of content.DynamicTokens || []) {
      if (token?.Name && conditionMatches(token.When, configValues)) tokens[token.Name] = resolveTokens(token.Value, tokens);
    }
    for (const change of content.Changes || []) {
      if (!conditionMatches(change.When, configValues)) continue;
      const target = resolveTokens(change.Target, tokens);
      if (String(change.Action).toLowerCase() === "load" && change.FromFile) {
        const match = /^(Characters|Portraits)\/([^/]+)$/i.exec(target);
        const source = resolve(packRoot, resolveTokens(change.FromFile, tokens));
        if (match && extname(source).toLowerCase() === ".png") {
          const destination = resolve(project, `public/assets/${match[1].toLowerCase() === "characters" ? "characters" : "portraits"}/${match[2]}.png`);
          try {
            await mkdir(resolve(destination, ".."), { recursive: true });
            await copyFile(source, destination);
            artworkCount += 1;
          } catch {
            // Ignore optional or conditionally unavailable Content Patcher files.
          }
        }
      }
      if (String(change.Action).toLowerCase() === "editdata" && target.toLowerCase() === "data/characters" && change.Entries) {
        for (const [id, entry] of Object.entries(change.Entries)) {
          if (!entry || typeof entry !== "object") continue;
          metadata[id] = {
            displayName: entry.DisplayName || id,
            birthSeason: entry.BirthSeason || null,
            birthDay: Number(entry.BirthDay) || null,
          };
        }
      }
      if (String(change.Action).toLowerCase() === "editdata" && target.toLowerCase() === "data/npcgifttastes" && change.Entries) {
        Object.assign(giftTastes, change.Entries);
      }
    }
  }
  return { metadata, giftTastes, artworkCount };
}

const moddedNpcs = await discoverModdedNpcs();
gameData.moddedCharacters = moddedNpcs.metadata;
Object.assign(gameData.giftTastes, moddedNpcs.giftTastes);
await Promise.all([
  writeFile(resolve(project, "assetbuild/game-data.json"), JSON.stringify(gameData), "utf8"),
  ...Object.entries(gameLocalizationCatalogs).map(([catalogLanguage, catalog]) =>
    writeFile(
      resolve(project, `public/data/game-localization.${catalogLanguage}.json`),
      JSON.stringify(catalog),
      "utf8",
    ),
  ),
]);
if (moddedNpcs.artworkCount) console.log(`Imported ${moddedNpcs.artworkCount} modded NPC artwork files.`);
syncRuntimePublic();
