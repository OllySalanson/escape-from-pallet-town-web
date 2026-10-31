# THE RAID ARENA's trailer

The captain, 2026-10-29: "when I walk into the gym for the first time ... there should be an epic
cutscene of me in a raid with my Charizard ... sneaking around finding pieces, then we get into a
battle and it looks like it's going to be OK but then all of a sudden we get swarmed and attacked by
the trainer. But then Charizard flies in, saves the day and we get out and we extract ... Are you
ready to take on the challenge ... book your loadout to start the raid."

It is played in the engine with the game's own art (`scenes/ArenaIntroScene.ts`; the script is
`cutscene/arenaIntro.ts`), so it is the player's own: their figure and name, their partner in the
fight, and the hunter who is after them on their next raid with that hunter's own team. It plays
unasked the first time the Arena's door is walked through. After that the door goes straight to the
hall, and the Gym Guide beside it asks WATCH THE REEL AGAIN? once he has said the day's work, which
plays it with a SKIP. Any key or click ends it in the hall.

`contact-sheet.png` is twelve of the beats at a third of the size.

| Picture | Beat |
|---|---|
| `01-sneak.png` | Night in Greystone Vale: up the path with the partner, picking things up. |
| `04-rustle.png` | The grass moves - a cut in at twice the size on the "!". |
| `06-hit.png` | A wild fight the partner is winning. |
| `10-swarmed.png` | Tonight's hunter, and their whole team out of the trees. |
| `13-panel-word.png` | The comic panel: the player looking up, and Charizard. |
| `15-fire.png` | Flamethrower across the clearing; the swarm scatters. |
| `17a-hold.png` | Charizard stays behind and pins the hunter off the road while the two of them run past. |
| `17b-takeoff.png` | The hunter breaks out, and Charizard takes off after them. |
| `17c-chased.png` | The hunter on the road behind them, Charizard coming up over the trees. |
| `17d-wall.png` | Fire across the road at their heels, hedge to hedge, with the hunter on the wrong side. |
| `17e-overhead.png` | Charizard over their heads and away, its job done. |
| `18-look-back.png` | At the way out they look back; the hunter shouts across the fire. |
| `19-extracted.png` | EXTRACTED, and what came home. |
| `21-ready.png` | Back at the Arena's door: the Gym Guide asks. |
| `22-loadout.png` | BOOK YOUR LOADOUT - any key, and it is the loadout. |
| `23-again-skip.png` | Asked for from the Gym Guide: SKIP, bottom right. |
| `look-panel.png` | The comic panel for a player dressed at THE HARBOUR BOUTIQUE: the trailer draws them in what they wear. |

All of them are `tools/playtest/arenaIntro.mjs` against a test-mode build at the real 3x window,
which also checks that it is seen once, that the door goes straight in after that, and that the Gym Guide runs it again.

Charizard's part in the run was redrawn on the captain's note of 2026-10-30, that in the last quarter it
"just follows you, flying behind you": it was pinned to the player at a fixed offset, doing nothing,
while the hunter's chase ran through the player. Now the escape is something it buys. `--every=FROM:TO:STEP`
on the driver photographs a stretch of the trailer at a step, which is how that was watched.
