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

## Checked and already fixed (skipped)

Playtest 45: findings 1 (Poké Ball stepper reach), 2 (teaching Pidgey now Lv 2), 3 (forced switch line), 4 (ranger forecast after the hunter is beaten - `hunterForecastLine` takes `defeated`), 5 (battle cursor remembered: `lastMainCommand`, `lastMoveOf`).

## Still open from playtest 6 (candidates for later iterations)

- B6: the MORE strip counts every button (`SCROLL_ENTRIES = 'button, .px-empty'` in `MenuOverlay.ts`) - check whether stepper rows still double.
- B9: Lass Ada says "Going up to Viridian?" inside Viridian City (`world/trainers.ts`).
- B9: the cache "secured" line is fixed (entry 3). Already fixed: the title's POKéMON accent, the MAKE A MAP hint, the defeat line-up's `×45` money (B8, now `itemCountTag`).
