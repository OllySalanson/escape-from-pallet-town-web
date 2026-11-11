# The partner's own place

The captain's call of 11 Nov 2026 (option B): the partner - the starter, at any
stage of its line - has a protected place of its own beside the secure
container. It takes none of the container's squares or slots, and no wipe takes
it. Every other Pokémon's risk is what the container makes it, as before.

The hunt of that day (finding 1) found the fault on the normal path of play: a
starter evolves at level 16, a Charmeleon is six squares against the 2x2
container every save starts with, the container filled itself with a level-6
Rattata, and a raid lost to the clock deleted the partner. A Charizard is nine
squares, and the container only ever grows columns, so nothing could ever
protect one.

## Before (the hunt's own pictures, `main` at `757d3351`)

| | |
|---|---|
| ![The rim card: "A wipe: Charmeleon (your partner): lost for good". Safe: Rattata.](before-rim.png) | ![The locker: a Charizard needing 9 squares of a 4x2 container.](before-locker.png) |
| ![The result: "You lost Charmeleon... The secure slot held Rattata." Charmeleon is GONE.](before-result.png) | |

## After

| | |
|---|---|
| ![The locker: CHARMELEON with a PARTNER tag above the Rattata, which has the container.](after-locker.png) | ![The partner's row pressed: "CHARMELEON is your partner, so it has a place of its own: a wipe never takes your partner, and it needs no room in the container."](after-locker-partner-pressed.png) |
| ![The rim card: Safe: Charmeleon (your partner), Rattata. No "A wipe" line.](after-rim.png) | ![The raid's pack: a PARTNER window under the squares, "Your partner. A wipe never takes it." SAFE.](after-raid-pack.png) |
| ![The result: "Charmeleon, your partner, came home with you. The secure slot held Rattata." A PARTNER row, SAFE, above the secure slot.](after-result.png) | |

## How they were made

`tools/playtest/partnerPlace.mjs` against a test-mode build
(`VITE_EPTW_TEST_MODE=pixels npx vite build`, served under the Pages subpath as
`tools/playtest/README.md` says), on stepped frames in one headless Chromium at
`PIXEL_WINDOW`. It starts a new game with a Charmander, edits the save to a
level-16 Charmeleon partner and a level-6 Rattata with no locker built, puts
both on the bench, opens the locker and the rim, jumps, opens the pack, runs the
raid clock out, photographs the result and reads the save: the partner is still
in the vault and still marked, and the Rattata the container held came home too.
