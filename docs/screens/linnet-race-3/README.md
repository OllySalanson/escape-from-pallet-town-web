# LINNET's race, round three

A third fresh designer played round two; what changed (`src/game/world/races.ts`):

| picture | what it shows |
| --- | --- |
| `1-the-floor-to-chase.png` | a save with a GOLD: the chip shows the floor, PERFECT 0:09.3 (down the woodcutter's ride and straight through the reeds - only a Repel makes it more than a dice roll), and the cool-washed ghost of the best run ahead in the meadow |
| `2-silver-at-the-line.png` | the pennant now stands off the planks, against the house front, behind whoever is crossing |

Made on a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite build`, served under
`/escape-from-pallet-town-web/`) at `?testmode=pixels`, 1200x768, stepped at 60fps:
`node tools/playtest/race.mjs "$URL" --pixels --line=cut --opened=greystone-vale/door-2 --slow=1000 --shot-every=1500 --record-in=best.json --shot=out`.
