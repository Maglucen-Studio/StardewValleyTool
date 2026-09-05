# Dashboard accessibility

The Aa button opens appearance settings. Text size (75, 85, 90, 100, 125, 150 or 200%) is independent of the Display setting and persists locally. High contrast changes interface surfaces; local game images keep their original pixels. The six-step guide is optional, remembers dismissal and can be reopened from Aa.

## Keyboard controls

- Tab and Shift+Tab move between controls; Enter or Space activates buttons. A skip link moves past the header.
- Dialogs use the native modal layer with an inert background, an explicit Tab cycle, Escape dismissal and focus restoration. Item-location actions are named buttons, including resources and storage cards.
- Main navigation retains shortcuts 1–6 and Alt+Left/Right. Text fields and open dialogs consume their own keys. The language menu supports arrow keys, Home and End.
- In Map, enter zero-based X and Y coordinates and choose **Inspect tile**. Selection details are announced in the tile status strip. For proposals, enable editing, choose a tool, then **Use selected tool on tile**. On a proposal, that action opens Move, completion and deletion actions. Moving uses the same placement validation as the mouse.
- Map column separators accept Left/Right, Home and End when the three-column layout is displayed. Smaller layouts stack the panels.
- The economy chart accepts Left/Right and announces each saved entry. Its two series use solid and dashed lines; spending bars are striped. Machine overlays use a check or clock as well as color.

## Automated checks

`npm test` includes axe-core checks against React-rendered Today, Map, Farm, Fishing, Plan and both Progress views, plus resource and coordinate controls. Fixtures are invented and contain no player data or game assets. Populated synthetic fishing, achievement and history entries exercise more than loading states.

Coordinate activation tests cover blocked placement, successful placement, movement and shared mouse/keyboard proposal menus. Existing localization, module-boundary and dashboard regression tests also run.

JSDOM does not paint or implement native focus behavior. Its axe run excludes color contrast; it cannot certify visual layout, assistive-technology output or WCAG conformance. Those require browser and screen-reader review.

## Manual browser verification

Verified during development on 2026-09-05:

- Open Aa with Enter, cycle backward from the first to the last control and forward again, then Escape: focus returns to Aa.
- High contrast and 200% text remain selected after reloading; Reset restores the default appearance.
- At 1280×720 and 640×360, the settings dialog scrolls and the map coordinate controls wrap without losing their actions at 200% text.
- Entering coordinates and activating Inspect updates the textual tile result.
- All six guide steps advance using Enter and finishing dismisses the guide.

Before merging, also review the normal Today checklist, Farm filters/storage locator, Fishing hour controls, Plan goal controls, and collection details with Tab, Enter and Escape. Check the economy chart with Left/Right and a screen reader, especially after changing language or text size. Use disposable companion proposals for creation/movement tests; the game save must remain unchanged.
