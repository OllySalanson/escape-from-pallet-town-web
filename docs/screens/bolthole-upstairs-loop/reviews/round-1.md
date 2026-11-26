# THE BOLTHOLE, upstairs (the player's own house at the east end of KEEPERS' ROW; go in, then up the stair mat) - score 4/10

**Verdict:** A faithful little FireRed bedroom with the soul of a settings page. Every object is a caption with one canned line that never changes in a meaningful way between raid one and raid eleven, the two real features (MY PC and THE WARDROBE) are menus borrowed from other buildings, one of which falls to pieces at small sizes, and the console makes you type a name before it lets you near its single game. The decorating is the only thing up here that feels like play, and it greets every piece you lift with a red "IT HAS TO GO ON THE FLOOR".

## Problems, worst first

### 1. MY PC loses its cursor after GARDEN, so the next key goes to the close button  [kind: bug]
- **Seen:** mid-game save. MY PC, Diglett chosen, Tab to its chip "IN THE GARDEN", ENTER. The status line says "Diglett is back in its box." and the chip becomes "OUT TO GARDEN", but nothing has the cursor any more (no control focused). The next ENTER does nothing (the status shows the chip's help, "Put Diglett out to walk about the garden at home, beside THE BOLTHOLE.", but Diglett stays boxed), and the next ArrowDown lands on the title bar's close X.
- **Where / repro:** mid-game save, upstairs, MY PC, ArrowRight to Diglett, Tab, ArrowRight to IN THE GARDEN, ENTER, ENTER again, then ArrowDown.
- **Screenshot:** (round 1 screenshot) bolthole-upstairs-13-mid-pc-cursor-lost.png
- **Why it is bad:** A player who toggles a Pokémon and changes their mind presses ENTER again and nothing happens. Their next press moves to the X and closes the PC. "One cursor" is the menu rule, and here there is none.
- **Fix:** `HubScene.toggleGarden` calls `this.overlay.refocus('[data-garden="..."]')` (src/game/scenes/HubScene.ts:2542), but the focus does not survive the redraw. Refocus after the re-render, or keep the cursor on the chip by id the way the box-move chip keeps it.

### 2. YOUR WARDROBE breaks apart in a small window: the mirror figure sits on top of the slot cards  [kind: menu-look] (seen at 400x256)
- **Seen:** both saves. THE MIRROR's big try-on figure is drawn over the HEAD / TOP / BOTTOMS / OUTFIT cards. A tall gold bar runs down through the panel into the "WHAT YOU HAVE ON" bar and the status line. When trying on, "PLAIN TEE" reads "PI AIN TFF". The keys line is cut off at "TAB clothes or b...".
- **Where / repro:** upstairs, YOUR WARDROBE, in a small browser window.
- **Screenshot:** (round 1 screenshot) bolthole-upstairs-03-wardrobe-overlap.png and .../bolthole-upstairs-04-wardrobe-tryon.png
- **Why it is bad:** The 1280x800 reference (`docs/screens/menu-look/after/boutique-wardrobe.png`) is clean, so this is a small-window fault, but it is the only screen up here that falls apart rather than just squeezing. MY PC and the console only get tight at the same size.
- **Fix:** Below a width, stack THE MIRROR above the slot list, or drop the big figure and keep the turning strip. Never let the figure overlap the cards.

### 3. The console makes a player name themselves before it will play, then prints its keys line twice  [kind: bug / bolted-on]
- **Seen:** both saves (each had said LATER at YOUR NAME). THE CONSOLE - GAMES: "WHO IS PLAYING? TYPE A NAME". Pressing PLAY on PALLET BLOCKS opens a name box instead of the game. While that box is open, the status line and the keys line both read "ENTER play under this name · ESC back to the games". With an empty box, ENTER says "Type a name first: letters and numbers, up to ten." There is no way to just play.
- **Where / repro:** upstairs, THE CONSOLE, ENTER on PALLET BLOCKS.
- **Screenshot:** (round 1 screenshot) bolthole-upstairs-06-console-name-twice.png
- **Why it is bad:** It is a console in your own bedroom, and you just told the game "LATER" about your name. Being stopped again, by a different-looking name box, before one falling-blocks game, is friction for nothing. The doubled line looks broken.
- **Fix:** Let PLAY start without a name and ask for one only when a score is good enough to post ("Put this on the board? YOUR NAME"). For the doubled line, the name field's `data-help` is `namingHints(waiting)` (src/game/console/gamesMenu.ts:107), which is the same text as the screen's `hints` (gamesMenu.ts:65 via `namingHints`, line 37). Give the field its own help ("Your scores go under this name.") or none. (I could not play PALLET BLOCKS itself: the test tool cannot type letters into a field.)

### 4. "PUTTING DOWN" your Pokémon  [kind: other / wording]
- **Seen:** new save. MY PC, Tab to "MOVE · BOX 1", ENTER. The chip now says "PUTTING DOWN" beside Charmander, and the status line says "Put Charmander down again."
- **Where / repro:** upstairs, MY PC, Tab, ENTER on MOVE · BOX 1.
- **Screenshot:** (round 1 screenshot) bolthole-upstairs-02-putting-down.png
- **Why it is bad:** In British English, "putting down" a pet means putting it to sleep for good. Seeing that beside your only partner is a grim little joke the game did not mean to make.
- **Fix:** src/game/scenes/HubScene.ts:2478 and 2481. Make the chip "CANCEL MOVE" and the line "Leave Charmander in Box 1."

### 5. YOUR BED's caption promises a heal the bed then refuses  [kind: wrong]
- **Seen:** new save. The caption over the bed says "YOUR BED · Sleep it off". Facing it: "You lie down. Nobody hunts you here." / "You dream of GREYSTONE VALE. LORELEI is there, one step behind you... and you wake up." / "You feel rested. Your Pokémon still need NURSE JOY for that." (Charmander 12/18 HP.) The player never lies down on screen; they stand beside the bed while a "[ESC] SKIP" chip shows.
- **Where / repro:** upstairs, face YOUR BED.
- **Screenshot:** (round 1 screenshot) bolthole-upstairs-18-mid-bed.png
- **Why it is bad:** "Sleep it off" is what you say about recovering, and the design says the bed is never a heal (src/game/base/homeLines.ts:132-152). "Still need NURSE JOY for that" - for what? Feeling rested? The line points at nothing. The bed is otherwise a three-box cutscene that says the same thing every time.
- **Fix:** Change the caption at src/game/base/rooms.ts:2427 to "Have a lie-down" or "Dream". Make the last line "You feel rested. CHARMANDER is still hurt - NURSE JOY can fix that." Show the player lying down (FireRed's bed frame) while the dream plays.

### 6. Decorating starts every piece with a red refusal, and the refusal names the wrong thing  [kind: other]
- **Seen:** both saves, pressing H then E at the console. Every piece in the box comes out reading "SMALL DESK 1/5 - IT HAS TO GO ON THE FLOOR", and so on for all seven on the mid-game save. In the first frame the piece you are holding is hidden under the player. Moved onto the telly, the RED PLANT says "IT HAS TO GO ON THE FLOOR" while drawn over a floor-coloured rug, when the real reason is the telly.
- **Where / repro:** upstairs, stand by THE CONSOLE, H, E.
- **Screenshot:** (round 1 screenshot) bolthole-upstairs-08-decorate-floor.png and .../bolthole-upstairs-16-mid-decorate-start.png
- **Why it is bad:** The first thing the decorating toy says is no, in red, about a piece you cannot see. "Off the floor" is a rule of the code's grid, not of the room.
- **Fix:** Start a lifted piece on the nearest tile where it fits, not on the faced fixture. For an `off-floor` refusal over a fixed thing, name it ("THE TELLY IS IN THE WAY"), as `in-the-way` already does (src/game/home/arrangement.ts:193-209).

### 7. PENNANTS: a whole wall's collection that is finished on the free first raid and never changes  [kind: bolted-on]
- **Seen:** new save: "PENNANTS · Home from Greystone Vale", and facing it, "GREYSTONE VALE: home once." Mid-game save, ten raids later: the same single pennant at the left end of a long empty string, the same caption "Home from Greystone Vale", and "GREYSTONE VALE: home 7 times."
- **Where / repro:** upstairs, face the string over the rug.
- **Screenshot:** (round 1 screenshot) bolthole-upstairs-12-mid-one-pennant.png
- **Why it is bad:** With one map in play (`STRUNG_PENNANTS`, src/game/base/pennants.ts:69), a collect-them-all wall is complete before the player knows it exists. After that it is a counter that repeats the calendar.
- **Fix:** Hang a pennant for each district of the vale come home from, or for each gym badge or far place. Or retire the string until a second map is offered, and let the calendar keep the count.

### 8. THE BOOKCASE and THE CALENDAR are flavour text that never grows  [kind: ai-feel]
- **Seen:** both saves. THE BOOKCASE (no caption at all): "Toys on top, and below them every book about Kanto you have ever been given." THE CALENDAR: "DAY 2. Every raid is a day on this calendar, and 1 is crossed off." / "It has a tick for coming home." Mid-game: "DAY 11. Every raid is a day on this calendar, and 10 are crossed off." / "7 of them have a tick for coming home."
- **Where / repro:** upstairs, face each.
- **Screenshot:** (round 1 screenshot) bolthole-upstairs-07-bookcase.png
- **Why it is bad:** Nobody in the game ever gives you a book; THE GREAT LIBRARY is where the books are, and this shelf never mentions it. "Every raid is a day on this calendar" explains the rule in a designer's voice. Neither line says anything you did.
- **Fix:** Bookcase: "Toys on top. The real books are at THE GREAT LIBRARY, up on THE GREEN." Calendar: "DAY 11. Ten raids crossed off - seven of them with a tick for getting home." Then add the last raid's line: "Yesterday: home with 3 things from MILLBROOK."

### 9. The wardrobe's pager is five pages of one card each, and the counts disagree  [kind: menu-look]
- **Seen:** mid-game save. The shelves read "HONOURS 1 OF 5", "LOOKS 2 OF 5", "HAIR", "TOPS", "BOTTOMS", each with a single card. "YOUR CLOTHES · 3 PIECES OF 209" leaves out the CASCADE NECKERCHIEF the player is wearing. The neckerchief card reads "MISTY's · Worn", but the slot list beside it says HEAD NONE / TOP NONE / BOTTOMS NONE / OUTFIT NONE and "The classic look". The keys line says "ENTER try it on, then ENTER wears it", but on the honours shelf ENTER wears or removes at once ("You take the CASCADE NECKERCHIEF off. Nobody sees it now."). The classic-look card says "Free", which is shop language in your own wardrobe. After wearing, the cursor sits on the greyed-out "ENTER WEAR THIS".
- **Where / repro:** upstairs, YOUR WARDROBE, Q/E through the shelves.
- **Screenshot:** (round 1 screenshot) bolthole-upstairs-14-mid-wardrobe-honours.png and .../bolthole-upstairs-11-wardrobe-worn.png
- **Why it is bad:** Paging through five shelves to see four things you own is busywork. "3 of 209" tells a newcomer how little they have more than what they have.
- **Fix:** In the wardrobe (not the shop), show owned pieces on one shelf grouped by slot. Count the honours in the total. Give the honours a row in the slot list. Change the classic card's "Free" to "Always yours" (src/game/look/boutiqueView.ts:265). Mark the worn piece "On" (boutiqueView.ts:302).

### 10. MY PC: Tab never reaches SUPPLIES  [kind: bug]
- **Seen:** both saves. Tab moves between the Pokémon grid and the KEEPING chips and back, but never to the SUPPLIES panel, which only the arrows reach. Arrows from the supplies can land on the greyed GARDEN chip.
- **Where / repro:** upstairs, MY PC, press Tab repeatedly.
- **Screenshot:** (round 1 screenshot) bolthole-upstairs-10-mypc.png
- **Why it is bad:** "Tab hops between the areas of a screen" is the house rule (docs/agents/ui-and-screens.md), and supplies are one of this screen's two areas.
- **Fix:** Add the SUPPLIES grid to the stash screen's Tab ring.

### 11. Small-window clashes: the decorating hint runs under FEEDBACK, and the console lets the room show through  [kind: menu-look] (seen at 400x256)
- **Seen:** while holding a placed doll, the hint "[SPACE] PICK UP [R] TURN [X] PUT AWAY [Q][E] BOX [H] DONE" runs under the FEEDBACK tab. THE CONSOLE's two panels leave a band of undimmed room between GAMES and the name bar; the 1280x800 reference shows the yard through a hole half the screen tall. The red "Pallet Town did not answer" line sits in a disabled row with a rule through it.
- **Screenshot:** (round 1 screenshot) bolthole-upstairs-17-mid-hint-under-feedback.png and .../bolthole-upstairs-05-console.png
- **Fix:** Keep the hint line clear of the FEEDBACK tab. Make the console one frame (GAMES over LEADERBOARD over the name bar, no gap), per the "one drawn frame" rule.

### 12. Arriving upstairs hides the H DECORATE hint behind the partner  [kind: other]
- **Seen:** both saves. Stepping off the stair mat, the hint line reads only "[SPACE] CHARMANDER" / "[SPACE] IVYSAUR". DECORATE comes back only once the player moves.
- **Why it is bad:** The harbour notes say the decorate key is named on the hint line always (docs/agents/harbour.md, THE BOLTHOLE decorating entry).
- **Fix:** Show "[SPACE] IVYSAUR [H] DECORATE".

## What is actually good
- The room is properly FireRed's: the bookcase of toys, the PC desk, the telly on a rug, and the rug in the partner's colour (red for Charmander, green for Ivysaur) is a lovely touch.
- MY PC at home really is the same storage as the Center. Its lines are honest: "Charmander needs NURSE JOY, at the Pokémon Center.", "Charmander walks at your heel, not in the garden.", and the Raid pack's "Eighteen squares" matches the 6x3 grid (src/game/items/items.ts:1204-1205).
- Decorating works once you are moving: doll on desk, chair and plant on the floor, X puts away, ESC drops what you hold and then leaves, the box count goes down as pieces go out, and a doll for every kind you own is a nice reward for the Pokédex.
- The calendar's tick sentence reads naturally for a single raid ("It has a tick for coming home.").

## Everything I read
- New save (after-first-raid.json) and mid-game save (midgame.json), each entered from KEEPERS' ROW, through THE BOLTHOLE, and up the stair mat.
- PENNANTS (caption and line, both saves), YOUR BED (all three lines, both saves, twice on the new save), THE CALENDAR (twice on the new save, once mid-game), THE BOOKCASE (both saves).
- MY PC: title pill (POKéDEX 1 · REWARD AT 10 / POKéDEX 3 · REWARD AT 10), the PREV / NEXT / SORT (to SPECIES) / FIND (and CANCEL) / RENAME (and CANCEL) / NEW BOX help, SWAP YOUR PARTNER text, MOVE · BOX 1 into PUT CHARMANDER IN and back, GARDEN (disabled for the partner; IN THE GARDEN and OUT TO GARDEN for Diglett), every supply's help line (Potion, Poké Ball, Raid pack, Satchel, Radio valve, Parts crate, Lamp oil, Pokédollars), and the status lines.
- YOUR WARDROBE: every shelf (HONOURS, LOOKS, HAIR, TOPS, BOTTOMS); tried on and wore the Plain tee; took the CASCADE NECKERCHIEF off and put it back on.
- THE CONSOLE: the GAMES list, the LEADERBOARD ("Pallet Town did not answer..."), TYPE A NAME, the name box with OK and CANCEL, and PLAY (sent to the name box; the game itself not played because the test tool cannot type).
- Decorating (H): the box walked with Q and E through every piece (5 on the new save; 7 mid-game, with BULBASAUR, IVYSAUR and DIGLETT DOLLs), R TURN, put down (desk, plant, doll on desk), X put away, ESC, H DONE.
- Checked against the code: src/game/base/homeLines.ts, src/game/base/rooms.ts (drawUpstairs), src/game/base/pennants.ts, src/game/console/gamesMenu.ts, src/game/scenes/HubScene.ts (box and garden chips), src/game/home/arrangement.ts (refusals), src/game/look/boutiqueView.ts, src/game/items/items.ts, and THE BOLTHOLE book in src/game/library/books.ts. The book's upstairs pages match what I saw, except that its "Where things go" page does not tell you a fixed thing like the telly counts as "not floor".
