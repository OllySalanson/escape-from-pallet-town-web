# THE GREAT LIBRARY (at the top of THE GREEN, door near 57,5) - score 5/10

**Verdict:** A handsome room with almost nothing in it. The "GREAT" library is two lecterns and a golden plinth in a hall whose whole bottom half is bare floorboards, and its best book - the RAIDS primer - gets the one rule a newcomer will lean on hardest (what fleeing a hunter costs) wrong. The golden prize for beating MISTY turns out to be twenty identical "Not found yet" pages, and everyone in the room says exactly the same thing every time you speak to them, whether you have played one raid or ten.

## Problems, worst first

### 1. RAIDS says running from a hunter costs forty seconds - only the first time  [kind: wrong/out-of-date]
- **Seen:** RAIDS, page 4 "The hunters": "Running from them costs forty seconds of your clock." Both saves.
- **Where / repro:** go into THE GREAT LIBRARY, face the red lectern (RAIDS, left of the golden plinth), SPACE, then ARROW RIGHT twice.
- **Screenshot:** (round 2 screenshot) great-library-05-raids-hunters.png
- **Why it is bad:** this is the rule a new player uses to decide whether to fight or flee, and it is wrong after the first flee. A player who believes it and flees three times loses three minutes, not two.
- **Fix:** the true fact is 40s, then 20s more for each earlier flee, capped at 120s (`src/game/run/fleePenalty.ts:9-18`). Write: "Running from them costs forty seconds of your clock the first time, and twenty more every time after." Hold it in `books.test.ts` with `HUNTER_FLEE_PENALTY_STEP_MS` and `HUNTER_FLEE_PENALTY_CAP_MS` beside the base number.

### 2. VALE SECRETS, the reward for beating MISTY, is twenty blank pages  [kind: other]
- **Seen:** mid-game save (MISTY beaten, no nook found yet). The librarian: "You've beaten MISTY, so VALE SECRETS is unchained." The book is 12 spreads: 3 pages of rules, then 20 pages that each say only "WHERE: <place> / Not found yet. A sign there hints at the rest, and this page fills in once you have found it." The same sentence twenty times, and the book always opens at spread 1 with no way to skip to a page that has something on it.
- **Where / repro:** mid-game save, face the golden plinth (7,6), SPACE, ARROW RIGHT x11.
- **Screenshot:** (round 2 screenshot) great-library-15-secrets-unfound.png, (round 2 screenshot) great-library-16-secrets-on-tanglewood.png
- **Why it is bad:** the room is built round this plinth as "the one book in the room that is a prize", and opening it feels like a prank. Twenty pages of a sentence repeated twenty times is the opposite of a reward, and it is eleven page-turns to reach the end.
- **Fix:** one contents spread for unfound nooks ("Not found yet: THE GREY STONES, THE TARN, ...", a line each, ticked as found) instead of a page each; only found nooks get a full page. Or open the book at the newest found page. Say the placeholder sentence once, on the "Hidden nooks" page, not twenty times.

### 3. THE STACKS say "the lectern", singular, with two lecterns in the room  [kind: wrong/out-of-date]
- **Seen:** mid-game save, THE STACKS: "Shelf after shelf of old books. The ones worth reading are open on the lectern and the golden plinth."
- **Where / repro:** mid-game save (MISTY beaten), face either stack at the sides of the room, SPACE.
- **Screenshot:** (round 2 screenshot) great-library-13-stacks-lectern.png
- **Why it is bad:** a plainly wrong sentence, written for a room that had one lectern; the new-save version two lines below in the code gets it right ("open on the lecterns").
- **Fix:** `src/game/base/rooms.ts:994` - "The ones worth reading are open on the lecterns and the golden plinth." (or count `onLecterns.length` as the locked branch does).

