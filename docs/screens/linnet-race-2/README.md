# LINNET's race, round two

What a fresh designer found playing the first version, fixed (`src/game/world/races.ts`, `raceGhost.ts`):

| picture | what it shows |
| --- | --- |
| `1-racing-your-best.png` | the see-through you: your best run (here a 0:10.3 GOLD) walking its line beside you, a second ahead after a slow start |
| `2-she-knows-the-reeds-now.png` | a save with a SILVER: LINNET has learned the reeds' dry way and is right there in THE HUMMOCK, ten seconds in - only the woodcutter's ride beats her now |
| `3-gold-at-the-line.png` | over the line: the mark and time across the screen, OLD REEVE (the old toll man by the door) calling it while LINNET is still out on the course |
| `4-the-line-and-linnet-waiting.png` | the line a full tile wide with its pennant, LINNET in her own red-and-white look waiting by the bench once she has run in |

There is no before beyond `docs/screens/linnet-race/`. Made on a test-mode build of this
branch (`VITE_EPTW_TEST_MODE=1 npx vite build`, served under `/escape-from-pallet-town-web/`)
at `?testmode=pixels`, 1200x768, stepped at 60fps, by `tools/playtest/race.mjs`:

```sh
node tools/playtest/race.mjs "$URL" --pixels --line=cut --opened=greystone-vale/door-2 --record-out=best.json --shot=gold
node tools/playtest/race.mjs "$URL" --pixels --line=cut --opened=greystone-vale/door-2 --slow=1000 --shot-every=1200 --record-in=best.json --shot=ghost
node tools/playtest/race.mjs "$URL" --first        # raid one: "Get home in one piece first. THEN I'll race you."
```
