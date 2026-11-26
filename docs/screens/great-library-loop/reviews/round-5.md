# THE GREAT LIBRARY (at the top of THE GREEN, door near 57,5) - score 6/10

**Verdict:** Credit where it's due: since last round the golden book counts what you've found, says what each nook asks for, and the librarian finally welcomes a veteran back. But the room that exists to tell the truth now tells two lies that cost raids. RAIDS still says the raid is simply lost fifteen seconds after zero, when the game now throws a last-stand fight at you. VALE SECRETS says "WHEN: any raid" over a crypt you can only reach at night. And the house manual's second page still writes over its own page number. Lovely book screen, honest-ish books, and a room full of people on tape loops.

## Problems, worst first

### 1. RAIDS says the raid is lost after the fifteen seconds; the game now gives you a last stand  [kind: wrong/out-of-date]
- **Seen:** new save. RAIDS page 2, "Five minutes": "When it reaches zero you have fifteen seconds to get out, and then the raid is lost."
- **Where / repro:** GREAT LIBRARY, red lectern at 5,6 (stand 5,8, face up), ArrowRight once.
- **Screenshot:** (round 5 screenshot) great-library-02-raids-five-minutes.png
- **Why it is bad:** It's the first book the librarian sends you to, and its one rule about the end of a raid is out of date. When the fifteen seconds run out, the game now brings the nearest enraged hunter (or the keeper of your district) to your side for a fight. Win it and you're carried out by the nearest open exit; only losing or fleeing loses the raid. A player who reads this gives up at 0:15 when they could have fought their way home.
- **Fix:** "When it reaches zero you have fifteen seconds to get out. Then a hunter comes for you: beat it and you fight your way home; lose, and the raid is lost." True fact: `src/game/scenes/WorldScene.ts:11423` (`makeLastStand` before `resolveExpiredRun`) and `:11437-11488`. `ENRAGE_GRACE_MS = 15_000` is at `src/game/run/RunManager.ts:13`. Add the last stand to the numbers test in `books.test.ts` so the next change to the ending fails there.

### 2. VALE SECRETS says "WHEN: any raid" for a crypt only a night raid can reach  [kind: wrong/out-of-date]
- **Seen:** mid-game save. Page 17, THE SHADOW IN THE CRYPT: "WHERE: THE CRYPT / WHEN: any raid / BRING: lead with a GHOST type / HOLDS: not found yet. / It waits there, every raid. Under THE MOOR CHAPEL."
- **Where / repro:** golden plinth at 7,6 (stand 7,8, face up), ArrowRight 8 times (spread 9).
- **Screenshot:** (round 5 screenshot) great-library-08-secrets-crypt-any-raid.png
- **Why it is bad:** The page says it twice: any raid, every raid. But THE MOOR CHAPEL is reached only by the night track off High Moor. By day the fog turns you back. A player who brings a Ghost lead on a day raid on the book's word walks into fog. This is exactly the "WHEN: any raid" over a gated nook that the comment in `unfoundSecretPage` says was fixed. It wasn't: `secretPage` still prints `WHEN: any raid` for every nook without a time condition.
- **Fix:** Read the night gate from the place, or failing that add a NOTES-style override: "WHEN: at night (the chapel's track opens only then)". True fact: `tools/mapcraft/worlds/greystoneVale/moorChapel.ts:8` ("by day the fog turns it back (a night track)"), `:194-198` and `:236`; the secret itself is at `src/game/world/secrets.ts:532` ("a place only a night raid reaches") and `:541` (its only condition is a Ghost lead). Printer: `src/game/library/secretsBook.ts:128`. On every other non-time page, drop either "WHEN: any raid" or "It waits there, every raid." (see 6).

### 3. THE BOLTHOLE page 2 still runs onto its page number  [kind: bug]
- **Seen:** new save. THE BOLTHOLE, spread 2, left page "Your name on the door": the last line "pick one." sits on the same baseline as the folio "2", one character's width away. The heading "Your name on the door" also wraps to two lines, which is what pushes the text down.
- **Where / repro:** gold lectern at 3,6 (stand 3,8, face up), ArrowRight once.
- **Screenshot:** (round 5 screenshot) great-library-01-bolthole-p2-folio-overlap.png
- **Why it is bad:** Seen at 400x256. `books.test.ts` says every page fits at that very size, so the guard is still too loose. VALE SECRETS page 2 was shortened last round for the same fault; this page was flagged too and left alone.
- **Fix:** Heading "Your name" (one line), and the text "Once you have a name, it goes over your door and over your head. You're asked for it when your first raid comes home, and at CONTINUE until you pick one." Then make the fit test reserve the folio's line and count a wrapped heading.

