import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import electronPath from "electron";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const restartFiles = new Set([
  "desktop/main.mjs",
  "desktop/preload.cjs",
  "desktop/settings.html",
  "scripts/config.mjs",
  "scripts/dev-local.mjs",
  "scripts/runtime-files.mjs",
]);

let electron = null;
let restartTimer = null;
let restarting = false;
let stopping = false;
const watchers = [];

function normalized(relativePath) {
  return String(relativePath || "").replaceAll("\\", "/");
}

function startElectron() {
  const environment = { ...process.env, STARDEW_TOOL_DESKTOP_DEV: "1" };
  delete environment.ELECTRON_RUN_AS_NODE;
  electron = spawn(electronPath, [project], {
    cwd: project,
    env: environment,
    stdio: "inherit",
    windowsHide: false,
  });
  electron.once("exit", (code) => {
    electron = null;
    if (restarting && !stopping) {
      restarting = false;
      startElectron();
      return;
    }
    if (!stopping) {
      stopping = true;
      for (const watcher of watchers) watcher.close();
      process.exit(code ?? 0);
    }
  });
}

function restartElectron(relativePath) {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (stopping || !electron) return;
    restarting = true;
    console.log(`\nDesktop runtime changed (${relativePath}); restarting…`);
    electron.kill("SIGTERM");
  }, 350);
}

function watchDirectory(relativeDirectory) {
  const directory = resolve(project, relativeDirectory);
  if (!existsSync(directory)) return;
  const watcher = watch(directory, { recursive: true }, (_event, file) => {
    const relativePath = normalized(`${relativeDirectory}/${file || ""}`);
    if (restartFiles.has(relativePath)) restartElectron(relativePath);
  });
  watchers.push(watcher);
}

function stop() {
  if (stopping) return;
  stopping = true;
  clearTimeout(restartTimer);
  for (const watcher of watchers) watcher.close();
  electron?.kill("SIGTERM");
}

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
watchDirectory("desktop");
watchDirectory("scripts");
console.log("Development mode: interface changes reload live; desktop runtime changes restart the app.");
startElectron();