### 4. RAIDS says a caught Pokemon takes four squares - only an unevolved one  [kind: wrong/out-of-date]
- **Seen:** RAIDS, page 6 "Catching": "A Pokémon you catch rides home in your pack and takes four squares of it, so leave room."
- **Screenshot:** (round 2 screenshot) great-library-06-raids-catching.png
- **Why it is bad:** catch a second-stage Pokemon and it takes six squares, a third-stage nine; a player who left exactly four squares is refused at the throw.
- **Fix:** true fact at `src/game/pokemon/pokemonCargo.ts:43-47` (2x2, 3x2, 3x3). Write: "takes four squares of it, six if it has evolved and nine if it has evolved twice, so leave room."

### 5. RAIDS names "THE RACK"; the station is THE ARMOURY RACK  [kind: wrong/out-of-date]
- **Seen:** RAIDS page 1 "The jump": "Choose who comes at THE BENCH and what you carry at THE RACK, then step up to the rail and jump."
- **Screenshot:** (round 2 screenshot) great-library-08-raids-jump.png
- **Why it is bad:** a newcomer walks into the hall looking for a caption that says THE RACK and finds THE ARMOURY RACK. Small, but this is the first page of the first book.
- **Fix:** `src/game/base/rooms.ts:2571` names it 'THE ARMOURY RACK'; build the sentence from `ARENA_STATION_NAMES` so it cannot drift again.

### 6. The librarian reads out a controls hint, and greets a ten-raid veteran as a first-timer  [kind: ai-feel]
- **Seen:** both saves, every time: "Welcome to the GREAT LIBRARY! Start with RAIDS, on the first lectern; THE BOLTHOLE is beside it." then "[ARROWS] turn the pages, or click the page you want to turn." then the golden line. The new save splits the last line over two boxes, the first only "The golden one is VALE SECRETS." Talking again gives the identical four boxes. MARLOW likewise repeats his two lines word for word.
- **Screenshot:** (round 2 screenshot) great-library-02-librarian-welcome.png, (round 2 screenshot) great-library-03-librarian-arrows.png, (round 2 screenshot) great-library-04-librarian-split.png
- **Why it is bad:** a person saying "[ARROWS]" is a tooltip in a cardigan, and the book screen already says "[ARROWS] or click a page to turn" on its own bar. "Start with RAIDS" to somebody who has banked the contract chain is the shop greeting on loop. "The first lectern" is ambiguous: the first thing in front of the door is the golden plinth, and the lecterns stand either side of it with no caption.
- **Fix:** cut the arrows line (the book screen says it). Make the welcome once-only, then a short second line ("RAIDS is on the red lectern, left of the plinth."). After the first visit, say something else - which book they have not opened, or a book-themed aside.

### 7. Text runs into the page number at 400x256  [kind: menu-look] (seen at 400x256 only)
- **Seen:** VALE SECRETS page 2 "Clues and rumours": the last line "sells them." sits on top of the page number "2". THE BOLTHOLE page 2 "Your name on the door": "pick one." touches its "2".
- **Screenshot:** (round 2 screenshot) great-library-14-secrets-rumours-overflow.png, (round 2 screenshot) great-library-09-bolthole-name.png
- **Why it is bad:** `books.ts` promises every page fits at the smallest window; at the tool's 400x256 two pages do not quite. Check against a real smallest-window size before ranking it higher.
- **Fix:** trim "Clues and rumours" (the six-name list is the culprit: "Ask around the harbour: the board, the ANGLER, BILL and others know rumours, and THE RUMOUR MILL sells them.") and shorten "Your name on the door" by a clause.

