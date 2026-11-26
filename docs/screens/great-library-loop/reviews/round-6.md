# THE GREAT LIBRARY (at the top of THE GREEN, door near 57,5) - score 6/10

**Verdict:** A handsome little reading room that finally teaches the game instead of selling you furniture, and most of what its books say is even true. Then you open the golden book you were made to beat a gym leader for and find it is a printed answer key that makes the harbour's whole rumour economy - which the same book advertises two pages earlier - pointless. Add a house manual that contradicts itself about cushions, a raids primer that promises fifteen safe seconds the game does not give you, and a librarian with exactly two sentences to her name, and you have a library that reads well and thinks badly.

## Problems, worst first

### 1. VALE SECRETS is an answer key that sells out the RUMOUR MILL it advertises  [kind: other]
- **Seen:** mid-game save. Page 2 says: "Half the harbour trades rumours - the board, the ANGLER, BILL and more - and THE RUMOUR MILL sells them." Then every unfound nook's page prints the lot, e.g. "THE LONG SHADOW / WHERE: THE GREY STONES / WHEN: at dusk / HOLDS: not found yet. / Hidden: step on it, or face it and press [SPACE]." and "THE RED ONE / WHERE: THE TARN / WHEN: at night / NEEDS: an Old Rod or a Good Rod packed". Only HOLDS is held back.
- **Where / repro:** midgame save, GREAT LIBRARY, golden plinth (7,6), turn to spreads 2 and 3 onward.
- **Screenshot:** (round 6 screenshot) great-library-15-secrets-rumour-mill.png and (round 6 screenshot) great-library-16-secrets-answer-key.png
- **Why it is bad:** The rumour system is built so each rumour gives "two of three facts - where, when, and what to bring" and the MILL's slip gives "the two facts the harbour's rumour leaves out" (`src/game/world/rumours.ts:8-17`). The book hands out WHEN and NEEDS for all twenty for free the moment MISTY falls, so every ticket spent at the MILL after that buys nothing, and the book's own page 2 tells you to go and buy them.
- **Fix:** Make an unfound page print only what the player has heard (rumours in `raidProgress.rumoursHeard`) or read on the nook's sign, and say "Not heard of yet - ask about the harbour" for the rest; or keep WHERE only. Either way page 2 and the unfound pages must stop contradicting each other.

### 2. RAIDS promises fifteen safe seconds the game does not give  [kind: wrong/out-of-date]
- **Seen:** new save, RAIDS page 2 "Five minutes": "At zero you have fifteen seconds to get out. Then a hunter comes for you: win, and you fight your way out."
- **Where / repro:** GREAT LIBRARY, RAIDS lectern (5,6), spread 2.
- **Screenshot:** (round 6 screenshot) great-library-09-five-minutes.png
- **Why it is bad:** The hunter is sent at zero, not after the fifteen seconds: the enrage sends one from `ENRAGE_SEND_STEPS` away at twice your pace and it reaches a player standing still in six seconds (`src/game/world/hunterPack.ts:125` `ENRAGE_REACH_MS = 6_000`; docs/agents/hunter.md line 10). The fight at the end of the fifteen seconds (`makeLastStand`, `src/game/scenes/WorldScene.ts:11437`) is the second hunter event, not the first. A newcomer who trusts this page dawdles and is caught at 0:06.
- **Fix:** "At zero the hunters come for you, fast, and you have fifteen seconds to get out. Still in the vale when they run out? You fight for it: win, and you are out." (`src/game/library/books.ts:71-73`).

### 3. THE BOLTHOLE contradicts itself about the cushion, and says it twice  [kind: wrong/out-of-date]
- **Seen:** new save, THE BOLTHOLE page 6 "Make it yours": "Win a cushion at the PRIZE WINDOW and it is yours to put anywhere." Page 9 "Where things go": "A piece stands on the floor, never on a mat... Nothing may block the door, the stairs or anything you use." Page 10 "Getting furniture" then repeats "The PRIZE WINDOW at PIER SQUARE sells furniture for TICKETS, like a Pika Cushion."
- **Where / repro:** GREAT LIBRARY, THE BOLTHOLE lectern (3,6), spreads 4, 5 and 6.
- **Screenshot:** (round 6 screenshot) great-library-03-cushion-anywhere.png, (round 6 screenshot) great-library-05-where-things-go.png, (round 6 screenshot) great-library-04-getting-furniture.png
- **Why it is bad:** "Anywhere" is false: the house refuses a piece that blocks (`src/game/home/arrangement.ts:189,348`). Twelve pages for one house and two of them are the same advert.
- **Fix:** Cut the cushion sentence from page 6 (`src/game/library/books.ts:169`): "The table, the plants and anything you bring home can all be moved, and the next pages say how." Leave the PRIZE WINDOW on page 10 only.

