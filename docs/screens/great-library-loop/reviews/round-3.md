# THE GREAT LIBRARY (at the top of THE GREEN, door near 57,5) - score 6/10

**Verdict:** A handsome room with a page-turning book that genuinely feels like a book, and three lecterns that finally teach the game rather than the soft furnishings. Then you open the golden prize, the thing you beat a gym leader to unchain, and find twenty pages of the same sentence pasted under twenty headings, fourteen of which tell you "WHEN: any raid" about nooks that will give you nothing on any raid. The librarian cannot count lecterns or conjugate a verb, and the one page you need most bleeds into its own page number. "Great" is doing a lot of work for four books.

## Problems, worst first

### 1. VALE SECRETS says "WHEN: any raid" about nooks that never give on any raid  [kind: wrong/out-of-date]
- **Seen:** mid-game save. The unchained golden book's unfound pages read, for example, "X MARKS THE SPOT / WHERE: SMUGGLERS' COVE / WHEN: any raid / What to bring, and what it holds: the sign there hints, and this page fills in once you find it." The same "WHEN: any raid" sits on THE NAVVIES' WAGER, THE OLD SHELLS, THE SLEEPER IN THE PINES, THE STICKY TONGUE, THE SILENT PICKET, THE SHADOW IN THE CRYPT, THE PINK ONE, THE ELEVENTH STONE, THE HERON THAT IS NOT, THE LIGHT THAT ANSWERS, THE KITE THIEF and THE LAPRAS DOLL - fourteen of twenty pages.
- **Where / repro:** midgame.json, walk up the runner to the golden plinth (7,6), SPACE, turn to spreads 3-12.
- **Screenshot:** (round 3 screenshot) great-library-13-x-marks-any-raid.png
- **Why it is bad:** Every one of those nooks has a condition. X MARKS THE SPOT needs the whole four-piece treasure chart (`src/game/world/secrets.ts:429`, `when: [{ kind: 'whole-chart' }]`); THE NAVVIES' WAGER needs a FIGHTING lead (`secrets.ts:416`); THE SLEEPER needs a Poké Flute (`secrets.ts:444`), and so on down the list. A player who believes the book walks out on an ordinary raid, finds nothing and decides the book lies - which it does. The book's own page 1 even says "Most hold their prize only when a condition is met", then prints "any raid" under most of them.
- **Fix:** `unfoundSecretPage` (`src/game/library/secretsBook.ts:179`) fills WHEN with only the time conditions and falls back to "any raid". On an unfound page, never print "any raid" when the secret has a non-time condition: print "WHEN: the sign there says" or drop the WHEN line, or write "WHEN: any time of day" plus "BRING: something - the sign there hints". Keep "any raid" only for a secret whose `when` is genuinely empty.

### 2. Twenty pages of one pasted sentence - the golden prize is a form letter  [kind: wall-of-text / ai-feel]
- **Seen:** mid-game save, every unfound VALE SECRETS page ends with exactly "What to bring, and what it holds: the sign there hints, and this page fills in once you find it." - forty times across twenty spreads, word for word.
- **Where / repro:** as above, turn through spreads 3 to 12.
- **Screenshot:** (round 3 screenshot) great-library-15-secrets-boilerplate.png
- **Why it is bad:** The book the librarian dangles as the reward for beating MISTY turns out to be a checklist of place names with the same sentence pasted under each one. Clicking through twelve spreads to read one line twenty times is padding, and a reader skims everything after the second spread. It also gives away WHERE and WHEN for every nook for free, which overlaps with the board's rumours (`src/game/world/rumours.ts:4-17` - a rumour gives "two of three facts", and the board's THE LONG SHADOW rumour gives exactly where + when, which this book now hands out at no cost).
- **Fix:** Say the "fills in once you find it" rule once, on the "Hidden nooks" page, and leave each unfound page as WHERE/WHEN plus a single faint "Not found yet." Or show unfound nooks as one contents page ("Found 0 of 20") listing the names, and give a full page only to found ones. Either way, check it against the rumour economy so the book does not undercut THE RUMOUR MILL.

