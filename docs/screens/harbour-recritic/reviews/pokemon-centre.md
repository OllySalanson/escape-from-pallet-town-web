# THE POKéMON CENTER (on KEEPERS' ROW, door near 19,11) - score 6/10

**Verdict:** The bones are FireRed's and they are good: walk in, press SPACE on the mat, Nurse Joy asks one question, your Poké Balls sit on her counter until she has treated them. Then the room starts lying to you. The healing machines' own plaques quote prices that stopped being true the moment Brock built the second one, the PC talks about "this raid" when there isn't one, and BILL'S PC quietly does Nurse Joy's job as well, so the room has two nurses and one of them is a filing cabinet. Joy herself has exactly one line once the welcome is over, and when she does have news she says "free" three ways in three boxes.

Saves used: **new** = `after-first-raid.json` (CHARMANDER 12/18). **mid** = `midgame.json` (IVYSAUR 17, DIGLETT 3, both fit, nothing built). Because the mid-game save is all fit and has nothing built, I also loaded two copies of it with only the state changed, so I could see Joy's pricing and the built machines: **mid-hurt** = IVYSAUR fainted, DIGLETT 5/13 poisoned, HEALING MACHINE I built, today's free heal already used. **mid-ward** = both fainted, HEALING MACHINE I and II and THE WARD built.

## Problems, worst first

### 1. HEALING MACHINE I's plaque gives the wrong price once Machine II is built  [kind: wrong/out-of-date]
- **Seen:** (mid-ward) Walk up to the left-hand machine: "HEALING MACHINE I - revive for 0:15 of a raid." The right-hand one says "HEALING MACHINE II - revive for 0:05 of a raid." Both stand in the same room, giving two prices for the same revive.
- **Where / repro:** Build Healing machine I and II, go into the Center and SPACE on the left machine (2,0, stand at 3,3).
- **Screenshot:** ../shots/pokemon-centre-21-machine-I-stale.png (and -22-machine-II.png for the other plaque)
- **Why it is bad:** A price tag in the room where you pay is the one thing that must be right. A player reading the plaque nearest the door is told 0:15 when they will really pay 0:05.
- **Fix:** The true price is the cheapest machine standing: `recoveryPriceShare` takes the minimum of every built share (`src/game/hub/workshop.ts:260-261`). But each plaque is written from its own share alone (`reviveNote(upgradeId)`, `src/game/base/rooms.ts:1262-1265`). Either word Machine I's plaque from the price the save really pays, or drop Machine I's price once II stands (e.g. "HEALING MACHINE I - the old one. II does it in 0:05.").

### 2. The PC says "costs this raid nothing" when no raid is running, and "full restore" is an item's name  [kind: wrong/out-of-date]
- **Seen:** (mid-hurt) BILL'S PC, cursor on the poisoned DIGLETT: "Pokémon Center: full restore, and it costs this raid nothing." On the fainted IVYSAUR: "Pokémon Center: full restore for −0:15 of raid time." Nurse Joy, three metres away, says "Healing would take 0:15 off your **next** raid."
- **Where / repro:** Have a hurt Pokémon, open BILL'S PC and point at its tile.
- **Screenshot:** ../shots/pokemon-centre-17-this-raid-nothing.png
- **Why it is bad:** There is no "this raid" at base. The cost always comes off the next raid. On top of that, "full restore" is the name of a FireRed item, and "for −0:15" stacks a minus sign on a price.
- **Fix:** `src/game/scenes/HubScene.ts:831-832`: "Nurse Joy heals it free." / "Nurse Joy can bring it round for 0:15 of your next raid." That matches her own words in `centerOffer`.

### 3. THE WARD's plaque says 3 free beds after two have been used  [kind: wrong/out-of-date]
- **Seen:** (mid-ward) Joy: "THE WARD takes Ivysaur and Diglett, so bringing them round is free." YES. Then walk to the bed: "THE WARD - 3 fainted brought round free."
- **Where / repro:** Build THE WARD, come home with two fainted, heal at Joy, then SPACE on the bed (2,5).
- **Screenshot:** ../shots/pokemon-centre-20-ward-room.png
- **Why it is bad:** Only one bed is free until the next raid, but the plaque promises three. It also never says the beds come back after each raid, so "3" reads as a lifetime total.
- **Fix:** `wardNote()` (`src/game/base/rooms.ts:1268-1272`) is static. Joy's own count is `terms.wardTreatments` = beds minus `wardTreatmentsUsed` (`src/game/hub/centerCounter.ts:43`). Write the plaque from that: "THE WARD - 1 bed free till your next raid" / "Three beds every raid".

