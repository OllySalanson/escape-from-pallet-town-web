# The Day-Care Man and a one-Pokémon save

`before.png`: a fresh save, spoken to him at his fence. He offered to raise
"one of your Pokémon" and opened a list whose only row refused: "Oh? You only
have one Pokémon." (the PC and Day-Care bug hunt, 11 Nov 2026, finding 3).

`after.png`: the same save. He says in the yard that he cannot take it
(`dayCareTurnedAway` in `src/game/hub/dayCare.ts`), and no list opens.

Both were taken against a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite
build`) at `?testmode=pixels`, 1200x768. The after picture is
`node tools/playtest/dayCare.mjs <build url> <out dir>`, its `alone.png`.
