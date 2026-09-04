"use client";

import { useI18n } from "./i18n";

export type ModCompatibilitySummary = {
  status: "vanilla" | "mod-aware" | "uncertain";
  installedModCount: number;
  contentPackCount: number;
  codeModCount: number;
  unclassifiedCodeModCount: number;
  alteredDomains: string[];
  supportedDomains: string[];
  uncertainDomains: string[];
  unsupportedChangeCount: number;
  parseFailureCount: number;
};

export function CompatibilityBadge({ summary }: { summary?: ModCompatibilitySummary }) {
  const { t } = useI18n();
  if (!summary || summary.status === "vanilla") return null;
  const uncertain = summary.status === "uncertain";
  return (
    <span
      className={`compatibility-badge ${uncertain ? "uncertain" : "mod-aware"}`}
      title={t(uncertain ? "compatibility.uncertainDetail" : "compatibility.modAwareDetail")}
    >
      <span aria-hidden="true">{uncertain ? "!" : "✓"}</span>
      <b>{t(uncertain ? "compatibility.uncertain" : "compatibility.modAware")}</b>
    </span>
  );
}
