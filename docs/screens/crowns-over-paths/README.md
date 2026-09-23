# Tree crowns off walked ground

A tree's crown is drawn over the figures, so a walkable tile under one hides
whoever stands on it. The map expansions carved lanes along the lattice's crown
rows and left about two hundred such tiles across the four maps; the catch-up
page of 2026-09-23 found one at Route 1 52,40. `src/game/world/crowns.test.ts`
now fails any of them, on every map and in every gate state.

Each pair is the same tile before (`main` at f3b726c) and after, with the player
placed on it. Taken at 1x in `LOGIC_WINDOW` against a `VITE_EPTW_TEST_MODE=1`
build (see 'Memory' in `tools/playtest/README.md` for why not the dev server),
then doubled. Loot is re-seated every raid, so a Poke Ball or a potion moving
between the two frames is not the change.

| | |
|---|---|
| `route1-steading.png` | The captain's finding: THE STEADING yard at 53,40. Before, only the chevron shows above the crown. After, the lane is edged in thicket and the trees stand one row back. |
| `route1-drove.png` | THE DROVE at 40,64, an eight-tile run that was all under crowns. |
| `floodplain-lane.png` | The Floodplain's longest lane under crowns, row 56 from 72 to 91. It hid a sign and a townsperson as well as the player. |
| `floodplain-south.png` | 36,88, where the crowns hid a ford as well as the player. |
| `viridian-east.png` | Viridian's east wood at 56,52, beside the trainer's watch. |
| `viridian-west.png` | Viridian's west wood at 14,42. |
| `pallet-east.png` | Pallet's east lobe at 53,48, under the dug rows. |
| `pallet-mill.png` | Pallet at 41,26, beside the millpond sluice. |

Two faults the frames show that this change did not cause and does not fix:
the second pine (`pineAlt`, cut from `TREE_PINE_B`) carries a darker grass
square baked into its tiles, which reads as a box on Pallet's thicket; and the
Floodplain's field generator seats single-tile ford gaps in its hedges (row 86
near x 44), which read as light squares.
