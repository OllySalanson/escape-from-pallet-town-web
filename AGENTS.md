# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Project notes

- The overworld's tile collision is built by `buildCollisionData()` in `src/game/worldMap.ts`; interactive NPC and sign definitions live in `src/game/world/npcs.ts`.
- Active raid scene data is defined by `ActiveRunSession` in `src/game/run/RunSession.ts` and must pass unchanged between `WorldScene` and `BattleScene`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
