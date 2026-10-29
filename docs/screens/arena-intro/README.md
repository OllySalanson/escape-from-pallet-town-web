# THE RAID ARENA's trailer

The captain, 2026-10-29: "when I walk into the gym for the first time ... there should be an epic
cutscene of me in a raid with my Charizard ... sneaking around finding pieces, then we get into a
battle and it looks like it's going to be OK but then all of a sudden we get swarmed and attacked by
the trainer. But then Charizard flies in, saves the day and we get out and we extract ... Are you
ready to take on the challenge ... book your loadout to start the raid."

It is played in the engine with the game's own art (`scenes/ArenaIntroScene.ts`; the script is
`cutscene/arenaIntro.ts`), so it is the player's own: their figure and name, their partner in the
fight, and the hunter who is after them on their next raid with that hunter's own team. It plays
unasked the first time the Arena's door is walked through and with a SKIP after; any key or click
ends it on the loadout.

`contact-sheet.png` is twelve of the beats at a third of the size.

| Picture | Beat |
|---|---|
| `01-sneak.png` | Night in Greystone Vale: up the path with the partner, picking things up. |
| `04-rustle.png` | The grass moves - a cut in at twice the size on the "!". |
| `06-hit.png` | A wild fight the partner is winning. |
| `10-swarmed.png` | Tonight's hunter, and their whole team out of the trees. |
| `13-panel-word.png` | The comic panel: the player looking up, and Charizard. |
| `15-fire.png` | Flamethrower across the clearing; the swarm scatters. |
| `17-escape.png` | The run for the exit, Charizard overhead, the clock red. |
| `19-extracted.png` | EXTRACTED, and what came home. |
| `21-ready.png` | Back at the Arena's door: the Gym Guide asks. |
| `22-loadout.png` | BOOK YOUR LOADOUT - any key, and it is the loadout. |
| `23-again-skip.png` | Every visit after the first: SKIP, bottom right. |
| `look-panel.png` | The comic panel for a player dressed at THE HARBOUR BOUTIQUE: the trailer draws them in what they wear. |

All of them are `tools/playtest/arenaIntro.mjs` against a test-mode build at the real 3x window,
which also checks that it is seen once, skipped after and ends on the loadout.