### 4. Pressing GARDEN loses the cursor  [kind: bug]
- **Seen:** (mid) BILL'S PC, DIGLETT, Tab to KEEPING, Right to "IN THE GARDEN", ENTER: "Diglett is back in its box." Nothing has focus after that. There is no gold ring anywhere, and ENTER does nothing (pressed twice: the chip stayed "OUT TO GARDEN"). The next ArrowDown jumps to the X in the top corner.
- **Where / repro:** As above, with any Pokémon that is not the partner.
- **Screenshot:** ../shots/pokemon-centre-14-garden-cursor-lost.png
- **Why it is bad:** It breaks the "one cursor" rule of the menu look. A keyboard player presses ENTER again to undo, nothing happens, and the next arrow throws them to the X they might press by accident.
- **Fix:** After the garden toggle re-renders, put focus back on the same chip (`data-shows` + garden attribute), as the SORT button already does.

### 5. BILL'S PC also heals, so the room has two nurses  [kind: bolted-on]
- **Seen:** (mid-hurt) In the PC, the hurt tiles carry price tags ("−0:15" in red, "FREE" in green). ENTER on DIGLETT healed it at once, with no question: "Diglett recovered for no extra raid time. Next raid clock: 5:00." ENTER on IVYSAUR armed it in the help bar: "Spend 0:15 of your next raid bringing Ivysaur round? ENTER again to heal."
- **Where / repro:** Hurt Pokémon, open BILL'S PC, ENTER on its tile.
- **Screenshot:** ../shots/pokemon-centre-18-pc-heal-arm.png
- **Why it is bad:** `centerCounter.ts` says the heal was moved off a PC screen and onto Joy because that is how FireRed does it, but the PC still does it in its own, different words ("recovered", "full restore", "this raid"). Bill's storage box should not be a second nurse. Healing there also leaves Joy with nothing to do.
- **Fix:** In the PC, make a hurt tile's ENTER do what a fit one does. Keep the small price tag if you like, and have the help line say "Nurse Joy heals it, at the counter." The help for a hurt Pokémon at the Center (`HubScene.ts:2389`) already says it that way.

### 6. A one-raid newcomer is offered to throw their starter away, in a panel that follows them into an empty box  [kind: bolted-on]
- **Seen:** (new) The first thing under Charmander's tile: "SWAP YOUR PARTNER - While Charmander is your only Pokémon, you can trade it for a level 5 starter, which arrives in the condition Charmander is in now. [CHOOSE A NEW PARTNER]". After NEW BOX, Box 2 shows "This box is empty." and then the same Charmander swap panel. In the picker: "Charmander (Level 5) is your last Pokémon. Swapping releases it for good for a level 5 starter as hurt as it is now, with no supplies." This was said of an 18/18 Charmander. The confirm says "This cannot be undone. It is gone for good."
- **Where / repro:** after-first-raid save, BILL'S PC, ArrowDown once. NEW BOX for the empty-box version.
- **Screenshot:** ../shots/pokemon-centre-05-swap-panel.png, -07-empty-box-swap.png, -10-swap-arm.png
- **Why it is bad:** The partner was chosen ten minutes ago, and the storage screen's biggest block of text is an offer to release it. "Trade" is also the word the TRADER outside uses for something else. "for good for", "as hurt as it is now" on a healthy Pokémon, and "cannot be undone. It is gone for good." are clumsy, doubled lines.
- **Fix:** Show the panel only after a lost raid (the `afterALoss` branch in `HubScene.ts:3946`), and only in the box holding that Pokémon. Reword: "Charmander is your last Pokémon. You can swap it for another starter at level 5. Charmander goes for good." Confirm: "Release Charmander? You can't get it back."

