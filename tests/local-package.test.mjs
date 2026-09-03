import test from "node:test";
import assert from "node:assert/strict";
import { validatePackageEntries } from "../scripts/local-package.mjs";

test("local package inspection rejects game assets and private runtime data", () => {
  assert.deepEqual(validatePackageEntries([
    "/dist/index.html",
    "/public/app-icon.png",
    "/public/assets/sprites/springobjects.png",
    "/public/data/days/latest.json",
    "/config.local.json",
    "/farm/history/checkpoint.json",
  ]), [
    "public/assets/sprites/springobjects.png",
    "public/data/days/latest.json",
    "config.local.json",
    "farm/history/checkpoint.json",
  ]);
});

test("local package inspection accepts application-owned distributable files", () => {
  assert.deepEqual(validatePackageEntries([
    "/dist/index.html",
    "/desktop/main.mjs",
    "/locales/en.json",
    "/scripts/generate_snapshot.py",
  ]), []);
});
