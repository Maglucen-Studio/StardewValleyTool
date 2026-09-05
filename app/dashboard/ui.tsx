"use client";

import { useI18n } from "../i18n";
import type { AppLanguageMode } from "../i18n";
import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import { stardewWikiUrl } from "./selectors";
import { type SectionVisibilityOption } from "./ui-types";

export function WikiLink({ name, label }: { name: string; label?: string }) {
  const { t } = useI18n();
  return (
    <a
      className="wiki-link"
      href={stardewWikiUrl(name)}
      target="_blank"
      rel="noreferrer"
      title={t("wiki.open", { name })}
      aria-label={t("wiki.open", { name })}
    >
      ↗ {label || t("wiki.label")}
    </a>
  );
}

export function LanguageModeIcon({ mode }: { mode: AppLanguageMode }) {
  if (mode === "es") {
    return (
      <span className="language-mode-icon flag" aria-hidden="true">
        <svg viewBox="0 0 30 20" focusable="false">
          <path fill="#aa151b" d="M0 0h30v20H0z" />
          <path fill="#f1bf00" d="M0 5h30v10H0z" />
        </svg>
      </span>
    );
  }
  if (mode === "en") {
    return (
      <span className="language-mode-icon flag" aria-hidden="true">
        <svg viewBox="0 0 30 20" focusable="false">
          <path fill="#012169" d="M0 0h30v20H0z" />
          <path stroke="#fff" strokeWidth="4" d="m0 0 30 20M30 0 0 20" />
          <path stroke="#c8102e" strokeWidth="2" d="m0 0 30 20M30 0 0 20" />
          <path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30" />
          <path stroke="#c8102e" strokeWidth="4" d="M15 0v20M0 10h30" />
        </svg>
      </span>
    );
  }
  return (
    <span className="language-mode-icon game" aria-hidden="true">
      {/* The executable icon is extracted at runtime from the user's own installation. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/ui/stardew-valley-icon.png"
        alt=""
        onError={(event) => { event.currentTarget.style.display = "none"; }}
      />
    </span>
  );
}

export function useSectionVisibility(storageKey: string, sectionIds: readonly string[]) {
  const defaults = () => ({
    visible: Object.fromEntries(sectionIds.map((id) => [id, true])) as Record<string, boolean>,
    order: [...sectionIds],
  });
  const [preferences, setPreferences] = useState(() => {
    const initial = defaults();
    if (typeof window === "undefined") return initial;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
      for (const id of sectionIds)
        if (typeof (saved.visible?.[id] ?? saved[id]) === "boolean")
          initial.visible[id] = saved.visible?.[id] ?? saved[id];
      if (Array.isArray(saved.order)) {
        initial.order = [
          ...saved.order.filter((id: unknown) => sectionIds.includes(String(id))),
          ...sectionIds.filter((id) => !saved.order.includes(id)),
        ];
      }
    } catch {
      // A damaged preference should never prevent the page from opening.
    }
    return initial;
  });
  const persist = (next: typeof preferences) => {
    setPreferences(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const setSectionVisible = (id: string, value: boolean) =>
    persist({ ...preferences, visible: { ...preferences.visible, [id]: value } });
  const showAll = () =>
    persist({ ...preferences, visible: defaults().visible });
  const moveSection = (id: string, direction: -1 | 1) => {
    const index = preferences.order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= preferences.order.length) return;
    const order = [...preferences.order];
    [order[index], order[target]] = [order[target], order[index]];
    persist({ ...preferences, order });
  };
  return [preferences.visible, setSectionVisible, showAll, preferences.order, moveSection] as const;
}

export function SectionVisibilityMenu({
  label,
  options,
  visible,
  order,
  onChange,
  onShowAll,
  onMove,
}: {
  label: string;
  options: readonly SectionVisibilityOption[];
  visible: Record<string, boolean>;
  order: readonly string[];
  onChange: (id: string, value: boolean) => void;
  onShowAll: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);
  const orderedOptions = [...options].sort(
    (a, b) => order.indexOf(a.id) - order.indexOf(b.id),
  );
  const visibleCount = options.filter((option) => visible[option.id]).length;
  return (
    <div className="section-visibility" ref={root}>
      <button
        type="button"
        className="section-visibility-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">⚙</span>{t("shell.sections")}</button>
      {open && (
        <div className="section-visibility-panel" role="dialog" aria-label={label}>
          <header>
            <div>
              <strong>{t("web.sectionVisibilityMenu.visibleSections")}</strong>
              <small>{visibleCount}/{options.length}{t("web.sectionVisibilityMenu.shown")}</small>
            </div>
            <button type="button" onClick={onShowAll}>{t("web.sectionVisibilityMenu.showAll")}</button>
          </header>
          <div>
            {orderedOptions.map((option, index) => (
              <div className="section-visibility-row" key={option.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={visible[option.id] !== false}
                    onChange={(event) => onChange(option.id, event.target.checked)}
                  />
                  <i aria-hidden="true">{visible[option.id] !== false ? "✓" : ""}</i>
                  <span>{option.label}</span>
                </label>
                <span className="section-order-buttons">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={t("sections.moveUp", { section: option.label })}
                    onClick={() => onMove(option.id, -1)}
                  >↑</button>
                  <button
                    type="button"
                    disabled={index === orderedOptions.length - 1}
                    aria-label={t("sections.moveDown", { section: option.label })}
                    onClick={() => onMove(option.id, 1)}
                  >↓</button>
                </span>
              </div>
            ))}
          </div>
          <p>{t("web.sectionVisibilityMenu.savedAutomaticallyOnThisDevice")}</p>
        </div>
      )}
    </div>
  );
}

export function Metric({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number;
}) {
  const { t } = useI18n();
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {delta !== undefined && (
        <small className={delta >= 0 ? "positive" : "negative"}>
          {delta >= 0 ? "+" : "−"}
          {Math.abs(delta).toLocaleString("en-US")}{t("web.metric.gSinceYesterday")}</small>
      )}
    </div>
  );
}

export function Skill({ label, value }: { label: string; value: number }) {
  return (
    <div className="skill-row">
      <span>{label}</span>
      <i>
        <b style={{ width: `${value * 10}%` }} />
      </i>
      <strong>{value}</strong>
    </div>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  color,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  color: string;
}) {
  return (
    <label className="toggle-row">
      <span className="swatch" style={{ background: color }} />
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input
        aria-label={label}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i />
    </label>
  );
}
