import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import english from "../locales/en.json" with { type: "json" };
import spanish from "../locales/es.json" with { type: "json" };
import {
  createTranslator,
  localizedXnbPath,
  normalizeGameLanguageCode,
  readGameLanguageCode,
  resolveLanguage,
} from "../scripts/localization.mjs";

test("Stardew language codes normalize to supported game locales", () => {
  assert.equal(normalizeGameLanguageCode("es"), "es");
  assert.equal(normalizeGameLanguageCode("es-ES"), "es");
  assert.equal(normalizeGameLanguageCode("pt-BR"), "pt");
  assert.equal(normalizeGameLanguageCode("unknown"), "en");
});

test("languageCode is read from Stardew's read-only startup preferences", async () => {
  const root = await mkdtemp(join(tmpdir(), "maglucen-language-"));
  try {
    const directory = join(root, "StardewValley");
    await mkdir(directory);
    await writeFile(
      join(directory, "startup_preferences"),
      "<StartupPreferences><languageCode>es</languageCode></StartupPreferences>",
    );
    assert.equal(readGameLanguageCode(root), "es");
    assert.deepEqual(resolveLanguage({ languageMode: "game" }, root), {
      mode: "game",
      gameCode: "es",
      language: "es",
      locale: "es-ES",
      xnbSuffix: "es-ES",
      followedGameExactly: true,
    });
    assert.equal(resolveLanguage({ languageMode: "en" }, root).language, "en");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("localized XNB lookup falls back to the base game file", async () => {
  const root = await mkdtemp(join(tmpdir(), "maglucen-xnb-"));
  try {
    await mkdir(join(root, "Strings"));
    await writeFile(join(root, "Strings", "Objects.xnb"), "base");
    assert.equal(
      localizedXnbPath(root, "Strings/Objects.xnb", "es-ES"),
      "Strings/Objects.xnb",
    );
    await writeFile(join(root, "Strings", "Objects.es-ES.xnb"), "localized");
    assert.match(
      localizedXnbPath(root, "Strings/Objects.xnb", "es-ES"),
      /Objects\.es-ES\.xnb$/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Spanish Companion messages cover every English key and interpolate", () => {
  assert.deepEqual(Object.keys(spanish).sort(), Object.keys(english).sort());
  const t = createTranslator(spanish, english);
  assert.equal(t("common.version", { version: "2.0.0" }), "Versión 2.0.0");
  assert.equal(t("missing.key"), "missing.key");
});

test("farm switching and storage feedback are localized", () => {
  const t = createTranslator(spanish, english);
  assert.match(t("shell.changingFarmDetail", { farm: "Pradera" }), /Pradera/);
  assert.equal(t("storage.backpack"), "Mochila");
  assert.equal(t("storage.chest"), "Cofre");
  assert.equal(t("storage.sortQuantityDesc"), "Cantidad: de mayor a menor");
});
