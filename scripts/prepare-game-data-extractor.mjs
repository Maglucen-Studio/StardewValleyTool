import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { loadConfig, projectRoot } from "./config.mjs";

const stardewPath = process.env.STARDEW_PATH || loadConfig().stardewPath;
if (!stardewPath) throw new Error("A Stardew Valley reference path is required to build the local data extractor.");

const project = resolve(projectRoot, "tools", "StardewDataExtractor", "StardewDataExtractor.csproj");
const publishDirectory = resolve(projectRoot, "tools", "StardewDataExtractor", "publish");
const destinationDirectory = resolve(projectRoot, "desktop", "resources", "game-data-extractor");
rmSync(publishDirectory, { recursive: true, force: true });
const result = spawnSync("dotnet", [
  "publish", project,
  "--configuration", "Release",
  "--runtime", "win-x64",
  "--self-contained", "true",
  `-p:StardewPath=${resolve(stardewPath)}`,
  "-p:PublishSingleFile=true",
  "-p:EnableCompressionInSingleFile=true",
  "-p:PublishTrimmed=false",
  `-p:PublishDir=${publishDirectory}`,
], { cwd: projectRoot, encoding: "utf8", stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const executable = resolve(publishDirectory, "StardewDataExtractor.exe");
if (!existsSync(executable)) throw new Error("The local game data extractor executable was not produced.");
mkdirSync(destinationDirectory, { recursive: true });
copyFileSync(executable, resolve(destinationDirectory, "StardewDataExtractor.exe"));
console.log("Prepared the read-only local game data extractor from public source.");
