# THE BOLTHOLE, after the critic tour

The harbour critic tour of 26 Nov 2026 scored THE BOLTHOLE 5/10 downstairs and
4/10 upstairs. This change fixes what it found wrong in the house's words, and
the decorating refusals that named the wrong thing.

`before/` is the critic's own pictures, on `main` at `4391c17e`. `after/` is
this change, played with `tools/playtest/ai-player/act` on a test-mode build.
It used `act start --rebuild --harbour=local --save=<file>`, the critic's
mid-game save with the shared harbour on, as a real player has it. Test mode
draws with the cheap renderer, so water and grass have no tint.

| What | Before | After |
|---|---|---|
| The sign by the door reads its own words, then offers the name screen (with words of its own) instead of an order nothing follows | `before/1-sign.png` | `after/1-sign-asks-for-a-name.png`, `after/1-sign-name-screen.png` |
| The telly's headline fits one box | `before/2-telly-split.png` | `after/2-telly-one-box.png` |
| The bed sends only a hurt team to NURSE JOY ("You feel rested. So does IVYSAUR.") | `before/3-bed.png` | held by `homeLines.test.ts`; seen in play on the mid-game save |
| A table over the door mat says KEEP THE DOOR MAT CLEAR, and a piece walling in the stairs blames THE STAIRS | `before/4-table-over-mat.png`, `before/5-blames-pennants.png` | held by `arrangement.test.ts` and `decorating.test.ts` |
| A string of one pennant is not "1 of 1" | `before/6-pennants-one-of-one.png` | `after/6-pennants.png` |
| The box is named on the hint line and the panel says "7 THINGS IN YOUR BOX" | (from the review) | `after/7-decorate-box-hint.png` |
