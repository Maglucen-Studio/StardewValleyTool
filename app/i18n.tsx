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
type LocalizationPayload = {
  language: "en" | "es";
  locale: string;
  messages: Messages;
  fallbackMessages: Messages;
};
type LocalizationContextValue = LocalizationPayload & {
  t: (key: string, variables?: Record<string, string | number>) => string;
  number: (value: number) => string;
};

const fallback: LocalizationPayload = {
  language: "en",
  locale: "en-US",
  messages: english,
  fallbackMessages: english,
};
const LocalizationContext = createContext<LocalizationContextValue>({
  ...fallback,
  t: key => english[key as keyof typeof english] || key,
  number: value => value.toLocaleString("en-US"),
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
    (key: string, variables: Record<string, string | number> = {}) => {
      const template = state.messages[key] ?? state.fallbackMessages[key] ?? key;
      return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
        Object.hasOwn(variables, name) ? String(variables[name]) : match,
      );
    },
    [state.fallbackMessages, state.messages],
  );
  const number = useCallback(
    (value: number) => value.toLocaleString(state.locale),
    [state.locale],
  );
  const value = useMemo(
    () => ({ ...state, t, number }),
    [number, state, t],
  );
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useI18n() {
  return useContext(LocalizationContext);
}
