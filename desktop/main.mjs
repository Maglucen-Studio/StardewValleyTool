import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} from "electron";
import updater from "electron-updater";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { release as osRelease } from "node:os";
import {
  createTranslator,
  resolveLanguage,
} from "../scripts/localization.mjs";
import { releaseNotesDecision } from "./release-notes.mjs";
import { scanModCompatibility } from "../scripts/mod-compatibility.mjs";

const desktopDevelopment = process.env.STARDEW_TOOL_DESKTOP_DEV === "1";
const APP_ID = "io.github.maglucenstudio.stardewvalleycompanion";
const ACTIVE_APP_ID = desktopDevelopment ? `${APP_ID}.development` : APP_ID;
const PRODUCT = desktopDevelopment
  ? "Maglucen Companion Development"
  : "Maglucen Stardew Valley Companion";
const LEGACY_DATA_DIR_NAME = "stardew-valley-tool";
const { autoUpdater } = updater;
const backgroundLaunch = process.argv.includes("--background");
let projectRoot;
let workRoot;
let desktopDataRoot;
let runtimeRoot;
let configPath;
let existingInstallationAtLaunch = false;
let mainWindow = null;
let setupWindow = null;
let loadingWindow = null;
let tray = null;
let backend = null;
let quitting = false;
let initialization = null;
let gameWasRunning = false;
let windowStateSaveTimer = null;
let setupWindowStateSaveTimer = null;
let farmSwitching = false;
let manualFarmSelectionDuringGame = null;
let resolvedSourcePython = null;
let updateState = { status: "idle", currentVersion: app.getVersion() };
const backendToken = randomBytes(32).toString("hex");
const localServiceHost = desktopDevelopment ? "localhost" : "127.0.0.1";

if (desktopDevelopment) {
  const developmentUserData = join(
    app.getPath("appData"),
    "maglucen-stardew-valley-companion-development",
  );
  mkdirSync(developmentUserData, { recursive: true });
  app.setPath("userData", developmentUserData);
}
app.setName(PRODUCT);
app.setAppUserModelId(ACTIVE_APP_ID);

function servicePort(config) {
  return desktopDevelopment
    ? Number(process.env.STARDEW_TOOL_DESKTOP_PORT || 43117)
    : Number(config?.port || 3000);
}

function log(message) {
  const directory = join(desktopDataRoot || app.getPath("userData"), "logs");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "desktop.log"),
    `[${new Date().toISOString()}] ${message}\n`,
    { flag: "a" },
  );
}

async function ensureLocalStardewIcon(config) {
  const executable = [
    join(config.stardewPath, "Stardew Valley.exe"),
    join(config.stardewPath, "StardewValley.exe"),
  ].find((candidate) => existsSync(candidate));
  if (!executable) return;
  const destinations = [
    join(runtimeRoot, "public", "assets", "ui", "stardew-valley-icon.png"),
    join(workRoot, "dist", "assets", "ui", "stardew-valley-icon.png"),
  ];
  if (destinations.every((destination) => existsSync(destination))) return;
  try {
    const icon = await app.getFileIcon(executable, { size: "normal" });
    if (icon.isEmpty()) return;
    const png = icon.toPNG();
    for (const destination of destinations) {
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, png);
    }
  } catch (error) {
    log(`Local Stardew Valley icon unavailable: ${error?.message || error}`);
  }
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function migrateLegacyDesktopData(target) {
  if (process.env.STARDEW_TOOL_DESKTOP_DATA) return;
  const legacyRoot = join(app.getPath("appData"), LEGACY_DATA_DIR_NAME);
  if (resolve(legacyRoot) === resolve(target) || !existsSync(legacyRoot)) return;
  mkdirSync(target, { recursive: true });
  for (const filename of ["config.json", "window-state.json"]) {
    const source = join(legacyRoot, filename);
    const destination = join(target, filename);
    if (existsSync(source) && !existsSync(destination))
      copyFileSync(source, destination);
  }
  const migratedConfigPath = join(target, "config.json");
  const migratedConfig = readJson(migratedConfigPath, null);
  if (!migratedConfig) return;
  const runtimeCandidates = [
    join(legacyRoot, "runtime", "public", "data"),
    join(legacyRoot, "runtime", "dist", "data"),
    join(legacyRoot, "runtime", "data"),
  ];
  const versionedRuntimeRoot = join(legacyRoot, "app-runtime");
  if (existsSync(versionedRuntimeRoot))
    for (const entry of readdirSync(versionedRuntimeRoot, {
      withFileTypes: true,
    }))
      if (entry.isDirectory())
        runtimeCandidates.push(
          join(versionedRuntimeRoot, entry.name, "dist", "data"),
        );
  migratedConfig.legacyDataDirs = [
    ...(Array.isArray(migratedConfig.legacyDataDirs)
      ? migratedConfig.legacyDataDirs
      : []),
    ...runtimeCandidates,
  ].filter(
    (candidate, index, values) =>
      existsSync(candidate) &&
      values.findIndex(
        (value) =>
          resolve(value).toLowerCase() === resolve(candidate).toLowerCase(),
      ) === index,
  );
  writeFileSync(
    migratedConfigPath,
    JSON.stringify(migratedConfig, null, 2),
    "utf8",
  );
}

function readConfig() {
  return readJson(configPath, null);
}

function releaseNotesStatePath() {
  return join(desktopDataRoot, "release-notes-state.json");
}

function acknowledgeReleaseNotes(version = app.getVersion()) {
  mkdirSync(desktopDataRoot, { recursive: true });
  writeFileSync(
    releaseNotesStatePath(),
    JSON.stringify({ schemaVersion: 1, lastSeenVersion: version }, null, 2),
    "utf8",
  );
}

function currentReleaseNotesState() {
  const saved = readJson(releaseNotesStatePath(), {});
  const decision = releaseNotesDecision({
    packaged: app.isPackaged,
    development: desktopDevelopment,
    currentVersion: app.getVersion(),
    lastSeenVersion: typeof saved.lastSeenVersion === "string"
      ? saved.lastSeenVersion
      : null,
    existingInstallation: existingInstallationAtLaunch,
  });
  if (decision.shouldAcknowledge)
    acknowledgeReleaseNotes(decision.currentVersion);
  return decision;
}

function localizationState(config = readConfig() || {}) {
  return resolveLanguage(config, app.getPath("appData"));
}

function localizationCatalog(language) {
  const root = projectRoot || app.getAppPath();
  return readJson(join(root, "locales", `${language}.json`), {});
}

