"use client";

import changelogMarkdown from "../CHANGELOG.md?raw";
import { useI18n } from "./i18n";

type ChangelogSection = {
  title: string;
  entries: string[];
};

export type ChangelogRelease = {
  version: string;
  date: string;
  sections: ChangelogSection[];
};

const RELEASE_HEADING = /^##\s+([^\s]+)\s+—\s+(\d{4}-\d{2}-\d{2})\s*$/;
const SECTION_HEADING = /^###\s+(.+?)\s*$/;
const LIST_ENTRY = /^-\s+(.+?)\s*$/;
const GITHUB_CHANGELOG_URL = "https://github.com/Maglucen-Studio/StardewValleyTool/blob/main/CHANGELOG.md";

export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | null = null;
  let section: ChangelogSection | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const releaseMatch = line.match(RELEASE_HEADING);
    if (releaseMatch) {
      release = {
        version: releaseMatch[1],
        date: releaseMatch[2],
        sections: [],
      };
      releases.push(release);
      section = null;
      continue;
    }

    const sectionMatch = line.match(SECTION_HEADING);
    if (sectionMatch && release) {
      section = { title: sectionMatch[1], entries: [] };
      release.sections.push(section);
      continue;
    }

    const entryMatch = line.match(LIST_ENTRY);
    if (entryMatch && release) {
      if (!section) {
        section = { title: "Changes", entries: [] };
        release.sections.push(section);
      }
      section.entries.push(entryMatch[1]);
    }
  }

  return releases.filter((item) => item.sections.some((itemSection) => itemSection.entries.length > 0));
}

export const CHANGELOG_RELEASES = parseChangelog(changelogMarkdown);

function versionParts(version: string) {
  return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(left: string, right: string) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function selectChangelogReleases(
  releases: ChangelogRelease[],
  fromVersion?: string | null,
  throughVersion?: string,
) {
  if (!fromVersion && !throughVersion) return releases;
  const selected = releases.filter((release) => {
    if (throughVersion && compareVersions(release.version, throughVersion) > 0) return false;
    if (fromVersion && compareVersions(release.version, fromVersion) <= 0) return false;
    return !throughVersion || fromVersion || compareVersions(release.version, throughVersion) === 0;
  });
  return selected.length > 0 ? selected : releases.slice(0, 1);
}

type ChangelogHistoryProps = {
  fromVersion?: string | null;
  throughVersion?: string;
  headingId?: string;
  compact?: boolean;
};

export function ChangelogHistory({
  fromVersion,
  throughVersion,
  headingId = "help-changelog-title",
  compact = false,
}: ChangelogHistoryProps = {}) {
  const { t } = useI18n();
  const releases = selectChangelogReleases(CHANGELOG_RELEASES, fromVersion, throughVersion);

  return (
    <section className={`help-changelog${compact ? " compact" : ""}`} aria-labelledby={headingId}>
      <div className="help-changelog-heading">
        <h3 id={headingId}>{t("web.home.changelog")}</h3>
        <a href={GITHUB_CHANGELOG_URL} target="_blank" rel="noreferrer">
          {t("web.home.viewChangelogOnGitHub")} <span aria-hidden="true">↗</span>
        </a>
      </div>
      <p className="help-changelog-intro">
        {t("web.home.changelogIsAvailableOfflineAndReleaseNotesAreWrittenInEnglish")}
      </p>
      <div className="help-changelog-releases">
        {releases.map((release, releaseIndex) => (
          <details className="help-changelog-release" open={releaseIndex === 0} key={release.version}>
            <summary>
              <span>{t("web.home.version")} {release.version}</span>
              <time dateTime={release.date}>{release.date}</time>
            </summary>
            <div className="help-changelog-release-body">
              {release.sections.map((section) => (
                <section key={section.title}>
                  <h4>{section.title}</h4>
                  <ul>
                    {section.entries.map((entry) => <li key={entry}>{entry}</li>)}
                  </ul>
                </section>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
