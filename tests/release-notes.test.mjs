import assert from "node:assert/strict";
import test from "node:test";

import { releaseNotesDecision } from "../desktop/release-notes.mjs";

test("a clean installation records its version without showing update notes", () => {
  assert.deepEqual(releaseNotesDecision({
    packaged: true,
    development: false,
    currentVersion: "1.11.0",
    existingInstallation: false,
  }), {
    shouldShow: false,
    currentVersion: "1.11.0",
    previousVersion: null,
    shouldAcknowledge: true,
  });
});

test("an existing installation sees notes once after its version changes", () => {
  assert.equal(releaseNotesDecision({
    packaged: true,
    development: false,
    currentVersion: "1.11.0",
    lastSeenVersion: "1.10.0",
    existingInstallation: true,
  }).shouldShow, true);

  assert.equal(releaseNotesDecision({
    packaged: true,
    development: false,
    currentVersion: "1.11.0",
    lastSeenVersion: "1.11.0",
    existingInstallation: true,
  }).shouldShow, false);
});

test("an installation predating release-note state sees the current release once", () => {
  assert.equal(releaseNotesDecision({
    packaged: true,
    development: false,
    currentVersion: "1.11.0",
    existingInstallation: true,
  }).shouldShow, true);
});

test("development and browser sessions never show update notes", () => {
  assert.equal(releaseNotesDecision({
    packaged: true,
    development: true,
    currentVersion: "1.11.0",
    existingInstallation: true,
  }).shouldShow, false);
  assert.equal(releaseNotesDecision({
    packaged: false,
    development: false,
    currentVersion: "1.11.0",
    existingInstallation: true,
  }).shouldShow, false);
});