function localizationPayload(config = readConfig() || {}) {
  const state = localizationState(config);
  return {
    ...state,
    messages: localizationCatalog(state.language),
    fallbackMessages: localizationCatalog("en"),
    gameCatalog: readJson(
      join(runtimeRoot, "public", "data", `game-localization.${state.language}.json`),
      {},
    ),
  };
}

function publishLocalizationState(config = readConfig() || {}) {
  const payload = localizationPayload(config);
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send("localization:changed", payload);
  return payload;
}

function desktopTranslator(config = readConfig() || {}) {
  const state = localizationState(config);
  return createTranslator(
    localizationCatalog(state.language),
    localizationCatalog("en"),
  );
}

function publishUpdateState(next) {
  updateState = { ...updateState, ...next, currentVersion: app.getVersion() };
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send("updates:state", updateState);
}

function configureAutoUpdates() {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_FILE) {
    publishUpdateState({
      status: "unavailable",
      reason: app.isPackaged ? "portable" : "development",
      message: undefined,
    });
    return;
  }
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.on("checking-for-update", () =>
    publishUpdateState({
      status: "checking",
      message: undefined,
    }),
  );
  autoUpdater.on("update-available", (info) =>
    publishUpdateState({
      status: "available",
      version: info.version,
      message: undefined,
    }),
  );
  autoUpdater.on("update-not-available", () =>
    publishUpdateState({
      status: "current",
      version: app.getVersion(),
      message: undefined,
    }),
  );
  autoUpdater.on("download-progress", (progress) =>
    publishUpdateState({
      status: "downloading",
      percent: Math.round(progress.percent),
      message: undefined,
    }),
  );
  autoUpdater.on("update-downloaded", (info) =>
    publishUpdateState({
      status: "downloaded",
      version: info.version,
      percent: 100,
      message: undefined,
    }),
  );
  autoUpdater.on("error", (error) => {
    log(`Updater: ${error?.stack || error}`);
    publishUpdateState({
      status: "error",
      message: undefined,
    });
  });
  setTimeout(
    () =>
      autoUpdater
        .checkForUpdates()
        .catch((error) => log(`Update check: ${error?.stack || error}`)),
    12000,
  ).unref();
}

function windowStatePath() {
  return join(desktopDataRoot, "window-state.json");
}

function setupWindowStatePath() {
  return join(desktopDataRoot, "settings-window-state.json");
}

function loadVisibleWindowState(path, fallback, minWidth, minHeight) {
  const saved = readJson(path, fallback);
  const width = Math.max(minWidth, Number(saved?.width) || fallback.width);
  const height = Math.max(minHeight, Number(saved?.height) || fallback.height);
  const candidate = { x: Number(saved?.x), y: Number(saved?.y), width, height };
  const visible =
    Number.isFinite(candidate.x) &&
    Number.isFinite(candidate.y) &&
    screen.getAllDisplays().some((display) => {
      const area = display.workArea;
      const overlapWidth = Math.max(
        0,
        Math.min(candidate.x + candidate.width, area.x + area.width) -
          Math.max(candidate.x, area.x),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(candidate.y + candidate.height, area.y + area.height) -
          Math.max(candidate.y, area.y),
      );
      return overlapWidth >= 160 && overlapHeight >= 120;
    });
  return {
    ...(visible ? candidate : { width, height }),
    maximized: Boolean(saved?.maximized),
  };
}

function loadWindowState() {
  const fallback = { width: 1500, height: 980, maximized: false };
  return loadVisibleWindowState(windowStatePath(), fallback, 1050, 720);
}

function loadSetupWindowState() {
  const fallback = { width: 820, height: 720, maximized: false };
  return loadVisibleWindowState(setupWindowStatePath(), fallback, 720, 650);
}

function loadingWindowBounds() {
  const width = 560;
  const height = 430;
  const saved = loadWindowState();
  if (!Number.isFinite(saved.x) || !Number.isFinite(saved.y))
    return { width, height };
  const display = screen.getDisplayNearestPoint({
    x: Math.round(saved.x + saved.width / 2),
    y: Math.round(saved.y + saved.height / 2),
  });
  const area = display.workArea;
  const centeredX = Math.round(saved.x + (saved.width - width) / 2);
  const centeredY = Math.round(saved.y + (saved.height - height) / 2);
  return {
    width,
    height,
    x: Math.max(area.x, Math.min(centeredX, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(centeredY, area.y + area.height - height)),
  };
}

function saveWindowState(window, path = windowStatePath()) {
  if (!window || window.isDestroyed()) return;
  const bounds = window.isMaximized()
    ? window.getNormalBounds()
    : window.getBounds();
  writeFileSync(
    path,
    JSON.stringify({ ...bounds, maximized: window.isMaximized() }, null, 2),
  );
}

function scheduleWindowStateSave(window) {
  clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = setTimeout(() => saveWindowState(window), 250);
}

function scheduleSetupWindowStateSave(window) {
  clearTimeout(setupWindowStateSaveTimer);
  setupWindowStateSaveTimer = setTimeout(
    () => saveWindowState(window, setupWindowStatePath()),
    250,
  );
}

function validConfig(config) {
  return Boolean(
    config?.stardewPath &&
    existsSync(join(config.stardewPath, "Stardew Valley.dll")) &&
    config?.savePath &&
    existsSync(config.savePath),
  );
}

function newestModDataMtime(directory) {
  let newest = 0;
  try {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory())
        newest = Math.max(newest, newestModDataMtime(path));
      else if (/\.(?:json|png)$/i.test(entry.name))
        newest = Math.max(newest, statSync(path).mtimeMs);
    }
  } catch {
    // Missing or unreadable mod folders contain nothing that needs refreshing.
  }
  return newest;
}

function extractedAssetsAreStale(config, requiredAssets) {
  if (requiredAssets.some((asset) => !existsSync(asset))) return true;
  const gameData = join(runtimeRoot, "assetbuild", "game-data.json");
  if (!existsSync(gameData)) return true;
  const extracted = readJson(gameData, {});
  if (
    extracted?._localization?.catalogVersion !== 11
  )
    return true;
  return (
    newestModDataMtime(join(config.stardewPath, "Mods")) >
    statSync(gameData).mtimeMs
  );
}

function uniqueExisting(paths) {
  return [
    ...new Set(paths.filter(Boolean).map((path) => resolve(path))),
  ].filter((path) => existsSync(path));
}

