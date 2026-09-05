# Dashboard modules

`app/page.tsx` composes the desktop shell, farm selection, navigation and feature views. Feature views receive snapshot and LIVE data through props and never import the page.

- `snapshot-types.ts` defines saved/local data contracts. `ui-types.ts` holds view state and presentation contracts. Production catalog contracts live in `app/planning/production-types.ts`, independently of the calculator component.
- `identity.ts`, `game-names.ts`, `formatting.ts` and `selectors.ts` provide shared identity, localization, formatting and reconciliation helpers. `farm-model.ts` reconciles construction proposals without React or canvas.
- `fishing-view.tsx`, `planning-view.tsx`, `today-view.tsx`, `progress-view.tsx` and `live-view.tsx` own their respective views.
- `use-dashboard-session.ts` owns snapshot/history polling, profile-scoped session baselines, previous-day data and LIVE freshness. Cleanup invalidates pending responses so an old profile or language cannot overwrite the current session. `use-farm-assets.ts` loads local sprites/backgrounds and cleans up image callbacks.
- `farm-editor-view.tsx` owns the outer map layout, panel widths, layer controls, interiors and proposal actions. It remains mounted across navigation to preserve editor state; canvas drawing follows view changes.
- `use-farm-editor.ts` owns map preferences, selection, proposals, movement and editor handlers; `farm-model.ts` validates placement without React. `use-dashboard-navigation.ts` owns section history and desktop/mouse/keyboard navigation subscriptions. `use-farm-canvas.ts` owns farm drawing and redraw dependencies. `farm-rendering.tsx` owns canvas helpers and interior rendering. `artwork.tsx`, `storage.tsx` and `ui.tsx` own reusable artwork, storage dialogs and controls.

Imports flow from the page to features and from features to shared modules. Shared modules must not import feature views or the page. A test checks the module graph, including type dependencies, for cycles.

Dashboard material counts, tool tiers, crop matching and fishing-quest matching use qualified identifiers. Machine products preserve both item namespace and preserve-parent variants; old ID-less bridge products remain isolated by legacy label. Inventory grouping retains labels as a variant discriminator for old payloads without preserve metadata. NPC, location and building keys may resemble English names but are game identifiers; presentation-name fallbacks remain for legacy artwork and text.

Numeric presentation uses `formatNumber` and `formatDecimal` with the selected locale. Game-clock and date formatting remain separate. Focused tests cover namespaces, translated labels, placement, session cleanup/profile isolation and locale formatting; the module graph test guards dependency direction.
