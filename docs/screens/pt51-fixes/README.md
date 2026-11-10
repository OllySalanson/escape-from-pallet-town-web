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
| 3 | The DERBY race at half the frame rate | `03-before-derby-fps.png` | the table below | `derbyFrames.mjs` (normal build, real speed) |
| 4 | A dialogue box holding one stray word | `04-before-*.png` | `04-after-*.png` (the golden plinth's first box now ends at its sentence; the second is "VALE SECRETS, it says on the spine.") | `greatLibrary.mjs`, `treasureHunt.mjs` |
| 5 | The field one pile at the start, yours hard to find | `05-before-derby-start-pile.png` | `05-after-derby-start-grid.png` | `derbyLevels.mjs` |
| 6 | The wallet read as the payout | `06-before-wallet-as-payout.png` | `06-after-you-hold.png` | `outdoorGames.mjs --team=unsuited` |
| 7 | AGAIN raced the next course | `07-before-again-races-the-next.png` | `07-after-race-the-sands.png` | `derbyLevels.mjs` |
| 8 | The DERBY board answered from its middle tile only | `08-before-board-post.png` | `08-after-board-post.png` | `pt51Checks.mjs` |
| 9 | The book screen's labels across its panels | `09-before-book-foot.png` | `09-after-book-foot.png` | `greatLibrary.mjs` |
| 10 | THE CHART ROOM's way out unsaid; captions off the room; the bottle at night | `10-before-*.png` | `10-after-*.png` | `pt51Checks.mjs` |
| 11 | A dusk raid unlabelled | `11-before-dusk-chip.png` | `11-after-dusk-chip.png` | `raid.mjs --clock=dusk` |
| 12 | The way-mark over THE DIG's sign | `12-before-chevron-on-dig-sign.png` | `12-after-chevron-clear-of-dig-sign.png` | `pt51Checks.mjs` |

## #3, measured

`node tools/playtest/derbyFrames.mjs <url> [--profile=out.cpuprofile]` against a
normal build (`npx vite build --base=/ --minify false`, served by `vite
preview`): ten seconds standing in the yard, then ten seconds of THE GRAND
DERBY. The profile of the race before the fix: 93% of its time native
rendering, 1-2% the game's own script, so the cause was what was drawn, not
what was worked out. With `--experiment="...setVisible(false) on the base scene"`
the race went from 21.6 to 54.6 fps: the paused harbour was being drawn under
it every frame. Before and after, back to back, on a machine other workers
were loading (compare within a pair):

| Run | Yard, still | DERBY race |
|---|---|---|
| before, 1 | 19.8 fps | 14.5 fps (median 66.6 ms) |
| after, 1 | 25.2 fps | 37.4 fps (median 16.7 ms) |
| before, 2 | 40.7 fps | 24.8 fps (median 33.3 ms) |
| after, 2 | 33.4 fps | 40.6 fps (median 16.7 ms) |

## #13, the drivers

`dojoClasses.mjs`, `greatLibrary.mjs` (fresh save and `--explorer`) and
`berryCourse.mjs` all pass again on this branch.
