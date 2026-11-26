# BILL'S COTTAGE, after the critic tour

The harbour critic tour of 26 Nov 2026 scored BILL'S COTTAGE 5/10: "The
cabinet of oddities is the best idea in the harbour. Bill misquotes his own
rules twice." This change makes him say his rules as the code keeps them, and
fixes the shop's worst slips.

`before/` is the critic's own pictures, on `main` at `4391c17e`. `after/` is
this change, played with `tools/playtest/ai-player/act` on a test-mode build
(`act start --rebuild --save=<file>`): the critic's new-player save (a
stranger with ₽0) and its ₽4000 mid-game save (a regular). Test mode draws with
the cheap renderer, so water and grass have no tint.

| What | Before | After |
|---|---|---|
| A stranger is told what it really takes: 3 jobs or 2 bosses, not "a boss" | `before/1-stranger-question.png` | `after/1-stranger-question.png` |
| The Locker shelf shows its padlock and tier, as every locked card does (seen as `LOCKER SHELF LOCKED REGULAR` in the screen's text; the card is below the fold at this window size) | `before/2-locker-shelf-no-padlock.png` | `after/2-list.png` |
| After a purchase the cursor stays on the card bought | `before/3-cursor-jumps-after-buy.png` | `after/3-cursor-stays-after-buy.png` |
| A regular hears what a regular gets | (from code) | `after/4-regular.png` |
