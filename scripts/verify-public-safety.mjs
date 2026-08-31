import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean)
  .map((path) => path.replaceAll("\\", "/"));

const allowedGeneratedPlaceholders = new Set([
  "assetbuild/unpacked/.gitkeep",
  "public/assets/.gitkeep",
  "public/data/.gitkeep",
]);

const forbiddenExact = new Set([
  "config.local.json",
  "watcher.log",
]);

const forbiddenPrefixes = [
  ".local/",
  ".stardew-reference-assemblies/",
  "assetbuild/achievement-packed/",
  "assetbuild/achievement-unpacked/",
  "assetbuild/data-packed/",
  "assetbuild/data-unpacked/",
  "assetbuild/dynamic-packed/",
  "assetbuild/dynamic-unpacked/",
  "assetbuild/packed/",
  "assetbuild/storage-location-maps/",
  "bridge/StardewValleyToolBridge/bin/",
  "bridge/StardewValleyToolBridge/obj/",
  "bridge/StardewValleyToolBridge/publish/",
  "desktop/resources/python/",
  "dist/",
  "logs/",
  "outputs/",
  "public/data/days/",
  "recovery/",
  "release/",
];

const forbiddenSuffixes = [
  ".pfx",
  ".pem",
  ".private-key",
  ".sav",
  ".xnb",
];

const violations = [];
for (const path of tracked) {
  const lower = path.toLowerCase();
  if (allowedGeneratedPlaceholders.has(path)) continue;
  if (
    forbiddenExact.has(path) ||
    forbiddenPrefixes.some((prefix) => path.startsWith(prefix)) ||
    forbiddenSuffixes.some((suffix) => lower.endsWith(suffix)) ||
    (path.startsWith("public/assets/") && path !== "public/assets/.gitkeep") ||
    (path.startsWith("public/data/") && path !== "public/data/.gitkeep") ||
    /^desktop\/resources\/bridge\/.*\.dll$/i.test(path)
  ) {
    violations.push(`${path}: generated, private, compiled, or game-owned file`);
  }
}

const textSecretPatterns = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key material"],
  [/github_pat_[A-Za-z0-9_]{20,}/, "GitHub personal access token"],
  [/gh[pousr]_[A-Za-z0-9]{20,}/, "GitHub token"],
  [/sk_live_[A-Za-z0-9]{16,}/, "live Stripe secret"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/C:\\Users\\maglu(?:\\|\b)/i, "personal Windows path"],
  [/\/Users\/maglu(?:\/|\b)/i, "personal macOS path"],
];

const binaryExtensions = /\.(?:dll|exe|ico|jpg|jpeg|png|webp|zip)$/i;
for (const path of tracked) {
  if (binaryExtensions.test(path)) continue;
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  for (const [pattern, description] of textSecretPatterns) {
    if (pattern.test(contents)) violations.push(`${path}: possible ${description}`);
  }
}

if (violations.length) {
  console.error("Public-source safety check failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `Public-source safety check passed for ${tracked.length} tracked files.`,
);