### 3. The librarian's one useful line is wrong three ways  [kind: wrong/out-of-date]
- **Seen:** both saves: "Start with RAIDS, on the first lectern; THE HARBOUR and THE BOLTHOLE is beside it."
- **Where / repro:** walk up the runner and talk to THE LIBRARIAN across her desk.
- **Screenshot:** (round 3 screenshot) great-library-02-librarian-is-beside-it.png
- **Why it is bad:** (a) "THE HARBOUR and THE BOLTHOLE **is**" - wrong verb. (b) Nothing on screen says which lectern is "first": reading the row left to right you meet THE BOLTHOLE (3,6), then RAIDS (5,6), then the golden plinth, then THE HARBOUR (9,6). (c) THE HARBOUR is not beside RAIDS: the golden plinth stands between them (`LIBRARY_LECTERNS`, `src/game/base/rooms.ts:883-886`, places books at x 5, 9, 3...; `GOLDEN_PLINTH` x 7, `rooms.ts:892`).
- **Fix:** `src/game/base/rooms.ts:914` - "Start with RAIDS, the red book left of the gold one. THE HARBOUR and THE BOLTHOLE are either side." Or name lecterns by colour, which the player can actually see. Use "is" for one book and "are" for more.

### 4. "Clues and rumours" runs into its own page number  [kind: bug / menu-look]
- **Seen:** mid-game save, VALE SECRETS spread 2, left page: the last line "sells them." is printed over the page number "2".
- **Where / repro:** open VALE SECRETS, press Right once.
- **Screenshot:** (round 3 screenshot) great-library-12-secrets-overflow.png (seen at 400x256; the book is drawn in the canvas, so it is the game's own pixels, and `books.ts:18` claims every page fits "at the smallest window").
- **Why it is bad:** Text running into a page number is the clearest sign nobody looked at the page. THE BOLTHOLE's "Your name on the door" (spread 2) is one line away from the same thing (great-library-06-bolthole-crammed-page.png).
- **Fix:** Split the page (`src/game/library/secretsBook.ts:154`): "Clues" - "A sign by every nook hints at what it wants." and "Rumours" - "The board, the ANGLER, the S.S. ANNE's captain, the SEAGALLOP's sailor, BILL and the PRIZE CLERK all know a rumour or two. THE RUMOUR MILL sells them." Also tighten the layout test so it measures against the page-number line, not the page edge.

### 5. "Heals your team for nothing ... and the first heal each day is free"  [kind: ai-feel / wrong]
- **Seen:** both saves, THE HARBOUR book, page 2 (The POKéMON CENTER): "NURSE JOY heals your team for nothing. Only bringing a Pokémon round from a faint costs time, off your next raid, and the first heal each day is free."
- **Where / repro:** THE HARBOUR lectern (9,6), Right once.
- **Screenshot:** (round 3 screenshot) great-library-04-heal-free-first-heal-free.png
- **Why it is bad:** It says healing is free, then says the first heal each day is free, which makes a reader wonder what the other heals cost. The truth is narrower: the daily freebie is the fainted revive (`src/game/hub/recovery.ts:267-279`, `isFreeHealDay` only matters when a patient `isFainted`).
- **Fix:** `src/game/library/books.ts:114` - "NURSE JOY heals your team for nothing. Only a fainted Pokémon costs anything: time off your next raid, except the first one each day. Your boxes are on BILL'S PC there."

### 6. RAIDS says you "put" things in THE LOCKER - you do not have to  [kind: wrong/out-of-date]
- **Seen:** both saves, RAIDS page 7 (Losing): "...all but your partner and whatever you put in THE LOCKER."
- **Screenshot:** (round 3 screenshot) great-library-05-raids-losing.png
- **Why it is bad:** The locker fills itself, best Pokémon first, until the player touches it (`src/game/hub/secureAutofill.ts`, `DeploymentFlow.refillSecureSlot()`; docs/agents/raid-and-stash.md "The secure container fills itself"). A new player reads this as a chore they skipped and worries their last raid was unprotected.
- **Fix:** `books.ts:92` - "...all but your partner and whatever is in THE LOCKER, which keeps your best for you unless you change it."

### 7. You can walk behind the librarian's desk and stand at her elbow  [kind: bug]
- **Seen:** new save. Walking to THE LIBRARIAN from MARLOW's corner put me at tile 8,2, behind the desk beside her, where her caption box then covered both of us and the back shelves.
- **Where / repro:** talk to MARLOW (14,2), then `walk THE LIBRARIAN`: the route goes along the back wall to 8,2.
- **Screenshot:** (round 3 screenshot) great-library-03-behind-the-desk.png
- **Why it is bad:** A counter you can stroll round is no counter. The room is drawn as staff-behind-desk, and the row y=2 is open floor from the stacks to MARLOW.
- **Fix:** Make tiles 6..8 and the row behind the desk solid (extend `solid` in `drawLibrary`, `src/game/base/rooms.ts:1052`), so she is only spoken to across the desk front (`deskFront`, which already exists).

### 8. Nobody says anything new the second time, or the tenth raid  [kind: other]
- **Seen:** both saves. MARLOW says the same two lines every time ("Charts, young one..." / "The sea sends old ones back..."). The librarian tells a ten-raid player with a gym badge "Start with RAIDS, on the first lectern" exactly as she told the newcomer.
- **Screenshot:** (round 3 screenshot) great-library-09-marlow.png
- **Why it is bad:** The room's two people are signposts on a loop. A mid-game player gets a beginner's welcome.
- **Fix:** Librarian: once the player has finished a raid or two, skip "Start with RAIDS" and lead with the golden book's news ("You've found 0 of 20 nooks"). MARLOW: a second line on a repeat talk.

### 9. Book page ragged edges  [kind: menu-look]
- **Seen:** headings that wrap put the rule under the second line ("Anywhere in the / harbour", "The pennants and the / calendar", "THE TAPPERS' / SUNDAY", "THE SLEEPER IN THE / PINES", "THE HERON THAT IS / NOT") while their neighbours' rules sit on line one, so facing pages start at different heights. "The POKéMON CENTER" is the one mixed-case place heading among all-caps ones. RAIDS ends on a "THE END - Press [ESC] to close the book." page; THE HARBOUR and THE BOLTHOLE just stop.
- **Screenshot:** (round 3 screenshot) great-library-07-two-line-heading.png, great-library-17-secrets-wrapped-heading.png, great-library-10-raids-end.png (400x256)
- **Fix:** Shorter headings ("Any time", "Pennants", "POKéMON CENTER"), and either give every book a closing page or none.

### 10. A "GREAT" library of three lecterns and a sea of empty floor  [kind: other]
- **Seen:** both saves. The whole bottom half of the room, under the lecterns, is bare boards with two stacks in the corners; `LIBRARY_LECTERNS` has ten places and three are used.
- **Screenshot:** (round 3 screenshot) great-library-16-midgame-room.png
- **Why it is bad:** Of the books, the longest (13 pages) is about decorating your house, while battle, catching, types and the gym leaders get no book at all.
- **Fix:** A BATTLES book (types, status, switching, items in a fight) on the second row would earn the name; or furnish the lower half (reading tables, a rug) so the room does not look half-built.

## What is actually good
- The book screen itself: a real open book, two pages a spread, page numbers, Right/Left/D/A to turn, Esc and Backspace to close. Each book's title page has its own colour band.
- RAIDS is a genuinely good primer, and its numbers check out: five minutes (`RAID_DURATION_MS`), fifteen seconds' grace (`ENRAGE_GRACE_MS`, `src/game/run/RunManager.ts:13`), forty seconds then twenty more to flee (`src/game/run/fleePenalty.ts:9-10`), packs of 12/18/24/30, cargo 4/6/9 squares.
- The furniture's small lines are short and have a voice: "Somebody has pencilled GREYSTONE VALE onto it by hand", "A fern in a brass pot, watered on the hour", the end case that "doesn't sit quite flush with the wall" next to MARLOW - a proper bit of foreshadowing.
- The chained golden plinth tells you who unchains it and why, both on the plinth and from the librarian, and unchains for real once MISTY is down.
- MARLOW's bottle line is true (`BEACH_BOTTLE`, `src/game/treasure/treasureMap.ts:163`).

## Everything I read
- Outside: door caption "GREAT LIBRARY / 3 books to read" (new), "4 books to read" (mid-game).
- THE LIBRARIAN: three lines (new, locked version), three lines (mid-game, unchained version), each read twice.
- MARLOW: both lines, talked to three times across two saves.
- Lecterns: RAIDS (title + 8 pages + THE END, all 5 spreads), THE HARBOUR (title + 7 pages, 4 spreads), THE BOLTHOLE (title + 13 pages, 7 spreads). Read in full on the new save.
- Golden plinth: locked lines (new save); VALE SECRETS opened and read in full on the mid-game save (title + 3 rule pages + 20 nook pages, 12 spreads).
- THE STACKS (both wordings), THE BOOKCASES, THE GLOBE, THE FERN, THE WINDOW ("Blue sky over the tree tops."), THE END BOOKCASE (both saves).
- Book controls: Right, Left, D, ArrowDown (does nothing), Space (does nothing), Escape, Backspace.
- Claims checked against code: raid clock, grace, flee penalty, pack sizes, locker autofill, Center healing, rumour givers, secrets' conditions, beach bottle, lectern positions.
