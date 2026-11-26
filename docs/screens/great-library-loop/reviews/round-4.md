# THE GREAT LIBRARY (at the top of THE GREEN, door near 57,5) - score 6/10

**Verdict:** For once a room in this harbour mostly tells the truth: I checked every number in RAIDS and THE HARBOUR against the code and nearly all of them hold. The trouble is everything round the books. The golden "prize" book, unchained after a gym leader, is twenty pages that each say "Not found yet." Its second page writes clean off the bottom of the paper. The librarian welcomes a ten-raid veteran as if they had just walked in. And the longest book in a GREAT LIBRARY is a 13-page manual for your own house. It looks lovely and the books are honest. Being an actual library is the part it hasn't managed yet.

## Problems, worst first

### 1. VALE SECRETS page 2 runs off the bottom of the page  [kind: bug]
- **Seen:** mid-game save. On the golden book's second spread, the left page "Clues and rumours" ends "...BILL and the PRIZE CLERK tell rumours; THE RUMOUR MILL sells them." The last line, "sells them.", sits below the page number "2" and is clipped by the bottom edge of the paper. THE BOLTHOLE's page 2 ("Your name on the door") has its last line, "pick one.", jammed against its folio too, with no gap.
- **Where / repro:** midgame save, GREAT LIBRARY, face VALE SECRETS on the golden plinth (7,6), SPACE, ArrowRight once.
- **Screenshot:** (round 4 screenshot) great-library-11-secrets-p2-overflow.png (zoom: (round 4 screenshot) great-library-12-secrets-p2-overflow-zoom.png; tight BOLTHOLE page: (round 4 screenshot) great-library-04-bolthole-p2-3.png)
- **Why it is bad:** Seen at 400x256, but that is not just the tool's small window. `books.test.ts:76-77` claims every page fits at exactly 400x256 ("the usual one"), so the guard passes while the page breaks. Its width estimate (`wordsWidth`, `bookLayout.ts`) is looser than the real Orange Kid line breaks.
- **Fix:** Cut the page to fit with room to spare: "A sign near every nook hints at it. Round the harbour, the board, the ANGLER, BILL and a few others pass on rumours; THE RUMOUR MILL sells them." Then make the test measure the real wrap (or reserve the folio's line in `linesOnAPage`) so the next long page fails the suite and not the player.

### 2. The golden prize is twenty pages of "Not found yet."  [kind: other]
- **Seen:** mid-game save (MISTY beaten, about ten raids, no nook found). The librarian: "You've beaten MISTY, so VALE SECRETS is unchained. Every nook you find gets written up in it." The book is 12 spreads: three rule pages, then twenty nook pages that all read the same way: a WHERE, sometimes a WHEN, "Not found yet.", and one of four stock closers ("Hidden: step on it, or face it and press [SPACE].", "It stands there, waiting.", "It waits there, every raid.", "Somebody there hands it over."). The title page says "The twenty hidden nooks of GREYSTONE VALE". There is no count of found nooks and no contents page, and every visit starts back on spread 1.
- **Where / repro:** midgame save, golden plinth, page through all 12 spreads.
- **Screenshot:** (round 4 screenshot) great-library-14-secrets-waits-every-raid.png, (round 4 screenshot) great-library-15-secrets-old-shells-crag.png
- **Why it is bad:** The game makes a gym badge the key to a golden book, and what you get is a checklist of twenty place names. Twelve spreads of the same four sentences is flicking, not reading, and with no index a player hunting for "THE KITE THIEF" has to turn eleven spreads to reach it.
- **Fix:** Put "0 of 20 found" on the title page. Start the book on the first unfound nook's spread, or let the left page of spread 1 be a contents list (nook name and page number, ticked once found). Give each unfound nook its rumour line once heard (`raidProgress.rumoursHeard`), so the book grows as the harbour talks and not only once a nook is found.

### 3. "It waits there, every raid." on nooks that need a particular lead  [kind: wrong/out-of-date]
- **Seen:** mid-game save, pages for THE SILENT PICKET, THE SHADOW IN THE CRYPT, THE ELEVENTH STONE, THE LIGHT THAT ANSWERS, THE KITE THIEF and THE SLEEPER IN THE PINES: "WHERE: ... / Not found yet. / It waits there, every raid." There is no WHEN line, and page 1 says the WHEN line is the only condition a page shows.
- **Where / repro:** golden book spreads 7, 9, 10, 11, 12.
- **Screenshot:** (round 4 screenshot) great-library-14-secrets-waits-every-raid.png
- **Why it is bad:** Read plainly, it says "go any raid and it's there". In fact each one answers only a PSYCHIC, GHOST, FLYING or shiny lead, a lone Pokémon, or a POKé FLUTE (`src/game/world/secrets.ts:520,541,580,621,643,444`). X MARKS THE SPOT likewise says only "Hidden: step on it" over a nook that needs the whole chart (`secrets.ts:429`). Rule 1 of the brief: a claim a player acts on and loses a raid to.
- **Fix:** On an unfound page whose secret has non-time conditions, write "It waits there, every raid - but not for just anybody." or simply "It wants something. The sign there says what." (`unfoundSecretPage`, `src/game/library/secretsBook.ts:172-189`).

### 4. The librarian welcomes you as a stranger every single time  [kind: ai-feel]
- **Seen:** both saves, every visit (I talked to her three times on the new save and twice on the mid-game one): "Welcome to the GREAT LIBRARY! Start with RAIDS, on the lectern just left of the runner." A ten-raid player with a badge gets "Start with RAIDS" too. She has no name (THE LIBRARIAN, caption "Knows where every book is"), when MARLOW three tiles away does.
- **Where / repro:** face THE LIBRARIAN across the desk, SPACE, repeat.
- **Screenshot:** (round 4 screenshot) great-library-07-librarian-golden.png
- **Why it is bad:** It's a tape loop. The one person in the room who "knows where every book is" never mentions THE HARBOUR or THE BOLTHOLE, and never says anything new once you've read RAIDS.
- **Fix:** In `librarianLines` (`src/game/base/rooms.ts:909`), greet once ("Welcome! Start with RAIDS, just left of the runner."). After that, point at the next unread book ("Read THE HARBOUR yet? It's the blue one."), and once everything is read, give a line of her own. Give her a name.

### 5. You walk behind the librarian's desk to talk to her  [kind: other]
- **Seen:** new save. `act walk THE LIBRARIAN` from MARLOW's corner took me along the back row to tile 8,2, standing beside her behind the desk with CHARMANDER trotting after. The talk worked from there.
- **Where / repro:** stand at 13,2 (by MARLOW), walk left along y=2 to 8,2, face left.
- **Screenshot:** (round 4 screenshot) great-library-01-behind-the-desk.png
- **Why it is bad:** A desk is a counter. In FireRed you speak across it, and you don't stroll round the back and stand shoulder to shoulder with staff.
- **Fix:** Make the back row (y=2) between the globe and the fern solid (tiles 5-9), or at least 6 and 8 either side of LIBRARIAN_TILE.

### 6. A 13-page house manual is the library's biggest book  [kind: bolted-on / wall-of-text]
- **Seen:** new save. THE BOLTHOLE is 7 spreads (13 pages) of decorating keys ("[Q] and [E] take them out one by one, and [X] puts a piece back in"), rug rules ("A rug lies on bare floor; a doll or cushion may sit on a desk or table"), the garden, visiting and more. RAIDS, the book about the actual game, is 8 pages.
- **Where / repro:** lectern at 3,6.
- **Screenshot:** (round 4 screenshot) great-library-05-bolthole-p10-11.png
- **Why it is bad:** It's a manual for another building, read standing at a lectern a long walk from where the keys work. "Decorating", "Your furniture box" and "Where things go" are reference you need while decorating, not before. And [X] is POKéDEX everywhere else in the harbour.
- **Fix:** Cut THE BOLTHOLE to five pages (your house, downstairs, upstairs, make it yours, visiting). The key pages belong on the decorate hint line in the house, where they are used.

### 7. Small wording slips across the lectern books  [kind: wrong/out-of-date]
- **Seen:** new save.
  - RAIDS p1: "Every raid starts at THE RAID ARENA, west across the yard." No place is called the yard. The place signs say KEEPERS' ROW, THE GREEN and ARENA SQUARE (`src/game/base/harbourPlaces.ts:100-110`).
  - RAIDS p4: "Running from one costs forty seconds of your clock, and twenty more each time after." The cost stops rising at two minutes (`HUNTER_FLEE_PENALTY_CAP_MS = 120_000`, `src/game/run/fleePenalty.ts:11`).
  - BOLTHOLE p11: "like a Pika Cushion": the only mixed-case item name in books written in capitals.
  - Heading case drifts: "OAK'S LAB", "The POKéMON CENTER", "Out on the front", "Anywhere in the harbour". The last one wraps to two lines with the rule under its second line.
  - The title pages say "THE GREAT LIBRARY". The door, the caption and the librarian say "GREAT LIBRARY".
- **Screenshot:** (round 4 screenshot) great-library-03-harbour-book-p6-7.png
- **Fix:** "west along KEEPERS' ROW, on ARENA SQUARE"; "...and twenty more each time after, up to two minutes"; `{item:...}` names in capitals; one heading style; one name for the room.

### 8. Half the room is empty floor  [kind: other]
- **Seen:** both saves. Three lecterns and the plinth in one row. The second row of lectern spots (`LIBRARY_LECTERNS`, y=9) and the whole lower half are bare boards between two stacks.
- **Screenshot:** (round 4 screenshot) great-library-02-room-new.png
- **Why it is bad:** A GREAT LIBRARY with three books and a dance floor. The room was laid out for ten lecterns and holds three.
- **Fix:** Shrink the room to two rows of floor, or put reading tables or chairs (somebody reading) in the lower half until more books come.

### 9. The room's hint line drops the harbour keys  [kind: menu-look]
- **Seen:** both saves. Outside, the hint reads "[L] LOOK [O] FAVOURS [B] THINGS [P] TEAM [X] DEX [M] MAP [T] SAY". Inside it reads only "[SPACE] CHARMANDER [DOWN] OUT", yet O and X work in here (I opened FAVOURS and the POKéDEX from the library floor).
- **Fix:** Keep the harbour keys on the room's hint line, as THE HARBOUR book's own "Anywhere in the harbour" page promises.

### 10. MARLOW never moves on  [kind: other]
- **Seen:** both saves, every talk: "MARLOW: Charts, young one. I've kept this library's charts all my life." / "The sea sends old ones back. There's a bottle on THE BEACH past the pier, and nobody's bothered to open it." It's word for word the same on a new save and a ten-raid one.
- **Screenshot:** (round 4 screenshot) great-library-08-marlow-bottle.png
- **Why it is bad:** It's a fine first hook. Repeated a dozen times it's a signpost with a beard.
- **Fix:** A second, shorter line from the second talk on: "Still on the sand, that bottle. Past the pier."

## What is actually good
- The books are honest. RAIDS' five minutes, fifteen-second grace, forty-second flee, 12/18/24/30 squares, 4/6/9 squares for a caught Pokémon and the partner surviving a wipe all match the code. So do THE HARBOUR's "free heal, a faint costs time, free once a day", BROCK's build list and BILL's stock.
- The book screen is a real joy: a drawn open book on a plinth, page numbers, an END page, and ARROWS, A/D, SPACE, ENTER, ESC and BACKSPACE all doing the obvious thing.
- The locked and unlocked plinths are clearly different (padlock vs open pages): (round 4 screenshot) great-library-10-plinth-locked-vs-open.png. The plinth and the librarian agree on what unlocks it.
- The furniture lines are short and human: "A fern in a brass pot, watered on the hour." "Somebody has pencilled GREYSTONE VALE onto it by hand." "This end case doesn't sit quite flush with the wall." That last one is a proper hook.

## Everything I read
- New save (after-first-raid.json): the door caption "GREAT LIBRARY 3 books to read"; THE LIBRARIAN x3 (3 lines, the same each time); RAIDS all 8 pages + END; THE HARBOUR all 7 pages + END; THE BOLTHOLE all 13 pages + END; VALE SECRETS locked plinth (2 lines); THE STACKS; THE GLOBE; THE FERN; THE WINDOW (day); THE BOOKCASES; THE END BOOKCASE; MARLOW x3; the book screen keys (ArrowLeft/Right, A, D, Space, Enter, Escape, Backspace); O (FAVOURS) and X (POKéDEX) from inside the room.
- Mid-game save (midgame.json): the door caption "GREAT LIBRARY 4 books to read"; THE LIBRARIAN x2 (unchained line); THE STACKS (golden-plinth version); MARLOW; VALE SECRETS all 12 spreads (title, 3 rule pages, 20 unfound nook pages, folios 1-23).
- Not reached: THE CHART ROOM (neither save had the bottled chart; MARLOW's first-chart lines read from code only), and the dusk and night windows (the clock was day).