function registrySteamPaths() {
  const candidates = [];
  for (const key of [
    "HKCU\\Software\\Valve\\Steam",
    "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam",
  ]) {
    const result = spawnSync("reg.exe", ["query", key, "/v", "SteamPath"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const match = result.stdout?.match(/SteamPath\s+REG_\w+\s+(.+)$/m);
    if (match) candidates.push(match[1].trim());
  }
  return candidates;
}

function detectGameInstalls() {
  const steamRoots = uniqueExisting([
    ...registrySteamPaths(),
    join(process.env.ProgramFiles || "C:\\Program Files", "Steam"),
    join(
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
      "Steam",
    ),
    "C:\\SteamLibrary",
  ]);
  const libraries = [...steamRoots];
  for (const steamRoot of steamRoots) {
    const vdf = join(steamRoot, "steamapps", "libraryfolders.vdf");
    if (!existsSync(vdf)) continue;
    const text = readFileSync(vdf, "utf8");
    for (const match of text.matchAll(/"path"\s+"([^"]+)"/g))
      libraries.push(match[1].replace(/\\\\/g, "\\"));
  }
  const otherStores = [];
  for (let code = "C".charCodeAt(0); code <= "Z".charCodeAt(0); code += 1) {
    const drive = `${String.fromCharCode(code)}:\\`;
    otherStores.push(
      join(drive, "GOG Games", "Stardew Valley"),
      join(
        drive,
        "Program Files (x86)",
        "GOG Galaxy",
        "Games",
        "Stardew Valley",
      ),
      join(drive, "XboxGames", "Stardew Valley", "Content"),
      join(drive, "XboxGames", "Stardew Valley"),
    );
  }
  return uniqueExisting([
    ...libraries.map((root) =>
      join(root, "steamapps", "common", "Stardew Valley"),
    ),
    ...otherStores,
  ]).filter((path) => existsSync(join(path, "Stardew Valley.dll")));
}

function platformForInstall(path = "") {
  const normalized = path.toLowerCase();
  if (normalized.includes("steamapps")) return "steam";
  if (normalized.includes("gog")) return "gog";
  if (normalized.includes("xboxgames") || normalized.includes("windowsapps"))
    return "xbox";
  return "other";
}

function detectSaves() {
  const root = join(
    process.env.APPDATA || app.getPath("appData"),
    "StardewValley",
    "Saves",
  );
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const file = join(root, entry.name, entry.name);
      if (!existsSync(file)) return [];
      const modifiedAt = statSync(file).mtimeMs;
      let farmer = "";
      let farmName = entry.name.replace(/_\d+$/, "");
      let gameSeason = "";
      let gameDay = 0;
      let gameYear = 0;
      try {
        const saveText = readFileSync(file, "utf8");
        farmer = saveText.match(/<name>([^<]+)<\/name>/)?.[1] || "";
        farmName = saveText.match(/<farmName>([^<]+)<\/farmName>/)?.[1] || farmName;
        gameSeason = saveText.match(/<currentSeason>([^<]+)<\/currentSeason>/)?.[1] || "";
        gameDay = Number(saveText.match(/<dayOfMonth>(\d+)<\/dayOfMonth>/)?.[1] || 0);
        gameYear = Number(saveText.match(/<year>(\d+)<\/year>/)?.[1] || 0);
      } catch {
        /* A damaged save can still be selected manually. */
      }
      return [
        {
          name: farmName,
          farmer,
          gameSeason,
          gameDay,
          gameYear,
          path: file,
          modifiedAt,
          avatar: `/assets/farmers/${profileIdForSave(file)}.png?v=${Math.trunc(modifiedAt)}`,
          liveUpdatedAt: existsSync(join(root, entry.name, ".stardew-tool-live.json"))
            ? statSync(join(root, entry.name, ".stardew-tool-live.json")).mtimeMs
            : 0,
        },
      ];
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

function setupState() {
  const config = readConfig();
  const language = localizationState(config || {});
  const installs = detectGameInstalls();
  const saves = detectSaves();
  const suggestedInstall = validConfig(config)
    ? config.stardewPath
    : installs[0] || "";
  const platformInstalls = Object.fromEntries(
    ["steam", "gog", "xbox", "other"].map((platform) => [
      platform,
      installs.find((path) => platformForInstall(path) === platform) || "",
    ]),
  );
  return {
    version: app.getVersion(),
    config,
    localization: {
      ...language,
      catalogs: {
        en: localizationCatalog("en"),
        es: localizationCatalog("es"),
      },
    },
    installs,
    saves,
    suggestedInstall,
    suggestedSave: validConfig(config) ? config.savePath : saves[0]?.path || "",
    suggestedPlatform: config?.platform || platformForInstall(suggestedInstall),
    platformInstalls,
    smapiDetected: installs.some((path) =>
      existsSync(join(path, "StardewModdingAPI.dll")),
    ),
    packaged: app.isPackaged,
    development: desktopDevelopment,
  };
}

function profileIdForSave(savePath) {
  return basename(dirname(String(savePath || "save")))
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 96) || "default";
}

function migrateLegacyFarmPreferences(config) {
  const legacy = join(runtimeRoot, ".local", "preferences.json");
  const marker = join(runtimeRoot, ".local", "preferences-profile-migrated.json");
  if (!existsSync(legacy) || existsSync(marker)) return;
  const profileId = profileIdForSave(config.savePath);
  const destination = join(runtimeRoot, ".local", "farms", profileId, "preferences.json");
  mkdirSync(dirname(destination), { recursive: true });
  if (!existsSync(destination)) copyFileSync(legacy, destination);
  writeFileSync(marker, JSON.stringify({ profileId, migratedAt: new Date().toISOString() }, null, 2), "utf8");
}

async function switchFarmConfig(savePath, progress = () => {}) {
  if (farmSwitching) return { ok: false, busy: true };
  const previousConfig = readConfig();
  const candidate = { ...previousConfig, savePath: String(savePath || "") };
  if (!validConfig(candidate))
    throw new Error(desktopTranslator(previousConfig)("desktop.error.saveUnavailable"));
  if (resolve(candidate.savePath) === resolve(previousConfig.savePath)) return { ok: true };
  farmSwitching = true;
  try {
    writeFileSync(configPath, JSON.stringify(candidate, null, 2), "utf8");
    if (backend && !backend.killed) {
      backend.kill();
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    }
    await initialize(candidate, progress);
    await mainWindow?.loadURL(`http://${localServiceHost}:${servicePort(candidate)}/`);
    return { ok: true };
  } finally {
    farmSwitching = false;
  }
}

function childEnvironment(config) {
  const language = localizationState(config);
  const legacyCandidates = [
    ...(process.env.STARDEW_TOOL_LEGACY_DATA_DIRS || "").split(delimiter),
    ...(Array.isArray(config.legacyDataDirs) ? config.legacyDataDirs : []),
    ...(process.env.PORTABLE_EXECUTABLE_FILE
      ? [
          join(
            dirname(process.env.PORTABLE_EXECUTABLE_FILE),
            "..",
            "public",
            "data",
          ),
        ]
      : []),
  ]
    .map((candidate) => String(candidate || "").trim())
    .filter((candidate) => candidate && existsSync(candidate));
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    STARDEW_TOOL_CONFIG: configPath,
    STARDEW_TOOL_RUNTIME_ROOT: runtimeRoot,
    STARDEW_PATH: config.stardewPath,
    STARDEW_SAVE: config.savePath,
    STARDEW_TOOL_PROFILE_ID: profileIdForSave(config.savePath),
    STARDEW_TOOL_LANGUAGE_MODE: language.mode,
    STARDEW_TOOL_LANGUAGE: language.language,
    STARDEW_TOOL_LOCALE: language.locale,
    STARDEW_TOOL_XNB_SUFFIX: language.xnbSuffix,
    STARDEW_PYTHON: pythonCommand(config),
    STARDEW_TOOL_TOKEN: backendToken,
    PORT: String(servicePort(config)),
    STARDEW_TOOL_LEGACY_DATA_DIRS: [
      ...new Set(legacyCandidates.map((candidate) => resolve(candidate))),
    ].join(delimiter),
  };
}

function runNodeScript(relativeScript, config, onLine = () => {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [join(workRoot, relativeScript)], {
      cwd: workRoot,
      env: childEnvironment(config),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (data) => onLine(String(data).trim()));
    child.stderr.on("data", (data) => onLine(String(data).trim()));
    child.once("error", rejectPromise);
    child.once("exit", (code) =>
      code === 0
        ? resolvePromise()
        : rejectPromise(
            new Error(desktopTranslator(config)("desktop.error.scriptExited", {
              script: basename(relativeScript),
              code,
            })),
          ),
    );
  });
}

