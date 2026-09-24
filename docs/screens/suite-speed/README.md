# Suite speed

The test suite went from three or four minutes to fifteen as the maps grew four
times over. Nearly all of it was one file, `mapStructure.test.ts`: every rule a
map is held to, asked from every tile of every map in every gate state, run end
to end on a single worker while the other cores sat idle. On `main` at
`c71d070` it took 911 seconds of CI on its own.

Nothing was sampled, skipped or loosened to get it back. What changed:

- **The structure rules are split into files** (`mapStructure.testkit.ts`, one
  `mapStructure.*.test.ts` per map and per third of the Floodplain's gate
  states), because vitest runs files side by side but the tests inside one file
  in turn. `mapStructure.test.ts` now fails any gate state that no file asks
  about, so a new map cannot be silently missed.
- **The hunter's whole-map searches read typed arrays**, and a caller that asks
  the same fixed map from every tile hands them `collisionBlocker(collision)`,
  which reads the grid once and gives every search a neighbour table.
- **Work that does not depend on the loop leaves the loop.** A flee's searches
  are done once for all four headings (`planHunterBreakaway`), raid generation
  no longer rescans every map with a string lookup per tile, and sweeps of
  thousands of raids gather their faults and assert once instead of calling
  `expect` hundreds of thousands of times.

## Before and after

| | main (`c71d070`) | this branch |
|---|---|---|
| CI unit tests step | 15m 06s | 1m 05s |
| CI whole job (lint, typecheck, tests, build) | 15m 54s | 1m 37s |
| `mapStructure` in CI | 911s, one file | six files, the largest 35s |
| Local, 2 workers, whole suite | not measured | 123s wall |
| Test files / tests | 162 / 2700 | 168 / 2707 |

The seven extra tests are the split's own guard: one that every gate state of
every map is asked about exactly once, and one per file that it really does ask.

## Proof that the game did not change

These three screens are from the branch, with the raid's randomness pinned to
seed 7, at 3x (`?testmode=pixels`, a test-mode build, real key events). The same
script on a build of `main` produced **byte-identical** PNGs: the hunter arrives
on the same tile, and after the flee falls back to the same tile, six steps off.

| | what it shows |
|---|---|
| `01-hunter-arrives-1200x768.png` | Blue arriving: the spawn search (`findHunterSpawnTile`) |
| `02-caught-1200x768.png` | Walking into the hunter starts the fight the flee is bought from |
| `03-hunter-falls-back-1200x768.png` | After the flee: the fall-back tile (`findHunterBreakawayTile`) and the search window |

Besides the screens, the old and new code were compared directly: every hunter
search (spawn, pursuit, doors, flee, every heading) from a fifth of the tiles of
every map in every gate state, 318,780 comparisons with no difference; 2,880
raid plans and 447 standing boards compared with `main`'s generator, identical;
and `raid.mjs --seed=7`, `--seed=11` and `--seed=9 --insertion=viridian-forest`
played the same raid, line for line, on both builds.
