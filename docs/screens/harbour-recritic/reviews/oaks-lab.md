# OAK'S LAB (on KEEPERS' ROW, door near 25,11) - score 5/10

**Verdict:** A handsome FireRed lab with a real starter table and a Pokédex that does Kanto proud, wrapped around a room that contradicts itself across six feet of floor. The wall map swears "nobody at base can tell you" what lives in the vale while Oak's PC, two steps to the left, lists eighteen places to find a Squirtle, and the wall map tells you cave Zubat live "in the tall grass". Oak himself is a gramophone: a newcomer is marched out of the door after three lines and walks back in to hear the same line again, forever, and the mid-game Oak plays the same three boxes on loop without once mentioning the job that is actually on his board.

## Problems, worst first

### 1. The Pokédex tells you where everything lives; the wall map beside it says nobody can  [kind: wrong/out-of-date]
- **Seen:** New game. THE WALL MAP close-up, WILDLIFE: "You have walked none of this map. Whatever lives here, nobody at base can tell you." Then OAK'S PC, Squirtle's page, WHERE TO FIND ONE: "Wild in THE CROSSING, THE STONE YARD, THE ANGLERS' STAGE and 15 more places". Mid-game, Pidgey (met, not owned): "Wild in THE MOOR GATE, THE MOOR CHAPEL, THE GREY STONES and 42 more places", while the wall map's wildlife only names walked places and says "113 more places on this map nobody here has walked."
- **Where / repro:** New game, choose a starter, walk back into the lab. Wall map -> ENTER -> PG DN to the end. Then OAK'S PC -> No. 007 -> ENTER.
- **Screenshot:** ../shots/oaks-lab-07-wallmap-close-end.png and ../shots/oaks-lab-09-dex-page.png
- **Why it is bad:** Two screens in the same room give opposite answers to the same question, and the wall map's whole "walk it to learn it" invitation is undone by the PC. The rule says one thing; the Pokédex leaks the survey.
- **Fix:** Pick one rule. The wall map's is the designed one (`src/game/scenes/HubScene.ts:3245-3247`, "what lives somewhere nobody has been is not something base could tell you"), so filter `pokedexSources.ts`'s wild places (`surveyOf`, `src/game/hub/pokedexSources.ts:95-126`, no walked-place filter) to places the player has reached, and say "and N places you have not walked" for the rest. Or, if the Pokédex is meant to know, change the wall map line to "Walk a place and its wildlife goes up here."

### 2. Cave wildlife "Found in the tall grass there"  [kind: wrong/out-of-date]
- **Seen:** Mid-game, wall map close-up, WILDLIFE row "GREYSTONE CAVES B1F and 3 more - Zubat 6-6 · Diglett 3-5 · Sandshrew 3-4"; its help line: "GREYSTONE CAVES B1F, GREYSTONE CAVES B2F, GREYSTONE CAVES B3F, GREYSTONE CAVES B4F: Zubat 6-6 · Diglett 3-5 · Sandshrew 3-4. Found in the tall" (and the line runs off the bottom of its box into the keys line at 400x256).
- **Where / repro:** Mid-game save, wall map -> ENTER -> ArrowDown to the last wildlife row.
- **Screenshot:** ../shots/oaks-lab-17-wallmap-wildlife-cave.png
- **Why it is bad:** There is no tall grass in a cave: a cave floor rolls on every step (`src/game/world/interiors.ts:43`, `src/game/world/districts.ts:70` "every step here rolls for wildlife, as a cave floor's does"). A newcomer who believes the help goes looking for grass that is not there. Also "Zubat 6-6" reads like a typo; a single level is "Lv 6".
- **Fix:** `HubScene.ts:3266` hard-codes "Found in the tall grass there" for every row. Say "Found on the cave floor there" for floor-rolling places and "in the tall grass" only for grass ones; print `min === max ? \`${min}\` : \`${min}-${max}\``.

### 3. Oak is a broken record, and the newcomer is shown the door  [kind: wall-of-text / other]
- **Seen:** New game: on YES, "You received SQUIRTLE from PROFESSOR OAK!", "On a raid, grab what you can and walk out through an exit.", "Every raid starts at the RAID ARENA, west across the yard." and the player is put out into the yard without a step. Walk back in, talk to Oak: "Off you go! The RAID ARENA is west across the yard. Grab what you can, and get out." Talk again, four more times: the identical line. Mid-game: "Walk to MOOR TOP on a raid, and you can land there next time." / "And when you're ready, the next gym: KOGA, at FUCHSIA GYM in TANGLEWOOD." / "My board by the wall has 2 notices on it. Have a read!" on every single talk, word for word.
- **Where / repro:** Any save, talk to PROFESSOR OAK twice.
- **Screenshot:** ../shots/oaks-lab-12-oak-mid.png
- **Why it is bad:** The professor has no second thing to say, ever. The newcomer is ejected (`BaseScene.ts:7071-7076`, "out of the door with them") before anyone says what the PC, wall map or board are for, and his one reply on return is the speech they just heard. The mid-game Oak never says what the job on his board is or how to take it; he only says to go and read it.
- **Fix:** Let the newcomer stay: end the handover on "Have a look round, then the RAID ARENA's west across the yard." On a second talk in the same visit, give one short line instead of the loop ("Still here? The RAID ARENA's west. Go on!"). Mid-game, lead with the job ("SEALED DISPATCH is on my board - take it at the RAID ARENA") and drop "And" from a line that is the second of only two.