async function extractGameAssets(config, progress) {
  const t = desktopTranslator(config);
  const script = join("scripts", "extract_game_data.mjs");
  try {
    await runNodeScript(script, config, progress);
  } catch (firstError) {
    log(`Asset extraction retry after: ${firstError?.stack || firstError}`);
    progress(t("loading.assetsRetry"));
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));
    await runNodeScript(script, config, progress);
  }
}

function pythonCommand(config) {
  const bundled = app.isPackaged
    ? join(workRoot, "python", "python.exe")
    : null;
  if (bundled && existsSync(bundled)) return bundled;
  const sourceRuntime = !app.isPackaged
    ? join(projectRoot, "desktop", "resources", "python", "python.exe")
    : null;
  if (sourceRuntime && existsSync(sourceRuntime)) {
    resolvedSourcePython = sourceRuntime;
    return sourceRuntime;
  }
  if (resolvedSourcePython) return resolvedSourcePython;

  const candidates = [config.pythonCommand, "python"];
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const windowsApps = join(process.env.LOCALAPPDATA, "Microsoft", "WindowsApps");
    candidates.push(join(windowsApps, "python.exe"));
    try {
      for (const entry of readdirSync(windowsApps, { withFileTypes: true })) {
        if (
          entry.isDirectory() &&
          entry.name.startsWith("PythonSoftwareFoundation.Python.")
        )
          candidates.push(join(windowsApps, entry.name, "python.exe"));
      }
    } catch {
      // The WindowsApps directory is optional and can be access-restricted.
    }
  }

  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    const result = spawnSync(candidate, ["-c", "import PIL"], {
      windowsHide: true,
      encoding: "utf8",
    });
    if (result.status === 0) {
      resolvedSourcePython = candidate;
      return candidate;
    }
  }
  return config.pythonCommand || "python";
}

function ensureFarmAvatars(config, progress = () => {}) {
  const staleSaves = detectSaves().filter((save) => {
    const avatar = join(
      runtimeRoot,
      "public",
      "assets",
      "farmers",
      `${profileIdForSave(save.path)}.png`,
    );
    return !existsSync(avatar) || statSync(avatar).mtimeMs < save.modifiedAt;
  });
  if (!staleSaves.length) return;
  progress(desktopTranslator(config)("loading.farmers"));
  const result = spawnSync(
    pythonCommand(config),
    [
      join(workRoot, "scripts", "generate_snapshot.py"),
      "--avatars-only",
      ...staleSaves.map((save) => save.path),
    ],
    {
      cwd: workRoot,
      env: childEnvironment(config),
      windowsHide: true,
      encoding: "utf8",
    },
  );
  if (result.status !== 0)
    log(`Farmer avatars could not be refreshed: ${result.stderr || result.error || "unknown error"}`);
}

function prepareStablePackagedRuntime() {
  const stableRoot = join(desktopDataRoot, "app-runtime", app.getVersion());
  const required = [
    join(stableRoot, "scripts", "dev-local.mjs"),
    join(stableRoot, "dist", "server", "index.js"),
    join(
      stableRoot,
      "desktop",
      "resources",
      "bridge",
      "StardewValleyToolBridge.dll",
    ),
    join(stableRoot, "python", "python.exe"),
  ];
  if (required.every((path) => existsSync(path))) return stableRoot;
  const unpackedSource = join(process.resourcesPath, "app.asar.unpacked");
  const pythonSource = join(process.resourcesPath, "python");
  if (!existsSync(unpackedSource) || !existsSync(pythonSource))
    throw new Error(
      desktopTranslator()("desktop.error.portableRuntimeExtract"),
    );
  mkdirSync(stableRoot, { recursive: true });
  cpSync(unpackedSource, stableRoot, { recursive: true, force: true });
  cpSync(pythonSource, join(stableRoot, "python"), {
    recursive: true,
    force: true,
  });
  if (!required.every((path) => existsSync(path)))
    throw new Error(
      desktopTranslator()("desktop.error.portableRuntimePrepare"),
    );
  return stableRoot;
}

function ensurePython(config) {
  const command = pythonCommand(config);
  let result = spawnSync(command, ["-c", "import PIL"], {
    windowsHide: true,
    encoding: "utf8",
  });
  if (result.status === 0) return;
  if (app.isPackaged)
    throw new Error(
      desktopTranslator(config)("desktop.error.imageComponent"),
    );
  throw new Error(
    desktopTranslator(config)("desktop.error.pythonPillow"),
  );
}

function bridgeSource() {
  const candidates = [
    join(workRoot, "desktop", "resources", "bridge"),
    join(
      workRoot,
      "bridge",
      "StardewValleyToolBridge",
      "bin",
      "Release",
      "net6.0",
    ),
  ];
  return candidates.find((directory) =>
    existsSync(join(directory, "StardewValleyToolBridge.dll")),
  );
}

