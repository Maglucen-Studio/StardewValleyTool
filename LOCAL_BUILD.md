# Local Windows builds

Local builds let maintainers verify and package Maglucen Stardew Valley Companion without waiting for GitHub Actions. They are test builds only: public releases must still be produced by the pinned GitHub Actions release workflow so their source, checksums, and provenance can be verified.

## Requirements

- Windows 10 or later.
- Node.js 22.13 or later.
- A legitimate local Stardew Valley installation, or `STARDEW_PATH` pointing to compatible public reference assemblies for bridge compilation.
- Dependencies installed with `npm ci`.

## Commands

Run the complete release-quality validation without packaging:

```powershell
npm run local:verify
```

Build and inspect an unpacked application for quick local testing:

```powershell
npm run local:unpacked
```

Build and inspect a local NSIS installer:

```powershell
npm run local:installer
```

Outputs are written to the ignored `release/` directory. The packaging helper inspects the ASAR and fails if it finds extracted Stardew Valley assets, generated farm data, saves, logs, history, snapshots, or `config.local.json`.

The local installer is intentionally not published or attested. To publish an official version, merge the verified source into `main` and push its matching `vX.Y.Z` tag so `.github/workflows/release.yml` can build the release.
