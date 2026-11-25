# LINNET's race: THE MERE DASH

A townsperson who says "I'll race you!" (`src/game/world/races.ts`). LINNET stands by the
alley below Mill Square from a save's second raid, asks "Do you want to race LINNET to THE
LAST HOUSE?" after saying where the line is and what each finish pays, counts 3-2-1-GO and
runs her road - the lane and the whole boardwalk round the mere - at the player's own pace.

| picture | what it shows |
| --- | --- |
| `1-the-question.png` | the captain's question, after the offer |
| `2-go.png` | GO!, the race chip (clock, where LINNET is, the line's bearing) |
| `3-the-woodcutters-ride.png` | five seconds in, coming down the woodcutter's ride: the new gap in Millbrook's pines a Cut tree keeps shut, into the reeds |
| `4-gold-and-the-purse.png` | over the chequered line at THE LAST HOUSE's door in 0:10.2: GOLD, and the day's purse - a stone of the player's choosing |

There is no before: nothing stood here. Made on a test-mode build of this branch
(`VITE_EPTW_TEST_MODE=1 npx vite build`, served under `/escape-from-pallet-town-web/`)
at `?testmode=pixels`, 1200x768, stepped at 60 frames a second by

```sh
node tools/playtest/race.mjs "$URL" --pixels --line=cut --opened=greystone-vale/door-2 --stone=2 --shot=out
```

The same driver's other lines, played on the dev server in test mode:

| line | steps | result |
| --- | --- | --- |
| `--line=road` (a newcomer following her) | 153 | lost by 0.2s, 0:22.9, P10 and "the reeds have a dry way" |
| `--line=dry` (the reeds' dry way) | 104, 5 wild | won by 7.2s, 0:15.6 SILVER, P30 and a word about the ride |
| `--line=wade` (straight through the reeds) | 102, 27 wild | fought on the way and lost by 4.0s, P10 and "I don't stop while you fight" |
| `--line=cut` with the ride open | 68 | 0:10.2 GOLD, P30, the Silver Shield and a stone |
