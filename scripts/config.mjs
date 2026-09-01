import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const projectRoot = resolve(import.meta.dirname, "..");
export const runtimeRoot = resolve(process.env.STARDEW_TOOL_RUNTIME_ROOT || projectRoot);
export const configPath = process.env.STARDEW_TOOL_CONFIG
  ? resolve(process.env.STARDEW_TOOL_CONFIG)
  : resolve(projectRoot, "config.local.json");

export function loadConfig() {
  const file = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
  const sourcePython = resolve(projectRoot, "desktop", "resources", "python", "python.exe");
  const savedPython = file.pythonCommand && existsSync(file.pythonCommand)
    ? file.pythonCommand
    : null;
  return {
    stardewPath: process.env.STARDEW_PATH || file.stardewPath,
    savePath: process.env.STARDEW_SAVE || process.env.AINCRAD_SAVE || file.savePath,
    pythonCommand:
      process.env.STARDEW_PYTHON ||
      savedPython ||
      (existsSync(sourcePython) ? sourcePython : "python"),
    languageMode: ["game", "en", "es"].includes(file.languageMode)
      ? file.languageMode
      : "game",
    port: Number(process.env.PORT || file.port || 3000),
  };
}

export function validateConfig(config, { requireSave = true } = {}) {
  const errors = [];
  if (!config.stardewPath || !existsSync(resolve(config.stardewPath, "Stardew Valley.dll"))) errors.push("No valid Stardew Valley installation was found.");
  if (requireSave && (!config.savePath || !existsSync(config.savePath))) errors.push("The selected main save file could not be found.");
  return errors;
}

export function runtimePaths(config) {
  const saveDirectory = config.savePath ? dirname(config.savePath) : null;
  return {
    contentRoot: resolve(config.stardewPath, "Content"),
    modsRoot: resolve(config.stardewPath, "Mods"),
    saveDirectory,
    liveSource: saveDirectory ? resolve(saveDirectory, ".stardew-tool-live.json") : null,
    legacyLiveSource: saveDirectory ? resolve(saveDirectory, ".aincrad-live.json") : null,
    questSource: saveDirectory ? resolve(saveDirectory, ".stardew-tool-help-wanted.json") : null,
    legacyQuestSource: saveDirectory ? resolve(saveDirectory, ".aincrad-help-wanted.json") : null,
  };
}
