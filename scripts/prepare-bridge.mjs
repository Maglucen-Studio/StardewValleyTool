import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { loadConfig, projectRoot } from "./config.mjs";

const stardewPath = process.env.STARDEW_PATH || loadConfig().stardewPath;
if (!stardewPath) {
  console.error(
    "A Stardew Valley reference path is required. Set STARDEW_PATH or stardewPath in config.local.json.",
  );
  process.exit(1);
}

const requiredAssemblies = [
  "StardewModdingAPI.dll",
  "Stardew Valley.dll",
  "StardewValley.GameData.dll",
  "MonoGame.Framework.dll",
];
const missingAssemblies = requiredAssemblies.filter(
  (name) => !existsSync(resolve(stardewPath, name)),
);
if (missingAssemblies.length) {
  console.error(
    `The reference path is missing: ${missingAssemblies.join(", ")}`,
  );
  process.exit(1);
}

const project = resolve(
  projectRoot,
  "bridge",
  "StardewValleyToolBridge",
  "StardewValleyToolBridge.csproj",
);
const result = spawnSync(
  "dotnet",
  [
    "build",
    project,
    "--configuration",
    "Release",
    `-p:StardewPath=${resolve(stardewPath)}`,
  ],
  { cwd: projectRoot, encoding: "utf8", stdio: "inherit" },
);
if (result.error) {
  console.error(`Could not start dotnet: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

const builtDll = resolve(
  projectRoot,
  "bridge",
  "StardewValleyToolBridge",
  "bin",
  "Release",
  "net6.0",
  "StardewValleyToolBridge.dll",
);
if (!existsSync(builtDll)) {
  console.error(`Bridge build succeeded but no DLL was found at ${builtDll}.`);
  process.exit(1);
}

const destinationDirectory = resolve(
  projectRoot,
  "desktop",
  "resources",
  "bridge",
);
mkdirSync(destinationDirectory, { recursive: true });
copyFileSync(
  builtDll,
  resolve(destinationDirectory, "StardewValleyToolBridge.dll"),
);
console.log("Prepared the bridge DLL from public source.");