### 4. Board says "new places" and names none  [kind: ai-feel / wrong]
- **Seen:** Mid-game board: "3 jobs done so far. These are new ones, in new places:" then "SEALED DISPATCH: Find the dispatch case in Greystone Vale and carry it out." / "Only CHARCOAL TRACK takes it home. The hunter is tougher." / "Reward: 2× Parts crate and a Lv 7 Pikachu, waiting at base."
- **Where / repro:** Mid-game save, face THE BOARD.
- **Screenshot:** ../shots/oaks-lab-13-board-dispatch.png
- **Why it is bad:** "In Greystone Vale" is every raid there is; it is a 204-place map, and the promised "new place" is never said. The place is known when the job is dealt (`standingBoard.ts` dispatch's own briefing says "The case is in ..."), the board just does not print it. A Lv 7 Pikachu as the prize for a player with a Lv 17 Ivysaur reads as a joke. The door outside says "1 job on the board" while Oak says "2 notices" (`doorStatus.ts:87-90` counts only contracts).
- **Fix:** Put the region on the notice: "SEALED DISPATCH: a dispatch case lies in <region>. Carry it out by CHARCOAL TRACK." (`src/game/objectives/standingBoard.ts:1013`). Drop "in new places" from `bankedJobsLine` (`src/game/base/labBoard.ts:110`) unless the place is named. Make the door and Oak count the same thing.

### 5. Oak's opening lines assume you know who he is and what to press  [kind: jargon]
- **Seen:** New game: the very first box, unnamed speaker: "There you are! Take a partner off that table." Talking to him: "Go on, choose! Walk up to a Poké Ball and press." (press what?) The ball preview then says "Beats the first gym's water types" before the word gym has been said once.
- **Where / repro:** NEW GAME.
- **Screenshot:** ../shots/oaks-lab-01-arrive.png
- **Why it is bad:** The newcomer persona has never played Pokémon; a man in a coat says "There you are!" with no name on the box. "And press" ends mid-instruction (`src/game/base/starterTable.ts:85`).
- **Fix:** "There you are! I'm PROFESSOR OAK. Take a partner off that table." and "Go on, choose! Walk up to a Poké Ball and press SPACE." Starter note: "Strong against water types, like the first gym's" or name MISTY.

### 6. The starter preview is outside the menu look, and the question box cuts it  [kind: menu-look]
- **Seen:** New game, facing a ball: a bare white panel on the left edge with the sprite, "SQUIRTLE / Water / Hardest to knock down with a tackle / Lv 5: Tackle, Tail Whip" - no ink title strip, no frame, no shadow. On "Is SQUIRTLE your choice?" the dialogue box at the top lies across the top of the preview, cutting Squirtle's picture in half.
- **Where / repro:** NEW GAME, walk to a ball, SPACE. Seen at 400x256; there is no starter-table picture in `docs/screens/menu-look/` to compare with.
- **Screenshot:** ../shots/oaks-lab-04-starter-question.png
- **Why it is bad:** It is the first card the game ever shows, and it is the one that does not follow the card rule (white, an ink line, hard pixel shadow, type as an ink chip with its colour square). "Water" is plain text, not the type chip used everywhere else.
- **Fix:** Draw it as a card with the type chip, and keep it below the question box (or move the question to the bottom box, as every other question in the lab sits).

### 7. The Pokédex sends you to Oak's table, which then refuses you  [kind: wrong/out-of-date]
- **Seen:** Mid-game, Squirtle's page (met, not owned): WHERE TO FIND ONE "... One of the three on Professor Oak's table". The ball on the table: "That's one of PROFESSOR OAK's last Pokémon. It stays with him."
- **Where / repro:** Mid-game, OAK'S PC -> No. 007 -> ENTER; then face the right-hand ball.
- **Screenshot:** ../shots/oaks-lab-19-dex-squirtle-oak-table.png
- **Why it is bad:** A "where to find" line pointing at a source closed to this save is a lie by the time anyone reads it.
- **Fix:** Drop the `starter` source line (`src/game/hub/pokedexSources.ts:396-397`) once a partner has been chosen, or reword it to "Professor Oak's table, for a new game".

### 8. The wall map is a list of one map you must open to see anything  [kind: bolted-on / menu-look]
- **Seen:** Both saves: THE WALL MAP opens on a single gold card, "GREYSTONE VALE 17% KNOWN", one thumbnail, and "ENTER reads it close up." Its help line wraps to two lines and pushes the keys line down. The close-up's SIGNS PINNED HERE is cut at "Next gym: CERULEAN GYM in GULL" on new game. "WORTH GOING FOR: Rare things are found on this map, but not in any place you have walked." on a save that has walked nowhere.
- **Where / repro:** Face THE WALL MAP.
- **Screenshot:** ../shots/oaks-lab-15-wallmap-mid.png
- **Why it is bad:** With every other map retired, the picker is a pointless extra press; the close-up is the screen. The "rare things" line is a riddle for a newcomer. (Cut text seen at 400x256.)
- **Fix:** While one map is offered, open straight on the close-up. Newcomer's WORTH GOING FOR: "Walk a place and what's worth finding there goes up here."

### 9. CINNABAR, and a dig that is never explained  [kind: jargon]
- **Seen:** Both saves, FOSSIL MACHINE: "A machine for waking fossils, borrowed from the lab on CINNABAR." / "OAK: Old shells turn up in the sand under the vale, if you know how to dig for them."
- **Where / repro:** Face the FOSSIL MACHINE (only there once a partner is chosen).
- **Screenshot:** (dialogue only; see the room in ../shots/oaks-lab-12-oak-mid.png)
- **Why it is bad:** Cinnabar is nowhere in this game; "under the vale, if you know how" is a coy riddle when the code knows exactly where (THE OLD SHELLS in Greystone Caves' sand, `src/game/hub/fossils.ts:12`).
- **Fix:** "A machine for waking fossils. OAK: Old shells turn up in the sand down in GREYSTONE CAVES. Bring me one!"

### 10. Pokédex header loses its label in a narrow window  [kind: menu-look]
- **Seen:** A lone red "1" (new) / "3" (mid) beside the rail, no "OF 151 OWNED / N MET" as in `docs/screens/menu-look/after/pokedex.png`; Squirtle's page squeezes WHERE TO FIND ONE to one line with "MORE" printed over the words. Seen at 400x256.
- **Screenshot:** ../shots/oaks-lab-08-pokedex.png
- **Fix:** Keep "OWNED" beside the number at every width; give WHERE TO FIND ONE at least two lines before the MORE marker.

## What is actually good
- The starter table: walking up to real balls, a preview that commits nothing, YES first, and FireRed's "Hey! Don't go away yet!" at the door. "That can wait. Choose your partner first!" on everything else is the right amount of Oak.
- The Pokédex grid itself: silhouettes for met, colour for owned, FireRed entries, a cry button, the gift rail with "OAK'S GIFT AT 10 / 9 MORE TO GO". Checked: the 10-kind gift really is 5 Great Balls (`src/game/hub/pokedex.ts:62-68`).
- The chart table and the parcel are small, quiet, physical props ("A big table under a sheet of tracing paper, pinned flat. Nothing is drawn on it yet.") that hint at later content without a menu.
- Checked true: "Every raid starts at the RAID ARENA, west across the yard" (arena door 8,12, lab 25,11); next gym CERULEAN GYM in GULL STRAND then FUCHSIA GYM in TANGLEWOOD (`src/game/world/valeQuarters.ts:129-168`); the parcel's "custom Poké Ball" matches Oak's errand thanks.

## Everything I read
- New game: Oak's opening line; Oak spoken to before choosing (x3, same line); THE BOARD, THE WALL MAP, OAK'S PC before choosing ("That can wait..."); the door mat line; all three ball previews (Bulbasaur, Charmander, Squirtle); the YES/NOT NOW question, NOT NOW, then YES and the handover; walked back in; Oak x5; THE BOARD ("Nothing pinned up."); THE WALL MAP list and close-up, all three PG DN pages; OAK'S PC grid, Squirtle's page, No. 006's not-met help; THE CHART TABLE; FOSSIL MACHINE; a leftover POKÉ BALL.
- Mid-game: door caption "OAK'S LAB 1 job on the board"; Oak (first-words "near work done" plus three lines) x3, read box by box; THE BOARD box by box (5 boxes: contract + favour); THE WALL MAP list and close-up with every row arrowed through (signs, errands, worth going for, doors, ways out, six wildlife rows); OAK'S PC grid, Squirtle (met) page, Pidgey (met) page; THE CHART TABLE; FOSSIL MACHINE; OAK'S PARCEL; both leftover POKÉ BALLs.
