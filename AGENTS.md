# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Update this file in the same change whenever work adds a subsystem, changes where something is registered, or contradicts a note below. This is part of finishing the task, not optional cleanup.

## Project notes

- The overworld's tile collision is built by `buildCollisionData()` in `src/game/worldMap.ts`; interactive NPC and sign definitions live in `src/game/world/npcs.ts`.
- Active raid scene data is defined by `ActiveRunSession` in `src/game/run/RunSession.ts` and must pass unchanged between `WorldScene` and `BattleScene`.
- The raid field guide is `ObjectivesScene` in `src/game/scenes/ObjectivesScene.ts`; derive its objective text from `buildObjectiveGuide()` in `src/game/objectives/ObjectiveGuide.ts`, and have it resume only the `WorldScene` instance it paused.
- Scenes are registered in `src/game/gameConfig.ts`, not `main.ts`.
- Both starter selection surfaces (`StarterScene` and `HubScene`'s `reselect` view) share their markup through `src/game/ui/starterPicker.ts`; the reselection rule itself is `Stash.swapStarter()`, and `SaveManager.reselectStarter()` also rewrites `starterSpeciesId` so later wipe re-grants follow the new choice.
- Background music is intentionally off for playtesting: `SILENCE_BACKGROUND_THEMES` in `src/game/audio/AudioManager.ts` makes `startTheme()` a no-op while sound effects keep playing. Flip it to `false` to restore the music; leave the scene `startTheme` calls alone.
- Every path back into play after a wipe must leave the player able to attempt a run: `MINIMUM_SUPPLIES` and `Stash.restockMinimumSupplies()` in `src/game/stash/Stash.ts` own that guarantee, and `Stash.ensurePlayable()`, `Stash.swapStarter()` and `SaveManager.applyWipeLoss()` all route through it. It only ever tops up the shortfall, so it never removes anything and cannot be farmed.
- Deployment is a stepped route owned by `DeploymentFlow` in `src/game/hub/deploymentFlow.ts`: base → loadout (secure slot is a detour) → final check → raid. `HubScene` renders the steps; only `deploy()` on a confirmed flow yields a party, so nothing may pre-select a raid party or start a run from an earlier step.
- `Pokemon` has no `cureStatus()` method; clear a status by setting `primaryStatus` to null directly, which `SaveManager` saves and restores.
- Battle data is ported from the public Unity original, `OllySalanson/escapeFromPalletTown` (readable through `gh-axi api`), but the web game adds a 1.5x same-type bonus that Unity's `Pokemon.TakeDamage` has no equivalent of, and Unity fought its encounter tables with a level-10 five-strong party rather than one level-5 starter. Check that repo before treating any stat, learnset or encounter table as intentional - and re-measure early balance rather than porting a number across.
- Every species sprite is `public/assets/pokemon/{front,back}/<dexId>.png`; `spriteAssets.test.ts` enforces the format and a size bound, because a dimensionless SVG once rasterised to 150x150 and covered the battle screen.
- Battle text lives in `src/game/scenes/battlePresentation.ts` as pure functions, so message wording, move guidance and layout are testable without Phaser.
- `PALLET_TALL_GRASS` in `src/game/pokemon/encounters.ts` is shared by Pallet Town, Route 1 and the Floodplain Relay; changing it changes all three.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