### 4. RAIDS leans on words it never teaches: THE LOCKER and "your partner"  [kind: jargon]
- **Seen:** new save, RAIDS page 7 "Losing": "...every Pokémon you took, all but your partner and whatever THE LOCKER holds." Page 1 names THE BENCH and THE ARMOURY RACK but never the locker, and no page says what a partner is.
- **Where / repro:** RAIDS lectern, spreads 1 and 4.
- **Screenshot:** (round 6 screenshot) great-library-07-losing-locker.png
- **Why it is bad:** This is the most important rule in the game (what you keep when you die) and the book that is meant to teach it to a beginner names the two safeguards as if the reader already knew them.
- **Fix:** Page 1: "...what you carry at THE ARMOURY RACK, and what is kept safe at THE LOCKER, then step up..."; page 7: "...all but your partner, the first Pokémon you chose, and whatever is in THE LOCKER."

### 5. VALE SECRETS: "WHERE" names a spot nobody can find, and the rest is boilerplate  [kind: ai-feel]
- **Seen:** mid-game save. "WHERE: THE CIDER PRESS", "WHERE: THE TARN", "WHERE: THE BUTTERFLY RIDE", "WHERE: THE DUCK HIDE" - no district on 18 of 20 pages (only THE LOST FOLD and THE LOST PICNIC get one). "It stands there, waiting." and "It waits there." close page after page. THE HERON THAT IS NOT says "NEEDS: standing still for 12 seconds, no step and no turn" then "Stand still, and something answers."; THE LAPRAS DOLL says "NEEDS: dry boots: not a step in tall grass all raid" then "Come in dry, and something answers."
- **Where / repro:** golden plinth, spreads 3 to 12.
- **Screenshot:** (round 6 screenshot) great-library-19-heron-redundant.png, (round 6 screenshot) great-library-20-lapras-redundant.png
- **Why it is bad:** A "golden book" that reads like a form filled in twenty times. Saying a thing twice on a seven-line page is padding; a place name with no district is useless on a map that is dark where you have not walked.
- **Fix:** Give every page its district (`DISTRICT_OF` in `src/game/library/secretsBook.ts:40` for all twenty, or read it off the map's parts). Drop the closing line where the NEEDS line already says it (`SUMMONS_WORDS` for the heron and the doll), and write one line of flavour per nook instead of "It waits there."

### 6. A two-line heading's rule sits on top of its second line  [kind: menu-look]
- **Seen (at 400x256):** "Anywhere in the / harbour" (THE HARBOUR, page 7), "THE TAPPERS' / SUNDAY", "THE SLEEPER IN THE / PINES", "THE HERON THAT IS / NOT": the gold rule and its dot run along the baseline of the wrapped word with no gap, where a one-line heading gets a clear 3-4 px.
- **Where / repro:** THE HARBOUR lectern, last spread; VALE SECRETS spreads 4, 7, 11.
- **Screenshot:** (round 6 screenshot) great-library-02-heading-rule-through-word.png, (round 6 screenshot) great-library-17-secrets-wrapped-heading.png
- **Why it is bad:** Looks like a strike-through. The 1280x800 reference (`docs/screens/menu-look/after/library-book.png`) has a one-line heading so it never shows this; small windows do.
- **Fix:** In `src/game/scenes/LibraryBookScene.ts:249`, `HEADING_LINE` is a fixed 18 while the heading font is smaller at small layouts, so `below` comes up short; measure one line of the heading font at the current layout instead of the constant (or shorten the headings: "Anywhere at home").

### 7. THE HARBOUR book is a partial cast list  [kind: other]
- **Seen:** new save, page 7 "Anywhere in the harbour": "[B] opens YOUR THINGS, [P] YOUR TEAM and [M] THE MAP. [O] lists the favours people have asked of you." The yard's own hint line outside the door reads "[L] LOOK [O] FAVOURS [B] THINGS [P] TEAM [X] DEX [M] MAP [T] SAY". No page mentions THE TRADER (stood in the yard at 14,9), THE HARBOUR BOUTIQUE or THE GAME CORNER by name; THE BATTLE ARENA has no "where".
- **Where / repro:** THE HARBOUR lectern (9,6), spreads 3 and 4.
- **Screenshot:** (round 6 screenshot) great-library-02-heading-rule-through-word.png
- **Why it is bad:** A book whose blurb is "Who does what, and where to find them" leaves out three of the places a player sees on the walk here and three of the seven keys.
- **Fix:** Page 7: "[B] YOUR THINGS, [P] YOUR TEAM, [M] THE MAP, [X] THE POKéDEX, [O] your favours and [T] a quick word to other players." Add one page: "THE TRADER in the yard swaps Pokémon; THE BOUTIQUE on the front sells looks; THE GAME CORNER on PIER SQUARE runs the games." Give THE BATTLE ARENA "on THE PROMENADE".

### 8. The librarian has two sentences and only ever sells one book  [kind: other]
- **Seen:** new save, talked four times, identical every time: "Welcome to the GREAT LIBRARY! Start with RAIDS, on the lectern just left of the runner." / "The golden one is VALE SECRETS." / "I unchain it for whoever beats MISTY, the gym leader out on the coast." Mid-game: "Welcome back to the GREAT LIBRARY." / "You've beaten MISTY, so VALE SECRETS is unchained. Every nook you find gets written up in it." - "back" whether or not this save has ever been in.
- **Where / repro:** stand at 7,5 facing up.
- **Screenshot:** (round 6 screenshot) great-library-01-room-new.png
- **Why it is bad:** Two of the three lecterns (THE HARBOUR, THE BOLTHOLE) are never mentioned by the person who "Knows where every book is". "Every nook you find gets written up in it" is also untrue of the book she hands over: it already lists every nook, found or not.
- **Fix:** Second talk: "THE HARBOUR on the right says who's who; THE BOLTHOLE on the far left is all about your house." Mid-game: "...VALE SECRETS is unchained. Every nook's in it; what each one holds is written in once you've found it." (`src/game/base/rooms.ts:914-933`).

### 9. Small inconsistencies that add up
- **Seen:** headings mix caps ("OAK'S LAB", "BROCK'S WORKSHOP") with sentence case ("The POKéMON CENTER", "Out on the front", "Practice and play") in the same book; RAIDS and THE BOLTHOLE end on a "THE END / Press [ESC] to close the book." page, THE HARBOUR and VALE SECRETS just stop; MARLOW's first line carries "MARLOW:" and his second does not, while THE LIBRARIAN never gets a name at all; THE SHADOW IN THE CRYPT is the one night-only nook with no WHEN line ("It waits there. Under the CHAPEL, by night.").
- **Screenshot:** (round 6 screenshot) great-library-11-harbour-2.png, (round 6 screenshot) great-library-18-crypt-night-in-note.png, (round 6 screenshot) great-library-10-marlow.png
- **Fix:** One heading style per book; a closing page on every book or none; "WHEN: at night (the CHAPEL opens only then)" on the crypt.

### 10. MARLOW points at a bottle and never says why  [kind: other]
- **Seen:** both saves, every time: "MARLOW: Charts, young one. I've kept this library's charts all my life." / "The sea sends old ones back. There's a bottle on THE BEACH past the pier, and nobody's bothered to open it." He never says to bring it to him, and the end bookcase beside him only says "This end case doesn't sit quite flush with the wall."
- **Fix:** Add "Bring me what's in it, and I'll show you something." The claim itself is true (`BEACH_BOTTLE` at 109,19, `src/game/treasure/treasureMap.ts:163`).

## What is actually good
- The RAIDS book is short, plain and almost entirely true: the numbers (5:00, 0:15, 40s plus 20s to 2:00, 12/18/24/30 squares, 4/6/9 for a catch) match the code and a test holds them.
- Keys are drawn from the game's own bindings, so [B] [M] [H] [Q] [E] [X] [R] are right, and SPACE, the arrows, A/D and Backspace all work in the book.
- The book screen itself is lovely: a real open book with a coloured title plate per lectern, page numbers, and no wall of text on any page.
- The librarian points newcomers at the right lectern with a real direction ("just left of the runner"), and the chained plinth tells you who unchains it and why.
- The dressing answers when faced (globe with GREYSTONE VALE pencilled on, the fern, the window following the clock, the not-quite-flush end case) without cluttering the room with captions.

## Everything I read
- Outside: caption "GREAT LIBRARY 3 books to read" (new save), "4 books to read" (mid-game).
- THE LIBRARIAN: talked 4x on new save, 1x mid-game (both line sets above).
- RAIDS: all 8 pages + title + THE END (new save). Turned with ArrowRight, D, A, ArrowLeft, Space; closed with Escape and Backspace.
- THE HARBOUR: all 7 pages + title.
- THE BOLTHOLE: all 12 pages + title + THE END.
- VALE SECRETS: locked plinth (new save: "A golden book, chained shut to its plinth. VALE SECRETS, it says on the spine." / "The LIBRARIAN unchains it for whoever beats MISTY."); opened mid-game, all 23 pages + title ("none found yet").
- THE STACKS (both saves, both line variants), THE GLOBE, THE FERN, THE WINDOW ("Blue sky over the tree tops." both saves), THE BOOKCASES, THE END BOOKCASE.
- MARLOW: talked 3x new save, 2x mid-game; caption "MARLOW Keeper of old charts".
- Book keys line: "[ARROWS] or click a page to turn", "[ESC] CLOSE".
