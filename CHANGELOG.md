# Changelog

This file records the user-facing changes in each public release of Maglucen Stardew Valley Companion.

## 1.11.1 — 2026-09-04

### Improved

- Companion now shows the relevant release notes once after an application update, including every release skipped by the previous installed version.
- New installations and development sessions remain uninterrupted, while the complete offline changelog stays available from Help.

### Fixed

- The read-only LIVE bridge now isolates failures in quests, locations, storage, machines, animals, collections, and farm-map data so one incompatible or incomplete value cannot stop the remaining snapshot from updating.
- Repeated bridge failures are deduplicated, previously valid slow-changing sections are preserved, and Companion identifies partial LIVE data without modifying the game or save.
- Added null-safe handling for modded or partially removed game data that can remain in established saves after a mod changes or is uninstalled.

## 1.11.0 — 2026-09-03

### New

- Added a unified production calculator for crops, fruit trees, passive forestry, artisan machines, animals, and fish ponds using data from the local game installation.
- Added searchable producer selection, exact date or duration horizons, budget and quantity modes, saved calculations, and side-by-side plan comparison.
- Added complete production portfolios that reserve shared money, materials, space, inputs, and machines without modifying the Stardew Valley save.

### Improved

- Connected production chains now propagate real dated batches across steps such as crop to keg, wine, and cask instead of relying on average daily rates.
- Estimates now account for professions, fertilizer, seasonal planting windows, animal maturity and feed, fish-pond population gates, processing capacity, and material setup costs where local rules are available.
- Animal and product artwork, names, prices, recipes, and production rules are read from the user's local game installation, with generated placeholders when optional artwork is unavailable.

### Fixed

- Fish-pond forecasts now identify every expected raw and processed resource and limit roe processing to the selected preserves-jar capacity.
- Animal forecasts now show the animal itself in the selector and identify the expected raw or processed products in the result.
- Required materials, calculation controls, bookmarks, comparison tables, and keyboard navigation now follow a consistent visual and document order.

## 1.10.0 — 2026-09-02

### New

- Added a compact language selector to the main header with English, Spanish, and automatic Stardew Valley modes.
- Added an offline in-app changelog with a direct link to the complete changelog on GitHub.
- Added a persistent per-farm Today checklist that combines manual decisions with completion detected from LIVE game state.

### Improved

- Language changes now happen live without closing the application, reloading the page, restarting the local service, or reparsing the save.
- English and Spanish game catalogs are extracted once from the user's local Stardew Valley installation and cached independently from farm logic.
- The interface now starts consistently in the configured language and keeps desktop menus, dialogs, game-owned names, standard quests, achievements, and historical snapshots synchronized.

### Fixed

- Corrected furniture placement so sprites anchor to their saved collision footprint instead of appearing one tile too high.
- Restored Stardew Valley foreground-layer occlusion so nearby walls correctly cover furniture placed behind them.
- Corrected inconsistent language states where the Companion interface remained in English while game-owned item names appeared in Spanish.

## 1.9.0 — 2026-09-01

### New

- Added Companion localization driven by the language selected in Stardew Valley, with complete English and Spanish interface catalogs.
- Added centralized resolution of game-owned names from the user's local Stardew Valley data while preserving custom farm, player, mod, and user-created names.
- Added automated localization coverage checks for the React interface and Electron desktop shell.

### Improved

- Localized Today, Farm, Fishing, Plan, Friendship, Progress, collections, loading, setup, update feedback, dates, quantities, statuses, and LIVE quest information through one shared locale source.
- Farm switching now provides immediate loading feedback while the selected save is prepared.
- Updated the Windows desktop runtime and development dependencies while retaining mutually compatible ESLint, TypeScript, and Node type versions.
- Updated the pinned GitHub build-provenance action and its release-safety verification.

### Fixed

- Corrected game-item localization across storage, routes, gifts, collections, shipping, crops, production, and missing-item checklists, including qualified variants such as white and brown large eggs.
- Corrected Mushroom Cave reminders so placed chests and garden pots are ignored and only ready cave rewards are reported.
- Removed weather and daily luck from the Extra TV channel because those belong to Weather Report and Fortune Teller.
- Corrected remaining untranslated desktop dialogs, development update feedback, quest text, loading progress, and semantic LIVE messages.

## 1.8.2 — 2026-08-30

### Improved