### 4. MARLOW and the librarian are still tape loops  [kind: ai-feel]
- **Seen:** both saves. MARLOW, talked to three times on the new save and twice on the ten-raid save, says word for word: "MARLOW: Charts, young one. I've kept this library's charts all my life." / "The sea sends old ones back. There's a bottle on THE BEACH past the pier, and nobody's bothered to open it." The librarian says her two lines every time on the mid-game save: "Welcome back to the GREAT LIBRARY." / "You've beaten MISTY, so VALE SECRETS is unchained. Every nook you find gets written up in it." Holding the BOTTLED CHART, she says exactly the same, though her caption is "Knows where every book is".
- **Where / repro:** MARLOW: stand 13,2, face right. Librarian: stand 7,5, face up. SPACE, repeat.
- **Screenshot:** (round 5 screenshot) great-library-13-room-mid.png
- **Why it is bad:** "Welcome back" on the fifth talk in a minute is a doormat, not a person. Neither of them ever notices that you've read a book, found a nook or picked up the chart she sent you towards.
- **Fix:** In `librarianLines` (`src/game/base/rooms.ts:909`), the welcome only on the first talk of a visit, then one line that reacts to something: the chart in your bag ("That chart? MARLOW, by the end case."), the found count ("Two nooks written up. Eighteen to go."). For MARLOW (`src/game/treasure/treasureMap.ts:252-256`), on the second talk: "Still on the sand, that bottle. Past the pier."

### 5. You can still walk behind the librarian's desk  [kind: other]
- **Seen:** new save. `walk 8 2` and `walk 6 2` both work: you stand behind the desk beside her with CHARMANDER, and the talk works from there.
- **Where / repro:** from anywhere in the room, walk to 8,2.
- **Screenshot:** (round 5 screenshot) great-library-06-behind-the-desk.png
- **Why it is bad:** It was raised last round and nothing changed. A counter you can stroll round isn't a counter, and the picture of you and your Pokémon piled onto her is plain messy.
- **Fix:** Make tiles 5-9 on y=2 solid (or at least 6 and 8).

### 6. VALE SECRETS bends its own labels and repeats itself  [kind: ai-feel]
- **Seen:** mid-game save. "BRING:" is used for things you can't bring: "BRING: the CASCADE BADGE won" (p13), "BRING: standing still for 12 seconds, no step and no turn" (p20), "BRING: dry boots: not a step in tall grass all raid" (p23), "BRING: one Pokémon in the party, and no more" (p19). Six pages say "WHEN: any raid" and then end "It waits there, every raid." (pp12, 16, 17, 19, 21, 22). Item names drift from the game's capitals: "a Poké Flute", "an Old Rod or a Good Rod", "a Pickaxe".
- **Where / repro:** golden plinth, spreads 7-12.
- **Screenshot:** (round 5 screenshot) great-library-12-secrets-bring-heron.png and (round 5 screenshot) great-library-11-secrets-sleeper.png
- **Why it is bad:** It reads like a form generator, because it is one. "BRING: dry boots: not a step in tall grass all raid" has two colons and a riddle in one line.
- **Fix:** Call the label "NEEDS:" (or split it into BRING for items and DO for acts: "DO: stand still for 12 seconds"). Drop the closer "It waits there, every raid." whenever WHEN already says "any raid". Run item names through the same capitals the other books use (`conditionWords`, `src/game/library/secretsBook.ts:70-109`).