### 7. Nurse Joy: "free" three times, then one line for ever, and the price speech in full every time you speak to her  [kind: wall-of-text / ai-feel]
- **Seen:** (new) "Welcome to the Pokémon Center! Healing is free. Only a faint costs time off your next raid." / "Your boxes and everything you have banked are on BILL'S PC, over by the wall." / "Charmander came home hurt. Healing won't cost your next raid a second." / "Shall I heal Charmander?" After that, all she ever says is "Your Pokémon are all fit to raid." (five times in a row, new and mid). (mid-hurt) Every talk replays "Ivysaur fainted and Diglett came home hurt. Healing would take 0:15 off your next raid." / "Only a faint costs. Your free heal today's been used; you get another tomorrow." / "Shall I heal both of them?", including after NOT NOW. (mid-ward) "Healing won't cost your next raid a second." and then "THE WARD takes Ivysaur and Diglett, so bringing them round is free." That is two boxes for one piece of news.
- **Where / repro:** Talk to her several times in each state.
- **Screenshot:** ../shots/pokemon-centre-02-joy-question.png, -15-hurt-question.png
- **Why it is bad:** She reads like a terms-of-service screen. "Only a faint costs." is the rule spoken out loud. The "free heal today" she says is used up was never introduced to a player whose first visit was a scratch. Once everyone is healed she has nothing to say, so the room's only person is a vending machine.
- **Fix:** Fold the price and the rule into one box: "Ivysaur fainted. Bringing it round takes 0:15 off your next raid. Your free one today's gone." When the ward pays, use one box: "Both fainted. THE WARD has beds for them, so it's free." Repeat the full speech only on a new visit. When nobody needs her, give her two or three short lines in turn, like FireRed's ("We hope to see you again!" / a word about the PC).

### 8. Words a newcomer has not been taught: banked, recovery, faint, KEEPING · TAB  [kind: jargon]
- **Seen:** (new) Joy: "everything you have banked". PC caption in the room: "BILL'S PC - Your boxes and your banked goods". Sort help: "The order they were banked in." / "those that need recovery". (mid) "Ivysaur is fit. There is nothing to recover." / "Diglett recovered for no extra raid time." / Joy: "0:15 went on recovery." Plaques: "Revive for 0:15 of a raid". In the PC's details: the heading "KEEPING · TAB".
- **Where / repro:** Throughout, both saves.
- **Screenshot:** ../shots/pokemon-centre-12-pc-caption.png, -04-keeping-garden.png
- **Why it is bad:** "Banked" and "recovery" are the designer's ledger words. The persona has never played Pokémon, so "faint" with no gloss is a cliff. "· TAB" glued onto a heading looks like part of its name.
- **Fix:** "everything you brought home"; "Your boxes and your supplies"; "The order they came home in"; "Ivysaur is fit."; "Diglett's healed. Your next raid is still 5:00."; "0:15 went on healing". Explain faint once in Joy's opener: "...Only a faint - knocked out cold - costs time." Move the Tab hint into the keys line ("TAB keeping").

### 9. The menu look slips in the PC's own sub-states  [kind: menu-look]
- **Seen:** (new) In FIND and RENAME the text field has focus, but the keys line still says "ARROWS move · ENTER choose · ESC back". The name screen on the title gets it right: "TYPE your name · ENTER OK · ESC later". In MOVE, the picked-up CHARMANDER tile is washed green, not gold, and its chip reads "PUTTING DOWN" (help: "Put Charmander down again."). In SWAP YOUR PARTNER, the card you chose (SQUIRTLE) and the card marked "yours" (CHARMANDER) are washed the same green, while the gold ring sits on a third card.
- **Where / repro:** PC: FIND / RENAME / MOVE · BOX 1. CHOOSE A NEW PARTNER, pick SQUIRTLE, SWAP FOR SQUIRTLE.
- **Screenshot:** ../shots/pokemon-centre-06-find-field.png, -08-putting-down.png, -10-swap-arm.png
- **Why it is bad:** The look's own rule is "Chosen: gold. Green is safe, ready, go." Here green means "held", "yours" and "chosen" at once. A keys line that lies inside a text field is the one place a player needs it.
- **Fix:** Keys line in fields: "TYPE a name · ENTER save · ESC cancel". `.px-mon-tile.is-selected` (`src/style.css:7379`) uses the gold wash. The chip reads "PUT BACK". Give the "yours" card a tag, not a wash.

