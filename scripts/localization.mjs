import { existsSync, readFileSync } from "node:fs";
import { join, parse } from "node:path";

export const GAME_LANGUAGES = Object.freeze({
  en: { appLanguage: "en", locale: "en-US", xnbSuffix: "" },
  de: { appLanguage: null, locale: "de-DE", xnbSuffix: "de-DE" },
  es: { appLanguage: "es", locale: "es-ES", xnbSuffix: "es-ES" },
  fr: { appLanguage: null, locale: "fr-FR", xnbSuffix: "fr-FR" },
  hu: { appLanguage: null, locale: "hu-HU", xnbSuffix: "hu-HU" },
  it: { appLanguage: null, locale: "it-IT", xnbSuffix: "it-IT" },
  ja: { appLanguage: null, locale: "ja-JP", xnbSuffix: "ja-JP" },
  ko: { appLanguage: null, locale: "ko-KR", xnbSuffix: "ko-KR" },
  pt: { appLanguage: null, locale: "pt-BR", xnbSuffix: "pt-BR" },
  ru: { appLanguage: null, locale: "ru-RU", xnbSuffix: "ru-RU" },
  tr: { appLanguage: null, locale: "tr-TR", xnbSuffix: "tr-TR" },
  zh: { appLanguage: null, locale: "zh-CN", xnbSuffix: "zh-CN" },
});

export const APP_LANGUAGE_MODES = Object.freeze(["game", "en", "es"]);

export function normalizeGameLanguageCode(value) {
  const normalized = String(value || "en").trim().toLowerCase();
  if (normalized.startsWith("pt")) return "pt";
  if (normalized.startsWith("zh")) return "zh";
  return normalized.slice(0, 2) in GAME_LANGUAGES ? normalized.slice(0, 2) : "en";
}

export function readGameLanguageCode(appDataPath) {
  const preferences = join(appDataPath, "StardewValley", "startup_preferences");
  try {
    const contents = readFileSync(preferences, "utf8");
    return normalizeGameLanguageCode(
      contents.match(/<languageCode>\s*([^<]+?)\s*<\/languageCode>/i)?.[1],
    );
  } catch {
    return "en";
  }
}

export function resolveLanguage(config = {}, appDataPath = "") {
  const requestedMode = APP_LANGUAGE_MODES.includes(config?.languageMode)
    ? config.languageMode
    : "game";
  const gameCode = readGameLanguageCode(appDataPath);
  const requestedLanguage = requestedMode === "game" ? gameCode : requestedMode;
  const language = requestedLanguage === "es" ? "es" : "en";
  const metadata = GAME_LANGUAGES[language];
  return {
    mode: requestedMode,
    gameCode,
    language,
    locale: metadata.locale,
    xnbSuffix: metadata.xnbSuffix,
    followedGameExactly: requestedMode !== "game" || requestedLanguage === language,
  };
}

export function localizedXnbPath(contentRoot, relativePath, xnbSuffix) {
  if (!xnbSuffix) return relativePath;
  const parsed = parse(relativePath);
  const localized = join(parsed.dir, `${parsed.name}.${xnbSuffix}${parsed.ext}`);
  return existsSync(join(contentRoot, localized)) ? localized : relativePath;
}

export function createTranslator(catalog, fallbackCatalog = catalog) {
  return (key, variables = {}) => {
    const template = catalog?.[key] ?? fallbackCatalog?.[key] ?? key;
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
      Object.hasOwn(variables, name) ? String(variables[name]) : match,
    );
  };
}
