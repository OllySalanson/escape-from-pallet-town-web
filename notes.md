# Play-and-fix notes (night 4)

One finding a fix, each with a behavioural test.

## 1. Viridian's flower girl described the wrong hunter (playtest 6, B1)

- **Found:** the flower girl in Viridian City (48,47) said "A trainer in a dark jacket was asking after you. He said he would catch you up..." The hunter rotates every raid through Blue, Misty, Lt. Surge, Koga and Sabrina (`rivalForRaid`), so four raids in five she described somebody who was not coming, and on Misty's and Sabrina's raids she had the wrong pronoun too.
- **Reproduced:** through the real `WorldScene.tryInteract` on the authored entity, on a raid hunted by each of the five rivals (`src/game/scenes/townsfolkRival.test.ts`): every one got the dark jacket and "he".
- **Fixed:** a townsperson's line may say `RIVAL_NAME` (`{RIVAL}` in `world/npcs.ts`), and `spokenLines` fills in this raid's rival when the line is said. Her lines are now "MISTY was asking after you - something about catching you up once you had set off." / "It did not sound like a friendly visit to me." - no looks, no pronoun.
- **How a player meets it:** drop into Viridian City, talk to the girl by the flower beds, and she names the hunter who will actually turn up this raid - a fair warning of who to expect.

## 2. Two discs promised things the 151 made false (playtest 6, B2)

- **Found:** TM13's description said Ice Beam was "The only Ice move there is", read on the teach screen and in the pack, when the roster now has Aurora Beam, Blizzard, Ice Punch, Icy Wind, Icicle Spear and Powder Snow. Checking every disc turned up a second: TM09 said "Only the Bulbasaur line can read it", while FireRed lets Oddish, Paras, Bellsprout, Exeggcute, Tangela and Mew read Bullet Seed too - a player holding a Gloom would think the disc useless to them. (The "A Ice"/"A Electric" half of B2 is already fixed in the generated catalogue.)
- **Reproduced:** `machines.test.ts` now holds every disc's description against the roster - a "the only X move" claim against every move in play, an "only the X line" claim against `canLearnFromMachine` - and both failed (seven Ice moves; twelve readers outside the Bulbasaur line). `teachScreen.test.ts` checks the words on the teach screen itself.
- **Fixed:** TM13 now reads "a beam of cold that may freeze. Grass, Ground, Flying and Dragon foes all fear it."; TM09 "two to five seeds in one turn. Mostly Grass Pokémon can read it." The stale code comments on Ice Beam, Aerial Ace ("the one move that cannot miss" - Swift and Feint Attack cannot either) and the Bullet Seed loot row were corrected too.
- **How a player meets it:** pick up a TM in a raid, open the pack or read it, and the description no longer tells you something untrue about who can use it or what else exists.

## 3. A cache said "secured" for loot a wipe takes (playtest 6, B9)

- **Found:** working a cache said e.g. "TOWN PUMP: 2× Potion + 1× Antidote secured. Detour reward is LOST ON WIPE - extract to bank it." "Secured" is the secure container's word, and a cache never fills it - the payout goes into the pack, which a wipe takes - so the line contradicted itself. A landmark that opens an exit said "... secured. Extract to bank it." the same way.
- **Reproduced:** through the real `WorldScene.tryActivatePoiAt` on Pallet Town's TOWN PUMP and the locked KILN STRONGBOX (`src/game/scenes/locksAndKeys.test.ts`, "what a cache says it did"): both lines said "secured".
- **Fixed:** the line is `cachePayoutLine` in `world/pois.ts`, beside the cache's refusal line: "TOWN PUMP: 2 Potions and 1 Antidote went into the PACK. Lost if you wipe - extract to bank them." Amounts are written by `itemAmountFor`, as every other sentence about items is (no "2× Potion"). A landmark that opens an exit says "... went into the PACK - extract to bank it." under its "EXIT is open." line. `pois.test.ts` holds that no shipped landmark's payout line says "secured".
- **How a player meets it:** walk onto any cache in a raid; the message now says the goods are in your pack and at risk until you extract, rather than calling them secured.