### 10. Box housekeeping is careless  [kind: other]
- **Seen:** (new) DELETE on an empty Box 1 removed it at once ("Box 1 taken away."), with no question asked. The one box left is still called "BOX 2 · 1/30". PREV from Box 1 wraps, unannounced, into "ALL BOXES · 1", a view with no RENAME.
- **Where / repro:** NEW BOX, move CHARMANDER into Box 2, PREV to Box 1, DELETE.
- **Screenshot:** ../shots/pokemon-centre-11-delete.png
- **Why it is bad:** It is small, but a lone "Box 2" looks like a lost box, and an ALL BOXES page reached by PREV is a hidden mode.
- **Fix:** Renumber default-named boxes after a delete. Label the wrap: PREV on Box 1 reads "ALL" in the button.

### 11. (seen at 400x256 only) The box's own tiles start below the fold
- **Seen:** (new) On opening the PC, the PREV/NEXT/SORT/FIND/RENAME/NEW BOX bar takes three rows. The CHARMANDER tile that has the cursor is scrolled out of sight under "2 MORE".
- **Screenshot:** ../shots/pokemon-centre-03-pc-new.png
- **Why it is bad:** The reference at 1280x800 (`docs/screens/menu-look/after/pokemon-centre-stash.png`) is fine, so this is low. Still, a focused tile should always be scrolled into view.
- **Fix:** scrollIntoView on the focused tile when the screen opens.

## What is actually good
- The mat key: SPACE from the doorway reaches Joy at once. A question with YES/NOT NOW, opening on YES when it is free or nobody can raid, and on NOT NOW when it costs, is exactly right.
- The Poké Balls waiting on her counter ("ONE POKÉ BALL - Waiting to be treated") disappear when she heals them. It is a lovely, wordless touch, and the yard sign changes with it ("1 Pokémon hurt" / "1 fainted · 1 hurt" / "Nobody fit to raid" / "Everyone is fit").
- Built machines and the ward bed physically appear in the room.
- The fainted revive in the PC asks before spending ("ENTER again to heal") rather than spending at once.
- Sort help lines say what each order does. The starter blurbs are true (Bulbasaur vs MISTY's water team, base Speed 65 vs 45/43, base Defense 65 vs 49/43).
- Supply descriptions are honest and checked: Raid pack 6x3 = eighteen squares, Satchel 4x3 = twelve, and valve/crate/oil go to the rungs named.

## Everything I read
- Yard: door, POKÉMON CENTER sign in all four states (new, mid, mid-hurt, mid-ward).
- Room: mat hint "[SPACE] NURSE JOY [DOWN] OUT"; NURSE JOY from the mat and from the counter, 5+ times per save; her welcome, price, rule, ward, healed, NOT NOW ("Of course. I'll be right here.") and post-heal clock lines; ONE POKÉ BALL / 2 POKÉ BALLS on the counter; HEALING MACHINE I, HEALING MACHINE II, THE WARD plaques; tried the bookshelf, TV, plant, sofa, table (none answer).
- BILL'S PC (new and mid, plus mid-hurt): title strip and NEXT RAID CLOCK pill; PREV / NEXT / ALL BOXES; SORT through all four orders and their help; FIND (field opens; this tool could not type into it, so search results are untested); RENAME (field, Cancel); NEW BOX; DELETE; MOVE · BOX n / PUT X IN / CANCEL / PUTTING DOWN; GARDEN in its three states (partner, IN THE GARDEN, OUT TO GARDEN); dossier (HP, XP, stats, moves and their help); every supply tile's help (Potion, Poké Ball, Raid pack, Satchel, Radio valve, Parts crate, Lamp oil, Pokédollars); hurt-tile price tags and PC healing; SWAP YOUR PARTNER panel, the picker (all three cards and their blurbs), the arm and confirm, KEEP CHARMANDER, the back crumb.