function installBridge(config) {
  if (!existsSync(join(config.stardewPath, "StardewModdingAPI.dll")))
    return { status: "smapi-missing" };
  const source = bridgeSource();
  if (!source) return { status: "bridge-missing" };
  const destination = join(
    config.stardewPath,
    "Mods",
    "StardewValleyToolBridge",
  );
  mkdirSync(destination, { recursive: true });
  const manifestSource = existsSync(join(source, "manifest.json"))
    ? join(source, "manifest.json")
    : join(workRoot, "bridge", "StardewValleyToolBridge", "manifest.json");
  const manifest = readJson(manifestSource, {});
  let entryDll = "StardewValleyToolBridge.dll";
  try {
    copyFileSync(
      join(source, "StardewValleyToolBridge.dll"),
      join(destination, entryDll),
    );
  } catch (error) {
    if (!["EACCES", "EBUSY", "EPERM"].includes(error?.code)) throw error;
    entryDll = `StardewValleyToolBridge-${manifest.Version || "updated"}.dll`;
    copyFileSync(
      join(source, "StardewValleyToolBridge.dll"),
      join(destination, entryDll),
    );
  }
  writeFileSync(
    join(destination, "manifest.json"),
    JSON.stringify({ ...manifest, EntryDll: entryDll }, null, 2),
    "utf8",
  );
  return { status: "installed" };
}

async function plannerReady(port) {
  try {
    const response = await fetch(`http://${localServiceHost}:${port}/`, {
      headers: { "x-stardew-tool-token": backendToken },
      signal: AbortSignal.timeout(1200),
    });
    return (
      response.ok &&
      (desktopDevelopment ||
        response.headers.get("x-stardew-tool-service") === "authenticated")
    );
  } catch {
    return false;
  }
}

async function startBackend(config, progress) {
  if (await plannerReady(servicePort(config))) return;
  const logDirectory = join(desktopDataRoot, "logs");
  mkdirSync(logDirectory, { recursive: true });
  const output = createWriteStream(join(logDirectory, "backend.log"), {
    flags: "a",
  });
  backend = spawn(
    process.execPath,
    [join(workRoot, "scripts", "dev-local.mjs")],
    {
      cwd: workRoot,
      env: {
        ...childEnvironment(config),
        STARDEW_TOOL_SERVER_MODE: desktopDevelopment
          ? "development"
          : "production",
        STARDEW_TOOL_SKIP_ASSET_EXTRACTION: "1",
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const launchedBackend = backend;
  backend.stdout.pipe(output, { end: false });
  backend.stderr.pipe(output, { end: false });
  backend.once("exit", (code) => {
    log(`Backend stopped with code ${code}`);
    backend = null;
  });
  const t = desktopTranslator(config);
  progress(t("loading.service"));
  const startupStartedAt = Date.now();
  let optimizationProgressShown = false;
  while (Date.now() - startupStartedAt < 120_000) {
    if (await plannerReady(servicePort(config))) return;
    if (launchedBackend.exitCode !== null || backend !== launchedBackend) {
      throw new Error(
        t("desktop.error.serviceStopped", {
          code: launchedBackend.exitCode ?? t("common.unknown"),
        }),
      );
    }
    if (
      !optimizationProgressShown &&
      Date.now() - startupStartedAt >= 20_000
    ) {
      optimizationProgressShown = true;
      progress(t("loading.optimizing"));
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(
    t("desktop.error.serviceStart"),
  );
}

async function initialize(config, progress = () => {}) {
  if (initialization) return initialization;
  initialization = (async () => {
    mkdirSync(runtimeRoot, { recursive: true });
    migrateLegacyFarmPreferences(config);
    ensurePython(config);
    await ensureLocalStardewIcon(config);
    const requiredAssets = [
      "springobjects.png",
      "Objects_2.png",
      "furniture.png",
      "weapons.png",
      "tools.png",
      "hats.png",
      "shirts.png",
      "Stable.png",
      "Shed.png",
      "Fish Pond.png",
      "Slime Hutch.png",
    ].map((name) => join(runtimeRoot, "public", "assets", "sprites", name));
    requiredAssets.push(
      join(runtimeRoot, "public", "data", "game-localization.en.json"),
      join(runtimeRoot, "public", "data", "game-localization.es.json"),
      join(runtimeRoot, "public", "assets", "characters", "Abigail.png"),
      join(runtimeRoot, "public", "assets", "portraits", "Abigail.png"),
      join(runtimeRoot, "public", "assets", "maps", "world-spring.png"),
      join(runtimeRoot, "public", "assets", "maps", "world-summer.png"),
      join(runtimeRoot, "public", "assets", "maps", "world-fall.png"),
      join(runtimeRoot, "public", "assets", "maps", "world-winter.png"),
      join(runtimeRoot, "assetbuild", "unpacked", "farmer", "farmer_base.png"),
      join(runtimeRoot, "assetbuild", "unpacked", "farmer", "hairstyles2.png"),
    );
    requiredAssets.push(
      join(
        runtimeRoot,
        "public",
        "assets",
        "community-rooms",
        "Pantry-ruined.png",
      ),
      join(
        runtimeRoot,
        "public",
        "assets",
        "community-rooms",
        "Pantry-complete.png",
      ),
    );
    if (extractedAssetsAreStale(config, requiredAssets)) {
      const t = desktopTranslator(config);
      progress(t("loading.extractingAssets"));
      await extractGameAssets(config, () => {});
    }
    ensureFarmAvatars(config, progress);
    progress(desktopTranslator(config)("loading.preparingLive"));
    installBridge(config);
    await startBackend(config, progress);
  })().finally(() => {
    initialization = null;
  });
  return initialization;
}

function secureWindowOptions(extra = {}) {
  const { webPreferences = {}, ...windowOptions } = extra;
  return {
    show: false,
    backgroundColor: "#17271f",
    icon: join(projectRoot, "desktop", "resources", "icon.png"),
    ...windowOptions,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      ...webPreferences,
    },
  };
}

function protectWindow(window, allowedPrefix) {
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(allowedPrefix)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
}

function revealWindow(window) {
  if (!window || window.isDestroyed()) return false;
  if (window.isMinimized()) window.restore();
  window.show();
  window.moveTop();
  window.focus();
  return true;
}

async function createDashboard() {
  const config = readConfig();
  if (!validConfig(config)) return createSetupWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    loadingWindow?.destroy();
    loadingWindow = null;
    revealWindow(mainWindow);
    return;
  }
  await initialize(config, (message) =>
    loadingWindow?.webContents.send("setup:progress", message),
  );
  const baseUrl = `http://${localServiceHost}:${servicePort(config)}`;
  const savedWindowState = loadWindowState();
  const { maximized: wasMaximized, ...savedBounds } = savedWindowState;
  mainWindow = new BrowserWindow(
    secureWindowOptions({
      ...savedBounds,
      minWidth: 1050,
      minHeight: 720,
      title: PRODUCT,
      webPreferences: { preload: join(projectRoot, "desktop", "preload.cjs") },
    }),
  );
  if (wasMaximized) mainWindow.maximize();
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: [`${baseUrl}/*`] },
    (details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          "X-Stardew-Tool-Token": backendToken,
        },
      });
    },
  );
  protectWindow(mainWindow, baseUrl);
  let lastHistoryCommand = { direction: "", at: 0 };
  const sendHistoryCommand = direction => {
    const now = Date.now();
    if (lastHistoryCommand.direction === direction && now - lastHistoryCommand.at < 120) return;
    lastHistoryCommand = { direction, at: now };
    mainWindow?.webContents.send("navigation:history", direction);
  };
  mainWindow.webContents.on("app-command", (event, command) => {
    if (command !== "browser-backward" && command !== "browser-forward") return;
    event.preventDefault();
    sendHistoryCommand(command === "browser-forward" ? "forward" : "back");
  });
  mainWindow.webContents.on("before-input-event", (event, input) => {
    const key = String(input.key || input.code || "").toLowerCase().replaceAll("-", "");
    const backward = key === "browserback" || key === "browserbackward" || key === "goback";
    const forward = key === "browserforward" || key === "goforward";
    if (!backward && !forward) return;
    event.preventDefault();
    sendHistoryCommand(forward ? "forward" : "back");
  });
  mainWindow.on("resize", () => scheduleWindowStateSave(mainWindow));
  mainWindow.on("move", () => scheduleWindowStateSave(mainWindow));
  mainWindow.on("close", (event) => {
    saveWindowState(mainWindow);
    if (!quitting && readConfig()?.closeToTray !== false) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (!quitting && readConfig()?.closeToTray === false) {
      quitting = true;
      app.quit();
    }
  });
  await mainWindow.loadURL(`${baseUrl}/`);
  loadingWindow?.destroy();
  loadingWindow = null;
  revealWindow(mainWindow);
}

