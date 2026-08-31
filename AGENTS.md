# Repository guidelines

These rules apply to every contributor and automated coding tool working in this repository.

## Stardew Valley assets

- Never commit, embed, redistribute, or upload assets extracted from Stardew Valley.
- Read sprites, maps, portraits, strings, and XNB contents only from the user's legitimate local game installation.
- Keep extracted and generated game assets in ignored runtime or build directories.
- Do not add copied game assets as fallbacks. Use a code-generated placeholder when local extraction is unavailable.
- Original Maglucen Companion branding is allowed. Do not present it as official Stardew Valley branding.

## Save safety and privacy

- Treat the game installation and original save directories as read-only, except for installing or updating the optional companion SMAPI bridge after an explicit user action.
- Never modify an original Stardew Valley save.
- Parse private working copies and write companion state only to application-owned or documented sidecar files.
- Never commit saves, player or farm names, logs, local history, generated snapshots, local paths, or `config.local.json`.
- Do not add telemetry, analytics, advertising, or cloud uploads without an explicit product decision and privacy review.

## Game data and localization

- Prefer data extracted from the installed game over manually maintained item tables.
- Preserve qualified Stardew Valley identifiers such as `(O)`, `(BC)`, `(W)`, `(H)`, and other namespaces. Equal numeric portions do not imply equal items.
- Respect the game's selected language. Do not replace unresolved localization keys with invented user-facing text.
- Verify game facts from the installed data or an authoritative source instead of guessing.

## LIVE bridge

- The SMAPI bridge must remain read-only and have no in-game interface unless the product requirements explicitly change.
- It must not alter gameplay, saves, inventory, time, quests, relationships, or world state.
- LIVE data stays on the user's computer.
- Release bridge binaries must be built from the public bridge source in CI; do not commit compiled bridge DLLs.

## Security and releases

- Never commit credentials, tokens, certificates, private keys, or signing material.
- Keep dependency and action versions pinned through the lockfile or an immutable action revision where practical.
- A public release must be produced by the repository's GitHub Actions workflow, not from an unverified local binary.
- Run `npm run verify:public`, `npm run lint`, and `npm test` before proposing a release-related change.
- Inspect installer contents before publishing and ensure they contain no extracted game assets or private player data.

## Collaboration and AI-assisted work

- Human maintainers remain responsible for product decisions, review, testing, licensing, and releases regardless of which development tools were used.
- Do not claim that generated code was manually authored or reviewed when it was not.
- Treat generated suggestions as untrusted until the relevant behavior and tests have been inspected.