## 4. The MORE strip counted buttons, not rows (playtest 6, B6)

- **Found:** a scrolling list's MORE strip counts what is below the fold, and it counted every button. A supply in the loadout or the secure container is one row with a minus and a plus in it, and a row on Bill's shelf is a row button beside a count selector, so those lists said more than was there: at the smallest stage (960x720 window) Oak's loadout read **30 MORE** over 25 hidden rows.
- **Reproduced:** in the browser with `tools/playtest/menuShots.mjs --window=960x720`, which now compares each pane's `N MORE` against the rows actually below its fold and fails on `MORE MISCOUNTED` (it printed `30 MORE over 25 rows` for the loadout). The tool also seeds every keeper's errand as already asked: Joy asking about her medicine bag stood over the Pokémon Center, so the tool's Escape only put that down and the run timed out walking to Brock.
- **Fixed:** `scrollEntries` in `ui/MenuOverlay.ts` counts one entry per row - a `.px-pair` first (its row button is itself a `.px-row`), else a `.px-row`, else the control on its own. `resultLedger.test.ts` holds seven supply rows with two steppers each plus one shelf pair and one button to `9 MORE`; the first draft counted the shelf pair twice and the test caught it.
- **How a player meets it:** open Oak's Lab and start preparing a raid on a small window; the strip under the supplies now says how many rows are really down there.

## 5. An errand's thing dropped for room was reported as a wipe (newest feature: errands)

- **Found:** an errand's thing (Oak's parcel, Joy's medicine bag, Brock's crate, Bill's amber) can be picked up and then put down for good - the pack's "Drop one", or the battle's make-room list for a catch. Walk out after that and the result screen said nothing about it at all, and back at base the giver asked after it as if the raid had been lost: Brock "You had my crate, and the raid went down with it?", Bill "your pack went down with it?", Oak and Joy "lost with your pack?". The pickup is written to the save the moment it happens (`recordErrandFound`), so `errandBeat` rightly asks - only the words were wrong.
- **Reproduced:** through `RunManager` and `buildExtractionReport` (`extractionReport.test.ts`, 'what became of an errand'): a raid that registered the crate as found and then banked nothing (escaped) or lost nothing with the pack (wiped) had no errand line, and every giver's `lost` words named the pack going down. Both tests failed before the fix.
- **Fixed:** `errandLines` also reads `snapshot.foundItems` and says "BROCK'S CRATE was left behind - Brock will want to hear" for an errand thing found this raid that is neither banked, secured nor lost with the pack (a real wipe's ledger holds everything in the pack, so this only speaks of a drop). The four `lost` speeches now say "it never made it home/back?", which is true of a wipe and a drop alike. `tools/playtest/errands.mjs` expects Oak's new words.
- **How a player meets it:** take Brock's crate, drop it to make room for a better find, and walk out: the result screen tells you it was left behind, and Brock asks after it without accusing you of wiping.
- **Also:** `menuShots.mjs`'s ROW CUT on the drop-in brief at 960x720 was the tool's fault, not the screen's: the "cut" row was a wrapped note whose blank top padding alone (2 game pixels) sat above the MORE strip, and its text starts exactly at the fold. The audit now measures from inside a row's top padding; the run is clean at 960x720.

## Checked and already fixed (skipped)

Playtest 45: findings 1 (Poké Ball stepper reach), 2 (teaching Pidgey now Lv 2), 3 (forced switch line), 4 (ranger forecast after the hunter is beaten - `hunterForecastLine` takes `defeated`), 5 (battle cursor remembered: `lastMainCommand`, `lastMoveOf`).

## Still open from playtest 6 (candidates for later iterations)

- B9: Lass Ada says "Going up to Viridian?" inside Viridian City (`world/trainers.ts`).
- B9: the cache "secured" line is fixed (entry 3). Already fixed: the title's POKéMON accent, the MAKE A MAP hint, the defeat line-up's `×45` money (B8, now `itemCountTag`).
