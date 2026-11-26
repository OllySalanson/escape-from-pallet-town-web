# THE BOLTHOLE, upstairs (the player's own house at the east end of KEEPERS' ROW; go in, then up the stair mat) - score 6/10

**Verdict:** The bookkeeping finally adds up. The calendar no longer invents finds, the swap button names the starter under the cursor, the name box gives one rule, and the offline board is written in plain words. Then you open the wardrobe, and the mirror, the one thing whose whole job is to show you yourself, swaps you into a green tee just because you moved to another shelf, all under the heading "WHAT YOU HAVE ON". MY PC hides the newcomer's only Pokémon while the cursor sits on it. Half the furniture never tells you it can be pressed. It's a competent bedroom with a lying mirror, and after ten raids it looks exactly as it did after one.

## Problems, worst first

### 1. The mirror dresses you in clothes you are not wearing, under "WHAT YOU HAVE ON"  [kind: wrong/out-of-date]
- **Seen:** both saves. The wardrobe opens on the LOOKS shelf, and the mirror reads "WHAT YOU HAVE ON / OUTFIT / THE CLASSIC LOOK" with the figure in a red cap and red top. Press E once to reach HAIR, without trying anything on, and the same panel, still headed "what you have on", now reads "HEAD SHORT CROP / TOP PLAIN TEE / BOTTOMS PLAIN TROUSERS / OUTFIT NONE". The figures have changed into a green tee. Nothing was tried on, and the player in the room is still in the classic look. On the mid-game save the HONOURS row (CASCADE NECKERCHIEF) is pushed out of the visible mirror on those shelves.
- **Where / repro:** either save, upstairs, face YOUR WARDROBE (stand 2,2, face up), press E.
- **Screenshot:** (round 3 screenshot) bolthole-upstairs-05-new-wardrobe-classic.png (before) and (round 3 screenshot) bolthole-upstairs-04-new-wardrobe-mirror-preview.png (after one E). Mid-game: (round 3 screenshot) bolthole-upstairs-11-mid-wardrobe-mirror-lies.png
- **Why it is bad:** Last round's fix made the mirror say what's on, and the cursor preview undoes it a key press later. The mirror's heading claims one thing while it shows another, and a newcomer can't tell whether they've just changed clothes.
- **Fix:** `BoutiqueScene.preview()` (src/game/scenes/BoutiqueScene.ts:243-270) redraws the figures and `wornRows` but never the mirror's note. That note is set once in `mirror()` (src/game/look/boutiqueView.ts:120: `sameLook(state.trying, state.wearing) ? 'what you have on' : 'trying on'`). Either make the preview update the note to "LOOKING AT" whenever `shown` differs from what's worn, or keep the slot rows showing what's actually worn and let only the figures preview.

### 2. MY PC hides a brand-new player's only Pokémon while the cursor is on it  [kind: menu-look / bug] (seen at 400x256)
- **Seen:** new save (CHARMANDER only). MY PC opens with the cursor on "Charmander, level 5, needs joy". The POKÉMON pane shows the box strip (PREV / BOX 1 · 1/30 / NEXT / SORT / FIND / RENAME / NEW BOX), then a blank band, then "2 MORE". The Charmander tile can't be seen. I read it again a second later and after ArrowUp/ArrowDown, and it was the same. On the mid-game save (two Pokémon, no SWAP YOUR PARTNER block) the tiles show fine (shot 15).
- **Where / repro:** after-first-raid save, MY PC.
- **Screenshot:** (round 3 screenshot) bolthole-upstairs-03-new-mypc-hidden-tile.png vs (round 3 screenshot) bolthole-upstairs-15-mid-mypc.png
- **Why it is bad:** It's the one case every newcomer meets: one Pokémon, and the cursor on something invisible. Seen at 400x256, though a phone or a half-width window is near that size.
- **Fix:** When the SWAP YOUR PARTNER block is present, scroll the focused tile into view under the sticky box strip (`MenuOverlay.scrollPastTopCut` already exists for Tab hops; call it on the first focus too). Or put the swap block below the tile row rather than wherever it lands now.

### 3. Four things in the room answer SPACE but never say so  [kind: bug]
- **Seen:** both saves. Facing MY PC, YOUR WARDROBE or THE CONSOLE, the hint line says "[SPACE] MY PC" and so on. Facing THE CALENDAR, YOUR BED, PENNANTS or THE BOOKCASE, it says only "[H] DECORATE", yet SPACE on each of them reads lines. THE BOOKCASE also showed no caption either time I walked up to it, so it gives no sign at all.
- **Where / repro:** stand at 4,2 facing up (bookcase), 10,2 (calendar), 9,2 (pennants), 2,5 facing left (bed).
- **Screenshot:** (round 3 screenshot) bolthole-upstairs-17-mid-bookcase-no-hint.png
- **Why it is bad:** The code's own rule (src/game/scenes/BaseScene.ts:4550-4552) says "a board on a wall that answers a key nobody was told about is a board nobody reads". The calendar is the room's best writing, and nothing tells the player it can be read.
- **Fix:** In the hint chain at BaseScene.ts:4559, also return `[SPACE] ${faced.name}` when `faced.lines` is set (or add `reads: true` to these four things in src/game/base/rooms.ts:2436-2493).

