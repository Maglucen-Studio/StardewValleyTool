"use client";

import changelogMarkdown from "../CHANGELOG.md?raw";
import { useI18n } from "./i18n";

type ChangelogSection = {
  title: string;
  entries: string[];
};

type ChangelogRelease = {
  version: string;
  date: string;
  sections: ChangelogSection[];
};

const RELEASE_HEADING = /^##\s+([^\s]+)\s+—\s+(\d{4}-\d{2}-\d{2})\s*$/;
const SECTION_HEADING = /^###\s+(.+?)\s*$/;
const LIST_ENTRY = /^-\s+(.+?)\s*$/;

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

export function ChangelogHistory() {
  const { t } = useI18n();

  return (
    <section className="help-changelog" aria-labelledby="help-changelog-title">
      <h3 id="help-changelog-title">{t("web.home.changelog")}</h3>
      <p className="help-changelog-intro">
        {t("web.home.changelogIsAvailableOfflineAndReleaseNotesAreWrittenInEnglish")}
      </p>
      <div className="help-changelog-releases">
        {CHANGELOG_RELEASES.map((release, releaseIndex) => (
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
