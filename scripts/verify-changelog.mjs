import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const releaseHeading = /^##\s+([^\s]+)\s+—\s+(\d{4}-\d{2}-\d{2})\s*$/;
const sectionHeading = /^###\s+(New|Improved|Fixed)\s*$/;

export function validateChangelog(markdown, expectedVersion) {
  const errors = [];
  const releases = [];
  let currentRelease = null;

  if (!markdown.startsWith("# Changelog\n") && !markdown.startsWith("# Changelog\r\n")) {
    errors.push("the document must start with '# Changelog'");
  }

  for (const [lineIndex, line] of markdown.split(/\r?\n/).entries()) {
    if (line.startsWith("## ")) {
      const match = line.match(releaseHeading);
      if (!match) {
        errors.push(`line ${lineIndex + 1}: invalid release heading`);
        currentRelease = null;
        continue;
      }

      const [, version, date] = match;
      if (releases.some((release) => release.version === version)) {
        errors.push(`line ${lineIndex + 1}: duplicate release ${version}`);
      }
      if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
        errors.push(`line ${lineIndex + 1}: invalid release date ${date}`);
      }

      currentRelease = { version, date, entries: 0 };
      releases.push(currentRelease);
      continue;
    }

    if (line.startsWith("### ") && !sectionHeading.test(line)) {
      errors.push(`line ${lineIndex + 1}: unsupported section heading`);
    }

    if (line.startsWith("- ")) {
      if (!currentRelease) {
        errors.push(`line ${lineIndex + 1}: changelog entry is outside a release`);
      } else if (line.slice(2).trim().length === 0) {
        errors.push(`line ${lineIndex + 1}: empty changelog entry`);
      } else {
        currentRelease.entries += 1;
      }
    }
  }

  if (releases.length === 0) {
    errors.push("no releases were found");
  } else if (releases[0].version !== expectedVersion) {
    errors.push(`latest release ${releases[0].version} does not match package version ${expectedVersion}`);
  }

  for (const release of releases) {
    if (release.entries === 0) {
      errors.push(`release ${release.version} has no entries`);
    }
  }

  return { errors, releases };
}

async function main() {
  const repositoryRoot = new URL("../", import.meta.url);
  const [markdown, packageText] = await Promise.all([
    readFile(new URL("CHANGELOG.md", repositoryRoot), "utf8"),
    readFile(new URL("package.json", repositoryRoot), "utf8"),
  ]);
  const packageMetadata = JSON.parse(packageText);
  const result = validateChangelog(markdown, packageMetadata.version);

  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`Changelog: ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Changelog: ${result.releases.length} releases validated; latest is ${result.releases[0].version}.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) await main();