### 4. The honours card says ENTER takes it off, next to a greyed "ENTER WEAR THIS"  [kind: menu-look]
- **Seen:** mid-game save. The wardrobe opens on HONOURS. The status reads "CASCADE NECKERCHIEF: won from MISTY. Everybody sees you wear it. ENTER takes it off." Right beside it, the foot bar's button reads "ENTER WEAR THIS" and is greyed out. The keys line says "ENTER try on, again to wear", but on an honour ENTER switches it straight on or off with no try-on step. Afterwards "You put the CASCADE NECKERCHIEF back on." stays in gold while you browse HAIR, TOPS and BOTTOMS, where on the new save each piece's own line showed. In the mirror, "CASCADE NECKERCHIEF" is cut to "CASCADE NECKERC" at 400x256, and the status wraps two lines into the keys line.
- **Where / repro:** midgame save, YOUR WARDROBE, ENTER, then E four times.
- **Screenshot:** (round 3 screenshot) bolthole-upstairs-10-mid-wardrobe-honours.png
- **Why it is bad:** Three instructions on one screen point ENTER at three different things.
- **Fix:** On the HONOURS shelf, label the foot button "ENTER TAKE IT OFF" / "ENTER PUT IT ON" and make it live (src/game/look/boutiqueView.ts:257 and `commitBar` :343). Clear `status` on a shelf change.

### 5. The wardrobe parks the cursor on dead buttons  [kind: menu-look]
- **Seen:** new save. After PUT IT BACK, and again after ENTER WEAR THIS, the red arrow rests on a greyed button ("PUT IT BACK", "ENTER WEAR THIS"). The status then says "Take it all off and put it back on the shelves." about something already done.
- **Where / repro:** YOUR WARDROBE, E E (TOPS), ENTER, then PUT IT BACK, or ENTER twice.
- **Screenshot:** (round 3 screenshot) bolthole-upstairs-06-new-wardrobe-cursor-on-dead-button.png
- **Fix:** After wear or put-back, send focus to `this.lastCard` (BoutiqueScene keeps it, :239). The status should say the result ("Back on the shelf."), not the button's help.

### 6. THE CONSOLE still stacks two "ARROWS move" lines and still asks "Pallet Town"  [kind: menu-look / jargon]
- **Seen:** both saves. Status: "ARROWS move, UP turns, SPACE drops, C holds. ESC on its title screen comes back to the house." The keys line right under it: "ARROWS move · ENTER play · N your name · ESC back". The room's floor still shows in the gap between the GAMES and LEADERBOARD cards. The failure line is fixed ("The online boards are not answering, so these are this console's scores."), but for the first second the board says "Asking Pallet Town for the PALLET BLOCKS board...". The game itself then says "Z X TURN", where the menu said "UP turns" (both work; vendor pallet-blocks.js:1727-1728).
- **Where / repro:** THE CONSOLE, 6,4 facing right.
- **Screenshot:** (round 3 screenshot) bolthole-upstairs-07-new-console.png
- **Fix:** src/game/console/gamesMenu.ts:70: "Asking the online boards for the PALLET BLOCKS scores...". Also src/game/scenes/ConsoleScene.ts:290 "Asking Pallet Town...". Move the game's controls (src/game/console/consoleGames.ts:74) onto the PALLET BLOCKS card, and close the gap between the cards.

### 7. MY PC: "KEEPING · TAB", a garden button with three names, and Tab that skips your Pokémon  [kind: jargon / menu-look]
- **Seen:** both saves. The card under a Pokémon is still headed "KEEPING · TAB". The garden button is "GARDEN" (greyed, for the partner), "IN THE GARDEN" (a state) and "OUT TO GARDEN" (an action) depending on the Pokémon. New save: Tab goes tile, then MOVE · BOX 1, then Potion, then the window's X, then MOVE again. It never comes back to the Pokémon tiles, and from the X one ENTER shuts the PC. ArrowRight from the Satchel (end of a row) jumps up to the X too.
- **Where / repro:** MY PC, Tab x4; midgame save, Diglett, MOVE, ENTER on the garden button.
- **Screenshot:** (round 3 screenshot) bolthole-upstairs-14-mid-move.png and (round 3 screenshot) bolthole-upstairs-18-new-mypc-tab-to-close.png
- **Fix:** Head the card "WHERE IT LIVES" (src/game/scenes/HubScene.ts:2444 `label: 'Keeping'`). Make the garden button one name with an on/off look: "GARDEN · OUT" / "GARDEN · IN" (HubScene.ts:2520/2526). Make the Pokémon tiles the area Tab lands on after SUPPLIES, not the X.