function createLoadingWindow() {
  if (revealWindow(mainWindow)) return;
  if (loadingWindow) return;
  loadingWindow = new BrowserWindow(
    secureWindowOptions({
      ...loadingWindowBounds(),
      resizable: false,
      frame: false,
      webPreferences: { preload: join(projectRoot, "desktop", "preload.cjs") },
    }),
  );
  protectWindow(loadingWindow, "file://");
  loadingWindow.loadFile(join(projectRoot, "desktop", "loading.html"));
  loadingWindow.once("ready-to-show", () => loadingWindow.show());
}

function createSetupWindow() {
  // Settings is an independent local window. A stale dashboard loader must
  // never be presented as if it were the settings window.
  if (mainWindow && loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.destroy();
    loadingWindow = null;
  }
  if (setupWindow && !setupWindow.isDestroyed()) {
    revealWindow(setupWindow);
    return;
  }
  const savedWindowState = loadSetupWindowState();
  const t = desktopTranslator();
  const { maximized: wasMaximized, ...savedBounds } = savedWindowState;
  setupWindow = new BrowserWindow(
    secureWindowOptions({
      ...savedBounds,
      minWidth: 720,
      minHeight: 650,
      title: `${PRODUCT} ${readConfig() ? t("window.settings") : t("window.setup")}`,
      webPreferences: { preload: join(projectRoot, "desktop", "preload.cjs") },
    }),
  );
  setupWindow.setMenu(null);
  if (wasMaximized) setupWindow.maximize();
  protectWindow(setupWindow, "file://");
  setupWindow.loadFile(join(projectRoot, "desktop", "setup.html"));
  setupWindow.once("ready-to-show", () => setupWindow.show());
  setupWindow.on("resize", () =>
    scheduleSetupWindowStateSave(setupWindow),
  );
  setupWindow.on("move", () => scheduleSetupWindowStateSave(setupWindow));
  setupWindow.on("close", () =>
    saveWindowState(setupWindow, setupWindowStatePath()),
  );
  setupWindow.on("closed", () => {
    setupWindow = null;
  });
}

function showAboutDialog() {
  const t = desktopTranslator();
  dialog.showMessageBox({
    type: "info",
    title: t("menu.about", { product: PRODUCT }),
    message: PRODUCT,
    detail: `${t("common.version", { version: app.getVersion() })}\n\n${t("app.privateDescription")}`,
    buttons: [t("common.ok")],
  });
}

function createApplicationMenu() {
  const t = desktopTranslator();
  return Menu.buildFromTemplate([
    {
      label: t("menu.application"),
      submenu: [
        { label: t("menu.settings"), click: () => createSetupWindow() },
        { type: "separator" },
        {
          label: t("menu.quit"),
          accelerator: "Ctrl+Q",
          click: () => {
            quitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: t("menu.view"),
      submenu: [
        { role: "reload", accelerator: "F5" },
        { role: "togglefullscreen" },
        ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }]),
      ],
    },
    {
      label: t("menu.support"),
      click: () => shell.openExternal("https://ko-fi.com/N4N21LP9O5"),
    },
    {
      label: t("menu.help"),
      submenu: [
        {
          label: t("menu.helpDiagnostics"),
          click: () => mainWindow?.webContents.send("help:open"),
        },
        { type: "separator" },
        { label: t("menu.about", { product: PRODUCT }), click: () => showAboutDialog() },
        { type: "separator" },
        {
          label: t("menu.github"),
          click: () =>
            shell.openExternal(
              "https://github.com/Maglucen-Studio/StardewValleyTool",
            ),
        },
        {
          label: t("menu.wiki"),
          click: () =>
            shell.openExternal(
              "https://stardewvalleywiki.com/Stardew_Valley_Wiki",
            ),
        },
      ],
    },
  ]);
}

function createTray() {
  const t = desktopTranslator();
  const png = join(workRoot, "desktop", "resources", "icon.png");
  const ico = join(workRoot, "desktop", "resources", "icon.ico");
  const source = nativeImage.createFromPath(png);
  const image = (
    source.isEmpty() ? nativeImage.createFromPath(ico) : source
  ).resize({ width: 16, height: 16, quality: "best" });
  if (image.isEmpty()) log(`Tray icon could not be loaded from ${png}`);
  tray = new Tray(image);
  tray.setToolTip(PRODUCT);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: t("tray.open"),
        click: () => {
          if (!mainWindow || mainWindow.isDestroyed()) createLoadingWindow();
          createDashboard().catch(showFatal);
        },
      },
      { type: "separator" },
      {
        label: t("menu.quit"),
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", () => {
    if (!mainWindow || mainWindow.isDestroyed()) createLoadingWindow();
    createDashboard().catch(showFatal);
  });
}

