# The endgame bug hunt, fixed

What the endgame bug hunt of 12 Nov 2026 found, before and after. The `before-` pictures are the hunt's own, taken on a test-mode build of `main` at #514. The `after-` pictures were taken on the dev server at `?testmode=pixels` in a 1200x768 window. The legend's throw starts a battle straight from the game's modules: a level-100 Mewtwo against a level-50 legendary Zapdos, as `tools/playtest/sendOutShots.mjs` starts its fight. The TRADER's pictures come from a save seeded in the page with an Abra, a Kadabra, a Golduck, a Haunter, a Spearow and a Pidgey. The player stands below him on the lawn.

## A beaten legend's one throw

- `before-one-throw-opens-on-poke-ball.png`: the list opened on the weaker ball.
  `after-zapdos-one-throw-opens-on-great-ball.png`: it now opens on the best ball carried (`bestBallIndex`).
- `before-one-esc-and-it-fled.png`: one ESC on the list let ZAPDOS go.
  `after-zapdos-esc-asks-let-go.png`: ESC now asks "Let ZAPDOS go?", with the cursor on NO. NO, or a second ESC, goes back to the list.
- `before-full-pack-keep-ends-it.png`: with a full pack, the panel opened on KEEP THE PACK. Its line read "The catch is off", and one more press ended the fight.
  `after-full-pack-keep-says-zapdos-leaves.png`: the line now says the legend gets away.
  `after-full-pack-keep-asks-let-go.png`: choosing KEEP THE PACK asks the same question, on NO, so two quick presses lose nothing.

## THE TRADER

- `after-trader-says.png`: on the lawn behind the RAID ARENA, in FireRed's own words. His first open trade is MIMIEN the MR. MIME, for an ABRA.
- `after-trader-list.png`: his list. It shows every Pokémon at base. The ones he would trade for come first, each tagged TRADE (one of his nine) or AND BACK (the trade that evolves it). The rest say why not.
- `after-trader-asks.png`: a trade of his is for good, so the row asks before he makes it.
