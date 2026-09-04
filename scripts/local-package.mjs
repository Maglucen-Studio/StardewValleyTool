import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const forbiddenPackagePaths = [
  /^public[\\/]assets(?:[\\/]|$)/i,
  /^public[\\/]data(?:[\\/]|$)/i,
  /^assetbuild[\\/]unpacked(?:[\\/]|$)/i,
  /(?:^|[\\/])config\.local\.json$/i,
  /(?:^|[\\/])SaveGameInfo$/i,
  /(?:^|[\\/])(?:logs?|snapshots?|history)(?:[\\/]|$)/i,
];

export function validatePackageEntries(entries) {
  return entries
    .map((entry) => String(entry).replace(/^[/\\]+/, ""))
    .filter((entry) => forbiddenPackagePaths.some((pattern) => pattern.test(entry)));
}

function runNpm(script) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli || !existsSync(npmCli)) throw new Error("Run this helper through one of the npm run local:* commands.");
  const result = spawnSync(process.execPath, [npmCli, "run", script], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm run ${script} failed with code ${result.status}.`);
}

function listAsarEntries(asarPath) {
  const asarCli = resolve(projectRoot, "node_modules/@electron/asar/bin/asar.js");
  if (!existsSync(asarCli)) throw new Error("The local ASAR inspection tool is missing. Run npm ci first.");
  const result = spawnSync(process.execPath, [asarCli, "list", asarPath], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `Could not inspect ${asarPath}.`);
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

export function inspectLocalPackage(root = projectRoot) {
  const releaseRoot = resolve(root, "release");
  const asarPath = resolve(releaseRoot, "win-unpacked/resources/app.asar");
  if (!existsSync(asarPath)) throw new Error("The unpacked application is missing from release/win-unpacked.");

  const unsafeEntries = validatePackageEntries(listAsarEntries(asarPath));
  if (unsafeEntries.length > 0) {
    throw new Error(`The local package contains forbidden runtime or private files:\n${unsafeEntries.join("\n")}`);
  }

  const outputs = readdirSync(releaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  console.log(`Local package inspection passed (${outputs.length} distributable file${outputs.length === 1 ? "" : "s"}).`);
  return outputs;
}

function verify() {
  for (const script of ["verify:public", "audit:runtime", "lint", "test"]) runNpm(script);
}

function main() {
  const mode = process.argv[2] || "verify";
  if (!new Set(["verify", "unpacked", "installer"]).has(mode)) {
    throw new Error("Usage: node scripts/local-package.mjs <verify|unpacked|installer>");
  }

  verify();
  if (mode === "verify") return;

  runNpm(mode === "installer" ? "desktop:installer" : "desktop:dir");
  const outputs = inspectLocalPackage();
  if (mode === "installer" && !outputs.some((name) => /Setup-.*\.exe$/i.test(name))) {
    throw new Error("The NSIS installer was not produced in the release directory.");
  }

  console.log("Local test build complete. Public releases must still be created from the verified GitHub Actions workflow.");
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) main();