### 7. Smaller untruths in THE HARBOUR and THE BOLTHOLE  [kind: wrong/out-of-date]
- **Seen:** new save.
  - BOLTHOLE p6: "Everything in the house can be moved: the table, the plants, and anything you bring home." The kitchen, cupboard, telly, badge case, bed, MY PC, wardrobe, console and bookcase are fixed props. Only furniture pieces move (`src/game/base/rooms.ts:2299-2308`, `src/game/home/arrangement.ts:29-31`).
  - BOLTHOLE p9: "A piece stands on the floor, never on a mat." Only the door mat and stair mats are banned. A piece may stand on a SURF or FIRE BLAST MAT (`src/game/home/arrangement.ts:29-32`). And "a doll or cushion may sit on a desk or table" is not true of the big 2x2 dolls (`src/game/home/furniture.ts:426-435`).
  - HARBOUR p1: "he has a gift for every few kinds you own". The gifts come at 10, 25, 50, 75, 100, 125 and 151 kinds, so mostly one every 25 (`src/game/hub/pokedex.ts:66-103`).
  - HARBOUR p6: "THE BATTLE ARENA holds practice bouts where nothing is lost." Nothing is lost, true, but its bouts are a cup paying 50/100/200 TICKETS (`src/game/arena/cups.ts:43-47`). Gym practice is in THE RAID ARENA (`src/game/base/gymPractice.ts:9`).
  - HARBOUR p4: BILL "swaps his tools for the parts you bring home". His barters are held gear and evolution stones (`src/game/hub/trader.ts:310-420`).
- **Screenshot:** (round 5 screenshot) great-library-04-pika-cushion.png
- **Fix:** "Every piece of furniture can be moved: the table, the plants and anything you bring home." / "A piece never stands on the door mat or the stairs." / "a small doll or a cushion may sit on a desk or table." / "he has a gift for the first ten kinds you own, and more after." / "THE BATTLE ARENA runs bouts for TICKETS where nothing of yours is lost." / "swaps held items and stones for the parts you bring home."

### 8. The house manual is still the biggest book, and its key page clashes with the harbour  [kind: bolted-on / wall-of-text]
- **Seen:** new save. THE BOLTHOLE is 12 pages: decorating keys, the furniture box, placement rules, getting furniture, the garden, visiting. RAIDS, the book about the game, is 8. Page 8: "[Q] and [E] take them out one by one, and [X] puts a piece back in." X is POKéDEX everywhere in the harbour, on the hint line outside this very door. Page 10 still says "like a Pika Cushion", the only mixed-case item name in an all-capitals library.
- **Where / repro:** gold lectern, spreads 4-6.
- **Screenshot:** (round 5 screenshot) great-library-04-pika-cushion.png
- **Why it is bad:** Nobody memorises five decorating keys at a lectern three streets from the house. That belongs on the decorate hint line, where the keys work.
- **Fix:** Cut pages 7-9 (Decorating, Your furniture box, Where things go) into one page: "Press [H] at home to decorate; the keys are on the line at the bottom." Write item names in capitals (`{item:...}` should print the display name upper-cased in books).

### 9. The golden book has no END, and the door says "3 books to read" forever  [kind: other]
- **Seen:** RAIDS, THE HARBOUR and THE BOLTHOLE each end on a "THE END - Press [ESC] to close the book." page. VALE SECRETS stops dead at pages 22/23 (THE KITE THIEF / THE LAPRAS DOLL). ArrowRight, Space and Enter do nothing there. Outside, the door caption read "GREAT LIBRARY 3 books to read" on the way in and after I'd read all three, and "4 books to read" on the ten-raid save.
- **Screenshot:** (round 5 screenshot) great-library-10-secrets-no-end.png
- **Why it is bad:** The prize book is the one without a proper ending. And "to read" on a door means "unread": the count never goes down (`booksToRead`, `src/game/base/doorStatus.ts:197-200`, counts openable books, not unread ones), so the caption is wallpaper.
- **Fix:** Add an END page to VALE SECRETS (with the found count: "Two of twenty found. The rest are out there."). Track books read and make the caption "1 book to read" / "all read".

