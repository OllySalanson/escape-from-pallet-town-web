# Moves in FireRed's own words

Churchyard critic, round 3 (26 Nov 2026), and Olly's rule that the game says things its own way: every move's description was written from its row as a rule ("Lowers the target's Attack by one stage."), and the fight's move list showed it under every status move. Now:

- every move is described in FireRed's own words, read out of pret/pokefirered's `src/move_descriptions.c` (`tools/moves/frlgMoveDescriptions.mjs`): Growl is "The user growls in a cute way, making the foe lower its ATTACK stat.", Lick "The foe is licked and hit with a long tongue. It may also paralyse.". The summary screen and the move chooser show it, as FireRed's summary does;
- the fight's move list shows a move's type, PP and matchup and no description, as FireRed's fight does - a status move's second line is empty unless an ability refuses it.

| | before | after |
|---|---|---|
| FIGHT, on GROWL | `before/3-moves.png`: "NORMAL · STATUS · PP 30/30" over "Lowers the target's Attack by one stage." | `after/3-moves.png`: "NORMAL · STATUS · PP 30/30" alone |

Made with `node tools/playtest/battleLines.mjs <url> <dir> --hp=25 --move=GROWL --moves` against a test-mode build of each (`VITE_EPTW_TEST_MODE=pixels npx vite build --outDir <dir> --base=/`, served as static files).
