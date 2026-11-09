# Playtest 51's fixes

Before and after pictures for the twelve ranked fixes of playtest 51 (played on
`main` at 83e17fa9, the THE TREASURE MAP merge). Every `*-before-*` picture is
the playtest's own, taken on that commit; every `*-after-*` picture is this
change, taken the same way: a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite
build --base=/`) at 1200x768 in one headless Chromium, driven by the drivers
named beside each.

| # | Finding | Before | After | Driver |
|---|---|---|---|---|
| 1 | A harder DERBY level paid nothing after an easier one had | `01-before-derby-level-4-result.png` | `01-after-derby-level-4-result.png` | `derbyLevels.mjs` |
| 2 | The smugglers' chest graded "YOU SCRAPED OUT." | `02-before-chest-scraped-out.png` | `02-after-chest-headline.png` | `treasureHunt.mjs`, `raid.mjs --grab=sea-chest` |
| 3 | The DERBY race at half the frame rate | `03-before-derby-fps.png` | the table below | `derbyFrames.mjs` |
| 4 | A dialogue box holding one stray word | `04-before-*.png` | `04-after-*.png` | `greatLibrary.mjs`, `treasureHunt.mjs` |
| 5 | The field one pile at the start, yours hard to find | `05-before-derby-start-pile.png` | `05-after-derby-start-grid.png` | `derbyLevels.mjs` |
| 6 | The wallet read as the payout | `06-before-wallet-as-payout.png` | `06-after-you-hold.png` | `outdoorGames.mjs --team=unsuited` |
| 7 | AGAIN raced the next course | `07-before-again-races-the-next.png` | `07-after-race-the-sands.png` | `derbyLevels.mjs` |
| 8 | The DERBY board answered from its middle tile only | `08-before-board-post.png` | `08-after-board-post.png` | `pt51Checks.mjs` |
| 9 | The book screen's labels across its panels | `09-before-book-foot.png` | `09-after-book-foot.png` | `greatLibrary.mjs` |
| 10 | THE CHART ROOM's way out unsaid; captions off the room; the bottle at night | `10-before-*.png` | `10-after-*.png` | `treasureHunt.mjs`, `pt51Checks.mjs` |
| 11 | A dusk raid unlabelled | `11-before-dusk-chip.png` | `11-after-dusk-chip.png` | `raid.mjs --clock=dusk` |
| 12 | The way-mark over THE DIG's sign | `12-before-chevron-on-dig-sign.png` | `12-after-chevron-clear-of-dig-sign.png` | `pt51Checks.mjs` |
