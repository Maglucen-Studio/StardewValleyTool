import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { validateChangelog } from "../scripts/verify-changelog.mjs";

test("the packaged changelog is structured and matches the application version", async () => {
  const [markdown, packageText, component, page] = await Promise.all([
    readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/changelog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  const packageMetadata = JSON.parse(packageText);
  const result = validateChangelog(markdown, packageMetadata.version);

  assert.deepEqual(result.errors, []);
  assert.equal(result.releases[0].version, packageMetadata.version);
  assert.ok(result.releases.length >= 2);
  assert.match(component, /import changelogMarkdown from "\.\.\/CHANGELOG\.md\?raw"/);
  assert.match(component, /parseChangelog\(changelogMarkdown\)/);
  assert.match(component, /https:\/\/github\.com\/Maglucen-Studio\/StardewValleyTool\/blob\/main\/CHANGELOG\.md/);
  assert.match(component, /target="_blank" rel="noreferrer"/);
  assert.match(page, /<ChangelogHistory \/>/);
});

test("changelog validation rejects stale or malformed release data", () => {
  const stale = validateChangelog("# Changelog\n\n## 1.0.0 — 2026-01-01\n\n- First release.\n", "2.0.0");
  assert.match(stale.errors.join("\n"), /does not match package version/);

  const malformed = validateChangelog("# Changelog\n\n## next week\n\n- Pending.\n", "2.0.0");
  assert.match(malformed.errors.join("\n"), /invalid release heading/);
  assert.match(malformed.errors.join("\n"), /outside a release/);
});
