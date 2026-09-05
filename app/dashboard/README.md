# Dashboard modules

`app/page.tsx` owns desktop subscriptions, farm selection, session state, navigation and the outer farm editor. Feature views receive snapshot and LIVE data through props and never import the page.

- `snapshot-types.ts` defines saved/local data contracts. `ui-types.ts` holds view state and presentation contracts. Production catalog contracts live in `app/planning/production-types.ts`, independently of the calculator component.
- `identity.ts`, `game-names.ts`, `formatting.ts` and `selectors.ts` provide shared identity, localization, formatting and reconciliation helpers. `farm-model.ts` reconciles construction proposals without React or canvas.
- `fishing-view.tsx`, `planning-view.tsx`, `today-view.tsx`, `progress-view.tsx` and `live-view.tsx` own their respective views.
- `use-farm-editor.ts` owns map preferences, selection, proposals, movement and editor handlers; `farm-model.ts` validates placement without React. `use-dashboard-navigation.ts` owns section history and desktop/mouse/keyboard navigation subscriptions. `use-farm-canvas.ts` owns farm drawing and redraw dependencies. `farm-rendering.tsx` owns canvas helpers and interior rendering. `artwork.tsx`, `storage.tsx` and `ui.tsx` own reusable artwork, storage dialogs and controls.

Imports flow from the page to features and from features to shared modules. Shared modules must not import feature views or the page. A test checks the module graph, including type dependencies, for cycles.

This extraction preserves behavior. Remaining incremental work in #16 includes separating the outer farm editor and session orchestration, replacing legacy English-name business rules at their data boundaries, and migrating remaining inline number formatting to shared functions. Do not mix those behavior changes into mechanical moves.
