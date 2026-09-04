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

export function CompatibilityNotice({
  summary,
  domains,
}: {
  summary?: ModCompatibilitySummary;
  domains: string[];
}) {
  const { t } = useI18n();
  const uncertainDomains = (summary?.uncertainDomains || []).filter((domain) =>
    domains.includes(domain),
  );
  if (!uncertainDomains.length) return null;
  return (
    <p
      className="compatibility-notice"
      title={t("compatibility.uncertainDetail")}
    >
      <span aria-hidden="true">!</span>
      <span>{t("compatibility.contextual", {
        domains: uncertainDomains
          .map((domain) => t(`compatibility.domain.${domain}`))
          .join(", "),
      })}</span>
    </p>
  );
}
