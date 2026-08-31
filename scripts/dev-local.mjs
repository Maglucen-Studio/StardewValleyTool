import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync, watch, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { loadConfig, projectRoot, runtimeRoot, runtimePaths, validateConfig } from "./config.mjs";
import { ensureRuntimeDirectories, syncRuntimePublic } from "./runtime-files.mjs";

const project = projectRoot;
const config = loadConfig();
const errors = validateConfig(config);
if (errors.length) {
  console.error(`Incomplete configuration:\n- ${errors.join("\n- ")}\nRun the desktop application to configure it.`);
  process.exit(1);
}
const saveFile = config.savePath;
const python = config.pythonCommand;
const paths = runtimePaths(config);
const liveDestination = resolve(runtimeRoot, "public/data/live-state.json");
const readerDirectory = resolve(runtimeRoot, ".cache/save-reader");
const readerSave = resolve(readerDirectory, basename(saveFile));
const gameSaveTemporary = `${saveFile}_STARDEWVALLEYSAVETMP`;
mkdirSync(readerDirectory, { recursive: true });
ensureRuntimeDirectories();
let generating = false;
let queued = false;
let timer;
let copiedLiveFingerprint = null;

if (process.env.STARDEW_TOOL_SKIP_ASSET_EXTRACTION !== "1") {
  spawnSync(process.execPath, ["scripts/extract_game_data.mjs"], {
    cwd: project,
    env: { ...process.env, STARDEW_PATH: config.stardewPath },
    stdio: "inherit",
    windowsHide: true,
  });
}

function generate() {
  if (generating) { queued = true; return; }
  generating = true;
  try {
    // Stardew replaces the save through a temporary file. Never open the
    // original while that process exists; Python only sees this private copy.
    const saveReplacementActive = existsSync(gameSaveTemporary) && Date.now() - statSync(gameSaveTemporary).mtimeMs < 90_000;
    if (saveReplacementActive) {
      generating = false;
      timer = setTimeout(generate, 3000);
      return;
    }
    copyFileSync(saveFile, readerSave);
    const questSource = [paths.questSource, paths.legacyQuestSource].find(source => source && existsSync(source));
    if (questSource && existsSync(questSource)) copyFileSync(questSource, resolve(readerDirectory, ".aincrad-help-wanted.json"));
  } catch (error) {
    generating = false;
    console.error("The save is busy; it will be retried without blocking Stardew:", error.message);
    timer = setTimeout(generate, 3000);
    return;
  }
  const result = spawnSync(python, ["scripts/generate_snapshot.py"], {
    cwd: project,
    env: { ...process.env, AINCRAD_SAVE: readerSave, STARDEW_TOOL_SOURCE_SAVE_DIR: dirname(saveFile), STARDEW_TOOL_RUNTIME_ROOT: runtimeRoot },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status === 0) {
    renderLocationMaps();
  }
  generating = false;
  if (result.error) console.error("The map could not be updated:", result.error.message);
  else syncRuntimePublic(["data", "assets/farmers", "assets/location-maps", "assets/sprites"]);
  if (queued) { queued = false; setTimeout(generate, 500); }
}

function renderLocationMaps() {
  const result = spawnSync(process.execPath, ["scripts/render-storage-location-maps.mjs"], {
    cwd: project,
    env: { ...process.env, STARDEW_PATH: config.stardewPath, STARDEW_TOOL_RUNTIME_ROOT: runtimeRoot },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error)
    console.error("Contextual location maps could not be rendered:", result.error.message);
  else if (result.status !== 0)
    console.error(`Contextual location maps exited with code ${result.status}.`);
}

timer = setTimeout(generate, 2500);

function copyLiveState() {
  try {
    const liveSource = [paths.liveSource, paths.legacyLiveSource].find(source => source && existsSync(source));
    const sourceStats = liveSource ? statSync(liveSource) : null;
    const fingerprint = sourceStats
      ? `${liveSource}:${sourceStats.mtimeMs}:${sourceStats.size}`
      : "offline";
    if (fingerprint === copiedLiveFingerprint) return;
    if (liveSource && existsSync(liveSource)) copyFileSync(liveSource, liveDestination);
    else writeFileSync(liveDestination, JSON.stringify({ active: false }), "utf8");
    renderLocationMaps();
    syncRuntimePublic(["data/live-state.json", "data/farm-state.json", "assets/location-maps"]);
    copiedLiveFingerprint = fingerprint;
  } catch (error) {
    console.error("The live state could not be copied:", error.message);
  }
}

copyLiveState();
setInterval(copyLiveState, 1000).unref();

watch(dirname(saveFile), { persistent: true }, (_event, filename) => {
  const changed = basename(String(filename || ""));
  if (changed === ".stardew-tool-live.json" || changed === ".aincrad-live.json") { copyLiveState(); return; }
  if (changed !== basename(saveFile) && changed !== ".stardew-tool-help-wanted.json" && changed !== ".aincrad-help-wanted.json") return;
  clearTimeout(timer);
  timer = setTimeout(generate, 4000);
});

syncRuntimePublic();
const serverMode = process.env.STARDEW_TOOL_SERVER_MODE === "production" ? "start" : "dev";
const serverCommand = serverMode === "start"
  ? [resolve(project, "scripts/serve-built.mjs"), String(config.port)]
  : [
      resolve(project, "node_modules/vinext/dist/cli.js"),
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(config.port),
    ];
const server = spawn(process.execPath, serverCommand, { cwd: project, stdio: "inherit", windowsHide: true, env: { ...process.env, PORT: String(config.port) } });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => { server.kill(signal); process.exit(0); });
}
server.on("exit", code => process.exit(code ?? 0));