function isGameRunning() {
  const result = spawnSync("tasklist.exe", ["/FO", "CSV", "/NH"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return /Stardew(?: Valley|ModdingAPI)\.exe/i.test(result.stdout || "");
}

function monitorGame() {
  setInterval(() => {
    const running = isGameRunning();
    if (!running) manualFarmSelectionDuringGame = null;
    if (running && !gameWasRunning && validConfig(readConfig())) {
      startBackgroundTracking().catch((error) =>
        log(error?.stack || String(error)),
      );
    }
    if (running && !manualFarmSelectionDuringGame && readConfig()?.autoFollowActiveSave !== false && !farmSwitching) {
      const fresh = detectSaves().find(
        (save) => save.liveUpdatedAt && Date.now() - save.liveUpdatedAt < 9000,
      );
      const activePath = readConfig()?.savePath;
      if (fresh && activePath && resolve(fresh.path) !== resolve(activePath))
        switchFarmConfig(fresh.path, (message) => log(message)).catch((error) =>
          log(`Automatic farm switch: ${error?.stack || error}`),
        );
    }
    gameWasRunning = running;
  }, 3500).unref();
}

async function startBackgroundTracking() {
  const config = readConfig();
  if (!validConfig(config)) return;
  await initialize(config, (message) => log(message));
}

function showFatal(error) {
  log(error?.stack || String(error));
  loadingWindow?.destroy();
  loadingWindow = null;
  dialog.showErrorBox(PRODUCT, error?.message || String(error));
}

function installIpc() {
    const requireLocalSender = (event) => {
      if (!event.senderFrame?.url.startsWith("file://"))
      throw new Error(desktopTranslator()("desktop.error.requestRejected"));
    };
    const requireDashboardSender = (event) => {
      if (!mainWindow || event.sender !== mainWindow.webContents)
      throw new Error(desktopTranslator()("desktop.error.requestRejected"));
  };
  ipcMain.handle("updates:get-state", (event) => {
    requireDashboardSender(event);
    return updateState;
  });
  ipcMain.handle("release-notes:get", (event) => {
    requireDashboardSender(event);
    return currentReleaseNotesState();
  });
  ipcMain.handle("release-notes:acknowledge", (event) => {
    requireDashboardSender(event);
    acknowledgeReleaseNotes();
    return { ok: true };
  });
  ipcMain.handle("localization:get-state", (event) => {
    requireDashboardSender(event);
    return localizationPayload();
  });
  ipcMain.handle("localization:set-mode", async (event, incomingMode) => {
    requireDashboardSender(event);
    const mode = ["game", "en", "es"].includes(incomingMode) ? incomingMode : null;
    if (!mode) throw new Error(desktopTranslator()("desktop.error.requestRejected"));
    const current = readConfig() || {};
    if (current.languageMode === mode) return { ok: true, changed: false };
    const config = { ...current, languageMode: mode };
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    publishLocalizationState(config);
    Menu.setApplicationMenu(createApplicationMenu());
    if (tray) {
      tray.destroy();
      tray = null;
      createTray();
    }
    setupWindow?.webContents.reload();
    return { ok: true, changed: true, restarted: false };
  });
  ipcMain.handle("display:set-scale", (event, incomingScale) => {
    requireDashboardSender(event);
    const scale = Math.max(0.5, Math.min(2, Number(incomingScale) || 1));
    event.sender.setZoomFactor(scale);
    return { ok: true, scale };
  });
  ipcMain.handle("updates:check", async (event) => {
    requireDashboardSender(event);
    await autoUpdater.checkForUpdates();
    return updateState;
  });
  ipcMain.handle("updates:download", async (event) => {
    requireDashboardSender(event);
    publishUpdateState({
      status: "downloading",
      percent: 0,
      message: undefined,
    });
    await autoUpdater.downloadUpdate();
    return updateState;
  });
  ipcMain.handle("updates:install", (event) => {
    requireDashboardSender(event);
    quitting = true;
    autoUpdater.quitAndInstall(true, true);
    return { ok: true };
  });
  ipcMain.handle("setup:get-state", (event) => {
    requireLocalSender(event);
    return setupState();
  });
  ipcMain.handle("farms:list", (event) => {
    requireDashboardSender(event);
    const config = readConfig();
    return {
      activePath: config?.savePath || "",
      farms: detectSaves(),
    };
  });
  ipcMain.handle("farms:switch", async (event, incomingPath) => {
    requireDashboardSender(event);
    const previousManualSelection = manualFarmSelectionDuringGame;
    manualFarmSelectionDuringGame = isGameRunning()
      ? resolve(String(incomingPath || ""))
      : null;
    try {
      return await switchFarmConfig(incomingPath, (message) =>
        event.sender.send("setup:progress", message),
      );
    } catch (error) {
      manualFarmSelectionDuringGame = previousManualSelection;
      throw error;
    }
  });
  ipcMain.handle("settings:open", (event) => {
    requireDashboardSender(event);
    createSetupWindow();
    return { ok: true };
  });
  ipcMain.handle("diagnostics:get", (event) => {
    requireDashboardSender(event);
    const config = readConfig();
    const bridgeDirectory = config?.stardewPath
      ? join(config.stardewPath, "Mods", "StardewValleyToolBridge")
      : null;
    const bridgeManifestPath = bridgeDirectory
      ? join(bridgeDirectory, "manifest.json")
      : null;
    const bridgeManifest = bridgeManifestPath
      ? readJson(bridgeManifestPath, null)
      : null;
    const bridgeDllFound = Boolean(
      bridgeDirectory &&
      bridgeManifest?.EntryDll &&
      existsSync(join(bridgeDirectory, basename(bridgeManifest.EntryDll))),
    );
    const liveStatePath = config?.savePath
      ? join(dirname(config.savePath), ".stardew-tool-live.json")
      : null;
    const liveStateUpdatedAt = liveStatePath && existsSync(liveStatePath)
      ? statSync(liveStatePath).mtimeMs
      : 0;
    const liveStateAgeSeconds = liveStateUpdatedAt
      ? Math.max(0, Math.round((Date.now() - liveStateUpdatedAt) / 1000))
      : null;
    const modCompatibility = scanModCompatibility(
      config?.stardewPath ? join(config.stardewPath, "Mods") : null,
    );
    return {
      version: app.getVersion(),
      packaged: app.isPackaged,
      development: desktopDevelopment,
      osVersion: osRelease(),
      architecture: process.arch,
      gameFound: Boolean(config?.stardewPath && existsSync(join(config.stardewPath, "Stardew Valley.dll"))),
      saveFound: Boolean(config?.savePath && existsSync(config.savePath)),
      smapiFound: Boolean(config?.stardewPath && existsSync(join(config.stardewPath, "StardewModdingAPI.dll"))),
      bridgeInstalled: Boolean(bridgeManifest && bridgeDllFound),
      bridgeManifestFound: Boolean(bridgeManifest),
      bridgeVersion: bridgeManifest?.Version || null,
      bridgeDllFound,
      gameRunning: isGameRunning(),
      liveStateFound: Boolean(liveStateUpdatedAt),
      liveStateFresh: liveStateAgeSeconds !== null && liveStateAgeSeconds < 9,
      liveStateAgeSeconds,
      modCompatibility,
    };
  });
  ipcMain.handle("clipboard:write", (event, value) => {
    requireDashboardSender(event);
    clipboard.writeText(String(value || ""));
    return { ok: true };
  });
  ipcMain.handle("farm:export", async (event) => {
    requireDashboardSender(event);
    const config = readConfig();
    const profileId = profileIdForSave(config?.savePath);
    const destination = await dialog.showSaveDialog(mainWindow, {
      title: desktopTranslator(config)("desktop.export.title"),
      defaultPath: `${profileId}-companion-backup.json`,
      filters: [{ name: desktopTranslator(config)("desktop.export.filter"), extensions: ["json"] }],
    });
    if (destination.canceled || !destination.filePath) return { ok: false, canceled: true };
    const profileRoot = join(runtimeRoot, ".local", "farms", profileId);
    const payload = {
      format: "maglucen-companion-farm-backup",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      profileId,
      history: readJson(join(profileRoot, "farm-history.json"), {}),
      preferences: readJson(join(profileRoot, "preferences.json"), {}),
      snapshot: readJson(join(runtimeRoot, "public", "data", "farm-state.json"), {}),
    };
    writeFileSync(destination.filePath, JSON.stringify(payload, null, 2), "utf8");
    return { ok: true, path: destination.filePath };
  });
  ipcMain.handle("setup:choose-game", async (event) => {
    requireLocalSender(event);
    const t = desktopTranslator();
    return (
      (
        await dialog.showOpenDialog({
          title: t("setup.chooseGameDialog"),
          properties: ["openDirectory"],
        })
      ).filePaths[0] || ""
    );
  });
  ipcMain.handle("setup:choose-save", async (event) => {
    requireLocalSender(event);
    const t = desktopTranslator();
    return (
      (
        await dialog.showOpenDialog({
          title: t("setup.chooseSaveDialog"),
          properties: ["openFile"],
        })
      ).filePaths[0] || ""
    );
  });
  ipcMain.handle("setup:complete", async (event, incoming) => {
    requireLocalSender(event);
    const previousConfig = readConfig();
    const config = {
      stardewPath: String(incoming?.stardewPath || ""),
      savePath: String(incoming?.savePath || ""),
      platform: ["steam", "gog", "xbox", "other"].includes(incoming?.platform)
        ? incoming.platform
        : "other",
      port: 3000,
      autoLaunch: app.isPackaged && incoming?.autoLaunch !== false,
      closeToTray: incoming?.closeToTray !== false,
      autoFollowActiveSave: incoming?.autoFollowActiveSave !== false,
      languageMode: ["game", "en", "es"].includes(incoming?.languageMode)
        ? incoming.languageMode
        : "game",
      ...(Array.isArray(previousConfig?.legacyDataDirs)
        ? { legacyDataDirs: previousConfig.legacyDataDirs }
        : {}),
    };
    if (!validConfig(config)) throw new Error(desktopTranslator(config)("setup.invalid"));
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    publishLocalizationState(config);
    Menu.setApplicationMenu(createApplicationMenu());
    if (tray) {
      tray.destroy();
      tray = null;
      createTray();
    }
    if (app.isPackaged)
      app.setLoginItemSettings({
        openAtLogin: config.autoLaunch,
        path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
        args: ["--background"],
      });
    if (backend && !backend.killed) {
      backend.kill();
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    }
    await initialize(config, (message) =>
      event.sender.send("setup:progress", message),
    );
    setupWindow?.destroy();
    setupWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      await mainWindow.loadURL(
        `http://${localServiceHost}:${servicePort(config)}/`,
      );
      revealWindow(mainWindow);
    } else {
      await createDashboard();
    }
    return { ok: true };
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on("second-instance", () => {
    if (!validConfig(readConfig())) return createSetupWindow();
    if (revealWindow(mainWindow)) return;
    if (revealWindow(loadingWindow)) return;
    if (revealWindow(setupWindow)) return;
    createLoadingWindow();
    createDashboard().catch(showFatal);
  });
  app.whenReady().then(async () => {
    projectRoot = app.getAppPath();
    desktopDataRoot = resolve(
      process.env.STARDEW_TOOL_DESKTOP_DATA || app.getPath("userData"),
    );
    migrateLegacyDesktopData(desktopDataRoot);
    workRoot = app.isPackaged ? prepareStablePackagedRuntime() : projectRoot;
    runtimeRoot = app.isPackaged
      ? join(desktopDataRoot, "runtime")
      : projectRoot;
    configPath = app.isPackaged
      ? join(desktopDataRoot, "config.json")
      : join(projectRoot, "config.local.json");
    existingInstallationAtLaunch = existsSync(configPath);
    installIpc();
    configureAutoUpdates();
    Menu.setApplicationMenu(createApplicationMenu());
    createTray();
    monitorGame();
    const testExitMs = Number(process.env.STARDEW_TOOL_TEST_EXIT_MS || 0);
    if (testExitMs > 0)
      setTimeout(() => {
        quitting = true;
        app.quit();
      }, testExitMs).unref();
    const activeConfig = readConfig();
    if (!validConfig(activeConfig)) return createSetupWindow();
    if (app.isPackaged && activeConfig.autoLaunch !== false)
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
        args: ["--background"],
      });
    if (backgroundLaunch) {
      gameWasRunning = isGameRunning();
      if (gameWasRunning)
        await startBackgroundTracking().catch((error) =>
          log(error?.stack || String(error)),
        );
      return;
    }
    createLoadingWindow();
    await createDashboard().catch(showFatal);
  });
}

app.on("before-quit", () => {
  quitting = true;
  if (backend && !backend.killed) backend.kill();
});
app.on("window-all-closed", () => {
  if (process.platform !== "win32") app.quit();
});