### 8. Ten raids and a gym badge later, the room is the same room  [kind: other]
- **Seen:** midgame save. Arrival shot is identical to the new save's except the rug is green instead of red. THE BOOKCASE: word for word "Toys on top, and a few comics. The proper books are at THE GREAT LIBRARY." on both saves. PENNANTS: one small pennant at the left end of a four-tile bare string, captioned "PENNANTS". The only line is "GREYSTONE VALE: home 7 times." MISTY beaten leaves no mark on the wall. THE CALENDAR on the mid-game save says less than on the new one ("DAY 11. 10 days crossed off..." / "7 of them have a tick", no yesterday's square at all).
- **Screenshot:** (round 3 screenshot) bolthole-upstairs-01-new-arrive.png
- **Fix:** Hang a gym pennant per beaten leader on the same string (src/game/base/pennants.ts). Let the calendar fall back to the raid record when `raidLog` is empty. Call the thing "THE PENNANT" while there is one.

### 9. Small leftovers  [kind: ai-feel / menu-look]
- **Bed:** "LORELEI, the next hunter after you, is one step behind..." reads as "the hunter who comes after you in the queue". Better: "LORELEI, who hunts your next raid, is one step behind...". (src/game/base/homeLines.ts:166)
- **Caps:** the bed says "Charmander came home hurt" but "So does IVYSAUR". The swap screen says "Charmander (Level 5)" over a card reading "CHARMANDER". Pick one.
- **Swap screen:** on your own starter the button is a greyed "SWAP FOR CHARMANDER" over two lines saying the same thing ("Already yours. Pick a different starter to swap." / "Your current partner."). The "Arrives as: Level 5 · 12/19 HP · Tackle, Growl" line is clipped off at 400x256 (shot 16). ESC back lands on the Charmander tile, not on CHOOSE A NEW PARTNER. "Beats the first gym's water types" uses "first gym" before the newcomer has heard of a gym.
- **Arrival hint:** both saves still arrive to "[SPACE] CHARMANDER" / "[SPACE] IVYSAUR" because the partner stands on the stair (shot 01).
- **Decorating:** "DECORATING - 5 THINGS IN YOUR BOX" never names what's in the box until you take one out. The partner is drawn on top of the player while decorating (shot 08).

## Fixed since the last review (checked)
- THE CALENDAR: "Yesterday's square: a tick, and empty hands." True for a raid that brought home only what it took.
- The swap button follows the cursor ("SWAP FOR BULBASAUR"), and its back chip reads "MY PC".
- The name box gives one rule: "Type a name first."
- The offline board: "THIS CONSOLE ONLY / The online boards are not answering, so these are this console's scores." in ink, not red.
- The wardrobe has no money pill. The mirror shows the classic look and the honour, on the LOOKS/HONOURS shelves, until you press E.
- One CANCEL during a box move.

## What is actually good
- The calendar's lines read like a person wrote them: "Yesterday's square: a tick, and empty hands."
- The partner swap is honest about the cost, and now the button and the gold ring agree.
- Every supply's help line is short, specific and true (Lamp oil, Parts crate and Radio valve match `src/game/hub/workshop.ts`; Satchel is 4x3, items.ts:1197).
- A doll for every kind you own is still the one thing up here that grows with play.

## Everything I read
- New save (after-first-raid, CHARMANDER): title YOUR NAME (LATER); upstairs arrival; THE CALENDAR x2 (caption "Day 2", 3 lines); PENNANTS (caption "Home from Greystone Vale", line); THE BOOKCASE x2; YOUR BED x2 (caption "Lie down a while", 4 lines); MY PC (whole text, focus on tile, ArrowUp/Down, Tab cycle, MOVE help, Potion / Poke Ball help); CHOOSE A NEW PARTNER (all three cards, button, help lines, ESC back); YOUR WARDROBE (LOOKS/HAIR/TOPS/BOTTOMS, try on Plain tee, PUT IT BACK, try on and WEAR); THE CONSOLE (games menu, loading and offline board, PALLET BLOCKS title, play, pause, QUIT, ESC to room, N name box, empty ENTER, CANCEL); decorating (H, all 5 pieces, R turn, put down, X put away, H done).
- Mid-game save (IVYSAUR + DIGLETT, MISTY beaten): arrival; THE CALENDAR ("Day 11"); PENNANTS; THE BOOKCASE; YOUR BED x2; MY PC (Ivysaur, Diglett, garden both ways, MOVE + cancel, Tab, every supply's help: Potion, Poke Ball, Satchel, Lamp oil, Parts crate, Radio valve, Pokedollars); YOUR WARDROBE (HONOURS take off / put on, LOOKS, HAIR, TOPS, BOTTOMS); THE CONSOLE (loading line, offline board); decorating (all 7 pieces, put down, put away).
