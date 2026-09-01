"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import english from "../locales/en.json";
import spanish from "../locales/es.json";

type Messages = Record<string, string>;
export type SupportedAppLanguage = "en" | "es";
export type AppLanguageMode = "game" | SupportedAppLanguage;
export type MessageDescriptor = {
  key: string;
  variables?: Record<string, string | number | MessageDescriptor>;
};
export type GameLocalizationCatalog = {
  localizedObjectNamesByEnglish?: Record<string, string>;
  localizedNamesByQualifiedId?: Record<string, string>;
  localizedAchievementsById?: Record<string, { name?: string; requirement?: string }>;
  localizedQuestsById?: Record<string, { title?: string; description?: string; objective?: string }>;
};
type LocalizationPayload = {
  mode: AppLanguageMode;
  gameCode: string;
  language: SupportedAppLanguage;
  locale: string;
  messages: Messages;
  fallbackMessages: Messages;
  gameCatalog: GameLocalizationCatalog;
};
type LocalizationContextValue = LocalizationPayload & {
  t: (key: string, variables?: Record<string, string | number>) => string;
  text: (value: string | MessageDescriptor | null | undefined) => string;
  number: (value: number) => string;
  date: (value: { year: number; season: string; day: number }) => string;
};
type DesktopLocalization = {
  getLocalization?: () => Promise<LocalizationPayload>;
  onLocalizationChanged?: (
    callback: (payload: LocalizationPayload) => void,
  ) => (() => void) | undefined;
};

const fallback: LocalizationPayload = {
  mode: "en",
  gameCode: "en",
  language: "en",
  locale: "en-US",
  messages: english,
  fallbackMessages: english,
  gameCatalog: {},
};

function localizationForLanguage(
  language: SupportedAppLanguage,
  mode: AppLanguageMode = language,
): LocalizationPayload {
  return language === "es"
    ? {
        mode,
        gameCode: language,
        language: "es",
        locale: "es-ES",
        messages: spanish,
        fallbackMessages: english,
        gameCatalog: {},
      }
    : { ...fallback, mode, gameCode: language };
}

function browserLocalization(): LocalizationPayload {
  return localizationForLanguage(
    navigator.language.toLowerCase().startsWith("es") ? "es" : "en",
  );
}

function isLocalizationPayload(value: unknown): value is LocalizationPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LocalizationPayload>;
  return (
    (candidate.language === "en" || candidate.language === "es") &&
    typeof candidate.gameCode === "string" &&
    (candidate.mode === "game" || candidate.mode === "en" || candidate.mode === "es") &&
    typeof candidate.locale === "string" &&
    Boolean(candidate.messages) &&
    typeof candidate.messages === "object" &&
    Boolean(candidate.fallbackMessages) &&
    typeof candidate.fallbackMessages === "object" &&
    Boolean(candidate.gameCatalog) &&
    typeof candidate.gameCatalog === "object"
  );
}

function translateMessage(
  messages: Messages,
  fallbackMessages: Messages,
  key: string,
  variables: Record<string, string | number> = {},
) {
  const template = messages[key] ?? fallbackMessages[key] ?? key;
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
    Object.hasOwn(variables, name) ? String(variables[name]) : match,
  );
}

function translateValue(
  messages: Messages,
  fallbackMessages: Messages,
  value: string | MessageDescriptor | null | undefined,
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return translateMessage(
    messages,
    fallbackMessages,
    value.key,
    Object.fromEntries(
      Object.entries(value.variables || {}).map(([key, variable]) => [
        key,
        typeof variable === "object"
          ? translateValue(messages, fallbackMessages, variable)
          : variable,
      ]),
    ),
  );
}

const LocalizationContext = createContext<LocalizationContextValue>({
  ...fallback,
  t: (key, variables) => translateMessage(english, english, key, variables),
  text: value => translateValue(english, english, value),
  number: value => value.toLocaleString("en-US"),
  date: value => translateMessage(english, english, "date.game", value),
});

export function LocalizationProvider({
  children,
  initialLanguage = "en",
  initialMode = initialLanguage,
}: {
  children: ReactNode;
  initialLanguage?: SupportedAppLanguage;
  initialMode?: AppLanguageMode;
}) {
  const [state, setState] = useState<LocalizationPayload>(() =>
    localizationForLanguage(initialLanguage, initialMode),
  );

  useEffect(() => {
    let active = true;
    const desktop = (window as Window & {
      stardewDesktop?: DesktopLocalization;
    }).stardewDesktop;
    const apply = (payload: unknown) => {
      if (active && isLocalizationPayload(payload)) setState(payload);
    };
    const applyBrowserFallback = () => {
      if (active) setState(browserLocalization());
    };
    const refresh = async () => {
      if (!desktop?.getLocalization) {
        applyBrowserFallback();
        return;
      }
      try {
        const payload = await Promise.race([
          desktop.getLocalization(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        if (isLocalizationPayload(payload)) apply(payload);
        else applyBrowserFallback();
      } catch {
        applyBrowserFallback();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    void refresh();
    const unsubscribe = desktop?.onLocalizationChanged?.(apply);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      unsubscribe?.();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = state.language;
  }, [state.language]);

  const t = useCallback(
    (key: string, variables: Record<string, string | number> = {}) =>
      translateMessage(
        state.messages,
        state.fallbackMessages,
        key,
        variables,
      ),
    [state.fallbackMessages, state.messages],
  );
  const number = useCallback(
    (value: number) => value.toLocaleString(state.locale),
    [state.locale],
  );
  const text = useCallback(
    (value: string | MessageDescriptor | null | undefined) =>
      translateValue(state.messages, state.fallbackMessages, value),
    [state.fallbackMessages, state.messages],
  );
  const date = useCallback(
    (value: { year: number; season: string; day: number }) =>
      t("date.game", {
        year: value.year,
        season: t(`season.${value.season.toLowerCase()}`),
        day: value.day,
      }),
    [t],
  );
  const value = useMemo(
    () => ({ ...state, t, text, number, date }),
    [date, number, state, t, text],
  );
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useI18n() {
  return useContext(LocalizationContext);
}
