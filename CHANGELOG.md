# Changelog

This file records the user-facing changes in each public release of Maglucen Stardew Valley Companion.

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
