# Escape from Pallet Town Web

This is a browser rebuild of **Escape from Pallet Town**, using TypeScript, Phaser 3, and Vite.
The current milestone is a thin playable overworld slice: load into a small map and walk a player
character one tile at a time with directional animations.

The settled game vision and player-research findings are in
[Product direction](docs/product-direction.md).

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Tooling and quality gates

- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript (`tsc --noEmit`)
- `npm run test` - Vitest
- `npm run build` - production bundle

CI runs those same checks on every push and pull request.

## Milestone roadmap

- v1 (this PR): walkable overworld slice with reused original art assets
- v2: random encounters and encounter tables
- v3: turn-based battle loop
- v4: party management and switching
- v5: move system and type interactions
- v6: status conditions and battle-state effects
