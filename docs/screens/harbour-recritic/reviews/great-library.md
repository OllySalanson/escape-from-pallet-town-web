# THE GREAT LIBRARY (at the top of THE GREEN, door near 57,5) - score 4/10

**Verdict:** A handsome room with exactly one thing to read in it, and that thing is the instruction leaflet for a house - fourteen pages on furniture, mouse buttons and rugs, handed to a player who has just come home from their first raid and owns no furniture. Ten raids later the golden plinth finally opens and turns out to be a spoiler sheet: twenty "secrets" printed as WHERE / WHEN / BRING / HOLDS tables, so the one thing the vale had left to discover is filled in for you. In between, the books tell you things that stopped being true when the old maps were put away, the librarian and MARLOW say the same speech word for word every visit, and the one bookcase the whole treasure hunt turns on stares back in silence. Pretty shelves; a library in name only.

## Problems, worst first

### 1. THE BOLTHOLE book says furniture comes from raids - on the vale most of it does not  [kind: wrong/out-of-date]
- **Seen:** page 12 "Getting furniture": "Most furniture is found on raids, and a piece lost with the pack is gone. The PRIZE WINDOW at PIER SQUARE sells some for TICKETS". Page 7 "Make it yours": "Find a cushion on a raid, carry it back, and it is yours to put anywhere." Both saves (read in full on the new save).
- **Where / repro:** GREAT LIBRARY, lectern left of the runner (5,6), SPACE, ArrowRight to spread 6 (pages 12-13) and spread 4 (pages 6-7).
- **Screenshot:** ../shots/great-library-11-book-p12-13.png and .../great-library-08-book-p6-7.png
- **Why it is bad:** It is backwards. Of the 21 `found()` furniture pieces (`src/game/home/furniture.ts:216-390`), only the fire cushion, water cushion, surf mat, tropical plant, pretty flowers, gold shield, silver shield and glass ornament can come off the live vale (treasure/rare rows in `src/game/world/trainerBags.ts:169-322`, and `races.ts`). The other thirteen - PIKA CUSHION, BALL CUSHION, both chairs, both desks, BIG PLANT, CUTE TV, three of the mats - are placed only on the retired maps (`src/game/worldMap.ts:485` etc.) and reach a player only through the PRIZE WINDOW (`src/game/minigames/tickets.ts:569`) or the pit's coins, whose own comment calls them "the commoner furniture of the old maps" (`src/game/base/pitCoins.ts:26`). GLITTER MAT and GORGEOUS PLANT cannot be got at all while the old maps are retired. And the cushions that do drop are `treasure` rows - the rarest tier - so "find a cushion on a raid" is a lottery ticket presented as a promise.
- **Fix:** `src/game/library/books.ts:108` -> "Most furniture is won: the PRIZE WINDOW at PIER SQUARE sells it for TICKETS, like a {item:pika-cushion}, and a coin over THE RAID ARENA's rail brings some back. Now and then a trainer's bag holds a piece. Every kind in your POKéDEX gives you a doll of it." `books.ts:88` -> "...and anything you bring home. Win a cushion at the PRIZE WINDOW, and it is yours to put anywhere."

### 2. VALE SECRETS is not a book of secrets, it is the answer key  [kind: other (design)]
- **Seen:** mid-game save, golden plinth. Twenty pages of the form "THE RED ONE / WHERE: THE TARN / WHEN: at night / BRING: an Old Rod or a Good Rod packed / HOLDS: a wild GYARADOS, Lv 20, shiny / Cast a line into the water." Every one of the twenty nooks, every condition, every reward, the shiny flags included.
- **Where / repro:** midgame save, GREAT LIBRARY, face the golden plinth (7,6), SPACE, page through.
- **Screenshot:** ../shots/great-library-19-secrets-spread3.png (and spreads 4 to 14)
- **Why it is bad:** The vale's secrets already have signs and rumours (page 2 says so itself). Beating MISTY now hands over every clue's answer at once, so a player who opens the prize never needs a sign, a rumour or THE RUMOUR MILL again - the reward eats three other features. It also reads like a wiki table, not a book in a library.
- **Fix:** Make each page a riddle written in the voice of whoever wrote the book, and fill in the WHERE/WHEN/BRING/HOLDS facts only once that nook has been found (a page per nook that "writes itself" as the player finds it, like the POKéDEX). Keep the three how-it-works pages.

