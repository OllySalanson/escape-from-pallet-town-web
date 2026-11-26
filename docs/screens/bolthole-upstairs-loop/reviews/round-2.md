# THE BOLTHOLE, upstairs (the player's own house at the east end of KEEPERS' ROW; go in, then up the stair mat) - score 5/10

**Verdict:** It's tidier than last time. The console now just plays, the wardrobe doesn't fall apart in a small window any more, and the PC holds its cursor. But tidy isn't the same as good. The calendar, the one object up here that tries to remember your last raid, tells a brand-new player they came home with "6 finds" when they found nothing at all. The wardrobe's mirror says you're wearing nothing while you stand there fully dressed with a gym leader's neckerchief on. Everything else is one canned line that reads the same on raid one and raid eleven. It's a bedroom you visit to fix your team, not a place you'd want to sit in.

## Problems, worst first

### 1. THE CALENDAR counts what you took out as what you found  [kind: wrong/out-of-date]
- **Seen:** new save. THE CALENDAR: "DAY 2. 1 day crossed off, one for each raid." / "It has a tick for coming home." / "Yesterday's square: a tick, with 6 finds." The save's one raid took 3 Potions and 3 Poke Balls and brought home exactly 3 Potions and 3 Poke Balls (`raidLog[0].took.items` = `home.items` = `{potion: 3, poke-ball: 3}`). The player found nothing.
- **Where / repro:** after-first-raid save, upstairs, stand at 10,2 and face up to THE CALENDAR.
- **Screenshot:** (round 2 screenshot) bolthole-upstairs-02-new-calendar-finds.png (the line is in the act transcript; `talk` plays the dialogue through before the shot)
- **Why it is bad:** It's the first thing in the house that tries to remember what you did, and it's wrong on the first raid. A newcomer who looted nothing is told they found six things and will go looking for them.
- **Fix:** `lastSquare` in src/game/base/homeLines.ts:133 adds up `last.home.items`. But `home` is what was packed plus the change (src/game/run/raidLog.ts:129, `const home = Math.max(0, packed + change)`), so the supplies you carried are counted too. Count finds as `home - took` for each item and floor at 0. On this save that gives "a tick, and empty hands."

### 2. YOUR WARDROBE's mirror says you are wearing nothing  [kind: wrong/out-of-date]
- **Seen:** both saves. When the wardrobe opens, THE MIRROR reads "WHAT YOU HAVE ON HEAD NONE TOP NONE BOTTOMS NONE OUTFIT NONE". Meanwhile the card says "The classic look - On in the mirror" (new save) or "CASCADE NECKERCHIEF MISTY's · On" (mid-game save), and the player is fully dressed in the room behind. Try on the Plain tee and the same mirror now shows "SHORT CROP / PLAIN TEE / PLAIN TROUSERS". So the classic look is made of those three pieces, and the mirror just won't say so until you've tried it on. The worn neckerchief never appears in any slot.
- **Where / repro:** either save, upstairs, stand at 2,2 and face up to YOUR WARDROBE. Compare the slots with the "On" card.
- **Screenshot:** (round 2 screenshot) bolthole-upstairs-23-mid-wardrobe.png and .../bolthole-upstairs-08-new-wardrobe.png
- **Why it is bad:** A mirror has one job. The screen headed "WHAT YOU HAVE ON" lists four NONEs while you're wearing four things, and Misty's honour (the only thing up here you earned) isn't shown at all.
- **Fix:** `slotCard`/`wornRows` (src/game/look/boutiqueView.ts:136-145) print 'None' when the look has no piece for a slot. When the look is the classic one, resolve it to its pieces (Short crop / Plain tee / Plain trousers). Add a fifth row, HONOURS, listing what's worn from `honours.worn`.

### 3. The mirror has no reflection in a small window  [kind: menu-look] (seen at 400x256)
- **Seen:** both saves. The old overlap is gone, but so is the figure. THE MIRROR is now just four grey text rows (HEAD / TOP / BOTTOMS / OUTFIT). Trying on a piece changes only the words and a 16px icon on the card, so you never see yourself in the clothes.
- **Where / repro:** YOUR WARDROBE, ENTER on Plain tee.
- **Screenshot:** (round 2 screenshot) bolthole-upstairs-09-new-wardrobe-tryon.png
- **Why it is bad:** Getting rid of the figure fixed the overlap, but it took away the reason to try things on. Seen at 400x256, though a laptop in a half-width window is near that size.
- **Fix:** Keep a small figure (`turningFigures`, scale 2, which already exists at boutiqueView.ts:131) in place of the big one under the width breakpoint, rather than nothing.

