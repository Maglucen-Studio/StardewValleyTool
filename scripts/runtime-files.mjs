import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { projectRoot, runtimeRoot } from "./config.mjs";

export function ensureRuntimeDirectories() {
  for (const directory of ["public/assets", "public/data/days", "assetbuild/unpacked", ".local"]) {
    mkdirSync(resolve(runtimeRoot, directory), { recursive: true });
  }
}

export function syncRuntimePublic(relativePaths = ["assets", "data"]) {
  ensureRuntimeDirectories();
  const destinations = runtimeRoot === projectRoot
    ? [resolve(projectRoot, "dist")]
    : [resolve(projectRoot, "public"), resolve(projectRoot, "dist")];
  for (const relative of relativePaths) {
    const source = resolve(runtimeRoot, "public", relative);
    if (!existsSync(source)) continue;
    for (const destinationRoot of destinations) {
      if (!existsSync(destinationRoot)) continue;
      const destination = resolve(destinationRoot, relative);
      mkdirSync(statSync(source).isDirectory() ? destination : dirname(destination), { recursive: true });
      cpSync(source, destination, { recursive: true, force: true });
    }
  }
}
