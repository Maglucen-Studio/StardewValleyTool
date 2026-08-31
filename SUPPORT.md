# Support

Before opening an issue:

1. Confirm that the latest release is installed.
2. Restart Maglucen Stardew Valley Companion.
3. If the problem concerns LIVE tracking, confirm that Stardew Valley was started through SMAPI.

When reporting a bug, include:

- Maglucen Stardew Valley Companion version.
- Windows version.
- Stardew Valley platform (Steam, GOG, or Xbox app).
- Whether SMAPI and LIVE tracking were active.
- The visible error message and exact reproduction steps.

Do not upload Stardew Valley save files or local diagnostic logs publicly unless you have checked their contents and intentionally choose to share them.

## Upgrading from the former Stardew Valley Tool

Version 1.4 and later use the permanent Maglucen application identity and data directory. On first launch, the companion detects `%APPDATA%\stardew-valley-tool` and migrates compatible settings, window state, and farm history into `%APPDATA%\maglucen-stardew-valley-companion`.

Keep the former data directory until the new application has opened the farm successfully. Stardew Valley save files are never moved or changed by this migration.