### 4. The partner swap opened from MY PC calls itself BILL'S PC  [kind: wrong/out-of-date]
- **Seen:** new save. MY PC, then CHOOSE A NEW PARTNER. The step-back chip in the title strip reads "BILL'S PC > SWAP YOUR PARTNER". You are upstairs in your own house, and the screen you came from was headed "MY PC".
- **Where / repro:** after-first-raid save, MY PC, CHOOSE A NEW PARTNER.
- **Screenshot:** (round 2 screenshot) bolthole-upstairs-04-new-partner-swap-bills-pc.png
- **Why it is bad:** It names a machine in another building. The house gets MY PC as its heading (HubScene.ts:1587) but the back step was never told.
- **Fix:** src/game/scenes/HubScene.ts:1604: `label: this.enteredFrom === 'bolthole-upstairs' ? 'My PC' : 'Bill’s PC'`, the same test as `atHome` at :1582.

### 5. The swap screen's cursor and its button disagree  [kind: menu-look]
- **Seen:** new save, SWAP YOUR PARTNER. Arrow onto SQUIRTLE and its card gets the gold ring (gold = "the chosen thing" by the menu rules). But the green button below still reads "SWAP FOR CHARMANDER" (greyed out), and the line under it still says "Already yours. Pick a different starter to swap." You have to press ENTER on the card before the button follows.
- **Where / repro:** MY PC, CHOOSE A NEW PARTNER, ArrowRight twice.
- **Screenshot:** (round 2 screenshot) bolthole-upstairs-05-new-swap-squirtle.png
- **Why it is bad:** On a screen that releases your only Pokémon for good, the thing ringed in gold and the thing the button names should never differ.
- **Fix:** Either let the cursor pick (the button names the card under the cursor, the way the boutique's try-on does), or don't gold-ring a card that isn't chosen yet. Use gold's wash for the cursor and keep the ring for the chosen one.

### 6. Most of the room says the same thing on raid one and raid eleven  [kind: other]
- **Seen:** THE BOOKCASE is word for word the same on both saves: "Toys on top, and a few comics. The proper books are at THE GREAT LIBRARY." Its caption, "Toys on top, books below", is contradicted by the line ("a few comics"). PENNANTS: "GREYSTONE VALE: home once." became "GREYSTONE VALE: home 7 times." on the mid-game save, and the beaten gym isn't on the wall. The bed swaps one name. THE CALENDAR on the mid-game save has no "yesterday" line at all (its raidLog is empty), so ten raids in it says less than it did after one.
- **Where / repro:** both saves, face each object.
- **Screenshot:** (round 2 screenshot) bolthole-upstairs-01-new-arrive.png
- **Why it is bad:** It's the player's own room, and ten raids, a gym badge and a Bulbasaur evolving into an Ivysaur leave no mark on it besides a number.
- **Fix:** Let the bookcase hold something earned (a VALE SECRETS copy once a nook is found, a gym book once a gym is beaten). Hang a gym pennant beside the vale's. Fix the caption to "Toys on top, comics below".

### 7. The bed name-drops a rival the newcomer has never heard of  [kind: jargon]
- **Seen:** new save, YOUR BED: "You dream of GREYSTONE VALE. LORELEI is there, one step behind you... and you wake up." On this save, LORELEI has only ever been named by the downstairs telly. Mid-game save: "BLUE is there".
- **Where / repro:** after-first-raid save, face YOUR BED at 1,5.
- **Screenshot:** (dialogue line from the transcript)
- **Why it is bad:** It's one name and a dream line, so it's not serious. But for a player who knows nothing it's another capitalised stranger.
- **Fix:** "...LORELEI, the next one hunting you, is there..." or "...the next hunter is there...". Say who she is once.

### 8. The console's name box gets its own rule wrong  [kind: wrong/out-of-date]
- **Seen:** mid-game save. THE CONSOLE, N for TYPE A NAME. The field says "Up to ten: letters, numbers, spaces and . ! ? ' -". ENTER on an empty box then says "Type a name first: letters and numbers, up to ten."
- **Where / repro:** THE CONSOLE, press N, press ENTER.
- **Screenshot:** (round 2 screenshot) bolthole-upstairs-24-mid-console-name.png
- **Why it is bad:** Two different rules on one box, a line apart.
- **Fix:** src/game/console/playerName.ts:69 (and the copy at src/game/names/nameScreen.ts:75): `Type a name first: up to ten ${NAME_CHARACTERS_WORDS}` (playerName.ts:32), or just "Type a name first."

### 9. The console screen: two "ARROWS move" lines stacked, and the room showing through  [kind: menu-look] (seen at 400x256)
- **Seen:** both saves. The status line under the panels reads "ARROWS move, UP turns, SPACE drops, C holds. ESC on its title screen comes back to the house." and the keys line right under it reads "ARROWS move · ENTER play · N your name · ESC back". So there are two "ARROWS move" lines, one for the game and one for the menu. The room's floor still shows in the gap between the GAMES and LEADERBOARD cards. The red "Pallet Town did not answer, so these are the scores played here." means nothing to a player ("Pallet Town" is a town in the games, not a server). It's red, which the rules keep for "can be lost". It may only show offline.
- **Where / repro:** THE CONSOLE at 7,4.
- **Screenshot:** (round 2 screenshot) bolthole-upstairs-11-new-console.png
- **Fix:** Put the game's controls on its card ("IN GAME: ARROWS move · UP turns · SPACE drops · C holds") instead of in the status line. Write "The online boards are not answering, so these are this console's scores." in ink, not red.

### 10. "KEEPING · TAB" and two CANCELs on MY PC's move  [kind: jargon]
- **Seen:** mid-game save. On MY PC, the card under a Pokémon is headed "KEEPING · TAB". During a move there's a "CANCEL" in the top bar and a "CANCEL MOVE" in that card, both live.
- **Where / repro:** MY PC, Diglett, Tab, MOVE · BOX 1.
- **Screenshot:** (round 2 screenshot) bolthole-upstairs-22-mid-move-box.png
- **Fix:** Head it "WHERE IT LIVES" and drop the key hint, which the keys line already gives. Keep one CANCEL.

### 11. Small leftovers  [kind: menu-look / other]
- **Arrival hint:** on arrival (both saves) the hint line says "[SPACE] CHARMANDER" / "[SPACE] IVYSAUR" because the partner stands in front of the stair, so "[H] DECORATE" doesn't show until you take a step.
- **Decorating hint line:** with a piece down, "[SPACE] PICK UP [R] TURN [X] PUT AWAY [Q][E] BOX [H] DONE" runs right up against FEEDBACK at 400x256 (shot 19). [R] TURN on a doll changes nothing on screen.
- **Wardrobe title pill:** it shows ₽0 / ₽110 in a room that sells nothing.
- Shots: (round 2 screenshot) bolthole-upstairs-19-new-decorate-put.png, .../bolthole-upstairs-17-new-decorate.png

## Fixed since the last review (checked)
- The console plays PALLET BLOCKS without asking for a name (title, pause menu and QUIT back to the room all work). Shots 12, 15, 16.
- MY PC: GARDEN toggles both ways and keeps the cursor. Tab reaches SUPPLIES. NEW BOX / DELETE / NEXT keep the cursor once a frame has passed. (An early "cursor lost" reading came from the tool reading focus before the next frame. It wasn't real, so I withdrew it.)
- The wardrobe no longer overlaps itself at 400x256, and WEAR THIS keeps the cursor.
- Decorating starts every piece on a spot where "IT FITS HERE".
- The bed says what's true about the team ("Charmander came home hurt. NURSE JOY can see to that." / "So does IVYSAUR.").

## What is actually good
- A doll for every kind you own ("ONE FOR EVERY KIND YOU OWN") is the one thing up here that grows with play, and it's charming.
- The calendar's tick sentences ("7 of them have a tick for coming home.") read like a person wrote them.
- The partner-swap screen is clear about the cost: "Swapping releases it for good for a level 5 starter as hurt as it is now, with no supplies."
- PALLET BLOCKS' own screens are clean and readable.

## Everything I read
- New save (after-first-raid, CHARMANDER): YOUR NAME prompt (LATER); THE BOLTHOLE door caption "Your things · your Pokémon"; downstairs only walked through; upstairs arrival; THE CALENDAR (caption "Day 2", 3 lines); THE BOOKCASE (x2); PENNANTS (caption + line); MY PC (whole text, Tab areas, SORT, FIND, NEW BOX, DELETE, RENAME, NEXT/ALL BOXES, Potion / Poke Ball / Raid pack help); CHOOSE A NEW PARTNER / SWAP YOUR PARTNER (all three cards, back step); YOUR WARDROBE (all 4 shelves LOOKS/HAIR/TOPS/BOTTOMS, try on, wear); THE CONSOLE games menu, PALLET BLOCKS title, game, pause menu, QUIT, back to the room (the falling blocks wouldn't start under the tool's stepped clock, so I didn't judge the game itself); YOUR BED (x2); decorating (H, all 5 box pieces, take out, move, put down, R, X, done).
- Mid-game save (IVYSAUR + DIGLETT, MISTY beaten): calendar "Day 11"; pennants; bed; bookcase; MY PC (Ivysaur, Diglett, GARDEN both ways, MOVE to box, CANCEL MOVE, Tab cycle, Satchel / Radio valve / Pokedollars help, NEW BOX, DELETE x2); YOUR WARDROBE (HONOURS / LOOKS / HAIR / TOPS / BOTTOMS, try on, wear); THE CONSOLE (TYPE A NAME field, empty ENTER); decorating (7 pieces).
