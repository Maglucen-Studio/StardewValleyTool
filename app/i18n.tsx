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
export type MessageDescriptor = {
  key: string;
  variables?: Record<string, string | number | MessageDescriptor>;
};
type LocalizationPayload = {
  language: "en" | "es";
  locale: string;
  messages: Messages;
  fallbackMessages: Messages;
};
type LocalizationContextValue = LocalizationPayload & {
  t: (key: string, variables?: Record<string, string | number>) => string;
  text: (value: string | MessageDescriptor | null | undefined) => string;
  number: (value: number) => string;
  date: (value: { year: number; season: string; day: number }) => string;
};

const fallback: LocalizationPayload = {
  language: "en",
  locale: "en-US",
  messages: english,
  fallbackMessages: english,
};

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

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocalizationPayload>(fallback);

  useEffect(() => {
    const desktop = (window as Window & {
      stardewDesktop?: { getLocalization?: () => Promise<LocalizationPayload> };
    }).stardewDesktop;
    if (desktop?.getLocalization) {
      desktop.getLocalization().then(setState).catch(() => undefined);
      return;
    }
    if (navigator.language.toLowerCase().startsWith("es"))
      queueMicrotask(() =>
        setState({
          language: "es",
          locale: "es-ES",
          messages: spanish,
          fallbackMessages: english,
        }),
      );
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
