<p align="center">
  <img src="assets/maglucen-stardew-companion-brand-v2.png" width="520" alt="Maglucen Stardew Valley Companion">
</p>

<p align="center">
  A private, local-first desktop companion that turns your Stardew Valley save into a practical daily plan.
</p>

<p align="center">
  <a href="https://github.com/Maglucen-Studio/StardewValleyTool/releases/latest"><strong>Download the latest Windows installer</strong></a>
  ·
  <a href="CHANGELOG.md">Changelog</a>
  ·
  <a href="SUPPORT.md">Support</a>
  ·
  <a href="PRIVACY.md">Privacy</a>
</p>

> The application is currently in active development and its interface is available in English. Release notes describe changes and known limitations for each version.

## What it does

- Builds daily priorities and a location-aware suggested route.
- Renders the matching tile-accurate layout for all eight vanilla farm types, with buildings, crops, machines, and interiors drawn from the user's local game installation.
- Shows fish by season, weather, time, location, fishing level, collection status, and active quest.
- Tracks crops, production, friendships, achievements, museum progress, and Community Center bundles.
- Reads the current game state through the optional included SMAPI bridge for LIVE updates.
- Processes everything locally and never writes to the Stardew Valley save.

## Install

1. Open [the latest release](https://github.com/Maglucen-Studio/StardewValleyTool/releases/latest).
2. Download **`Maglucen-Stardew-Valley-Companion-Setup-<version>.exe`**.
3. Run the installer and open **Maglucen Stardew Valley Companion**.
4. On first launch, choose your Stardew Valley installation and farm if they are not detected automatically.

The setup assistant checks Steam libraries and common GOG and Xbox locations. It also shows store-specific example paths when manual selection is needed. The application extracts required visual assets from the user's own game installation; Stardew Valley assets are not bundled in this repository or its installer.

## LIVE tracking

Normal save reading works without SMAPI. For updates while Stardew Valley is running, install [SMAPI](https://smapi.io/) first and let the setup assistant add the included companion bridge to the game's `Mods` folder.

The bridge reports selected live information such as time, location, inventory, quests, route progress, fishing, friendships, bundles, and museum donations. It does not modify game state and it does not install or download SMAPI itself.

## Requirements

- Windows 10 or Windows 11, 64-bit.
- A legitimate PC installation of Stardew Valley 1.6.
- Optional: SMAPI for LIVE tracking.

No separate installation of Python, Node.js, or a web browser is required.

## Updates

Use **Check for updates** inside the application. It reports whether the installed version is current and, when a newer release is available, can download it and restart the companion to finish installing it. Restarting the companion does not restart or close Stardew Valley.

## Settings and background tracking

Open **Application → Settings…** to configure the farm and two independent background options:

- **Track automatically** starts the companion quietly with Windows and watches for Stardew Valley.
- **Keep running in the system tray** hides the dashboard when its window is closed so tracking can continue. Disable it if closing the window should quit the companion, its tray icon, and its private local service completely.

## Privacy and save safety

- Save data, configuration, extracted assets, logs, and history remain on the user's computer.
- The application reads a private copy of the selected save and never writes to the original.
- No account, cloud upload, analytics service, or hosted dashboard is required.
- See [PRIVACY.md](PRIVACY.md) for the complete privacy summary.

## Support

Use [GitHub Issues](https://github.com/Maglucen-Studio/StardewValleyTool/issues) for reproducible bugs and feature requests. Please read [SUPPORT.md](SUPPORT.md) before opening an issue and include the application version and relevant error message.

## About this repository

This public repository is the distribution and support home for Maglucen Stardew Valley Companion. Stable installers, update metadata, release notes, user documentation, and public issue tracking live here. Development source remains in a separate private repository.

## Disclaimer

Maglucen Stardew Valley Companion is an independent fan-made project. It is not affiliated with, endorsed by, or sponsored by ConcernedApe or the publishers of Stardew Valley. Stardew Valley names and assets belong to their respective owners.
