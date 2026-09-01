import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

test("local development extracts the same language selected by the app", async () => {
  const [development, config] = await Promise.all([
    readFile(new URL("../scripts/dev-local.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/config.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(config, /languageMode: \["game", "en", "es"\]\.includes\(file\.languageMode\)/);
  assert.match(development, /resolveLanguage\(config, process\.env\.APPDATA \|\| ""\)/);
  assert.match(development, /STARDEW_TOOL_LANGUAGE: localization\.language/);
  assert.match(development, /STARDEW_TOOL_XNB_SUFFIX: localization\.xnbSuffix/);
  assert.match(development, /env: \{ \.\.\.localizedEnvironment, STARDEW_PATH:/);
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

test("semantic daily and fishing messages are available in both catalogs", () => {
  const en = createTranslator(english, english);
  const es = createTranslator(spanish, english);
  assert.equal(en("weather.Rain"), "Rain");
  assert.equal(es("weather.Rain"), "Lluvia");
  assert.match(es("today.luck.favorable.label"), /suerte favorable/);
  assert.equal(es("fishing.level", { level: 8 }), "Nivel de pesca 8");
  assert.equal(es("gameName.largeEggWhite", { item: "Huevo XXL" }), "Huevo XXL (blanco)");
  assert.equal(es("gameName.largeEggBrown", { item: "Huevo XXL" }), "Huevo XXL (marrón)");
  assert.match(es("today.brief.caveCollectibles", { count: 2, cave: "murciélagos fruteros" }), /2 objetos/);
});

test("desktop and renderer keep the Companion locale synchronized", async () => {
  const [provider, layout, page, styles, preload, desktop, development, setup, setupScript] = await Promise.all([
    readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../desktop/preload.cjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/dev-local.mjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/setup.html", import.meta.url), "utf8"),
    readFile(new URL("../desktop/setup.js", import.meta.url), "utf8"),
  ]);

  assert.match(preload, /setLanguageMode: mode => ipcRenderer\.invoke\("localization:set-mode"/);
  assert.match(preload, /onLocalizationChanged: callback =>/);
  assert.match(preload, /ipcRenderer\.on\("localization:changed", listener\)/);
  assert.match(desktop, /function localizationPayload\(config = readConfig\(\) \|\| \{\}\)/);
  assert.match(desktop, /ipcMain\.handle\("localization:set-mode"/);
  assert.match(desktop, /STARDEW_TOOL_LANGUAGE_MODE: language\.mode/);
  assert.match(desktop, /mainWindow\.webContents\.send\("localization:changed", payload\)/);
  assert.match(desktop, /writeFileSync\(configPath,[\s\S]*publishLocalizationState\(config\)/);
  assert.match(provider, /desktop\?\.onLocalizationChanged\?\.\(apply\)/);
  assert.match(provider, /window\.addEventListener\("focus", refresh\)/);
  assert.match(provider, /document\.addEventListener\("visibilitychange", handleVisibility\)/);
  assert.match(provider, /Promise\.race\(\[/);
  assert.match(provider, /setTimeout\(\(\) => resolve\(null\), 1500\)/);
  assert.match(provider, /catch \{\s*applyBrowserFallback\(\);\s*\}/);
  assert.match(layout, /export const dynamic = "force-dynamic"/);
  assert.match(layout, /process\.env\.STARDEW_TOOL_LANGUAGE === "es"/);
  assert.match(layout, /initialMode=\{initialMode\}/);
  assert.match(development, /STARDEW_TOOL_LANGUAGE_MODE: localization\.mode/);
  assert.match(page, /className="language-selector"/);
  assert.match(page, /function LanguageModeIcon/);
  assert.match(page, /\/assets\/ui\/stardew-valley-icon\.png/);
  assert.match(styles, /\.language-selector-menu/);
  assert.match(styles, /\.language-mode-icon\.es/);
  assert.match(styles, /\.language-mode-icon\.en/);
  assert.match(desktop, /app\.getFileIcon\(executable, \{ size: "normal" \}\)/);
  assert.match(setup, /id="language-label"/);
  assert.match(setupScript, /element\.hidden = Boolean\(state\.config\)/);
  assert.doesNotMatch(provider, /getLocalization\(\)\.then\(setState\)\.catch\(\(\) => undefined\)/);
});