### 3. A "GREAT LIBRARY" with one book in it, and that book is a furniture manual  [kind: bolted-on]
- **Seen:** new save: door caption "GREAT LIBRARY 1 book to read". Inside: a single lectern (THE BOLTHOLE) and a chained plinth on a 15x12 floor, with nine empty tiles of runner and parquet. The librarian: "The book on the lectern there is all about your house." The one book spends pages 8-11 on decorating keys, mouse buttons, the furniture box and where a rug may lie.
- **Where / repro:** walk up THE GREEN to 57,6, step up.
- **Screenshot:** ../shots/great-library-02-room-new.png and .../great-library-09-book-p8-9.png
- **Why it is bad:** A player just home from a free first raid walks into the grandest building on the green expecting to learn the game - raids, packs, the clock, the hunter, extracting - and is taught where a rug may go. The house manual belongs in the house; a library that teaches the game teaches none of the game.
- **Fix:** Either write the books the room promises (a short RAIDING book - landing, loot, the clock, getting out - should be the first lectern on the runner) or move THE BOLTHOLE book onto the house's own shelf and call this room what it is.

### 4. "beating its keeper fills it" - the game's own word for badges is not "keeper"  [kind: wrong/out-of-date, jargon]
- **Seen:** BOLTHOLE book page 3 "Downstairs": "The badge case has a slot for every badge there is to win, and beating its keeper fills it." New save.
- **Screenshot:** ../shots/great-library-06-book-p2-3.png
- **Why it is bad:** "Keeper" is the base's word for OAK, JOY, BROCK and BILL; the badge case itself was rewritten to drop it for exactly this reason (`src/game/base/badgeCase.ts:206-208`: "Every gym leader and boss out there guards a way on, and has a badge for whoever beats them"). The book still says it, so a newcomer reads that beating BROCK fills the case.
- **Fix:** `src/game/library/books.ts:72` -> "The badge case has a slot for every badge there is to win: beat a gym leader or a boss and theirs goes in."

### 5. The secrets book's rules pages talk like a design document  [kind: ai-feel / wall-of-text]
- **Seen:** page 1: "Each is always there. Most hold their prize only when a condition is met as the raid sets out; a few ask what you do on the way." Page 3: "A prize lost with the pack was never found: its nook holds it again the next time its condition is met. Once a nook has given all it has, it holds a berry." Page 2's list "the board, the ANGLER, the S.S. ANNE's captain, the SEAGALLOP's sailor, BILL and the PRIZE CLERK tell rumours" runs into the page number ("sells them." sits on the "2", seen at 400x256).
- **Screenshot:** ../shots/great-library-17-secrets-spread1.png and .../great-library-18-secrets-spread2.png
- **Why it is bad:** "a condition is met", "was never found" (for a thing you did find and then lost) are rules-engine words. And "Once a nook has given all it has, it holds a berry" is only true of a hidden spot: the code says "a spot holds a berry, a giver says their after-lines" (`src/game/world/secrets.ts:747-748`), and fifteen of the twenty nooks are wild Pokemon or a giver.
- **Fix:** p1 "Twenty nooks lie hidden in GREYSTONE VALE. Most only open on the right raid - the right hour, the right lead, the right thing in your pack. A few watch what you do once you're out there." p3 "Lose the prize with your pack and it's back in its nook next time. A hidden spot you've emptied keeps a berry for you." Cut the rumour list to "Half the harbour trades rumours; THE RUMOUR MILL sells them."