### 10. The room's hint line still hides the harbour keys  [kind: menu-look]
- **Seen:** both saves. Outside: "[L] LOOK [O] FAVOURS [B] THINGS [P] TEAM [X] DEX [M] MAP [T] SAY". Inside: "[SPACE] CHARMANDER [DOWN] OUT". Pressing O inside opened FAVOURS fine.
- **Screenshot:** (round 5 screenshot) great-library-05-room-new.png
- **Why it is bad:** THE HARBOUR book's own last page says these keys work "Anywhere in the harbour", and the one room that teaches them hides them. The book screen's own bar, "[ARROWS] or click a page to turn", is the only mixed-case keys line in the game. Its heading "Anywhere in the harbour" also still wraps onto two lines with the rule under the second ((round 5 screenshot) great-library-03-harbour-anywhere-wrap.png).
- **Fix:** Keep the harbour keys on room hint lines. Make the book bar "ARROWS TURN · ESC CLOSE", and the heading "Anywhere".

### 11. MARLOW's chart scene is ten boxes before you can move  [kind: wall-of-text]
- **Seen:** mid-game save, after picking up the bottle (out of the room, on THE BEACH) and talking to MARLOW: nine boxes in a row ("Is that... a chart? ... CLOSER." through "Pin your piece on it. It will show us where the treasure is."). Then pinning adds six more, ending "And look at you and IVYSAUR. Mighty! It's yours to finish." and "Try the board on THE QUAY, the SAILOR on THE QUAY and the CAPTAIN on THE LONG PIER after dark."
- **Screenshot:** (round 5 screenshot) great-library-14-chart-pin.png
- **Why it is bad:** It's the one real moment in this building and it's a monologue. "Nobody has seen a chart like this in sixty years", "a room nobody has been into for years", "Nobody knows it is here": three nobodies in nine boxes. "Mighty!" is a filler compliment.
- **Fix:** Cut "Salt-stained... MAGIKARP" to one box and drop "Nobody has seen a chart like this in sixty years". Cut "And look at you and IVYSAUR. Mighty!". Make the leads line "Ask at the board and the SAILOR on THE QUAY, or the CAPTAIN on THE LONG PIER after dark."

## What is actually good
- Most of last round's list is fixed. VALE SECRETS' title page now says "none found yet", each unfound page says what it asks for (lead type, rod, Pickaxe, badge, flute), and page 2 fits. RAIDS has "on ARENA SQUARE at the west end" and "up to two minutes", and both are true (`src/game/run/fleePenalty.ts:9-11`). A ten-raid player is welcomed back.
- RAIDS' other numbers hold up: five minutes, 12/18/24/30 squares, 4/6/9 squares for a catch, the partner kept on a wipe, and O/M/P doing what it says.
- The book screen is still a pleasure. A drawn open book, real folios, and Arrows, A/D, Space, Esc and Backspace all behave.
- The furniture lines are short and human. "Somebody has pencilled GREYSTONE VALE onto it by hand." "This end case doesn't sit quite flush with the wall." That one pays off: the case swings open and THE CHART ROOM's gap is a nice reveal.

## Everything I read
- **New save (after-first-raid.json):** door caption "GREAT LIBRARY 3 books to read" (in and out); room hint line; THE LIBRARIAN x4 (from the front, and once from behind the desk); RAIDS (title + 8 pages + END); THE HARBOUR (title + 7 pages + END); THE BOLTHOLE (title + 12 pages + END); VALE SECRETS chained plinth (2 lines); THE STACKS; THE GLOBE; THE FERN; THE WINDOW (day: "Blue sky over the tree tops."); THE BOOKCASES; THE END BOOKCASE; MARLOW x3; L (LOOK) captions; O (FAVOURS) from inside the room.
- **Mid-game save (midgame.json):** door caption "4 books to read"; THE LIBRARIAN x3 (once holding the BOTTLED CHART); VALE SECRETS all 12 spreads (title "none found yet", 3 rule pages, 20 unfound nook pages); book keys A, D, Space, Enter, ArrowLeft, Backspace; reopening starts back on spread 1; THE STACKS (golden-plinth line); MARLOW x2 before the chart; the BOTTLED CHART fetched from THE BEACH; MARLOW's first-chart scene into THE CHART ROOM; THE CHART pin question and pinning; THE CHART after pinning; MARLOW x2 in THE CHART ROOM; the open END BOOKCASE line; GLOBE, FERN, WINDOW and BOOKCASES again.
- **Not seen:** the dusk and night windows (the clock was day both times); a found nook's full page (neither save had found one).
