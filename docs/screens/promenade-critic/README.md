# THE PROMENADE, after the critic tour

The harbour critic tour of 26 Nov 2026 scored the east of THE HARBOUR 5/10.
The worst problems:

- THE DIG paid out `sand-ornament`, an id no item or furniture had.
- THE FISHING DERBY threw its own result away: the SPACE still being pressed
  at the buzzer started a new derby.
- Signs and people promised things the game never does.

`before/` is the critic's own pictures, on `main` at `4391c17e`. `after/` is
this change, played with `tools/playtest/ai-player/act` on a test-mode build,
on the critic's mid-game save. Test mode draws with the cheap renderer, so
water and grass have no tint.

| What | Before | After |
|---|---|---|
| THE DIG's top find is a real SAND ORNAMENT: Emerald's own decoration, cut by `scripts/cut-home-furniture.mjs`, placed in THE BOLTHOLE like any furniture | `before/1-dig-pays-an-id.png` | `after/1-sand-ornament-icon.png` (its bag icon); held by `outdoorGames.test.ts` and `furniture.test.ts` |
| A game's end puts the cursor on who played, never on AGAIN, and AGAIN takes no press for a moment | `before/2-derby-result-lost.png` | `after/2-result-stays-cursor-on-picker.png` (THE DIG; the derby shares the scene) |
| THE GARDENS promise no band | `before/3-gardens-band.png` | "THE GARDENS / Sit a while. Mind the beds." (seen in play) |
| The coin telescope answers | `before/4-telescope-dead.png` | `after/4-telescope-answers.png` |
| "A tally of 60 pays 10 tickets" is said only to a day that has paid nothing | `before/5-first-tier-after-paid.png` | held by `tickets.test.ts` |
