"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import type { ActiveView } from "./ui-types";
import { AccessibleDialog } from "./accessible-dialog";

const textSizes = [75, 85, 90, 100, 125, 150, 200];

export function AccessibilitySettings() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [contrast, setContrast] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("companion-high-contrast") === "true");
  const [textSize, setTextSize] = useState(() => {
    if (typeof window === "undefined") return 100;
    const saved = Number(window.localStorage.getItem("companion-text-size"));
    return textSizes.includes(saved) ? saved : 100;
  });
  useEffect(() => {
    document.documentElement.dataset.highContrast = String(contrast);
    document.documentElement.style.setProperty("--text-scale", String(textSize / 100));
    window.localStorage.setItem("companion-high-contrast", String(contrast));
    window.localStorage.setItem("companion-text-size", String(textSize));
  }, [contrast, textSize]);
  return <>
    <button type="button" className="accessibility-trigger" onClick={() => setOpen(true)} aria-label={t("accessibility.settings")} title={t("accessibility.settings")}>{t("accessibility.symbol")}</button>
    {open && <AccessibleDialog className="help-dialog accessibility-dialog" aria-labelledby="accessibility-title" onDismiss={() => setOpen(false)}>
      <button className="help-close" onClick={() => setOpen(false)} aria-label={t("accessibility.close")}>×</button>
      <h2 id="accessibility-title">{t("accessibility.settings")}</h2>
      <label><input type="checkbox" checked={contrast} onChange={(event) => setContrast(event.target.checked)} /> {t("accessibility.contrast")}</label>
      <label htmlFor="text-size">{t("accessibility.textSize")}</label>
      <select id="text-size" value={textSize} onChange={(event) => setTextSize(Number(event.target.value))}>
        {textSizes.map((size) => <option key={size} value={size}>{size}%</option>)}
      </select>
      <p>{t("accessibility.textSizeHint")}</p>
      <p>{t("accessibility.keyboardHint")}</p>
      <button type="button" onClick={() => { setContrast(false); setTextSize(100); }}>{t("accessibility.reset")}</button>
      <button type="button" onClick={() => { setOpen(false); window.dispatchEvent(new Event("companion:show-tour")); }}>{t("accessibility.tour")}</button>
    </AccessibleDialog>}
  </>;
}

const steps: { view: ActiveView; title: string; detail: string }[] = [
  { view: "agenda", title: "today.when.today", detail: "accessibility.tour.today" },
  { view: "map", title: "nav.map", detail: "accessibility.tour.map" },
  { view: "farm", title: "nav.farm", detail: "accessibility.tour.farm" },
  { view: "fishing", title: "nav.fishing", detail: "accessibility.tour.fishing" },
  { view: "planning", title: "nav.plan", detail: "accessibility.tour.plan" },
  { view: "growth", title: "nav.progress", detail: "accessibility.tour.progress" },
];

/** Nonmodal guidance leaves the current workflow available to explore. */
export function DashboardTour({ navigate }: { navigate: (target: { view: ActiveView }) => void }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("companion-tour-seen") !== "true");
  const [step, setStep] = useState(-1);
  useEffect(() => {
    const show = () => { setStep(-1); setVisible(true); };
    window.addEventListener("companion:show-tour", show);
    return () => window.removeEventListener("companion:show-tour", show);
  }, []);
  const dismiss = () => {
    window.localStorage.setItem("companion-tour-seen", "true");
    setVisible(false);
  };
  const go = (next: number) => { setStep(next); navigate({ view: steps[next].view }); };
  if (!visible) return null;
  return <aside className="dashboard-tour" aria-label={t("accessibility.tour")}>
    <span className="tour-emblem" aria-hidden="true">✦</span>
    <div className="tour-copy" aria-live="polite" aria-atomic="true">
      <span className="tour-eyebrow">{t("accessibility.tour")}{step >= 0 && ` · ${step + 1}/${steps.length}`}</span>
      <h2>{step < 0 ? t("accessibility.welcome") : t(steps[step].title)}</h2>
      <p>{t(step < 0 ? "accessibility.welcomeHint" : steps[step].detail)}</p>
    </div>
    <div className="tour-actions">
      {step > 0 && <button onClick={() => go(step - 1)}>{t("accessibility.previous")}</button>}
      <button className="tour-primary" onClick={() => step === steps.length - 1 ? dismiss() : go(step + 1)}>{t(step < 0 ? "accessibility.start" : step === steps.length - 1 ? "accessibility.finish" : "accessibility.next")} <span aria-hidden="true">→</span></button>
      <button className="tour-dismiss" onClick={dismiss}>{t("accessibility.skip")}</button>
    </div>
    <nav className="tour-steps" aria-label={t("accessibility.tour")}>
      {steps.map((item, index) => <button key={item.view} type="button" aria-current={step === index ? "step" : undefined} onClick={() => go(index)}>
        <span className="tour-step-number" aria-hidden="true">{index + 1}</span>{t(item.title)}
      </button>)}
    </nav>
  </aside>;
}