### 6. The same boilerplate stamped on page after page  [kind: ai-feel]
- **Seen:** "It waits there, every raid." on six pages (THE SLEEPER IN THE PINES, THE SILENT PICKET, THE SHADOW IN THE CRYPT, THE ELEVENTH STONE, THE LIGHT THAT ANSWERS, THE KITE THIEF); "It stands there, waiting." on four; "Hidden: step on it, or face it and press [SPACE]." on five. Mid-game save.
- **Screenshot:** ../shots/great-library-24-secrets-spread8.png
- **Why it is bad:** It is a template showing through (`NOOK_WORDS` and the `shutLines` branch in `src/game/library/secretsBook.ts:119-136`); the last line of every page is the one place a nook could have a voice, and it is a form field.
- **Fix:** Give each nook a hand-written closing line in `NOTES` (the three that have one are the best pages), and say "how to search" once on page 1 instead of on every spot page.

### 7. Item names with internal tags leak onto the page  [kind: jargon]
- **Seen:** "HOLDS: a Torn chart (moor)", "a Torn chart (hollow)", "a Torn chart (fold)". Mid-game save.
- **Screenshot:** ../shots/great-library-19-secrets-spread3.png
- **Why it is bad:** "(moor)" reads as a developer's disambiguator, and nothing on the page says this is a piece of THE TREASURE MAP or that MARLOW, standing ten tiles away, wants it.
- **Fix:** Display the pieces as "a piece of an old sea chart" in the book (or rename the items "Sea chart: moor corner"), and add a NOTES line: "MARLOW, by the end bookcase, would want to see it."

### 8. People and the golden plinth get no hint line; the lectern's hint reads like a destination  [kind: menu-look]
- **Seen:** facing THE LIBRARIAN, MARLOW or the chained plinth, the hint line is empty (nothing at the bottom of the screen). Facing the lectern: "[SPACE] THE BOLTHOLE". Both saves.
- **Screenshot:** ../shots/great-library-03-plinth-no-hint.png and .../great-library-04-lectern-hint.png
- **Why it is bad:** Out in the harbour every person shows "[SPACE] NAME"; in here the two people you came to see show nothing (the hint only fires for `opens/reads/chalked/good`, `src/game/scenes/BaseScene.ts:4593-4595`). And "[SPACE] THE BOLTHOLE" in a different building looks like a shortcut home.
- **Fix:** Hint "[SPACE] LIBRARIAN" / "[SPACE] MARLOW" / "[SPACE] LOOK" for the chained book, and "[SPACE] READ THE BOLTHOLE" on a lectern.

### 9. Everybody says the same speech every visit  [kind: other]
- **Seen:** the librarian repeats "Welcome to the GREAT LIBRARY. The book on the lectern there is all about your house. / Step up and have a read. [ARROWS] turn the pages, or just click the one you want. / ..." on every talk, including ten raids in. MARLOW repeats all five boxes ("Charts, young one. / Fifty years I have kept the library's charts, and every one of them has been somewhere. / The sea sends old ones back, now and then. / A bottle washes up on THE BEACH past the pier, and nobody looks at it. / Somebody ought to.") every time. Both saves, three talks each.
- **Screenshot:** ../shots/great-library-13-marlow.png
- **Why it is bad:** Five boxes for a hint MARLOW could give in two; "Welcome" to a regular; "click the one you want" suggests picking a page when a click only turns one. MARLOW's "fifty years" also sits oddly against his own "nobody has seen a chart like this in sixty years" later (`src/game/treasure/treasureMap.ts:246-256`).
- **Fix:** Librarian on a second talk: one line ("Back again? VALE SECRETS is on the plinth whenever you want it."). MARLOW: "Charts, young one. The sea sends old ones back - there's a bottle on THE BEACH past the pier nobody's bothered to open." then, on repeat, "Still on THE BEACH, that bottle."

