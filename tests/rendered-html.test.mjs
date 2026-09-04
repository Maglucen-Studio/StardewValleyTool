import assert from "node:assert/strict";
import { readFile as readRawFile } from "node:fs/promises";
import test from "node:test";
import { furnitureDestination } from "../app/furniture-layout.mjs";
import { isForegroundMapLayer } from "../scripts/render-community-rooms.mjs";

async function readFile(path, encoding) {
  const source = await readRawFile(path, encoding);
  const pathname = path instanceof URL ? path.pathname : String(path);
  if (!/\.(?:tsx|css)$/.test(pathname)) return source;
  return source.replace(/>\s+</g, "><").replace(/\s+/g, " ");
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: handler } = await import(workerUrl.href);
  const request = new Request("http://localhost/", {
    headers: { accept: "text/html" },
  });
  const environment = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  return typeof handler === "function"
    ? handler(request, environment)
    : handler.fetch(request, environment, {
        waitUntil() {},
        passThroughOnException() {},
      });
}

test("server renders the local Maglucen companion shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(
    html,
    /<title>Maglucen .* Stardew Valley Companion<\/title>/i,
  );
  assert.match(html, /Preparing your farm/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("furniture sprites anchor to the bottom of their saved collision footprint", async () => {
  assert.deepEqual(
    furnitureDestination({
      x: 4,
      y: 4,
      sourceWidth: 16,
      sourceHeight: 32,
      footprintHeight: 1,
    }),
    [64, 48, 16, 32],
  );
  assert.deepEqual(
    furnitureDestination({
      x: 5,
      y: 4,
      sourceWidth: 32,
      sourceHeight: 48,
      footprintHeight: 2,
    }),
    [80, 48, 32, 48],
  );
  assert.deepEqual(
    furnitureDestination({
      x: 7,
      y: 8,
      sourceWidth: 32,
      sourceHeight: 48,
      footprintHeight: 3,
    }),
    [112, 128, 32, 48],
  );

  const [generator, page] = await Promise.all([
    readRawFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
    readRawFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(generator, /item\.find\("boundingBox"\)/);
  assert.match(generator, /"footprintHeight": footprint_height/);
  assert.match(page, /furnitureDestination\(entity, size\)/);
  assert.match(page, /furnitureDestination\(item, TILE\)/);
});

test("interior foreground map layers occlude furniture like Stardew Valley", async () => {
  assert.equal(isForegroundMapLayer("Back"), false);
  assert.equal(isForegroundMapLayer("Buildings"), false);
  assert.equal(isForegroundMapLayer("Front"), true);
  assert.equal(isForegroundMapLayer("Front2"), true);
  assert.equal(isForegroundMapLayer("AlwaysFront"), true);

  const [renderer, page, styles] = await Promise.all([
    readRawFile(new URL("../scripts/render-storage-location-maps.mjs", import.meta.url), "utf8"),
    readRawFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readRawFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(renderer, /renderLocation\(mapName, season, \{ layered: true \}\)/);
  assert.match(renderer, /interior\.foreground = rendered\.foreground/);
  assert.match(page, /ctx\.drawImage\(currentForeground\.image/);
  assert.match(page, /storage-location-preview-foreground/);
  assert.match(styles, /\.storage-location-preview-foreground/);
});

test("the localization context interpolates variables before and after desktop hydration", async () => {
  const localization = await readFile(
    new URL("../app/i18n.tsx", import.meta.url),
    "utf8",
  );
  assert.match(localization, /function translateMessage\(/);
  assert.match(localization, /t: \(key, variables\) => translateMessage\(english, english, key, variables\)/);
  assert.match(localization, /translateMessage\([\s\S]*?state\.messages,[\s\S]*?variables/);
});

test("planner includes live state, safe save reading, and decision support", async () => {
  const [page, localServer, generator] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/dev-local.mjs", import.meta.url), "utf8"),
    readFile(
      new URL("../scripts/generate_snapshot.py", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(page, /PlanningView/);
  assert.match(page, /t\("today\.section\.priorities"\)/);
  assert.match(page, /t\("web\.achievements\.spoilerFreeMuseum"\)/);
  assert.match(page, /farmMap/);
  assert.match(localServer, /readerSave/);
  assert.doesNotMatch(localServer, /AINCRAD_SAVE:\s*saveFile/);
  assert.match(localServer, /saveReplacementActive/);
  assert.match(generator, /artifact_ids = .*range\(96, 102\)/s);
  assert.match(generator, /mineral_ids = .*range\(538, 579\)/s);
});

test("portable configuration contains no personal paths", async () => {
  const [example, configLoader, generator, readme, viteConfig, builtPublic] = await Promise.all([
    readFile(new URL("../config.example.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/config.mjs", import.meta.url), "utf8"),
    readFile(
      new URL("../scripts/generate_snapshot.py", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/prepare-built-public.mjs", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(example, /maglu|Aincrad|SteamLibrary/i);
  assert.doesNotMatch(generator, /maglu|Aincrad_446203252|SteamLibrary|Trispona/i);
  assert.match(configLoader, /STARDEW_PATH/);
  assert.match(readme, /assets are \*\*not\*\* distributed/i);
  assert.match(viteConfig, /publicDir:\s*command === "build" \? false/);
  assert.doesNotMatch(builtPublic, /cpSync|public["'],\s*"(?:assets|data)/);
});

test("public user-facing sources are English", async () => {
  const sources = await Promise.all(
    [
      "../app/page.tsx",
      "../app/layout.tsx",
      "../scripts/generate_snapshot.py",
      "../scripts/config.mjs",
      "../scripts/dev-local.mjs",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  assert.doesNotMatch(
    sources.join("\n"),
    /[¿¡]|\b(?:Primavera|Verano|Otoño|Invierno|guardado|granja|cultivos|edificios|dinero|suerte|cumpleaños|museo|logros|herramienta|días|año)\b/i,
  );
});

test("full game dates consistently put the year first", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    page,
    /t\("date\.game", \{ year: date\.year, season: t\(`season\.\$\{date\.season\}`\), day: date\.day \}\)/,
  );
  assert.doesNotMatch(
    page,
    /\{current\.seasonLabel\} \{current\.day\}, Year \{current\.year\}/,
  );
});

test("the interface supports persistent high-resolution scaling", async () => {
  const [page, preload, desktop] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../desktop/preload.cjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(page, /stardew-tool-ui-scale/);
  assert.match(page, /window\.innerWidth >= 3000\) return 1\.5/);
  assert.match(page, /aria-label=\{t\("shell\.interfaceSize"\)\}/);
  for (const scale of [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2])
    assert.match(page, new RegExp(`option value=\\{${String(scale).replace(".", "\\.")}\\}`));
  assert.match(preload, /display:set-scale/);
  assert.match(desktop, /setZoomFactor\(scale\)/);
});

test("Buildings hides locked spoilers, uses local sprites, and leaves placement on Map", async () => {
  const [page, styles, generator, extractor] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(
      new URL("../scripts/generate_snapshot.py", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../scripts/extract_game_data.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(page, /t\("web\.planning\.constructionProjectsCurrentlyUnlocked"\)/);
  assert.match(page, /availableBuildings = plan\.buildings\.filter/);
  assert.match(page, /building\.available !== false/);
  assert.match(page, /<BuildingPreview name=\{building\.name\} catalog/);
  assert.match(styles, /\.building-catalog-artwork/);
  assert.match(page, /t\("web\.planning\.thisTabOnlyShowsProjectsYourFarmerCanCurrently"\)/);
  assert.match(page, /"All", "Robin", "Upgrades", "Wizard", "Community"/);
  assert.match(page, /buildingCategories = \([\s\S]*?availableBuildings\.some/);
  assert.match(page, /\{buildingCategories\.map\(\(category\) => \(/);
  assert.match(page, /effectiveBuildingCategory = buildingCategories\.includes\(buildingCategory\)/);
  assert.match(page, /t\("building\.group\.ready\.title"\)/);
  assert.match(page, /t\("building\.group\.missing\.title"\)/);
  assert.match(page, /t\("building\.group\.completed\.title"\)/);
  assert.match(page, /stardew-tool-building-sort/);
  assert.match(page, /t\("crops\.sortAlphabetical"\)/);
  assert.match(page, /t\("web\.planning\.costLowToHigh"\)/);
  for (const project of [
    "Silo",
    "Well",
    "Mill",
    "Shipping Bin",
    "Pet Bowl",
    "Big Coop",
    "Deluxe Barn",
    "Big Shed",
    "Farmhouse Upgrade 3",
    "Junimo Hut",
    "Island Obelisk",
    "Gold Clock",
    "Pam's House",
    "Town Shortcuts",
  ]) {
    assert.ok(
      generator.includes(`"name": "${project}"`),
      `${project} should be in the catalog`,
    );
  }
  assert.match(generator, /"category": "Robin"/);
  assert.match(generator, /"category": "Wizard"/);
  assert.match(generator, /placed_buildings/);
  assert.match(generator, /has_magic_construction = bool_value\(player, "hasMagicInk"\)/);
  assert.match(generator, /first_community_upgrade_complete = "pamHouseUpgrade" in received_mail/);
  assert.match(generator, /"communityUpgradeShortcuts" in received_mail/);
  assert.match(generator, /"available": building_available/);
  assert.match(extractor, /Buildings\/Big Coop\.xnb/);
  assert.match(extractor, /Buildings\/Junimo Hut\.xnb/);
});

test("friendship planning explains gift reactions and quality multipliers", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /t\("web\.planning\.friendshipPointsPerGift"\)/);
  assert.match(page, /t\("web\.planning\.loved"\)/);
  assert.match(page, /t\("web\.planning\.liked"\)/);
  assert.match(page, /t\("web\.planning\.neutral"\)/);
  assert.match(page, /t\("web\.planning\.disliked"\)/);
  assert.match(page, /t\("web\.planning\.hated"\)/);
  assert.match(page, /t\("web\.planning\.iridium150"\)/);
  assert.match(
    page,
    /t\("web\.planning\.qualityDoesNotChangeNeutralDislikedOrHatedGifts"\)/,
  );
});

test("daily priorities name every ready machine output and bundle delivery", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /summarizeReadyMachines\(savedReadyMachines\)/);
  assert.match(page, /summarizeReadyLiveMachines\(liveReadyMachines\)/);
  assert.match(page, /`\$\{count\}× \$\{label\}`/);
  assert.match(
    page,
    /formatBundleRequirement\(item, t, locale\).*communityRoomName\(item\.roomId, t\).*communityBundleName\(item\.bundleId/s,
  );
  assert.doesNotMatch(page, /readyMachines\.slice\(0, 3\)/);
});

test("proposals are isolated per farm and support an explicit edit workflow", async () => {
  const [page, preferences, generator, gitignore] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/preferences/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../scripts/generate_snapshot.py", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
  ]);
  assert.match(page, /t\("map\.editProposals"\)/);
  assert.match(page, /t\("web\.home\.undoLastProposalChange"\)/);
  assert.match(page, /setMovingProposalId/);
  assert.match(page, /localSuggestions\.filter\(\(item\) => item\.id !== proposal\.id\)/);
  assert.match(page, /t\("web\.home\.alreadyBuiltElsewhere"\)/);
  assert.match(page, /t\("map\.proposal\.completedElsewhere"/);
  assert.match(page, /t\("web\.home\.reopenProposal"\)/);
  assert.match(preferences, /proposalLinks/);
  assert.match(preferences, /"farms", profileId, "preferences\.json"/);
  assert.match(preferences, /incoming\.suggestions/);
  assert.match(generator, /"suggestions": \[\]/);
  assert.doesNotMatch(generator, /"suggestions": \[\s*\{/);
  assert.match(gitignore, /\/\.local\//);
});

test("map layers collapse and interiors use an interactive sprite canvas", async () => {
  const [page, styles, extractor, desktop] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(
      new URL("../scripts/extract_game_data.mjs", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(page, /stardew-tool-layers-collapsed/);
  assert.match(page, /aria-expanded=\{!layersCollapsed\}/);
  assert.match(page, /function InteriorView/);
  assert.match(page, /sprites\.craftables/);
  assert.match(page, /sprites\.furniture/);
  assert.match(
    page,
    /fishpond: \{ image: "Fish Pond", source: \[0, 0, 80, 80\] \}/,
  );
  assert.match(page, /drawBuildingSprite\(ctx, sprites, suggestion\)/);
  assert.match(page, /drawBuildingSprite\(ctx, sprites, building\)/);
  assert.match(page, /if \(activeView === "map"\) draw\(\)/);
  assert.match(page, /useState<Record<string, HTMLImageElement>>\(\{\}\)/);
  assert.match(page, /window\.setTimeout\(\(\) => finish\(null\), 8000\)/);
  assert.match(
    page,
    /setSprites\(\(previous\) => \(\{ \.\.\.previous, \[name\]: loaded \}\)\)/,
  );
  assert.match(
    page,
    /if \(dataLoadError && !data\).*<main className="loading load-error">/,
  );
  assert.match(
    page,
    /if \(!data\) return <main className="loading">\{t\("web\.home\.preparingYourFarm"\)\}/,
  );
  assert.doesNotMatch(page, /if \(!data \|\| !sprites\)/);
  assert.match(page, /t\("web\.home\.farmVisualsCouldNotBePrepared"\)/);
  assert.match(
    page,
    /t\("map\.clickInteriorTile"\)/,
  );
  assert.match(page, /activeView === "map" \? "" : "view-hidden"/);
  assert.match(page, /activeView !== "map" && \(activeView === "fishing"/);
  assert.match(page, /hasCenteredFarmRef/);
  assert.match(
    page,
    /requestAnimationFrame\(\(\) => window\.requestAnimationFrame\(draw\),?\s*\)/,
  );
  assert.match(styles, /\.workspace\.layers-collapsed/);
  assert.match(styles, /\.workspace\.view-hidden \{ display: none; \}/);
  assert.match(styles, /\.interior-stage canvas/);
  assert.match(extractor, /TileSheets\/furniture\.xnb/);
  assert.match(extractor, /Buildings\/Stable\.xnb/);
  assert.match(extractor, /Buildings\/Shed\.xnb/);
  assert.match(extractor, /Buildings\/Fish Pond\.xnb/);
  assert.match(extractor, /Buildings\/Slime Hutch\.xnb/);
  assert.match(desktop, /"furniture\.png"/);
  assert.match(desktop, /"Objects_2\.png"/);
  assert.match(desktop, /"weapons\.png"/);
  assert.match(desktop, /"tools\.png"/);
  assert.match(desktop, /"hats\.png"/);
  assert.match(desktop, /"shirts\.png"/);
  assert.match(desktop, /"Fish Pond\.png"/);
});

test("crop sprites use both columns of each 32-pixel spritesheet band", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /function cropSpriteSource/);
  assert.match(page, /\(safeRow % 2\) \* 128 \+ safePhase \* TILE/);
  assert.match(page, /Math\.floor\(safeRow \/ 2\) \* 32/);
  assert.match(
    page,
    /sprites\.crops, cropSpriteSource\(feature\.cropRow!, phase\)/,
  );
  assert.doesNotMatch(page, /feature\.cropRow! \* 16/);
});

test("crop planning explains the one-tile simulation and its assumptions", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /t\("web\.planning\.plantingGuideForToday"\)/);
  assert.match(page, /t\("planning\.plantOnDate"/);
  assert.match(page, /t\("web\.planning\.latestSafePlantingDay"\)/);
  assert.match(page, /t\("web\.planning\.baseQualityCropsSoldRawMinusTheSeedCost"\)/);
  assert.match(
    page,
    /t\("web\.planning\.fertilizerSpeedGroProfessionsProcessingOrMissedWatering"\)/,
  );
  assert.match(
    page,
    /t\("web\.planning\.everyPossibleRegrowthBeforeTheSeasonEndsIsIncluded"\)/,
  );
  assert.match(page, /stardew-tool-planted-crop-sort/);
  assert.match(page, /t\("crops\.sortQuantity"\)/);
  assert.match(page, /t\("crops\.sortHarvest"\)/);
  assert.match(page, /a\.daysRemaining - b\.daysRemaining/);
  assert.match(
    page,
    /<SheetArtwork id=\{crop\.id\} kind="object" label=\{crop\.displayName \|\| crop\.name\}/,
  );
  assert.match(page, /ItemArtworkCatalogContext/);
  assert.match(page, /SummerSquash: 81/);
  assert.match(page, /const resolvedKind = modernIndex === undefined \? kind : "object2"/);
});

test("production machine artwork keeps the complete two-tile sprite", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    page,
    /kind=\{isCrabPot \? "object" : "craftable"\}[\s\S]*?label=\{machine\.displayName \|\| machine\.name\}/,
  );
  assert.doesNotMatch(
    page,
    /<SheetArtwork\s+id=\{machine\.id\}\s+kind=\{isCrabPot \? "object" : "craftable"\}\s+label=\{machine\.displayName \|\| machine\.name\}\s+fit\s*\/>/,
  );
  assert.match(styles, /\.sheet-artwork\.object,\s*\.sheet-artwork\.object2/);
  assert.match(styles, /\.machine-heading > span \{/);
  assert.doesNotMatch(styles, /\.machine-plan-grid span \{/);
});

test("desktop shell is secure, local-first, and distributable", async () => {
  const [
    main,
    preload,
    setup,
    setupScript,
    packageJson,
    productionServer,
    portableRuntime,
    releaseWorkflow,
  ] = await Promise.all([
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/preload.cjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/setup.html", import.meta.url), "utf8"),
    readFile(new URL("../desktop/setup.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/serve-built.mjs", import.meta.url), "utf8"),
    readFile(
      new URL("../scripts/prepare-portable-python.mjs", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../.github/workflows/release.yml", import.meta.url),
      "utf8",
    ),
  ]);
  const manifest = JSON.parse(packageJson);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(preload, /contextBridge\.exposeInMainWorld/);
  assert.match(setup, /FIRST-RUN SETUP/);
  assert.equal(manifest.main, "desktop/main.mjs");
  assert.equal(manifest.name, "maglucen-stardew-valley-companion");
  assert.equal(
    manifest.build.appId,
    "io.github.maglucenstudio.stardewvalleycompanion",
  );
  assert.equal(manifest.build.productName, "Maglucen Stardew Valley Companion");
  assert.deepEqual(manifest.build.win.target, ["nsis"]);
  assert.equal(
    manifest.build.win.executableName,
    "MaglucenStardewValleyCompanion",
  );
  assert.match(main, /nativeImage\.createFromPath\(png\)/);
  assert.match(main, /PORTABLE_EXECUTABLE_FILE/);
  assert.equal(
    manifest.build.portable.artifactName,
    "Maglucen-Stardew-Valley-Companion-Portable-${version}.${ext}",
  );
  assert.equal(manifest.build.portable.unpackDirName, true);
  assert.equal(manifest.build.extraResources[0].to, "python");
  assert.match(portableRuntime, /python-\$\{PYTHON_VERSION\}-embed-amd64\.zip/);
  assert.match(portableRuntime, /pillow-\$\{PILLOW_VERSION\}-cp313-cp313-win_amd64\.whl/);
  assert.match(portableRuntime, /createHash\("sha256"\)/);
  assert.doesNotMatch(portableRuntime, /get-pip/);
  assert.match(main, /function prepareStablePackagedRuntime\(\)/);
  assert.match(
    main,
    /join\(desktopDataRoot, "app-runtime", app\.getVersion\(\)\)/,
  );
  assert.match(main, /cpSync\(pythonSource, join\(stableRoot, "python"\)/);
  assert.match(main, /join\(workRoot, "python", "python\.exe"\)/);
  assert.doesNotMatch(main, /Open in browser/);
  assert.doesNotMatch(setup, /Python command|Local port/);
  assert.match(main, /startBackgroundTracking\(\)/);
  assert.match(main, /Stardew\(\?: Valley\|ModdingAPI\)/);
  assert.match(main, /randomBytes\(32\)/);
  assert.match(main, /x-stardew-tool-token/);
  assert.match(
    main,
    /response\.headers\.get\("x-stardew-tool-service"\) === "authenticated"/,
  );
  assert.doesNotMatch(main, /response\.text\(\)\)\.includes\(PRODUCT\)/);
  assert.match(main, /onBeforeSendHeaders/);
  assert.match(main, /"X-Stardew-Tool-Token": backendToken/);
  assert.match(
    main,
    /title: PRODUCT,\s*webPreferences: \{ preload: join\(projectRoot, "desktop", "preload\.cjs"\) \}/,
  );
  assert.match(main, /loadingWindow\?\.destroy\(\);\s*loadingWindow = null;/);
  assert.match(
    main,
    /if \(mainWindow && !mainWindow\.isDestroyed\(\)\) \{\s*loadingWindow\?\.destroy\(\);\s*loadingWindow = null;\s*revealWindow\(mainWindow\);/,
  );
  assert.match(main, /platformForInstall/);
  assert.match(main, /XboxGames/);
  assert.match(main, /GOG Galaxy/);
  assert.match(main, /function loadWindowState\(\)/);
  assert.match(main, /function loadSetupWindowState\(\)/);
  assert.match(main, /settings-window-state\.json/);
  assert.match(main, /screen\.getAllDisplays\(\)/);
  assert.match(main, /window\.getNormalBounds\(\)/);
  assert.match(main, /mainWindow\.on\("resize"/);
  assert.match(main, /mainWindow\.on\("move"/);
  assert.match(main, /configureAutoUpdates\(\)/);
  assert.match(main, /autoUpdater\.autoRunAppAfterInstall = true/);
  assert.match(main, /autoUpdater\.quitAndInstall\(true, true\)/);
  assert.doesNotMatch(main, /autoUpdater\.quitAndInstall\(\{/);
  assert.match(preload, /checkForUpdates/);
  assert.match(preload, /installUpdate/);
  assert.equal(manifest.build.nsis.perMachine, false);
  assert.equal(
    manifest.build.nsis.artifactName,
    "Maglucen-Stardew-Valley-Companion-Setup-${version}.${ext}",
  );
  assert.match(main, /app\.setAppUserModelId\(ACTIVE_APP_ID\)/);
  assert.match(main, /desktopDevelopment \? `\$\{APP_ID\}\.development` : APP_ID/);
  assert.equal(manifest.build.publish[0].repo, "StardewValleyTool");
  assert.match(releaseWorkflow, /tags:\s+- "v\*"/);
  assert.doesNotMatch(releaseWorkflow, /PUBLIC_RELEASE_TOKEN/);
  assert.match(
    releaseWorkflow,
    /attest-build-provenance@977bb373ede98d70efdf65b84cb5f73e068dcc2a/,
  );
  assert.match(releaseWorkflow, /SHA256SUMS\.txt/);
  assert.match(releaseWorkflow, /gh release create/);
  assert.match(
    releaseWorkflow,
    /--title "\$\{\{ github\.ref_name \}\} · Maglucen Stardew Valley Companion"/,
  );
  assert.match(productionServer, /requestAccess\(request\)/);
  assert.match(
    productionServer,
    /This private service can only be opened by Maglucen Stardew Valley Companion/,
  );
  assert.match(productionServer, /timingSafeEqual/);
  assert.match(setup, /The dashboard stays closed until you open it/);
  assert.match(setup, /Keep running in the system tray/);
  assert.match(setupScript, /state\.config\?\.closeToTray !== false/);
  assert.match(preload, /closeToTray: config\?\.closeToTray !== false/);
  assert.match(main, /closeToTray: incoming\?\.closeToTray !== false/);
  assert.match(main, /readConfig\(\)\?\.closeToTray !== false/);
  assert.match(main, /readConfig\(\)\?\.closeToTray === false/);
  assert.doesNotMatch(
    main,
    /mainWindow\.on\("close"[\s\S]{0,180}config\.autoLaunch !== false/,
  );
  assert.match(main, /label: t\("menu\.settings"\)/);
  assert.match(main, /t\("menu\.about", \{ product: PRODUCT \}\)/);
  assert.match(main, /t\("common\.version", \{ version: app\.getVersion\(\) \}\)/);
  assert.match(main, /setupWindow\.setMenu\(null\)/);
  assert.match(main, /setupWindow\.on\("resize"/);
  assert.match(main, /setupWindow\.on\("move"/);
  assert.match(setup, /id="app-version"/);
  assert.match(setupScript, /t\("common\.version"/);
  assert.match(setup, /Where do you own Stardew Valley/);
  assert.match(setup, /It does not download or install SMAPI itself/);
  assert.match(main, /Array\.isArray\(previousConfig\?\.legacyDataDirs\)/);
  assert.match(main, /function migrateLegacyDesktopData\(target\)/);
  assert.match(main, /const LEGACY_DATA_DIR_NAME = "stardew-valley-tool"/);
  assert.match(main, /migrateLegacyDesktopData\(desktopDataRoot\)/);
  assert.ok(manifest.build.files.includes("!dist/assets/**"));
  assert.ok(manifest.build.files.includes("!dist/data/**"));
  assert.ok(manifest.build.files.includes("!dist/client/assets/**"));
  assert.ok(manifest.build.files.includes("!dist/client/data/**"));
  assert.match(
    productionServer,
    /pathname\.startsWith\("_next\/"\) \? `client\/\$\{pathname\}`/,
  );
});

test("update checks always show localized immediate and final feedback", async () => {
  const [page, styles, desktop, manifest] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /status: "checking"/);
  assert.match(page, /t\("update\.checking"\)/);
  assert.match(page, /className=\{`update-feedback/);
  assert.match(page, /role="status"/);
  assert.match(page, /status: "error"/);
  assert.match(styles, /\.update-feedback/);
  assert.match(styles, /\.update-feedback\s*\{[^}]*position: fixed/s);
  assert.match(styles, /\.update-feedback\s*\{[^}]*z-index: 1000/s);
  assert.match(page, /aria-label=\{t\("updates\.dismiss"\)\}/);
  assert.match(page, /status === "error" \? 10000 : 6500/);
  assert.match(page, /function localizedUpdateMessage\(/);
  assert.match(page, /updates\.developmentUnavailable/);
  assert.match(desktop, /reason: app\.isPackaged \? "portable" : "development"/);
  assert.doesNotMatch(desktop, /Updates are disabled during development/);
  assert.deepEqual(JSON.parse(manifest).build.electronLanguages, [
    "en-US",
    "es",
  ]);
});

test("farm history is checkpointed, backed up, and recovered across migrations", async () => {
  const [generator, desktop, bridge, sourceManifest, bundledManifest] =
    await Promise.all([
      readFile(
        new URL("../scripts/generate_snapshot.py", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../bridge/StardewValleyToolBridge/ModEntry.cs",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../bridge/StardewValleyToolBridge/manifest.json",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../desktop/resources/bridge/manifest.json", import.meta.url),
        "utf8",
      ),
    ]);
  assert.match(generator, /def atomic_write_json\(/);
  assert.match(generator, /HISTORY_BACKUPS/);
  assert.match(generator, /STARDEW_TOOL_LEGACY_DATA_DIRS/);
  assert.match(generator, /source_days\.glob\("\*\.json"\)/);
  assert.match(generator, /destination = days_path \/ f'\{recovered_snapshot\["dateKey"\]\}\.json'/);
  assert.match(generator, /f'\{PROFILE_ID\}--\{snapshot\["dateKey"\]\}\.json'/);
  assert.match(generator, /history = \{"profileId": PROFILE_ID, "farmName": farm_name/);
  assert.match(generator, /recovered\.get\("profileId"\) != PROFILE_ID/);
  assert.match(generator, /recovered_snapshot\.get\("profileId"\) != PROFILE_ID/);
  assert.match(generator, /checkpoint_root\.glob\("\*\.json\.bak"\)/);
  assert.match(desktop, /legacyDataDirs/);
  assert.match(desktop, /STARDEW_TOOL_LEGACY_DATA_DIRS/);
  assert.match(bridge, /GameLoop\.DayEnding \+= OnDayEnding/);
  assert.match(bridge, /GameLoop\.Saved \+= OnSaved/);
  assert.match(bridge, /ExportDailyCheckpoint\(pending: true\)/);
  assert.match(bridge, /PromotePendingCheckpoint/);
  assert.match(bridge, /DiscardPendingCheckpoint/);
  assert.match(bridge, /"pending\.checkpoint"/);
  assert.match(bridge, /keepBackup: true/);
  assert.match(bridge, /farmName = player\.farmName\.Value/);
  assert.equal(JSON.parse(sourceManifest).Version, "5.1.0");
  assert.equal(JSON.parse(bundledManifest).Version, "5.1.0");
});

test("farm switching isolates previous-day, history, and LIVE state by profile", async () => {
  const [page, desktop, localServer] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/dev-local.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(page, /type FarmHistory = \{ profileId: string;/);
  assert.match(page, /if \(farmHistory\.profileId !== profileId\) return;/);
  assert.match(page, /setPreviousDay\(null\);[\s\S]*setLive\(\{ active: false, profileId \}\);/);
  assert.match(page, /history\.profileId !== data\.profileId/);
  assert.match(page, /snapshot && snapshot\.profileId === expectedProfileId/);
  assert.match(page, /candidatePrevious\?\.profileId === current\.profileId/);
  assert.match(page, /payload\.profileId === expectedProfileId/);
  assert.match(localServer, /JSON\.stringify\(\{ \.\.\.payload, profileId: activeProfileId \}\)/);
  assert.match(desktop, /let manualFarmSelectionDuringGame = null;/);
  assert.match(desktop, /if \(!running\) manualFarmSelectionDuringGame = null;/);
  assert.match(desktop, /running && !manualFarmSelectionDuringGame && readConfig\(\)\?\.autoFollowActiveSave !== false/);
  assert.match(desktop, /manualFarmSelectionDuringGame = isGameRunning\(\)/);
});

test("the SMAPI bridge stays invisible while exporting read-only LIVE state", async () => {
  const [entry, project] = await Promise.all([
    readFile(
      new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../bridge/StardewValleyToolBridge/StardewValleyToolBridge.csproj",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(entry, /Display\.MenuChanged/);
  assert.doesNotMatch(entry, /Input\.ButtonPressed/);
  assert.doesNotMatch(entry, /HarmonyPatch|GameMenu|SButton\.F7/);
  assert.match(entry, /ExportLiveState/);
  assert.match(entry, /\.stardew-tool-live\.json/);
  assert.match(entry, /CaptureLiveSection/);
  assert.match(entry, /ReportLiveSectionFailure/);
  assert.match(entry, /bridgeWarnings = liveSectionErrors\.Keys/);
  assert.match(entry, /The remaining LIVE data will continue updating/);
  assert.doesNotMatch(entry, /No se pudo exportar el estado en vivo: \{ex\.Message\}/);
  assert.doesNotMatch(project, /0Harmony\.dll/);
});

test("live mode avoids recursive copies and recovers from missed filesystem events", async () => {
  const [runtimeFiles, localServer, page, bridge, desktop] = await Promise.all([
    readFile(new URL("../scripts/runtime-files.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/dev-local.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(
    runtimeFiles,
    /syncRuntimePublic\(relativePaths = \["assets", "data"\]\)/,
  );
  assert.match(
    localServer,
    /syncRuntimePublic\(\["data\/live-state\.json", "data\/farm-state\.json", "assets\/location-maps"\]\)/,
  );
  assert.match(
    localServer,
    /syncRuntimePublic\(\["data", "assets\/farmers", "assets\/location-maps", "assets\/sprites"\]\)/,
  );
  assert.match(localServer, /setInterval\(copyLiveState, 1000\)\.unref\(\)/);
  assert.match(localServer, /sourceStats\.mtimeMs/);
  assert.match(page, /if \(document\.hidden\) return Promise\.resolve\(\)/);
  assert.match(page, /previous\.updatedAt === next\.updatedAt/);
  assert.match(bridge, /refreshSlowState: liveTicks % 5 == 0/);
  assert.match(bridge, /ToUnixTimeMilliseconds\(\) \/ 4000 \* 4000/);
  assert.match(bridge, /cachedFarmMap/);
  assert.match(bridge, /cachedCollections/);
  assert.match(bridge, /cachedStorage/);
  assert.match(bridge, /cachedMachines/);
  assert.match(desktop, /liveStateAgeSeconds/);
  assert.match(desktop, /bridgeDllFound/);
  assert.match(page, /t\("web\.home\.bridgeOutput"\)/);
  assert.match(page, /t\("diagnostics\.notCreated"\)/);
  assert.match(page, /live\.bridgeWarnings/);
  assert.match(page, /t\("live\.partialConnection"/);
  assert.match(page, /liveWarnings: live\.bridgeWarnings \|\| \[\]/);
});

test("Today lists every active journal quest with opt-in spoiler guidance", async () => {
  const [page, styles, generator] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(
      new URL("../scripts/generate_snapshot.py", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(generator, /def accepted_quests_status\(/);
  assert.match(generator, /not bool_value\(item, "completed"\)/);
  assert.match(generator, /"acceptedQuests": accepted_quests_status/);
  assert.match(generator, /today_birthday = next/);
  assert.match(generator, /today\.summary\.birthdayToday/);
  assert.match(generator, /quest_id == 7/);
  assert.match(generator, /quest_id == 18/);
  assert.match(page, /<h2>\{t\("web\.dailyBrief\.acceptedQuests"\)\}<\/h2>/);
  assert.match(page, /t\("web\.dailyBrief\.showGuidanceAndPossibleSpoilers"\)/);
  assert.match(page, /acceptedQuests\.map/);
  assert.match(page, /function matchingSavedQuest\(/);
  assert.match(page, /official\?\.title \|\| quest\.title/);
  assert.match(styles, /\.accepted-quest-list/);
  assert.match(styles, /\.quest-spoilers/);
});

test("Today presents summary, priorities, changes, journal, and route in decision order", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const sections = [
    '<div className="daily-summary-grid"',
    "<section className={`priority-center",
    '<section className="daily-changes"',
    '<section className="accepted-quests-section"',
    '<div className="daily-content-grid">',
  ].map((marker) => page.indexOf(marker));
  assert.ok(sections.every((index) => index >= 0));
  assert.deepEqual(
    sections,
    [...sections].sort((a, b) => a - b),
  );
  assert.match(page, /function LiveWorldMap/);
  assert.match(page, /<LiveWorldMap\s+live=\{live\}[\s\S]*?compact/);
  assert.match(page, /world-\$\{season\}\.png/);
  assert.match(page, /function worldMapRegion/);
  assert.match(page, /function worldMapCrop/);
  assert.match(page, /id: "live-map", label: t\("today\.section\.liveMap"\)/);
  assert.match(page, /visibleSections\["live-map"\] && live\.active/);
  assert.doesNotMatch(page, /\{live\.active && <LiveWorldMap live=\{live\} season=\{current\.season\} \/>\}/);
  assert.match(page, /island\|volcano/);
  assert.match(page, /town\|seedshop\|saloon\|hospital/);
});

test("Extra channel excludes weather and fortune in semantic and legacy snapshots", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /const isCoreTvProgram/);
  assert.match(page, /program\.id === "weather" \|\| program\.id === "fortune"/);
  assert.match(page, /today\.tv\.weather\.channel/);
  assert.match(page, /"Weather Report", "Fortune Teller", "El tiempo", "La adivina"/);
  assert.match(page, /brief\.tv\.filter\(\(program\) => !isCoreTvProgram\(program\)\)/);
});

test("Special Orders use the game's fully localized LIVE text", async () => {
  const [page, bridge, snapshot] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
  ]);
  assert.match(bridge, /order\.GetName\(\)/);
  assert.match(bridge, /order\.GetDescription\(\)/);
  assert.match(bridge, /order\.GetObjectiveDescriptions\(\)/);
  assert.match(bridge, /specialOrders,/);
  assert.match(page, /live\.active && live\.specialOrders/);
  assert.match(page, /specialOrders\.map\(\(order\) =>/);
  assert.match(snapshot, /r"\\\[\(\[\^\\\]\]\+\)\\\]"/);
  assert.match(snapshot, /"LocalizedText" not in raw/);
});

test("Today and both Progress pages persist visible sections and their order", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /function SectionVisibilityMenu/);
  assert.match(page, /stardew-tool-visible-sections-today-v1/);
  assert.match(page, /stardew-tool-visible-sections-growth-v1/);
  assert.match(page, /stardew-tool-visible-sections-achievements-v1/);
  assert.match(page, /t\("sections\.moveUp"/);
  assert.match(page, /t\("sections\.moveDown"/);
  assert.match(page, /window\.localStorage\.setItem\(storageKey, JSON\.stringify\(next\)\)/);
  assert.match(styles, /\.section-visibility-panel/);
  assert.match(styles, /\.section-order-buttons/);
});

test("route checks distinguish manual decisions from reversible LIVE completion", async () => {
  const [page, generator, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /manualWorldStorageKey/);
  assert.match(page, /manualCompletedWorld/);
  assert.match(page, /automaticallyCompletedWorld/);
  assert.match(page, /const automaticallyCompletedWorld = \(\(\) => \{/);
  assert.match(page, /if \(!live\.active \|\| !live\.routeState\) return \[\]/);
  assert.match(page, /t\("today\.route\.completedLive"\)/);
  assert.match(page, /t\("today\.route\.completedManual"\)/);
  assert.match(page, /disabled=\{automatic\}/);
  assert.match(page, /currentRouteLocation/);
  assert.match(page, /liveWorldItems\.get\(location\.location\)/);
  assert.match(page, /route-player-marker/);
  assert.match(page, /t\("today\.route\.youAreHere", \{ time:/);
  assert.match(page, /name=\{birthday\.id \|\| birthday\.person\}/);
  assert.match(generator, /"routeContext": route_context/);
  assert.match(generator, /"Secret Woods": axe_level >= 2/);
  assert.match(generator, /"minecarts": any\(flag in received_mail/);
  assert.match(generator, /game_data\.get\("festivalDates", \{\}\)/);
  assert.match(generator, /"blacksmithOpenToday"/);
  assert.match(page, /const blacksmithAvailable/);
  assert.match(page, /today\.route\.blacksmithFestivalClosed/);
  assert.match(page, /routeAccess\[stop\.location\] !== false/);
  assert.match(page, /for \(const \[location, items\] of liveWorldItems\)/);
  assert.match(page, /today\.route\.inaccessibleSkipped/);
  assert.match(page, /today\.route\.unknownAccess/);
  assert.match(page, /today\.route\.roughEstimate/);
  assert.match(page, /fishingQuestRouteStop/);
  assert.match(page, /routeBundleDeliveries/);
  assert.match(page, /today\.route\.fishingQuestWindow/);
  assert.match(page, /today\.route\.bundleDeliveries/);
  assert.match(styles, /\.route-assumptions/);
  assert.match(styles, /\.route-access-warning/);
});

test("Farm Cave tasks ignore placed containers and only expose ready cave rewards", async () => {
  const [page, generator, bridge] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
    readFile(new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url), "utf8"),
  ]);
  assert.match(generator, /def farm_cave_collectibles\(/);
  assert.match(generator, /if cave_choice == 1:[\s\S]*?isSpawnedObject/);
  assert.match(generator, /obj\.findtext\("name"\) != "Mushroom Box"/);
  assert.match(generator, /bool_value\(obj, "readyForHarvest"\)/);
  assert.match(
    generator,
    /if obj\.findtext\("name"\) != "Mushroom Box"[^\r\n]*:\r?\n\s{16}continue\r?\n\s{12}held_container = obj\.find\("heldObject"\)/,
  );
  assert.match(generator, /held_container\.find\("Object"\)/);
  assert.match(bridge, /DescribeRouteItems\(location, player\)/);
  assert.match(bridge, /player\.caveChoice\.Value == 1/);
  assert.match(bridge, /pair\.Value\.Name == "Mushroom Box"/);
  assert.match(bridge, /pair\.Value\.readyForHarvest\.Value/);
  assert.match(page, /today\.brief\.caveCollectibles/);
  assert.doesNotMatch(page, /There are \{brief\.fruitCave\.count\} items/);
});

test("Today bundle priorities open the Community Center plan", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    page,
    /onOpenCommunityCenter=\{\(\) => \{[\s\S]*?navigateTo\(\{ view: "planning", section: "community" \}\);/,
  );
  assert.match(page, /action: "community" as const/);
  assert.match(page, /onClick=\{onOpenCommunityCenter\}/);
  assert.match(page, /t\("today\.openCommunity"/);
});

test("Community Center rooms show local artwork and their completion rewards", async () => {
  const [page, styles, generator, extractor, renderer, desktop] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(
        new URL("../scripts/generate_snapshot.py", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../scripts/extract_game_data.mjs", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../scripts/render-community-rooms.mjs", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    ]);
  assert.match(extractor, /CommunityCenter_Refurbished\.xnb/);
  assert.match(extractor, /CommunityCenter_Ruins\.xnb/);
  assert.match(extractor, /renderCommunityRooms\(project\)/);
  assert.match(renderer, /function readMap\(buffer\)/);
  assert.match(renderer, /"Crafts Room": \{ x: 112, y: 224/);
  assert.match(page, /function CommunityRoomArtwork/);
  assert.match(page, /assets\/community-rooms/);
  assert.match(page, /room\.completed >= room\.total \? "complete" : "ruined"/);
  assert.match(page, /t\("community\.completionReward"\)/);
  assert.match(page, /communityRoomReward\(room\.id, t\)/);
  assert.match(styles, /\.community-room-artwork/);
  assert.match(desktop, /"community-rooms",\s*"Pantry-ruined\.png"/);
  assert.match(desktop, /"community-rooms",\s*"Pantry-complete\.png"/);
  for (const reward of [
    "Bridge Repair",
    "Greenhouse",
    "Glittering Boulder Removed",
    "Minecarts Repaired",
    "Friendship",
    "Bus Repair",
  ]) {
    assert.match(generator, new RegExp(reward));
  }
});

test("Friendship planning includes the pet, available gifts, sorting, and Grandpa projections", async () => {
  const [page, styles, generator, bridge] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(
      new URL("../scripts/generate_snapshot.py", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(
    generator,
    /"gifts": gift_options\(name, available, gift_tastes\)/,
  );
  assert.match(
    generator,
    /VANILLA_FRIENDSHIP_NPCS = frozenset\(BIRTHDAYS\.values\(\)\)/,
  );
  assert.match(generator, /name not in VANILLA_FRIENDSHIP_NPCS/);
  assert.match(generator, /"id": name, "name": name/);
  assert.match(generator, /"giftsToday": number\(value, "GiftsToday"\)/);
  assert.match(generator, /"pet": pet/);
  assert.match(
    generator,
    /"friendships": \[\{"id": item\.get\("id", item\["name"\]\)/,
  );
  assert.match(bridge, /petFriendship = farm\.characters\.OfType<Pet>/);
  assert.match(bridge, /VanillaFriendshipNpcs\.Contains\(pair\.Key\)/);
  assert.match(bridge, /giftsToday = pair\.Value\.GiftsToday/);
  assert.match(page, /const VANILLA_FRIENDSHIP_NPCS = new Set/);
  assert.match(page, /plan\.friendships\.filter\(isVanillaFriend\)/);
  assert.match(page, /savedFriendships\s*\.map/);
  assert.match(page, /t\("web\.planning\.nameAZ"\)/);
  assert.match(page, /value="friendship">\{t\("web\.planning\.friendship"\)\}/);
  assert.match(page, /setExpandedFriend\(expanded \? null : friend\.name\)/);
  assert.match(page, /t\("friendship\.lovedAvailable"\)/);
  assert.match(page, /t\("web\.planning\.year3Spring1Projection"\)/);
  assert.match(page, /friend-card-projection/);
  assert.match(page, /t\("friendship\.projection\.grandpa"/);
  assert.match(page, /t\("friendship\.projection\.none"\)/);
  assert.match(page, /t\("friendship\.talked"\)/);
  assert.match(page, /t\("friendship\.giftToday"\)/);
  assert.match(page, /t\("web\.planning\.2ThisWeek"\)/);
  assert.match(
    page,
    /<NpcArtwork name=\{friend\.id \|\| friend\.name\} kind="sprite"/,
  );
  assert.match(
    page,
    /<NpcArtwork name=\{friend\.id \|\| friend\.name\} kind="portrait"/,
  );
  assert.match(
    page,
    /assets\/\$\{kind === "sprite" \? "characters" : "portraits"\}/,
  );
  assert.match(styles, /\.pet-friendship-card/);
  assert.match(styles, /\.friend-plan-list article\.expanded/);
  assert.match(styles, /\.friend-card-projection\.on-track/);
  assert.match(styles, /\.friend-daily-status/);
  assert.match(styles, /\.weekly-gifts\.complete/);
  assert.match(
    page,
    /<ItemMentionArtwork[\s\S]*?id=\{item\.id\}[\s\S]*?name=\{item\.name\}/,
  );
  assert.match(generator, /"spriteKind",\s*\n\s*"spriteIndex"/);
  assert.match(styles, /\.gift-list > div > \.item-mention-artwork/);
  assert.match(styles, /\.npc-artwork\.sprite/);
  assert.match(
    styles,
    /\.npc-artwork\.sprite \{ width: 32px; height: 64px; \}/,
  );
  assert.match(
    styles,
    /\.npc-artwork \{[^}]*background: transparent;[^}]*border: 0;/,
  );
  assert.match(
    styles,
    /\.npc-artwork\.missing \{ background: #526b50; border: 1px solid #b79d72; \}/,
  );
  assert.match(styles, /\.npc-artwork\.portrait/);
  assert.match(styles, /image-rendering: pixelated/);
});

test("friendship artwork is extracted privately from the local game", async () => {
  const [extractor, desktop] = await Promise.all([
    readFile(
      new URL("../scripts/extract_game_data.mjs", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(extractor, /Characters\/\$\{name\}\.xnb/);
  assert.match(extractor, /Portraits\/\$\{name\}\.xnb/);
  assert.match(extractor, /"Leah", "Leo", "Lewis"/);
  assert.match(extractor, /public\/assets\/characters\/\$\{name\}\.png/);
  assert.match(extractor, /public\/assets\/portraits\/\$\{name\}\.png/);
  assert.match(extractor, /findContentPacks\(modsRoot\)/);
  assert.match(extractor, /import JSON5 from "json5"/);
  assert.match(extractor, /\^\(Characters\|Portraits\)/);
  assert.match(extractor, /gameData\.moddedCharacters = moddedNpcs\.metadata/);
  assert.match(
    extractor,
    /Object\.assign\(gameData\.giftTastes, moddedNpcs\.giftTastes\)/,
  );
  assert.match(desktop, /"characters", "Abigail\.png"/);
  assert.match(desktop, /"portraits", "Abigail\.png"/);
});

test("the header and farm selector use each save's locally composed farmer", async () => {
  const [page, styles, extractor, generator, desktop, localServer] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../scripts/extract_game_data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/dev-local.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(page, /src=\{data\.farmerAvatar \|\| "\/app-icon\.png"\}/);
  assert.match(page, /className="farmer-avatar"/);
  assert.match(page, /className="farmer-name">[\s\S]*?\{data\.farmer\}[\s\S]*?development-badge/);
  assert.doesNotMatch(page, /className="app-version-badge"/);
  assert.match(page, /Maglucen Stardew Valley Companion · v\$\{APPLICATION_VERSION\}/);
  assert.doesNotMatch(page, />Maglucen · Stardew Valley Companion<\/span>/);
  assert.match(page, /className="farm-option-avatar"/);
  assert.match(styles, /\.farmer-avatar \{[^}]*image-rendering: pixelated/s);
  assert.match(styles, /\.farm-option-avatar \{[^}]*image-rendering: pixelated/s);
  assert.match(extractor, /Characters\/Farmer\/farmer_base\.xnb/);
  assert.match(extractor, /Characters\/Farmer\/hairstyles2\.xnb/);
  assert.match(generator, /def render_farmer_avatar\(/);
  assert.match(generator, /arm_frame = base_sheet\.crop\(\(96, 0, 112, 32\)\)/);
  assert.match(generator, /--avatars-only/);
  assert.match(generator, /"farmerAvatar": farmer_avatar/);
  assert.match(generator, /ASSETS \/ "farmers" \/ f"\{profile_id\}\.png"/);
  assert.match(desktop, /function ensureFarmAvatars\(/);
  assert.match(desktop, /avatar: `\/assets\/farmers\/\$\{profileIdForSave\(file\)\}\.png/);
  assert.match(localServer, /syncRuntimePublic\(\["data", "assets\/farmers", "assets\/location-maps", "assets\/sprites"\]\)/);
  assert.match(styles, /\.friend-gifts \{[^}]*grid-column: 1\/-1;/s);
  assert.match(styles, /\.friend-gifts \.gift-list \{[\s\S]*?auto-fit,[\s\S]*?minmax\(min\(210px, 100%\), 1fr\)/);
  assert.match(styles, /\.friend-gifts \.gift-list strong \{[^}]*overflow-wrap: break-word;[^}]*word-break: normal;/s);
});

test("the desktop refreshes extracted NPC assets after a mod changes", async () => {
  const desktop = await readFile(
    new URL("../desktop/main.mjs", import.meta.url),
    "utf8",
  );
  assert.match(desktop, /function newestModDataMtime\(directory\)/);
  assert.match(
    desktop,
    /newestModDataMtime\(join\(config\.stardewPath, "Mods"\)\)/,
  );
  assert.match(desktop, /extractedAssetsAreStale\(config, requiredAssets\)/);
});

test("mod compatibility is contextual and copied diagnostics exclude farm identity", async () => {
  const [page, calculator, compatibility, desktop, scanner, snapshot] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/planning/production-calculator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/compatibility.tsx", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/mod-compatibility.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
  ]);
  assert.match(scanner, /scanModCompatibility/);
  assert.match(scanner, /uncertainDomains/);
  assert.match(scanner, /SAFE_CODE_MODS/);
  assert.match(snapshot, /"modCompatibility": game_data\.get/);
  assert.doesNotMatch(page, /<CompatibilityBadge summary=\{data\.modCompatibility\}/);
  assert.doesNotMatch(page, /<CompatibilityNotice/);
  assert.match(calculator, /<CompatibilityNotice summary=\{modCompatibility\} domains=\{compatibilityDomains\}/);
  assert.match(calculator, /selectedIsAnimal[\s\S]*?\["animals", "items", "buildings"/);
  assert.match(calculator, /selectedIsPond[\s\S]*?\["fish", "items", "buildings"/);
  assert.match(compatibility, /summary\?\.uncertainDomains/);
  assert.match(compatibility, /domains\.includes\(domain\)/);
  assert.match(page, /modCompatibility: diagnostics\.modCompatibility/);
  assert.doesNotMatch(page, /JSON\.stringify\(\{ \.\.\.diagnostics/);
  assert.doesNotMatch(desktop, /profileId: profileIdForSave\(config\?\.savePath\)/);
});

test("Farm and Plan remember separate sections while bundle links open Community Center", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    page,
    /localStorage\.getItem\(`stardew-tool-\$\{mode\}-section`\)/,
  );
  assert.match(
    page,
    /localStorage\.setItem\(`stardew-tool-\$\{mode\}-section`, section\)/,
  );
  assert.match(
    page,
    /localStorage\.setItem\(\s*"stardew-tool-plan-section",\s*"community",?\s*\)/,
  );
  assert.match(page, /<PlanningView key="farm"[^>]*mode="farm"/);
  assert.match(page, /<PlanningView key="plan"[^>]*mode="plan"/);
  assert.match(page, /\["calculators", t\("planning\.calculators"\)\]/);
  assert.match(page, /section === "calculators"/);
});

test("content pages use the app-wide scrollbar while Map keeps its fixed workspace", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(styles, /html, body \{[^}]*height: 100%;[^}]*overflow: hidden/);
  assert.match(
    styles,
    /\.app-shell \{[^}]*height: 100%;[^}]*overflow: hidden;[^}]*display: flex/,
  );
  assert.match(styles, /\.workspace \{[^}]*flex: 1 1 auto;[^}]*min-height: 0/);
  assert.match(styles, /\.app-shell\.content-mode \{[^}]*overflow-y: auto/);
  assert.match(styles, /\.app-shell\.content-mode::before \{[^}]*height: 18px/s);
  assert.match(styles, /--app-background: #243128/);
  assert.match(
    styles,
    /\.app-shell \{[^}]*background: var\(--app-background\)/s,
  );
  assert.doesNotMatch(styles, /\.app-shell \{[^}]*radial-gradient/s);
  assert.match(styles, /\.app-shell\.content-mode \.topbar \{[^}]*top: 0/s);
  assert.match(styles, /\.progress-shell \{[^}]*flex: 0 0 auto;[^}]*padding-top: 0/s);
  assert.match(styles, /\.progress-tabs::before \{[^}]*position: absolute;[^}]*bottom: calc\(100% - 1px\);[^}]*height: 16px/s);
  assert.match(styles, /\.progress-tabs \{[^}]*position: sticky;[^}]*top: var\(--progress-tabs-top, 82px\)[^}]*width: 100%/s);
  assert.match(page, /const topbarRef = useRef<HTMLElement>\(null\)/);
  assert.match(page, /new ResizeObserver\(update\)/);
  assert.match(page, /setProgressTabsTop\(topbar\.offsetHeight \+ 14\)/);
  assert.match(page, /"--progress-tabs-top": `\$\{progressTabsTop\}px`/);
  for (const page of ["growth", "achievements", "daily"]) {
    assert.match(
      styles,
      new RegExp(
        `\\.${page}-page \\{[^}]*flex: 1 1 auto;[^}]*min-height: 0;[^}]*overflow: visible`,
      ),
    );
  }
  assert.match(
    styles,
    /\.fishing-page, \.planning-page \{[^}]*flex: 1 1 auto;[^}]*min-height: 0/,
  );
});

test("Farm Cave and Farmhouse use their real locally extracted map artwork", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const renderer = await readFile(new URL("../scripts/render-storage-location-maps.mjs", import.meta.url), "utf8");
  const snapshot = await readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8");
  assert.match(page, /interior\.background/);
  assert.match(renderer, /interior\.name === "FarmCave"/);
  assert.match(renderer, /\["FarmHouse", "FarmHouse1", "FarmHouse2"\]/);
  assert.match(snapshot, /"mapName": map_name/);
  assert.doesNotMatch(snapshot, /assets\/interiors/);
});

test("collection achievement cards receive real completion totals", async () => {
  const [extractor, snapshot] = await Promise.all([
    readFile(new URL("../scripts/extract_game_data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
  ]);
  assert.match(extractor, /Data\/CookingRecipes\.xnb/);
  assert.match(extractor, /Data\/CraftingRecipes\.xnb/);
  assert.match(snapshot, /set\(game_data\.get\("cookingRecipes", \{\}\)\)/);
  assert.match(snapshot, /set\(game_data\.get\("craftingRecipes", \{\}\)\) - \{"Wedding Ring"\}/);
  assert.match(snapshot, /len\(shipped\), 154, "types shipped"/);
  assert.match(snapshot, /cooked_count, cooking_total, "recipes cooked"/);
  assert.match(snapshot, /crafted_count, crafting_total, "different items"/);
});

test("non-destructive popups close from their backdrop or the Escape key", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const closePopup = \(event: KeyboardEvent\) =>/);
  assert.match(page, /if \(showAppSearch\)[\s\S]*else if \(showHelp\)[\s\S]*else if \(locatedItemName\)[\s\S]*else if \(showDailyBrief\)[\s\S]*else if \(showFarmSwitcher\)/);
  assert.match(page, /className="help-backdrop" onPointerDown=\{\(\) => setShowHelp\(false\)\}/);
  assert.match(page, /className="help-dialog"[\s\S]*onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(page, /className="app-search-backdrop" onPointerDown=\{\(\) => setShowAppSearch\(false\)\}/);
  assert.match(page, /className="item-locator-backdrop" onPointerDown=\{onClose\}/);
  assert.match(page, /className="daily-modal-backdrop"[\s\S]*if \(event\.target === event\.currentTarget\) onClose\(\)/);
});

test("all item mentions share the save-generated artwork catalog", async () => {
  const [page, snapshot] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
  ]);
  assert.match(snapshot, /def item_artwork_catalog\(/);
  assert.match(snapshot, /"itemArtworkCatalog": artwork_catalog/);
  assert.match(snapshot, /"localizedNamesByQualifiedId": localized_names_by_qualified_id/);
  assert.match(page, /const ItemArtworkCatalogContext = createContext/);
  assert.match(page, /const resolvedItem = item \|\| catalog\[itemArtworkKey\(name\)\]/);
  assert.match(page, /<ItemArtworkCatalogContext\.Provider value=\{data\.itemArtworkCatalog \|\| \{\}\}>/);
  assert.match(snapshot, /KNOWN_ITEM_IDS = \{/);
  assert.match(snapshot, /node\.findtext\("indexOfMenuItemView", node\.findtext\("currentParentTileIndex"/);
  assert.doesNotMatch(page, /const ITEM_ARTWORK_IDS/);
  assert.doesNotMatch(page, /const CROP_ARTWORK_IDS/);
});

test("storage locator groups one container and preserves each stack quality", async () => {
  const [page, styles, generator] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
  ]);
  assert.match(page, /quality: entry\.quality \?\? item\?\.quality \?\? 0/);
  assert.match(page, /rawEntries\.reduce</);
  assert.match(page, /grouped\.get\(entry\.source\)/);
  assert.match(page, /className="item-locator-quality-list"/);
  assert.match(page, /function readableStorageLocation/);
  assert.match(page, /function completeStorageSourceDetail/);
  assert.match(page, /const legacy = \/\^Chest ·/);
  assert.match(page, /location: detail\.location \|\| legacy\[1\]/);
  assert.match(page, /x: detail\.x \?\? Number\(legacy\[2\]\)/);
  assert.match(page, /detail = completeStorageSourceDetail\(detail\)/);
  assert.match(page, /entry\.name === raw && entry\.background/);
  assert.match(page, /entry\.name === legacyLocation && entry\.background/);
  assert.match(page, /const rawLocation = detail\.location \|\| ""/);
  assert.match(page, /entry\.id === rawLocation/);
  assert.match(page, /replace\(\/\[0-9a-f\]\{8\}/);
  assert.match(page, /displayStorageSource\(location\)/);
  assert.match(page, /quality === "normal" \? "—" : "★"/);
  assert.match(styles, /\.item-locator-quality-list/);
  assert.match(generator, /"sourceCounts": \[\{"source": item\["source"\], "count": item\["count"\], "quality": item\["quality"\]\}\]/);
  assert.match(page, /storageView === "combined"[\s\S]*?className="locatable-item-card"[\s\S]*?data-storage-item=\{item\.name\}/);
  assert.doesNotMatch(page, /group\.items\.map\(\(item\) => \([\s\S]{0,300}?data-storage-item=\{item\.name\}/);
});

test("animal-building storage previews use extracted local interiors", async () => {
  const [renderer, snapshot, desktop, bridge] = await Promise.all([
    readFile(new URL("../scripts/render-storage-location-maps.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url), "utf8"),
  ]);
  for (const name of ["Coop", "Coop2", "Coop3", "Barn", "Barn2", "Barn3", "Shed", "Shed2"]) {
    assert.match(snapshot, new RegExp(`"${name}"`));
  }
  assert.match(renderer, /interiorMapName\(interior\)/);
  assert.match(renderer, /if \(interior\.mapName\) return interior\.mapName/);
  assert.match(renderer, /interior\.background = rendered\.background/);
  assert.doesNotMatch(desktop, /assets", "interiors"/);
  assert.match(snapshot, /"Deluxe Coop": "Coop3"/);
  assert.match(snapshot, /"Deluxe Barn": "Barn3"/);
  assert.match(snapshot, /building_dimensions/);
  assert.match(snapshot, /building_interior_names/);
  assert.match(snapshot, /def player_chests\(location: ET\.Element\)/);
  assert.match(snapshot, /not bool_value\(chest, "playerChest"\)/);
  assert.match(snapshot, /storage_locations\.append\(\(view_id, interior\)\)/);
  assert.match(snapshot, /seen_chests = set\(\)/);
  assert.match(bridge, /pair\.Value is Chest chest && chest\.playerChest\.Value/);
  assert.match(bridge, /private static string TrackedLocationKey/);
  assert.match(bridge, /building\.buildingType\.Value.*building\.tileX\.Value.*building\.tileY\.Value/);
  assert.doesNotMatch(bridge, /GroupBy\(location => location\.NameOrUniqueName\)/);
});

test("physical chests can request locally rendered maps for any game location", async () => {
  const [page, renderer, localServer, mapRenderer, generator, packageSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/render-storage-location-maps.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/dev-local.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/render-community-rooms.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(renderer, /snapshot\.planningBrief\?\.inventory/);
  assert.match(renderer, /resolve\(contentRoot, "Maps", `\$\{name\}\.xnb`\)/);
  assert.match(renderer, /seasonalSheetName\(imageSource, season\)/);
  assert.match(renderer, /await renderMap\(tbinPath, sheets,/);
  assert.match(renderer, /snapshot\.locationMaps = locationMaps/);
  assert.match(renderer, /liveState\.storage \|\| \[\]/);
  assert.match(renderer, /1: "Farm_Fishing"/);
  assert.match(renderer, /7: "Farm_Ranching"/);
  assert.match(renderer, /includeBlocked: true/);
  assert.match(renderer, /blocked: farm\.blocked/);
  assert.match(renderer, /interior\.background = rendered\.background/);
  assert.match(renderer, /renderGrandpaShrineScene\(season\)/);
  assert.match(localServer, /render-storage-location-maps\.mjs/);
  assert.match(localServer, /renderLocationMaps\(\);/);
  assert.match(localServer, /assets\/location-maps/);
  assert.match(mapRenderer, /const frame = this\.staticTile\(sheetId\)/);
  assert.match(mapRenderer, /export function blockedMapTiles\(map\)/);
  assert.match(mapRenderer, /layer\.id === "Buildings"/);
  assert.match(page, /current\.locationMaps\?\.\[rawLocation\]/);
  assert.match(page, /backgroundSize: `\$\{mapWidth \* 12\}px \$\{mapHeight \* 12\}px`/);
  assert.match(page, /interior\?\.background \|\| extractedLocation\?\.background/);
  assert.match(page, /data\?\.locationMaps\?\.Farm\?\.background/);
  assert.doesNotMatch(page, /assets\/farm-spring\.png/);
  assert.doesNotMatch(generator, /map-layout\.json/);
  assert.doesNotMatch(packageSource, /map-layout\.json/);
  assert.match(page, /!objects\.some\(\(item\) => item\.x === detail\.x && item\.y === detail\.y\)/);
});

test("qualified item identities cannot confuse objects with big craftables", async () => {
  const [page, generator] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
  ]);
  assert.match(generator, /"craftable": "BC"/);
  assert.match(generator, /"Boots": "B"/);
  assert.match(generator, /return "S" if node\.findtext\("clothesType"\) ===? "SHIRT" else "P"/);
  assert.match(generator, /def qualified_item_id\(/);
  assert.match(generator, /saved_item_qualifier\(node,/);
  assert.match(generator, /inventory_by_id\.setdefault\(str\(item\["id"\]\)/);
  assert.match(generator, /inventory_by_id\.get\(qualified_item_id\(item_id\)/);
  assert.doesNotMatch(generator, /inventory_by_id\.setdefault\(str\(item\["id"\]\)\.removeprefix/);
  assert.match(page, /const inventoryItemId =/);
  assert.match(page, /inventoryItemId\(item\) === normalizeObjectId\(requirement\.id\)/);
  assert.doesNotMatch(page, /inventoryItemId\(item\) === requestedId \|\|/);
  assert.doesNotMatch(page, /inventoryItemId\(item\) === normalizeObjectId\(requirement\.id\) \|\|/);
});

test("farm proposals may replace natural features but not placed machines", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /object\.kind === "Litter" \|\| object\.name === "Artifact Spot"/);
  assert.match(page, /\["Tree", "FruitTree"\]\.includes\(feature\.kind\)/);
  assert.match(page, /t\("map\.error\.placedObject"\)/);
  assert.doesNotMatch(page, /Trees or crops must be removed first/);
  assert.doesNotMatch(page, /A large obstacle must be removed first/);
});

test("Suggested Route item cards describe map pickups without opening storage", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<ItemMentionArtwork name=\{item\.name\} locatable=\{false\} \/>/);
  assert.doesNotMatch(page, /Tip · Right-click any item card to see where you have it stored/);
  assert.match(page, /data-storage-item=\{locatable \? name : undefined\}/);
  assert.match(styles, /\.world-items \.item-mention-artwork > \.sheet-artwork/);
});

test("proposal editing shows building sprites in the palette and at the cursor", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /catalog \? "building-catalog-artwork" : "tool-preview"/);
  assert.match(page, /movingProposalId[\s\S]*drawBuildingSprite\(ctx, sprites/);
  assert.match(page, /onContextMenu=\{openProposalMenu\}/);
  assert.match(page, /t\("web\.home\.deleteProposal"\)/);
});

test("Map side columns are resizable and remember their widths", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /stardew-tool-left-panel-width/);
  assert.match(page, /stardew-tool-right-panel-width/);
  assert.match(page, /beginPanelResize\("left"/);
  assert.match(page, /beginPanelResize\("right"/);
  assert.match(styles, /\.column-resizer/);
});

test("Support and Help have one clear native-menu location each", async () => {
  const [page, desktop] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /Support development on Ko-fi/);
  assert.match(desktop, /label: t\("menu\.support"\)/);
  assert.match(desktop, /label: t\("menu\.helpDiagnostics"\)/);
});

test("feedback links prefill a safe structured GitHub issue", async () => {
  const [page, desktop] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
  ]);
  const feedbackBuilder = page.slice(
    page.indexOf("function feedbackIssueUrl"),
    page.indexOf("function summarizeReadyMachines"),
  );
  assert.match(page, /function feedbackIssueUrl/);
  assert.match(page, /## What happened\?/);
  assert.match(page, /## Steps to reproduce/);
  assert.match(page, /## What would you like to improve\?/);
  assert.match(page, /No paths, usernames, or save contents are included/);
  assert.match(page, /t\("web\.home\.reportAProblem"\)/);
  assert.match(page, /t\("web\.home\.suggestAnImprovement"\)/);
  assert.doesNotMatch(feedbackBuilder, /profileId/);
  assert.match(desktop, /osVersion: osRelease\(\)/);
  assert.match(desktop, /architecture: process\.arch/);
});

test("the fishing planner covers every hour and stops before the mandatory 2 AM bedtime", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const hours = source.match(/const fishingHours = \[([^\]]+)\]/)?.[1] || "";
  for (let hour = 600; hour <= 2500; hour += 100) {
    assert.match(hours, new RegExp(`\\b${hour}\\b`));
  }
  assert.doesNotMatch(hours, /2600/);
});

test("Today uses LIVE quest and farm progress instead of stale save priorities", async () => {
  const [page, bridge] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(bridge, /boardQuest,/);
  assert.match(bridge, /dailyQuestCompleted,/);
  assert.match(page, /live\.boardQuest/);
  assert.match(page, /live\.dailyQuestCompleted/);
  assert.match(page, /live\.farmMap\.terrain\.filter/);
  assert.match(page, /liveReadyBundleDeliveries/);
  assert.match(page, /summarizeReadyLiveMachines/);
  assert.match(page, /t\("today\.priority\.harvestCrops", \{ count: readyCrops \}\)/);
  assert.doesNotMatch(
    page,
    /const displayedQuest = brief\.boardQuest \?\? liveDailyQuest/,
  );
});

test("Fishing can plan another hour during LIVE and guides accepted fishing requests", async () => {
  const [page, bridge] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(
    page,
    /const \[useLiveTime, setUseLiveTime\] = useState\(true\)/,
  );
  assert.match(page, /setUseLiveTime\(false\)/);
  assert.match(page, /t\("fishing\.returnLive"/);
  assert.match(page, /t\("fishing\.missionPriority"\)/);
  assert.match(page, /questFishDetails/);
  assert.match(page, /mission-fish/);
  assert.match(page, /mission-fish-art/);
  assert.match(page, /mission-fish-copy/);
  assert.match(page, /mission-fish-progress/);
  assert.match(page, /fishingQuests\.map/);
  assert.match(
    page,
    /acceptedMissionQuests\.filter\(\(quest\) => trackedFish\.some/,
  );
  assert.match(page, /quest\.type !== "ItemDelivery"/);
  assert.match(page, /t\("fishing\.readyToDeliver"/);
  assert.match(page, /t\("fishing\.difficulty", \{ difficulty: fish\.difficulty \}\)/);
  assert.match(page, /stardew-tool-fishing-list/);
  assert.match(page, /t\("fishing\.allAvailable"/);
  assert.match(page, /atLiveLocation/);
  assert.match(page, /current-location-fish/);
  assert.match(page, /live\.acceptedQuests/);
  assert.match(bridge, /DescribeActiveQuests\(Game1\.player\)/);
  assert.match(bridge, /acceptedQuests,/);
  assert.match(bridge, /id = quest\.id\.Value/);
  assert.match(bridge, /case FishingQuest fishing:/);
});

test("Fishing renders each catch from the private object spritesheet", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(
    page,
    /<SheetArtwork id=\{fish\.id\} kind="object" label=\{fish\.displayName\}/,
  );
  assert.match(page, /spritePaths\.objects/);
  assert.match(
    styles,
    /\.sheet-artwork\.object, \.sheet-artwork\.object2 \{ width: 32px; height: 32px; \}/,
  );
  assert.match(styles, /\.money-targets > div > \.sheet-artwork/);
});

test("Production counts functional machines, interiors, live storage, and actionable states", async () => {
  const [page, generator, bridge] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../scripts/generate_snapshot.py", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(generator, /PRODUCTION_MACHINE_NAMES = \{/);
  assert.match(generator, /"Furnace".*"Keg"/s);
  assert.match(generator, /def is_production_machine\(obj: dict\)/);
  assert.match(generator, /for location in locations/);
  assert.match(generator, /for obj in saved_objects\(location\)/);
  assert.match(generator, /"Crab Pot"/);
  assert.match(
    generator,
    /entry\["idle"\] \+= 1 if not obj\.get\("ready"\) and not obj\.get\("processing"\)/,
  );
  assert.match(generator, /"readyOutputs"/);
  assert.match(page, /t\("web\.planning\.whatToCollectAndRefill"\)/);
  assert.match(page, /summarizeLiveMachines/);
  assert.match(page, /kind=\{isCrabPot \? "object" : "craftable"\}/);
  assert.match(page, /t\("web\.planning\.currentMachinesAndCrabPots"\)/);
  assert.match(page, /legacyCraftableSpriteIndex/);
  assert.match(page, /\{idle\}\{t\("web\.planning\.idle"\)\}/);
  assert.match(page, /savedChestInventory/);
  assert.match(page, /Backpack · LIVE/);
  assert.match(bridge, /pair\.Value is Chest/);
  assert.match(bridge, /storage = cachedStorage/);
  assert.match(bridge, /machines = cachedMachines/);
  assert.match(bridge, /id = pair\.Value\.QualifiedItemId/);
  assert.match(bridge, /"Crab Pot"/);
  assert.match(generator, /"id": obj\.get\("id", ""\)/);
});

test("Grandpa forecast separates projected milestones from points confirmed today", async () => {
  const [page, styles, generator] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(
      new URL("../scripts/generate_snapshot.py", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(
    page,
    /forecast: item\.done \? \("achieved" as const\) : projected \? \("projected" as const\) : \("not-projected" as const\)/,
  );
  assert.match(page, /forecastMilestonePoints/);
  assert.match(page, /t\("growth\.status\.projectedPace"\)/);
  assert.match(page, /t\("web\.growth\.comparedWith"\)/);
  assert.match(page, /scoreEvents\.map/);
  assert.match(page, /<GrandpaShrineArtwork candles=\{projectedCandles\} \/>/);
  assert.match(page, /Grandpa%20Shrine%20Scene\.png/);
  assert.match(page, /candlePositions\.slice\(0, candles\)/);
  assert.match(page, /className="grandpa-candle-base"/);
  assert.match(page, /className="grandpa-candle-flame"/);
  assert.doesNotMatch(page, /<SheetArtwork id="93"/);
  assert.doesNotMatch(page, /<div className="candles">\{\[1,2,3,4\]/);
  assert.match(generator, /def render_extracted_ui_sprites\(\)/);
  assert.match(generator, /cursors\.crop\(\(536, 1945, 592, 1953\)\)/);
  assert.match(generator, /cursors\.crop\(\(577, 1985, 579, 1990\)\)/);
  assert.match(styles, /\.milestone-list > div\.projected/);
  assert.match(styles, /\.grandpa-shrine/);
  assert.match(styles, /\.grandpa-candle-flame/);
  assert.match(styles, /@keyframes grandpa-candle-flicker/);
  assert.match(styles, /mask-image: linear-gradient/);
  assert.match(styles, /\.score-events/);
});

test("Farm, Plan, and Progress share storage, goals, history, and completion data", async () => {
  const [page, styles, preferences, generator, extractor, bridge, desktop] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/preferences/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
    readFile(new URL("../scripts/extract_game_data.mjs", import.meta.url), "utf8"),
    readFile(
      new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(page, /\["storage", t\("planning\.storage"\)\]/);
  assert.match(page, /className="storage-dashboard"/);
  assert.match(page, /t\("storage\.searchLabel"\)/);
  assert.match(page, /t\("storage\.byContainer"\)/);
  assert.match(page, /t\("storage\.sortQuantityDesc"\)/);
  assert.match(page, /item\.displayName \|\| item\.name/);
  assert.match(page, /displayName: gameName\(item\.displayName \|\| item\.name, item\.id\)/);
  assert.match(page, /current\.localizedNamesByQualifiedId/);
  assert.match(page, /t\("crops\.currentlyPlanted"\)/);
  assert.match(page, /crop\.displayName/);
  assert.match(page, /storageLocation/);
  assert.match(page, /sourceCounts/);
  assert.match(page, /function StorageContainerArtwork/);
  assert.match(page, /function StorageLocationPreview/);
  assert.match(page, /sourceDetails/);
  assert.match(generator, /playerChoiceColor/);
  assert.match(generator, /"sourceDetails"/);
  assert.match(generator, /"localizedObjectNamesByEnglish"/);
  assert.match(generator, /"displayName"/);
  assert.match(extractor, /Strings\/BigCraftables\.xnb/);
  assert.match(extractor, /Strings\/Tools\.xnb/);
  assert.match(extractor, /Strings\/Weapons\.xnb/);
  assert.match(extractor, /Strings\/Shirts\.xnb/);
  assert.match(extractor, /Strings\/Furniture\.xnb/);
  assert.match(extractor, /Data\/Boots\.xnb/);
  assert.match(extractor, /Data\/hats\.xnb/);
  assert.match(extractor, /catalogVersion: 11/);
  assert.match(desktop, /catalogVersion !== 11/);
  assert.match(extractor, /game-localization\.\$\{catalogLanguage\}\.json/);
  assert.match(extractor, /const activeLocalization = gameLocalizationCatalogs\.en/);
  assert.match(extractor, /Data\/Achievements\.xnb/);
  assert.match(extractor, /replace\(\/\(\\d\)o\\b\/g, "\$1g"\)/);
  assert.match(extractor, /Data\/Quests\.xnb/);
  assert.match(generator, /localizedAchievementsById/);
  assert.match(generator, /localizedQuestsById/);
  assert.match(extractor, /localizedNamesByQualifiedId/);
  assert.match(generator, /def localized_message\(/);
  assert.match(generator, /today\.luck\.\{luck_tier\}/);
  assert.match(generator, /"spriteKind": "fallback"/);
  assert.match(generator, /"Furniture"/);
  assert.match(generator, /bool_value\(node, "bigCraftable"\)/);
  assert.match(generator, /\{"Object", "Torch"\}/);
  assert.match(generator, /community_center_status\(root, available, money\)/);
  assert.match(generator, /if item_id == "-1":/);
  assert.match(page, /item\.id === "-1"/);
  assert.match(page, /function formatBundleRequirement/);
  assert.match(generator, /"spriteIndex": parent_index/);
  assert.match(page, /function StorageArtwork/);
  assert.match(page, /weapon: \{ path: spritePaths\.weapons/);
  assert.match(page, /object2: \{ path: spritePaths\.objects2/);
  assert.match(page, /furniture: \{ path: spritePaths\.furniture/);
  assert.match(extractor, /TileSheets\/weapons\.xnb/);
  assert.match(extractor, /TileSheets\/tools\.xnb/);
  assert.match(extractor, /TileSheets\/Objects_2\.xnb/);
  assert.match(bridge, /spriteKind = SpriteKind\(item\)/);
  assert.match(bridge, /spriteIndex = SpriteIndex\(item\)/);
  assert.match(bridge, /tool\.IndexOfMenuItemView/);
  assert.match(bridge, /furniture\.defaultSourceRect\.Value\.Width/);
  assert.match(bridge, /containerColor/);
  assert.match(bridge, /containerLocation/);
  assert.match(page, /\["goals", t\("planning\.goals"\)\]/);
  assert.match(page, /className="goal-planner"/);
  assert.match(page, /\.\.\.constructionTargets,\s*\.\.\.toolTargets,\s*\.\.\.craftingTargets,\s*\.\.\.bundleTargets/s);
  assert.match(page, /t\("web\.planning\.linkAConstructionToolRecipeOrBundle"\)/);
  assert.match(page, /const commonCraftingGoals = \[/);
  assert.match(page, /function GoalRequirements/);
  assert.match(page, /function ItemMentionArtwork/);
  assert.match(page, /catalog\[itemArtworkKey\(name\)\]/);
  assert.match(page, /<ItemMentionArtwork\s+id=\{requirement\.id\}\s+name=\{requirement\.name\}/);
  assert.match(page, /<ItemMentionArtwork\s+id=\{item\.id\}\s+name=\{item\.name\}/);
  assert.match(page, /t\("goal\.everythingRequired"\)/);
  assert.match(page, /requirementsLabel: t\("goal\.bundle\.choose", \{ count: needed \}\)/);
  assert.match(page, /<GoalRequirements target=\{selectedTarget\}/);
  assert.match(page, /<GoalRequirements target=\{target\} compact/);
  assert.match(styles, /\.goal-requirements ul \{/);
  assert.match(styles, /\.item-mention-artwork/);
  assert.match(styles, /grid-template-columns: 18px 32px minmax\(0, 1fr\)/);
  assert.match(preferences, /Array\.isArray\(incoming\.goals\)/);
  assert.doesNotMatch(page, /Compare any two recorded days/);
  assert.match(page, /<details className="history-timeline"/);
  assert.match(page, /t\("web\.growth\.automaticHistoryAnnotations"\)/);
  assert.match(page, /className="completion-explorer"/);
  assert.match(page, /t\("web\.home\.collectionsAchievements"\)/);
  assert.match(styles, /\.storage-results \{/);
  assert.match(styles, /\.storage-container-groups \{/);
  assert.match(styles, /\.storage-container-artwork/);
  assert.match(styles, /\.storage-location-preview/);
  assert.match(page, /function StorageLocationPreviewCanvas/);
  assert.match(page, /<canvas ref=\{canvas\}/);
  assert.match(page, /chestColors\.set/);
  assert.match(page, /drawBuildingSprite\(ctx, sprites, entity\.item\)/);
  assert.match(page, /className="storage-chest-tint"/);
  assert.match(styles, /\.storage-chest-tint/);
  assert.match(generator, /"color": color/);
  assert.match(bridge, /pair\.Value is Chest chest/);
  assert.match(styles, /\.storage-results \.sheet-artwork \{[\s\S]*?width: 32px;/);
  assert.match(styles, /\.sheet-artwork-crop/);
  assert.match(page, /tool: \{[^\n]+height: 16, row: 16/);
  assert.match(generator, /"spriteHeight": 1 if item_type == "FishingRod" else 2/);
  assert.match(styles, /\.history-timeline > summary/);
  assert.match(styles, /\.completion-card-grid \{/);
});

test("game-owned names are localized once for every snapshot-backed view", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /function resolveGameDisplayName\(/);
  assert.match(page, /const gameNameIndexes = new WeakMap/);
  assert.match(page, /function gameNameIndex\(/);
  assert.match(page, /index\.normalized\.get\(normalizedGameName\(candidate\)\)/);
  assert.doesNotMatch(page, /const localizeEnglishName[^}]+Object\.entries\(byEnglish\)/s);
  assert.match(page, /replace\(\/\\bL\\\.\\s\*\/g, "Large "\)/);
  assert.match(page, /const identityName = qualifiedId \? byId\[qualifiedId\]/);
  assert.match(page, /"\(O\)174": "gameName\.largeEggWhite"/);
  assert.match(page, /"\(O\)182": "gameName\.largeEggBrown"/);
  assert.match(page, /replace\(\/\\s\*\\\(\(\?:White\|Brown\)\\\)\\s\*\$\/i, ""\)/);
  assert.match(page, /const registerIdentity = \(item:/);
  assert.match(page, /snapshot\.collectionBrief\?\.shipping \|\| \[\]/);
  assert.match(page, /snapshot\.museumBrief\.sources\.flatMap\(source => source\.items/);
  assert.match(page, /function localizeSnapshotGameNames\(/);
  assert.match(page, /snapshot\.dailyBrief\.world\.flatMap/);
  assert.match(page, /snapshot\.planningBrief\.crops\.forEach/);
  assert.match(page, /snapshot\.planningBrief\.buildings\.flatMap/);
  assert.match(page, /snapshot\.dailyBrief\.birthdays\.forEach/);
  assert.match(page, /snapshot\.planningBrief\.friendships\.forEach/);
  assert.match(page, /snapshot\.collectionBrief\?\.shipping/);
  assert.match(page, /snapshot\.museumBrief\.sources\.flatMap/);
  assert.match(page, /material\.displayName \|\| material\.name/);
  assert.match(page, /machine\.displayName \|\| machine\.name/);
  assert.match(page, /snapshot = localizeSnapshotGameNames\(snapshot, t, gameCatalog\)/);
  assert.match(page, /if \(document\.hidden \|\| loadingLatest\) return Promise\.resolve\(\)/);
  assert.match(page, /\.finally\(\(\) => \{\s*loadingLatest = false;/);
  assert.match(page, /localizeSnapshotGameNames\([\s\S]*?\{ \.\.\.snapshot, seasonLabel:[\s\S]*?gameCatalog/);
  assert.match(page, /live\.routeState\?\.worldTasks/);
  assert.match(page, /item\.displayName \|\| resolveGameDisplayName\(/);
});

test("desktop development reloads the interface and restarts Electron runtime changes", async () => {
  const [packageSource, desktop, supervisor, localServer, launcher, configSource, assetExtractor] =
    await Promise.all([
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
      readFile(
        new URL("../scripts/desktop-development.mjs", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../scripts/dev-local.mjs", import.meta.url), "utf8"),
      readFile(
        new URL("../scripts/start-development.ps1", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../scripts/config.mjs", import.meta.url), "utf8"),
      readFile(
        new URL("../scripts/extract_game_data.mjs", import.meta.url),
        "utf8",
      ),
    ]);
  assert.equal(
    JSON.parse(packageSource).scripts["desktop:dev"],
    "npm run desktop:bridge && npm run desktop:game-data && node scripts/prepare-portable-python.mjs && npm run electron:prepare && node scripts/desktop-development.mjs",
  );
  assert.match(
    desktop,
    /join\(projectRoot, "desktop", "resources", "python", "python\.exe"\)/,
  );
  assert.match(configSource, /process\.env\.STARDEW_PYTHON/);
  assert.match(configSource, /existsSync\(sourcePython\) \? sourcePython : "python"/);
  assert.match(localServer, /const python = config\.pythonCommand/);
  assert.match(desktop, /if \(revealWindow\(loadingWindow\)\) return/);
  assert.match(desktop, /role: "reload", accelerator: "F5"/);
  assert.doesNotMatch(desktop, /role: "reload"[^\n]*CmdOrCtrl\+R/);
  assert.match(desktop, /Date\.now\(\) - startupStartedAt < 120_000/);
  assert.match(desktop, /Date\.now\(\) - startupStartedAt >= 20_000/);
  assert.match(desktop, /t\("loading\.optimizing"\)/);
  assert.match(desktop, /launchedBackend\.exitCode !== null/);
  assert.match(desktop, /STARDEW_TOOL_DESKTOP_DEV === "1"/);
  assert.match(desktop, /"maglucen-stardew-valley-companion-development"/);
  assert.match(desktop, /app\.getPath\("appData"\)/);
  assert.match(desktop, /APP_ID}\.development/);
  assert.match(desktop, /STARDEW_TOOL_DESKTOP_PORT \|\| 43117/);
  assert.match(desktop, /async function extractGameAssets/);
  assert.match(desktop, /t\("loading\.assetsRetry"\)/);
  assert.match(desktop, /if \(app\.isPackaged\)\s*app\.setLoginItemSettings/);
  assert.match(
    desktop,
    /const localServiceHost = desktopDevelopment \? "localhost" : "127\.0\.0\.1"/,
  );
  assert.match(
    desktop,
    /desktopDevelopment \|\|\s*response\.headers\.get\("x-stardew-tool-service"\) ===\s*"authenticated"/s,
  );
  assert.match(supervisor, /watchDirectory\("desktop"\)/);
  assert.match(supervisor, /watchDirectory\("scripts"\)/);
  assert.match(supervisor, /electron\.kill\("SIGTERM"\)/);
  assert.match(localServer, /"dev",\s*"--host",\s*"127\.0\.0\.1"/s);
  assert.match(launcher, /npm\.cmd run desktop:dev/);
  assert.match(launcher, /Get-CimInstance Win32_Process/);
  assert.match(launcher, /short-lived second Electron process/);
  assert.match(launcher, /\\\\\.local\\\\/);
  assert.match(launcher, /MaglucenCompanionDevelopmentLauncher/);
  assert.match(launcher, /Show-DevelopmentWindow/);
  assert.match(launcher, /exit 0/);
  assert.doesNotMatch(launcher, /Get-Process -Name "MaglucenStardewValleyCompanion"/);
  assert.match(assetExtractor, /process the files serially for a reliable cold start/);
  assert.match(assetExtractor, /for \(const \[source, destination\] of Object\.entries\(textures\)\)/);
  assert.match(desktop, /function revealWindow\(window\)/);
  assert.match(desktop, /if \(window\.isMinimized\(\)\) window\.restore\(\)/);
  assert.match(desktop, /window\.moveTop\(\)/);
});

test("desktop loading screen uses the complete original brand lockup and localized progress", async () => {
  const [loading, loadingScript, styles, desktop] = await Promise.all([
    readFile(new URL("../desktop/loading.html", import.meta.url), "utf8"),
    readFile(new URL("../desktop/loading.js", import.meta.url), "utf8"),
    readFile(new URL("../desktop/setup.css", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(loading, /resources\/brand-lockup-original\.png/);
  assert.doesNotMatch(loading, /MAGLUCEN · STARD/);
  assert.match(styles, /\.loading-brand \{/);
  assert.match(styles, /width: 270px/);
  assert.match(styles, /mix-blend-mode: lighten/);
  assert.match(loadingScript, /messages\["loading\.title"\]/);
  assert.match(desktop, /t\("loading\.extractingAssets"\)/);
  assert.match(desktop, /t\("loading\.optimizing"\)/);
  assert.match(desktop, /function loadingWindowBounds\(\)/);
  assert.match(desktop, /const saved = loadWindowState\(\)/);
  assert.match(desktop, /screen\.getDisplayNearestPoint\(/);
  assert.match(desktop, /const area = display\.workArea/);
  assert.match(desktop, /\.\.\.loadingWindowBounds\(\)/);
  assert.doesNotMatch(desktop, /progress\("Preparing your farmers/);
});

test("development, LIVE help, storage locating, and unlocked weekly orders are discoverable", async () => {
  const [page, styles, desktop, setup, setupScript, extractor, generator] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/setup.html", import.meta.url), "utf8"),
    readFile(new URL("../desktop/setup.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/extract_game_data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
  ]);
  assert.match(page, /development-badge/);
  assert.match(page, /t\("shell\.liveMapAt"/);
  assert.match(page, /onMouseEnter=\{openLivePanel\}/);
  assert.match(page, /onMouseLeave=\{closeLivePanelSoon\}/);
  assert.match(page, /t\("web\.home\.hoverToPreviewSaveAndLIVEData"\)/);
  assert.match(styles, /\.live-data-panel \{[^}]*z-index: 90/s);
  assert.match(page, /function ItemLocationDialog/);
  assert.match(page, /document\.addEventListener\("click", locate\)/);
  assert.match(page, /document\.removeEventListener\("click", locate\)/);
  assert.match(page, /closest\("button, a, summary, input, select, textarea, \[role='button'\]"\)/);
  assert.match(page, /closest<HTMLElement>\([\s\S]*?"\[data-storage-item\]"/);
  assert.match(page, /t\("web\.home\.clickAnItemCardToSeeWhereItIs"\)/);
  assert.match(styles, /\.item-locator-dialog/);
  assert.match(page, /stardew-tool-storage-view/);
  assert.match(page, /stardew-tool-storage-location/);
  assert.match(page, /stardew-tool-storage-sort/);
  assert.match(page, /special-orders-section/);
  assert.match(generator, /def special_orders_status/);
  assert.match(generator, /"specialOrdersUnlocked": day_index >= 58/);
  assert.match(extractor, /specialOrderStrings/);
  assert.match(desktop, /development: desktopDevelopment/);
  assert.match(setup, /nexusmods\.com\/stardewvalley\/mods\/2400/);
  assert.match(setup, /curseforge\.com\/stardewvalley\/mods\/smapi/);
  assert.match(setupScript, /\.smapi-links"\)\.hidden = state\.smapiDetected/);
  assert.match(setupScript, /`Maglucen Companion \$\{t\("window\.settings"\)\}`/);
});

test("main navigation shortcuts and route item artwork are visible and safe", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /window\.addEventListener\("keydown", openSection\)/);
  assert.match(page, /input, select, textarea, \[contenteditable='true'\]/);
  assert.match(page, /\{t\("nav\.today"\)\} <kbd>1<\/kbd>/);
  assert.match(page, /\{t\("nav\.progress"\)\} <kbd>6<\/kbd>/);
  assert.match(page, /<h3>\{t\("web\.home\.quickControls"\)\}<\/h3>/);
  assert.match(page, /displayedItems\.map\([\s\S]*?<ItemMentionArtwork name=\{item\.name\}/);
  assert.match(styles, /\.world-items \.item-mention-artwork \{[^}]*width: 28px;[^}]*height: 28px;/s);
  assert.match(styles, /\.world-items \.item-mention-artwork > \.sheet-artwork \{[^}]*left: 50%;[^}]*top: 50%;[^}]*translate\(-50%, -50%\) scale\(0\.75\)/s);
  assert.match(page, /diagnostics && !diagnostics\.smapiFound/);
});

test("Progress exploration is interactive, searchable, and permanently anchored", async () => {
  const [page, styles, desktop] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(page, /event\.key\.toLowerCase\(\) === "f"/);
  assert.match(page, /t\("web\.home\.searchTheCompanion"\)/);
  assert.match(page, /t\("search\.ownedItemDetail"\)/);
  assert.match(styles, /\.app-search-dialog/);
  assert.match(page, /className=\{`economy-chart-tooltip/);
  assert.match(page, /onMouseMove=\{\(event\) => selectNearest\(event\.clientX\)\}/);
  assert.match(page, /window\.devicePixelRatio/);
  assert.match(page, /new ResizeObserver\(draw\)/);
  assert.match(styles, /\.economy-chart \{[\s\S]*?image-rendering: auto;/);
  assert.match(page, /scrollIntoView\(\{/);
  assert.match(page, /className="next-event"/);
  assert.match(styles, /\.achievement-card\.focused/);
  assert.match(page, /https:\/\/stardewvalleywiki\.com\/Stardew_Valley_Wiki/);
  assert.match(desktop, /t\("menu\.wiki"\)/);
});

test("long-term collection cards open exact missing-item checklists", async () => {
  const [page, styles, generator, bridge] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
    readFile(new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url), "utf8"),
  ]);
  assert.match(page, /onClick=\{\(\) => setOpenCollectionId\(card\.id\)\}/);
  assert.match(page, /aria-label=\{t\("collection\.openMissing"/);
  assert.match(page, /aria-label=\{t\("collection\.missingFor"/);
  assert.match(page, /className="collection-checklist"/);
  assert.match(page, /if \(event\.key === "Escape"\) setOpenCollectionId\(null\)/);
  assert.match(page, /missingMuseum/);
  assert.match(page, /missingFish/);
  assert.match(page, /missingBundles/);
  assert.match(page, /live\.collections\?\.shipping/);
  assert.match(page, /current\.collectionBrief\?\.shipping/);
  assert.match(page, /t\("collection\.shipping\.notShipped"\)/);
  assert.match(page, /current\.collectionBrief\?\.cooking/);
  assert.match(page, /current\.collectionBrief\?\.crafting/);
  assert.match(styles, /\.completion-card:hover/);
  assert.match(styles, /\.collection-detail-dialog/);
  assert.match(styles, /\.collection-checklist/);
  assert.match(generator, /def long_term_collection_brief\(/);
  assert.match(generator, /def cached_shipping_collection\(/);
  assert.match(generator, /"shipping": shipping or \[\]/);
  assert.match(generator, /"learned": name in cooked/);
  assert.match(generator, /"learned": name in crafted/);
  assert.match(bridge, /Object\.isPotentialBasicShipped/);
  assert.match(bridge, /player\.basicShipped\.ContainsKey\(item\.ItemId\)/);
});

test("daily completion, LIVE alerts, wiki links, and history intelligence share verified state", async () => {
  const [page, styles, generator, bridge] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
    readFile(new URL("../bridge/StardewValleyToolBridge/ModEntry.cs", import.meta.url), "utf8"),
  ]);
  assert.match(page, /t\("web\.dailyBrief\.whatCanICompleteToday"\)/);
  assert.match(page, /t\("web\.dailyBrief\.whatChangedSinceMyLastSession"\)/);
  assert.match(page, /function deriveLiveAlerts/);
  assert.match(page, /stardew-tool-live-alerts/);
  assert.match(page, /<LiveAlertCenter/);
  assert.match(page, /setShowLiveAlerts\(false\)/);
  assert.match(page, /function WikiLink/);
  assert.match(page, /<WikiLink name=\{fish\.name\}/);
  assert.match(page, /<WikiLink name=\{building\.name\}/);
  assert.match(page, /<WikiLink name=\{friend\.name\}/);
  assert.match(page, /t\("web\.growth\.automaticHistoryAnnotations"\)/);
  assert.match(styles, /\.live-alert-dialog/);
  assert.match(styles, /\.completable-grid/);
  assert.match(styles, /\.history-event-list/);
  assert.match(generator, /"buildingStates"/);
  assert.match(generator, /"completedBundles"/);
  assert.match(generator, /"completedAchievements"/);
  assert.match(generator, /"toolLevels"/);
  assert.match(generator, /entry\["annotations"\] = annotations/);
  assert.match(bridge, /buildingStates = farm\.buildings/);
  assert.match(bridge, /toolLevels = player\.Items\.OfType<Tool>/);
});

test("navigation history supports header controls, keyboard shortcuts, and mouse buttons", async () => {
  const [page, styles, desktop, preload] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/preload.cjs", import.meta.url), "utf8"),
  ]);
  assert.match(page, /className="history-navigation"/);
  assert.match(page, /aria-label=\{t\("shell\.back"\)\}/);
  assert.match(page, /aria-label=\{t\("shell\.forward"\)\}/);
  assert.match(page, /event\.altKey/);
  assert.match(page, /event\.key !== "ArrowLeft" && event\.key !== "ArrowRight"/);
  assert.match(page, /event\.button !== 3 && event\.button !== 4/);
  assert.match(page, /event\.button === 3 \? "back" : "forward"/);
  assert.match(page, /window\.addEventListener\("mousedown", mouseHistoryShortcut, true\)/);
  assert.match(page, /lastHardwareNavigationRef/);
  assert.match(page, /onNavigateSection=\{\(section\) => navigateTo/);
  assert.match(page, /t\("web\.home\.theHeaderArrowsOrYourMouseBackForwardButtons"\)/);
  assert.match(styles, /\.history-navigation button/);
  assert.match(desktop, /webContents\.on\("app-command"/);
  assert.match(desktop, /webContents\.on\("before-input-event"/);
  assert.match(desktop, /command !== "browser-backward" && command !== "browser-forward"/);
  assert.match(desktop, /key === "browserback"/);
  assert.match(desktop, /key === "browserforward"/);
  assert.match(desktop, /"navigation:history"/);
  assert.match(preload, /onNavigateHistory/);
});

test("Today checklist persists per farm and resolves eligible tasks from LIVE evidence", async () => {
  const [page, preferences, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/preferences/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(preferences, /resolve\(directory, "farms", profileId, "preferences\.json"\)/);
  assert.match(preferences, /mergeTodayTaskDay/);
  assert.match(preferences, /todayTasks: mergeTodayTaskDay/);
  assert.match(page, /type TodayTaskStatus = "active" \| "completed" \| "dismissed" \| "postponed"/);
  assert.match(page, /completionMode\?: "manual" \| "automatic"/);
  assert.match(page, /"collect-machines": readyMachinesCount === 0/);
  assert.match(page, /"birthday-gift": Boolean\(birthdayFriend\?\.giftsToday\)/);
  assert.match(page, /liveCompletedBundleCount > \(task\.baseline/);
  assert.match(page, /task\.status === "postponed"/);
  assert.match(page, /today\.checklist\.savedSidecar/);
  assert.match(page, /today-personal-goals/);
  assert.match(styles, /\.checklist-actions/);
  assert.match(styles, /\.checklist-history/);
});

test("production planner works offline with a catalog derived from the local game", async () => {
  const [page, calculator, engine, machineEngine, extractor, gameReader, generator, preferences] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/planning/production-calculator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/planning/production-engine.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/planning/machine-engine.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/extract_game_data.mjs", import.meta.url), "utf8"),
    readFile(new URL("../tools/StardewDataExtractor/Program.cs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/generate_snapshot.py", import.meta.url), "utf8"),
    readFile(new URL("../app/api/preferences/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /productionCatalog\?: ProductionCatalog/);
  assert.match(page, /<ProductionCalculator/);
  assert.match(calculator, /calculateProductionPlan/);
  assert.match(calculator, /buildCalculatorEntries/);
  assert.match(calculator, /"tapped-tree", "mushroom-log"/);
  assert.match(calculator, /"tapped-tree", "mushroom-log", "machine"/);
  assert.match(calculator, /calculateMachinePlan/);
  assert.match(calculator, /currentInventory/);
  assert.match(calculator, /currentMachines/);
  assert.match(machineEngine, /directSaleValue/);
  assert.match(machineEngine, /machine-input-bottleneck/);
  assert.match(calculator, /<option value="units">/);
  assert.match(calculator, /horizonMode === "days"/);
  assert.match(calculator, /horizonMode === "date"/);
  assert.match(calculator, /<span>\{t\("planner\.endDay"\)\}<\/span>/);
  assert.match(calculator, /<span>\{t\("planner\.endYear"\)\}<\/span>/);
  assert.match(engine, /export function resolvePlanningHorizon/);
  assert.match(engine, /export function calculateProductionPlan/);
  assert.match(page, /catalog=\{current\.productionCatalog\}/);
  assert.doesNotMatch(page, /catalog=\{live\.productionCatalog\}/);
  assert.match(calculator, /currentFarmingLevel/);
  assert.match(calculator, /currentProfessionIds/);
  assert.match(calculator, /qualityPriceMultipliers/);
  assert.match(calculator, /acceleratedGrowthDays/);
  assert.match(calculator, /tillerApplies/);
  assert.match(calculator, /entry\.kind === "crop"[\s\S]*resolveGameName\(entry\.output\.name, entry\.output\.id\)/);
  assert.match(calculator, /renderItemArtwork\?\.\(entry\.output\.id, outputName, entry\.output\.spriteIndex, entry\.output\.artworkUrl, entry\.output\.artworkColumns\)/);
  assert.match(page, /function ModdedItemArtwork/);
  assert.match(calculator, /className="planner-result-identity"/);
  assert.match(calculator, /className="planner-comparison-identity"/);
  assert.match(calculator, /className="planner-producer-menu"/);
  assert.match(calculator, /className="planner-producer-search"/);
  assert.match(calculator, /normalize\("NFD"\)/);
  assert.match(calculator, /queryTerms\.every\(term => searchable\.includes\(term\)\)/);
  assert.match(calculator, /producerSearch\.current\?\.focus\(\)/);
  assert.match(calculator, /document\.addEventListener\("pointerdown", closeOnOutsideClick\)/);
  assert.doesNotMatch(calculator, /window\.localStorage\.setItem\(storageKey/);
  assert.match(calculator, /fetch\("\/api\/preferences"/);
  assert.match(calculator, /productionPlanning: \{ current: calculation, bookmarks, comparisonIds, comparisonView, portfolios \}/);
  assert.match(preferences, /sanitizeProductionPlanning/);
  assert.match(preferences, /productionPlanning/);
  assert.match(calculator, /className="planner-bookmarks"/);
  assert.match(calculator, /planner-applied-assumptions/);
  assert.match(calculator, /className="planner-comparison-table"/);
  assert.match(calculator, /className="planner-comparison-chart"/);
  assert.match(calculator, /comparisonIds\.length >= 3/);
  assert.match(calculator, /comparisonRows/);
  assert.match(calculator, /machineUpstreamId/);
  assert.match(calculator, /bookmarkOutput/);
  assert.match(calculator, /inputEvents: selectedUpstream\?\.events/);
  assert.match(machineEngine, /outputEvents/);
  assert.match(calculator, /pondProcessorCount/);
  assert.match(calculator, /pondPlan\?\.outputs/);
  assert.match(calculator, /animalPlan\?\.outputs/);
  assert.match(calculator, /renderAnimalArtwork/);
  assert.match(extractor, /public\/assets\/animals/);
  assert.match(gameReader, /processedRoe = DescribeItem/);
  assert.match(calculator, /savePortfolio/);
  assert.match(calculator, /planner-saved-portfolios/);
  assert.ok(calculator.indexOf('className="planner-advanced"') < calculator.indexOf('className="planner-results"'));
  assert.ok(calculator.indexOf('className="planner-results"') < calculator.indexOf('className="planner-bookmark-toolbar"'));
  assert.match(calculator, /savedEntries = buildCalculatorEntries/);
  assert.match(calculator, /selectedIsForestry \? "forestry\.initialCost"/);
  assert.match(calculator, /selectedIsForestry \? "forestry\.collectionCycles"/);
  assert.match(calculator, /!selectedIsForestry \|\| !forestryExisting/);
  assert.match(calculator, /resetCalculation/);
  assert.match(calculator, /forcePlantToday/);
  assert.match(page, /renderItemArtwork=\{/);
  assert.match(page, /<ModdedItemArtwork/);
  assert.match(page, /: <SheetArtwork/);
  assert.match(extractor, /StardewDataExtractor\.exe/);
  assert.match(gameReader, /Data\/Crops/);
  assert.match(gameReader, /Data\/Objects/);
  assert.match(gameReader, /Data\/FruitTrees/);
  assert.match(gameReader, /Data\/Shops/);
  assert.match(gameReader, /growthPhases = pair\.Value\.DaysInPhase/);
  assert.match(gameReader, /category = data\?\.Category/);
  assert.match(gameReader, /fertilizerCatalog/);
  assert.match(gameReader, /Data\/WildTrees/);
  assert.match(gameReader, /Data\/Machines/);
  assert.match(gameReader, /artisanMachines/);
  assert.match(gameReader, /GeneratedCategoryTags/);
  assert.match(gameReader, /tappedTreeCatalog/);
  assert.match(gameReader, /mushroomLogRules/);
  assert.match(gameReader, /forestryEquipment/);
  assert.match(generator, /"professionIds"/);
  assert.match(gameReader, /source = "local-game"/);
  assert.match(generator, /"productionCatalog": game_data\.get\("productionCatalog"\)/);
});
