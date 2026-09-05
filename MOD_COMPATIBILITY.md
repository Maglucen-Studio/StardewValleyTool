# Local mod compatibility matrix

This is a conservative static-data catalog, not a Content Patcher interpreter or a SMAPI runtime emulator. Additions are consumed only after validation. Existing entry replacements are skipped and diagnosed; a supported manifest alone never proves that every rule is modeled. All game data is read from the local installation. No game assets or save data belong in this repository.

| Domain | Consumed additions | Unsupported edits and conditions | Runtime-only limitations |
| --- | --- | --- | --- |
| Objects and crops | New typed records, qualified output identities and extracted growth data | Existing entry replacement, partial directives, unresolved tokens, missing prices | Code-defined items and crop behavior |
| Fish | New fish plus explicit location spawns; per-spawn season and fishing level | Conditional, spatial, distance, catch-limit and bait-specific spawns remain uncertain | Code-driven spawns and live map access |
| Recipes | New cooking/crafting collection records with qualified output IDs and save-backed learned/completed state | Ingredient/unlock evaluation is not implemented for arbitrary additions; added recipe domains remain uncertain, as do replacement records | Arbitrary recipe unlock callbacks |
| Buildings | New local records, material costs, build days and upgrade prerequisites | Unknown materials or build conditions prevent verification | Custom builders, interiors and code-driven upgrade rules |
| NPCs | New typed character records consumed by the catalog | Replacement records and unresolved names are diagnosed | Custom schedules and interaction callbacks |
| Machines / big craftables | New machine identities, deterministic item-placed fixed input/output rules, quantities and cycle times through the existing machine engine | Alternative triggers/outputs, callbacks, unknown inputs, unsupported modifiers and existing-record edits cannot be verified | Code-driven output methods, interactions and machine behavior |
| Animals | New animal records with local building and produce references through the existing animal engine | Conditional/multiple produce selection, missing products/buildings and unlock rules remain uncertain | Code-driven animal behavior and shop access |
| Fish ponds | New keyed pond rules with tags, precedence, population gates and local products through the existing pond engine | Conditional/random/unknown products remain uncertain; existing rules are not replaced | Custom pond callbacks and code-defined population logic |
| Fruit / wild trees | New tree records, local fruit/tap products, growth and cycle data through existing production engines | Missing purchase prices, conditional/random/seasonal fruit or complex tap rules cannot be verified | Code-driven growth, fruit selection and map behavior |
| Locations / maps | New location fish metadata and explicit fish-list additions | Unknown access never creates a confirmed route; map patch operations are diagnosed | Tile edits, warps, arbitrary map loading and access callbacks are not simulated |

Forecasts flagged as uncertain are estimates. Local runtime observations do not automatically verify every future outcome. The parent compatibility issue must stay open until its original acceptance criteria are checked against this matrix and all child deliveries.

## Reproducible validation

`tests/mod-production-extractor.test.mjs` is an opt-in integration test: build the local extractor and set `STARDEW_PATH` to a legitimate installation, then run `node --test tests/mod-production-extractor.test.mjs`. The test writes only synthetic overlay input to a temporary directory and keeps extracted data in memory. Without the environment variable it is skipped so public CI does not require or distribute game content.

Local validation on 2026-09-05: extractor built with no warnings/errors; synthetic additions for machines, animals, ponds and trees reached the existing consumers; the unchanged crop baseline compared equal; missing tree purchase cost and explicitly uncertain production were retained as warnings. This was a synthetic integration smoke test, not a claim that a particular installed mod pack or private save was verified. Manual in-app testing remains necessary before a release.