- Farm, interior, and chest previews now use the matching maps extracted from the local game installation, including all eight vanilla farm layouts.
- Item identities now preserve their Stardew Valley namespaces so unrelated objects, tools, clothing, furniture, and big craftables with the same numeric ID are not confused.
- Help diagnostics now report the installed bridge, Stardew Valley process, and LIVE output status more clearly.

### Fixed

- LIVE tracking now recovers automatically when Windows misses a bridge file-change event.
- Farm dimensions and blocked planning tiles now come from the selected farm's actual map instead of the standard layout.

## 1.8.1 — 2026-08-30

### Improved

- The optional Today LIVE map now focuses on the player's current area instead of displaying the complete world atlas.
- Storage locations use readable farm-building names and locally extracted interior artwork for contextual previews.

### Fixed

- Restored chest-location snapshots for both outdoor Farm chests and chests inside farm buildings, including saves that still provide the older location format.
- Special Order names, descriptions, and objectives now use the localized text supplied by the game instead of unresolved translation keys.

## 1.8.0 — 2026-08-30

### New

- Added configurable section menus to Today, Progress Growth, and Collections & Achievements; sections can be hidden, restored, and reordered per device.
- Added “What can I complete today?”, configurable LIVE alerts, contextual Stardew Valley Wiki links, automatic farm-history annotations, and a summary of changes since the previous app session.
- Added browser-style navigation history using header controls, Alt + arrow keys, and mouse Back/Forward buttons.
- Added exact missing-item checklists for long-term collections and clearer item-location previews grouped by container and quality.

### Improved

- Collection, goal, storage, building, Community Center, friendship, crop, production, and suggested-route cards now share more consistent local item artwork and interactions.
- Locked building spoilers and empty building-category filters remain hidden until relevant.
- Growth history uses a sharper responsive economy chart and keeps optional milestone annotations collapsed by default.
- Farm and Plan preserve their own selected subsection, while Progress keeps its subheader permanently aligned during scrolling.
- The included SMAPI bridge remains invisible in-game and is refreshed automatically when the desktop application starts.

### Fixed

- Corrected remaining clipped, missing, or mismatched item and production sprites.
- Corrected repeated storage locations by grouping stacks from the same container while preserving quality.
- Corrected mouse-side-button handling across Electron and mouse drivers that emit different Back/Forward events.
- Improved development startup, single-instance restoration, and automatic desktop-runtime reloads.

## 1.7.0 — 2026-08-30

### New

- Reorganized the companion into clear Today, Map, Farm, Fishing, Plan, and Progress areas.
- Added fast farm switching with each farmer's locally composed portrait, isolated history, and separate proposals.
- Added a searchable global storage index with sorting, container grouping, chest colors, and contextual map previews.
- Added linked goals with complete money and material requirements, inventory availability, and forecasts.
- Added historical day comparisons, collection exploration, and a clearer Grandpa evaluation forecast.
- Added richer Community Center, friendship, museum, achievement, crop, production, and fishing planning.
- Added structured GitHub feedback forms prefilled with safe application diagnostics.

### Improved

- Maps now include locally extracted Farmhouse and Farm Cave artwork, resizable side panels, clearer proposal editing, building previews, and right-click removal.
- Fishing is planned hour by hour through the final playable hour.
- Item artwork is shown throughout goals, bundles, construction, crops, storage, and production views.
- The header uses the selected farmer and keeps navigation consistently visible while scrolling.
- Interface scaling now supports 50%, 75%, 100%, 125%, 150%, 175%, and 200%.
- Reload now uses F5, matching the familiar browser shortcut.

### Fixed

- Corrected storage sprites that were missing, mismatched, or cropped.
- Corrected Summer Squash and production-machine artwork, including Furnace, Preserves Jar, Crab Pot, and Recycling Machine.
- Corrected Vault bundle readiness so affordable money bundles are not shown as completed.
- Corrected production counts and removed the visible in-game companion overlay while retaining optional LIVE tracking.
- Improved cold-start and relaunch reliability for the development launcher.

## 1.6.0 — 2026-08-28

- Added the dedicated settings window with remembered position and size.
- Added configurable start-with-Windows and close-to-tray behavior.
- Added application version information and clearer Help and Support entry points.

For older versions, see the [GitHub Releases](https://github.com/Maglucen-Studio/StardewValleyTool/releases) archive.