### 10. Small things that are untrue or broken
- THE STACKS still say "The one worth reading is open on its lectern" after VALE SECRETS is unchained (mid-game save; `src/game/base/rooms.ts:990-992` counts lecterns only, never the plinth). Fix: count the books that open. Screenshot: .../great-library-32-lower-stack.png
- The end bookcase (13,0) - the one the treasure hunt opens - says nothing when faced ("nothing answered", mid-game save), while every other shelf has a line. Fix: "This end case doesn't sit quite flush with the wall." Screenshot: .../great-library-31-end-bookcase-silent.png
- The door caption says "1 book to read" / "2 books to read" for ever, even after every page has been read (`src/game/base/doorStatus.ts:198-201`), so it reads like an unfinished job. Fix: say it only for a book not yet opened, else "VALE SECRETS" / nothing.
- VALE SECRETS stops dead at page 23 with no "THE END" spread (THE BOLTHOLE book has one); ArrowRight just does nothing. Screenshot: .../great-library-30-secrets-spread14.png
- Two-line headings ("THE TAPPERS' SUNDAY", "THE HERON THAT IS NOT", "The pennants and the calendar") sit right on the gold rule, and page 20's last line "Stand still, and something answers." touches its page number (seen at 400x256). Screenshot: .../great-library-27-secrets-spread11.png
- "I unchain it for whoever beats MISTY" to a player who has never met or been told of MISTY (new save; librarian and plinth). Fix: "...for whoever beats MISTY, the gym leader at the coast."

## What is actually good
- The room looks right: back wall of cases with three windows that really follow the clock ("Blue sky over the tree tops."), a desk, globe and fern; the globe line ("Somebody has pencilled GREYSTONE VALE onto it by hand") is the best sentence in the building.
- The book screen is lovely: a real open book on a plinth, page turns on arrows, A/D, SPACE and ENTER, ESC and BACKSPACE both close, nothing ever stuck.
- The lock is now said in three places (plinth, librarian, door count) and unlocks correctly on the MISTY save.
- The secret pages with hand-written notes ("A STRENGTH boulder on HIGH MOOR shuts the fold.", "Behind MISTY's gate.") show what every page could be.

## Everything I read
- New save (after-first-raid): exterior and door caption ("GREAT LIBRARY 1 book to read"); THE LIBRARIAN x3; the chained golden plinth x2; THE BOLTHOLE book, all 14 pages and THE END, turned with ArrowRight, A, Space and closed with Backspace; THE STACKS; THE GLOBE; THE FERN; THE WINDOW; THE BOOKCASES; MARLOW x3; the mat and way out.
- Mid-game save (MISTY beaten): exterior ("2 books to read"); THE LIBRARIAN x2 (unlocked line); VALE SECRETS, all 23 pages (3 rules pages, 20 nooks) turned with ArrowRight and Enter, closed with Escape; MARLOW x2; THE STACKS (top-left, bottom-left, bottom-right); THE GLOBE; THE FERN; two of the three windows; THE BOOKCASES; the end bookcase (silent).
- Code checked: `src/game/library/books.ts`, `secretsBook.ts`, `secretsBookLock.ts`, `src/game/base/rooms.ts` (library and house), `badgeCase.ts`, `doorStatus.ts`, `homeLines.ts`, `homeGarden.ts`, `doors.ts`, `harbourPlaces.ts`, `src/game/home/furniture.ts`, `src/game/world/trainerBags.ts`, `src/game/world/secrets.ts`, `src/game/base/pitCoins.ts`, `src/game/minigames/tickets.ts`, `src/game/treasure/treasureMap.ts`. Claims found true: the house's place on KEEPERS' ROW, the downstairs telly and window, MY PC, PALLET BLOCKS, the garden's six, the PRIZE WINDOW selling a Pika Cushion, PIER SQUARE, THE RUMOUR MILL and PRIZE CLERK existing, the twenty nooks.
