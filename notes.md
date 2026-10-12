# Play-and-fix notes (night 4)

One finding a fix, each with a behavioural test.

## 1. Viridian's flower girl described the wrong hunter (playtest 6, B1)

- **Found:** the flower girl in Viridian City (48,47) said "A trainer in a dark jacket was asking after you. He said he would catch you up..." The hunter rotates every raid through Blue, Misty, Lt. Surge, Koga and Sabrina (`rivalForRaid`), so four raids in five she described somebody who was not coming, and on Misty's and Sabrina's raids she had the wrong pronoun too.
- **Reproduced:** through the real `WorldScene.tryInteract` on the authored entity, on a raid hunted by each of the five rivals (`src/game/scenes/townsfolkRival.test.ts`): every one got the dark jacket and "he".
- **Fixed:** a townsperson's line may say `RIVAL_NAME` (`{RIVAL}` in `world/npcs.ts`), and `spokenLines` fills in this raid's rival when the line is said. Her lines are now "MISTY was asking after you - something about catching you up once you had set off." / "It did not sound like a friendly visit to me." - no looks, no pronoun.
- **How a player meets it:** drop into Viridian City, talk to the girl by the flower beds, and she names the hunter who will actually turn up this raid - a fair warning of who to expect.

## Checked and already fixed (skipped)

Playtest 45: findings 1 (Poké Ball stepper reach), 2 (teaching Pidgey now Lv 2), 3 (forced switch line), 4 (ranger forecast after the hunter is beaten - `hunterForecastLine` takes `defeated`), 5 (battle cursor remembered: `lastMainCommand`, `lastMoveOf`).

## Still open from playtest 6 (candidates for later iterations)

- B2: TM13 Ice Beam still says "The only Ice move there is" (`items/items.ts`, `pokemon/moves.ts`).
- B6: the MORE strip counts every button (`SCROLL_ENTRIES = 'button, .px-empty'` in `MenuOverlay.ts`) - check whether stepper rows still double.
- B9: Lass Ada says "Going up to Viridian?" inside Viridian City (`world/trainers.ts`).