### 8. A library about the game, two-thirds of which is a furniture manual  [kind: bolted-on]
- **Seen:** RAIDS is 8 pages; THE BOLTHOLE is 14 (decorating keys, mouse controls, furniture box keys, where a rug may lie, visiting). The room lays out lecterns for ten books and uses two, leaving the whole lower half bare floor between two bookcases.
- **Screenshot:** (round 2 screenshot) great-library-01-room-new.png, (round 2 screenshot) great-library-11-empty-floor.png, (round 2 screenshot) great-library-10-bolthole-end.png
- **Why it is bad:** "GREAT LIBRARY" over a door, and inside it is one primer and a house manual nearly twice its length. Nothing teaches battles, the pack, money, the keepers or the harbour's own buildings. The decorating pages belong on a card by the house's own door, where you would use them.
- **Fix:** move pages 8-11 of THE BOLTHOLE (decorating, furniture box, mouse, where things go) into the house's own H-hint or a card upstairs; add the books the room has slots for (fights and types, the pack and the locker, the keepers). Until then, put a reading bench or rug in the empty lower half so it does not look unfinished.

### 9. Smaller things
- VALE SECRETS: "WHERE: THE LOST PICNIC, on TANGLEWOOD" - you are in a wood, not on it (`src/game/library/secretsBook.ts:132` uses "on" for every district). Screenshot: (round 2 screenshot) great-library-16-secrets-on-tanglewood.png.
- RAIDS "Help on the way": "[O] calls PROFESSOR OAK on the radio for where to go next" - read in the harbour, where O opens FAVOURS. Add "in a raid". Screenshot: (round 2 screenshot) great-library-07-raids-help.png.
- The door caption reads "2 books to read" (new) / "3 books to read" (mid-game) forever, even after every book has been read (`src/game/base/doorStatus.ts:199` counts books, not unread ones).
- Odd-length books end on a "THE END / Press [ESC] to close the book." page, repeating the bar under it.
- THE BOLTHOLE page 5: "Your bed gives you a dream, but only NURSE JOY heals." reads as a rules lawyer, not a book.

## What is actually good
- The room is lovely to look at: back wall of bookcases and windows, globe and fern either side of the desk, the red runner to the golden plinth, and the windows follow the clock.
- The book screen is a proper drawn book, page turns work on ARROWS, A/D, SPACE and ENTER, and ESC and BACKSPACE both close it. Up/Down rightly do nothing.
- The props all answer, briefly and in voice: the globe with GREYSTONE VALE pencilled on, the end case "not quite flush with the wall" next to MARLOW, who points at a bottle on THE BEACH. That is a real hook.
- RAIDS is short, plain and mostly right; the five-minute, fifteen-second and pack-size numbers are true (`books.test.ts:143-148`). The locked plinth and the librarian agree on what unlocks it, and the unchained line ("Every nook you find gets written up in it") is good.

## Everything I read
- New save (after-first-raid, CHARMANDER): door caption "GREAT LIBRARY 2 books to read"; THE LIBRARIAN x3 talks (4 boxes each); MARLOW x2 (2 boxes each); THE END BOOKCASE; THE STACKS; THE BOOKCASES; THE GLOBE; THE FERN; THE WINDOW (day); VALE SECRETS plinth locked (both lines, from front and back); RAIDS every page (title + 8 + THE END); THE BOLTHOLE every page (title + 14 + THE END); page turning with ARROWS, A, D, SPACE, ENTER, Up/Down; close with ESC and BACKSPACE; O in the library (opens FAVOURS: "Nobody has a favour to ask yet.").
- Mid-game save (MISTY beaten, IVYSAUR): door caption "GREAT LIBRARY 3 books to read"; THE LIBRARIAN x2 (unchained line); MARLOW x2; THE STACKS x2 (golden-open line); THE END BOOKCASE x2; THE WINDOW x2; THE GLOBE; THE FERN; THE BOOKCASES; VALE SECRETS every spread (title, Hidden nooks, Clues and rumours, Keeping what you find, all 20 nook pages: THE LONG SHADOW, THE RED ONE, THE TAPPERS' SUNDAY, THE LOST FOLD, ... THE PINK ONE, THE ELEVENTH STONE, THE KITE THIEF, THE LAPRAS DOLL), reopened (starts at spread 1 again).
- Not reachable: THE CHART ROOM (needs the bottle from THE BEACH; out of this place's scope), MARLOW's chart lines (from code only).
