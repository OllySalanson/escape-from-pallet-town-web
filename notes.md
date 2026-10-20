# Playtest fixes log

One short entry per iteration: what a player met, how it was reproduced, what changed, and how to use it.

## Report findings checked (so later iterations do not re-check)

Checked against the code on 2026-10-20 (branch fm/eptw-gnhf-night-7, base 95c45b13).

### Playtest 48 (map maker and shared harbour)
- F1 maker undo lost on maps with an inside: fixed (#347).
- F2 174-row palette: fixed, groups fold (#347).
- F3 cave and room fights drawn on grass: captain's call (art), not touched.
- F4 moving a building leaves cleared wood gone: fixed (#347).
- F5 Cut tree speaks Viridian Forest's words: fixed (#347).
- F6 another player's name plate on your head: fixed (#347), raid half too.
- F7 other players have no partner: captain's call.
- F8 a stopped knock still asks the host: fixed (#347).
- Small: building anchored top-left (nudge, open, low); dropdown arrow keys fixed; overview over the corner fixed; cave encounters thick (luck, open, needs measuring); knock-screen back label, "Knock anyway?", H as a visitor, house hint all fixed.

### Playtest 47 (first hour)
- F1 nothing teaches ITEM: fixed (#347).
- F2 shortfall not on the final check / briefing replaced: fixed (check shows "Still short", briefing then warning).
- F3 CHARMANDERPSN status tag: fixed (#344).
- F4 defeat line-up off the edge: fixed (#344/#345).
- F5 Pallet Town never named: fixed (#344).
- F6 newcomer told the partner can be swapped: fixed (#344).
- F7 lone Pokemon not packed by default: fixed (packLonePokemon). Starter confirm bar follows the cursor: fixed. TM note at base: fixed. Objective chip bearing after the kit: fixed. First contract payoff under the fold: fixed. Next raid clock at Oak's: fixed.
- F8 polish: Sing on a sleeper says "is already asleep!": fixed. Title POKéMON: fixed. Oak's first words use the name: fixed. "Packed for you" wrap: fixed. Jigglypuff harmless fight: FireRed canon, left.
- C1-C5: captain's calls.

### Greystone Vale playtest
- B1 boats ignore a short clock, B2 hunter on Ember Isle: fixed (#343).
- B3 "still being drawn" landing text: fixed (test holds it).
- B4 strand boulders on lawn, B5 chapel plate by day: map drawing, needs the captain (map edits are off limits here).
- B6 silent bump at a jetty outside the tide: captain's call (by design).
- Explorer-only: Oak's errand completes from the explorer vault: very low, left.

## Iterations

### 1. OAK'S LAB unnamed at the yard spawn while Oak has a favour to ask
- What a player met: on every visit to the harbour after the first contract (Oak asking for his parcel), the player spawns two steps below Oak's Lab and the lab has no caption at all, with or without L held; with L, BROCK'S WORKSHOP's caption was drawn over the lab's roof instead.
- How reproduced: a fresh game with the first contract banked and Oak's errand unasked, standing on the spawn (16,13) at 1200x768; `explainSeats` showed every seat refused - "Professor Oak has a favour to ask" made the caption 181 px wide, and the only row above the lab is the 176 px between the Pokémon Center's roof and THE BOLTHOLE's, while every row below is the player and partner.
- What changed: an errand may carry `called`, the name a door caption uses (`hub/errands.ts`); Oak's is FireRed's "Prof. Oak", so his door reads "Prof. Oak has a favour to ask" (155 px) and seats over the lab. Test: `doorCaptions.test.ts` "names OAK'S LAB from the spawn while Professor Oak has a favour to ask" (fails on the old wording).
- How to use it: walk into the harbour after banking the first contract - OAK'S LAB / Prof. Oak has a favour to ask is over the lab.
- Also checked this iteration and passing: dayCare.mjs, decorate.mjs, bolthole.mjs, bicycle.mjs, packFull.mjs, locks.mjs, errands.mjs.

### 2. The raid result screen's first second: last row sliced, no MORE strip
- What a player met: walking out of the first contract's raid, the result screen's BANKED pane (contract, experience, haul, pack) overflowed, and for the first 0.9s (longer after a defeat's line-up) its last row was cut through its letters at the pane's foot with no MORE strip; then the screen jumped as the way out unlocked.
- How reproduced: `raid.mjs --stepped --pixels --window=pixel --level=9 --shot=...` (at level 5 the driver loses to Maya, it never drinks a Potion); measuring the pane at the result screen gave scrollHeight 501 against 452 with no `data-more` while the button was still disabled, and `MORE` with a cover once the lock lifted. Nothing measured the screen (columns, snapped boxes, MORE strips) until the delayed `focus('[data-continue]')`.
- What changed: `MenuOverlay.layout()` measures a freshly drawn screen without moving the cursor, and `ExtractionScene.showReport` calls it as soon as the screen is drawn. Tests: `defeatScreen.test.ts` "the result screen as it arrives" (both an extraction and the accounting after a defeat are measured before the lock lifts; both fail before the fix).
- How to use it: finish any raid with more on the ledger than fits - the MORE strip is there from the first frame.

### 3. The raid's party pane at 640x480: a blank band half the pane deep over "2 MORE"
- What a player met: in a small window (640x480, the smallest menu stage), pressing P in a raid showed the Pokemon's name, health and TAKE LEFTOVERS, then about 60 game pixels of empty pane over a "2 MORE" strip - the experience, stats and moves were all hidden behind blank space.
- How reproduced: `menuShots.mjs <url> <out> --window=640x480 --raid` and the party picture; probing the pane showed the strip raised 118 screen px. At the smallest stage the dossier stacks its blocks (vitals, gear, then the portrait), the portrait is one 64-pixel row, and the fold never cuts a row through its waist, so the strip took the whole portrait and nothing else.
- What changed: in tight room the portrait is ordered last (`style.css`, `.px-dossier-figure { order: 1 }` under `[data-room='tight']`); experience, stats and moves are a line at a time, so the fold falls between two of them and the pane is full to its strip. Test: `ui/dossierFold.test.ts` (stacks the blocks in the stylesheet's tight order with the measured row heights and runs the real `scrollCoverHeight`; 47 px of blank before, under a line after).
- How to use it: play in a small window and press P in a raid - the pane under the party shows the experience and stats down to its MORE strip.
- Seen and left: at 640x480 the FEEDBACK tab sits over menu text on the right (Lv numbers, "EXTRACTION", "Route 1"); AGENTS.md records that 640x480 has room on neither edge and keeps the tab on the right, so moving it is the captain's call. A `px-label` (STATS) can still be the last line above a MORE strip, because only `.px-subheading` counts as a heading for the orphan rule.

### 4. A pane's STATS (or MOVES, EXPERIENCE) label left last above its MORE strip
- What a player met: in a small window the Pokemon pane under a list (the raid's party, the stash, the loadout) could end on the word STATS over a "MORE" strip, with none of the stats under it - it reads as a Pokemon with no stats. Iteration 3 saw it and left it.
- How reproduced: stacking the dossier at the smallest stage with its measured row heights and a pane a little taller than 640x480 gives it (152 game px): the fold falls through the stats line, the strip takes that line, and STATS is left over it. The fold's orphan rule only counted `.px-subheading` bands as headings, never the dossier's and shop panes' `.px-label`s.
- What changed: `headsWhatFollows` in `MenuOverlay.ts` is the one rule for which rows head what follows them - a `.px-subheading` and a `.px-label` - so a label goes under the strip with its rows. Test: `ui/dossierFold.test.ts` "never leaves a label such as STATS as the last line above the strip" (fails with the old rule).
- How to use it: open any Pokemon pane in a small window - a part's label is never the last line above MORE; the strip takes it with its rows.

### 5. A sliver of a cut line's letters over the top of a scrolled pane
- What a player met: in the map maker at 1200x768, with the side column scrolled down to the map's name (REROLL), the top of the column showed the foot of a red `g` from a line that had scrolled away, floating over "passes, press WALK IT or RAID IT". The same could show at the top of any scrolled pane whose cut line had a descender.
- How reproduced: `names.mjs` photographs it (map-name.png). A probe of `.maker-side` showed the top mask set (`data-above`, cover 22 screen px), but it stopped at the cut line's line box, and Orange Kid draws its descenders about 2 game pixels below the line box.
- What changed: every measured row now carries `ink`, the foot of its text's content area (`lineBoxes` per line, `elementBox` for a whole element, in `MenuOverlay.ts`), and `scrollTopCoverHeight` masks down to that rather than to the line box. The next line's own letters start 5 game pixels below its box, so nothing of them is hidden (checked live: the cover grew 22 to 26 screen px and "passes" is whole). Test: `resultLedger.test.ts` "hides the foot of a cut line that Orange Kid draws below its line box" (fails on the old rule).
- How to use it: scroll any pane part-way through a line of words - its top edge is clean, with no stray letter feet.
- Also checked this iteration and clean: fishing.mjs, teachShots.mjs --hover-check, names.mjs, a Viridian City raid, menuShots at 1024x700 and 1280x800 --keys. At 900-1024 wide the Pokémon Center's dossier wraps its portrait to a second line and the MORE strip takes that line whole; that is the fold rule working, not a blank band.

### 6. A finished braid survey told the player to go and find loot
- What a player met: on Route 1's braid survey, reading the third stake ("East road logged. That is all three.") turned the objective chip to FIND LOOT, THEN EXTRACT whenever nothing had been picked up - the job was done and only walking out banks it, but the chip sent the player off looking instead of naming a way out.
- How reproduced: `raid.mjs --stepped --pixels --window=pixel --insertion=route-1 --level=10 --completed=recover-lost-field-kit --fight --shot=... --shot-dialogs`, whose last dialogue picture shows the chip. `contractNavigationCue` returned nothing once every stop was made (unless the contract named one exit), so the chip fell through to `openRaidCue`, which only counts found items and catches.
- What changed: `WorldScene.contractNavigationCue` names the nearest open exit once every stop is made - `BANK VIA WEST GATE: SW` - in the words the one-exit contract already used (`EXTRACT TO BANK THE CONTRACT` with no open exit in reach). Test: `requiredExitCue.test.ts` "names the way out once every stop of a contract is made, pack empty or not" (fails before the fix: the cue was undefined).
- How to use it: finish any contract's last stop - the chip says which exit banks it and which way it is.
- Also checked this iteration and clean: a Pallet Town raid (result screen, pickups, lobby), dropinShots.mjs --small. The errand box after a raid is Oak asking for the first time (his first words take the lab's first visit), not a repeat.

### 7. A fainted Pokemon could be packed into a raid it could only be lost in
- What a player met: after losing a raid with one Pokemon (secured, so it came home fainted), the loadout's row for it read ADD while the help line under it said "Bulbasaur has fainted and cannot fight". Pressing it packed the fainted Bulbasaur ("1/6 POKEMON PACKED", and the secure slot took it); beside a fit Pokemon it could even be deployed, where it cannot fight, nothing revives it, and a wipe takes it.
- How reproduced: `raid.mjs --stepped --pixels --window=pixel --hp=1 --fight --save-out=save.json`, then a probe that loads that save, walks into Oak's Lab and presses START A RAID and Enter on the Bulbasaur row.
- What changed: `DeploymentFlow.togglePokemon` refuses a fainted Pokemon with the help line's own words (`faintedRefusal`); its row is `aria-disabled` and tagged FAINTED instead of ADD; and reviving a lone Pokemon from the loadout's CENTER chip packs it (`packRevivedLonePokemon`), as it would have been at the door. Tests: `deploymentFlow.test.ts` "never packs a fainted Pokemon...", "packs a lone Pokemon revived while the loadout is open...", the reworked "refuses a loadout of nothing but fainted Pokemon", and the row markup in `HubScene.test.ts` (all fail before the fix).
- How to use it: open the loadout with a fainted Pokemon - its row says FAINTED and why; press its CENTER chip and it is packed and ready.
- Also fixed: `wallMapShots.mjs` clicked the lone Pokemon's row and so took it back out of the party (it is packed by default now), and timed out on the drop-in picture; it uses `takePokemon` now.
- Also checked this iteration and clean: a Viridian Forest raid, buildingInside.mjs, shopScreens.mjs, firstHour.mjs, hunterShots.mjs, baseRooms.mjs --built=all --hurt=3, knocking.mjs, friendRaid.mjs, a clock-out raid. Seen and left: in a visit the host standing on his own mat is hidden whole behind the arriving visitor (other players are drawn behind; the same accepted overlap as the yard's spawn).

### 8. The loadout's Pokemon pane ended on STATS with no stats under it
- What a player met: in Oak's Lab's loadout at 1200x768, the pane under the stash showed EXPERIENCE and its XP line, then STATS over the MORE strip with none of the stats, beside the moves column's TACKLE and GROWL. It reads as a Pokemon with no stats.
- How reproduced: `packArrange.mjs` (loadout-packed.png), then a probe of the dossier pane's rows: the fold sat at 546 under GROWL (514-542), with STATS at 522-546 and every stat from 548 down. The orphan rule (iteration 4) asks whether any row is beside or under a heading, and GROWL, in the other column, counted as STATS's own.
- What changed: `headingsOrphanedInColumn` in `MenuOverlay.ts` finds a heading whose own column (the rows under it that share some of its width, up to the next heading there) has rows and none above the fold, and `markScrollCues` folds that label out (`data-folded`) while the strip stays where the other column needs it. Rows now carry `left`/`right`. Tests: `dossierFold.test.ts` "leaves STATS out when only the moves beside it are still above the strip" and "keeps a label whose own rows are still drawn".
- How to use it: open the loadout with a Pokemon chosen - the left column ends on its XP line, and STATS comes back with its stats as the pane scrolls.
- Also checked this iteration and clean: packArrange.mjs.

### 9. A player's feet were cut off on every door mat
- What a player met: walking into any building (a shipped map's press house, a player map's house), the player arrives on the door mat on the room's last row, and their shoes and the ground ring under them were sliced off flat at the room's edge; the partner beside them lost its feet too.
- How reproduced: `makerAreas.mjs` (play-2-inside.png) and `buildingInside.mjs` (inside-room.png), zoomed with ffmpeg. A figure's soles rest on the first pixel row of the tile below its own (`CHARACTER_FEET_PIXEL_Y`), the ring's outline a row under that, and the dark round a place (`frameArea`, drawn over every figure) started exactly at the room's last row.
- What changed: `world/areaFrame.ts` works out the camera bounds and the dark round a place; the dark under it starts `FIGURE_OVERHANG_PX` (read off the ground ring) below the last row, and an inside taller than the view lets the camera down that far (the outdoors does not). `WorldScene.frameArea` draws what it says. Tests: `world/areaFrame.test.ts` (a player on a room's last row and on a tall cave's are whole; the place laid under is never shown; two fail before the fix).
- How to use it: walk into any building - the player stands on the mat whole, shoes and ring.
- Also: `staleTab.mjs` clicked the lone Charmander's row and so took it out of the party (it is packed by default); it uses `takePokemon` now. Also checked and clean: billCabinet.mjs --traded=12, heldEnter.mjs, interior.mjs --insertion=town-square, menuShots.mjs --window=1100x700 --raid, bolthole.mjs, titleShots.mjs (needs `?testmode=pixels` on the URL, or NEW GAME asks the name first), raids on Route 1, Viridian Forest and a defeat at 800x600.

### 10. Sending with no internet blamed a bot-check blocker instead of saying No signal
- What a player met: with no connection, the FEEDBACK tab's SEND (and the map maker's SEND and a console score) answered "BOT CHECK WON'T LOAD. Something stopped the bot check loading..." with a TRY AGAIN that cannot work offline, sending the player hunting for a blocker that is not there. Headless, with only the lab blocked, it sat on "Transmitting..." for 30 s while the bot check asked.
- How reproduced: `feedbackShots.mjs` timed out at "SEND to answer with a tag"; a probe that blocks the lab and Cloudflare and makes `navigator.onLine` false read the panel's outcome text.
- What changed: `signInWith` (`maker/playerSignIn.ts`) asks the browser whether it is online (`SignInParts.online`, `navigator.onLine`) once there is no session, and a browser that knows it is offline is `offline` at once - no check drawn - so the panel says NO SIGNAL (the message is kept and sends itself back on the air), the maker says check your connection. Test: `playerSignIn.test.ts` "says a browser that knows it is offline is offline, without drawing a check the network cannot load" (fails before the fix).
- How to use it: press F and SEND with the internet off - the radio says NO SIGNAL straight away and keeps the message.
- Also fixed: `feedbackShots.mjs` now puts the browser offline the way a player is (blocks the lab and Cloudflare, `navigator.onLine` false) and passes all 26 checks again. Also checked and clean: sendOutShots.mjs, harbourPartner.mjs (needs `?testmode=pixels` on its URL: it calls `pauseLoop`), dayCare.mjs --window=640x480, frostreef.mjs (its "out of the cave" check is a driver race: the B1F walk sometimes steps through the exit itself), a Viridian City raid.

### 11. A prize behind a door was "605 steps" away
- What a player met: in Ember Isle's Lava Tube, a step from the door out to the crater, the prize chip read CHARCOAL / S 605 - the heading was right (out of the door, south) but the number was hundreds of steps for a find just outside. The same is true of any prize on the far side of a door from the player, on any map with insides (a player map's house, a shipped building, a cave).
- How reproduced: `emberIsle.mjs` (09-the-crater.png, taken in the tube by the crater door). `WorldScene.prizeInMind` counted the steps as a straight line across the composed grid, and a map's insides are laid east of its outdoors with dark between (the vale is 384 wide), so the count measured the layout, not the walk. On the real vale, from the tube's crater door to the Charcoal's spot: 616 straight, 15 walked.
- What changed: `stepsTowards` in `world/areaRoutes.ts` is the number to print beside the heading `wayTowards` gives: the straight count within one place, the walk through the doors to another place; the prize chip uses it. Tests: `mapAreas.test.ts` "counts the steps to something on the far side of a door as the walk there, not across the grid" (6 from the doorstep to Tam's House's item spot), and a pin in `WorldScene.test.ts`.
- How to use it: see a prize in a room or cave and step outside (or the other way) - the chip's number is the walk back to it.
- Also: `headingShots.mjs` now puts down a keeper's errand box before leaving each room (Bill's took its Escape and the walk to the next door timed out); `emberIsle.mjs` names the tile when the crater check fails. Also checked and clean: headingShots.mjs --small (no heading cut), makerPath.mjs, makerGates.mjs, bunker.mjs (its strongroom lines show twice because the driver logs each Space, typewriter included), emberIsle.mjs (its first run failed "out of the tube" once, a race; the rerun passed). Seen and left: the hunter chip has the same straight count (`hunterStepsAway`), so a hunter just outside a door reads as far away and its chip stays silent - a separate change.

### 12. A hunter on the doorstep of the player's room was silent on the chip
- What a player met: hiding in a room (a player map's house, a shipped building, a cave), the hunter could stand a step off the doorstep outside while the chip said nothing - its count was a straight line across the composed grid, where the room is laid east of the outdoors past a band of dark, so a hunter two steps away read as dozens and never passed `HUNTER_ALERT_DISTANCE`. Iteration 11 saw it and left it.
- How reproduced: on the sample lane with Tam's House, from the mat (38,7) to a tile below the doorstep the straight count is over 8 and the walk is 2.
- What changed: `WorldScene.hunterStepsAway` counts with `stepsTowards` (the walk through the doors in another place, the straight count in this one). The walks `areaRoutes.ts` keeps per map are now limited to `ROUTE_FIELDS_KEPT` (8), newest kept: a moving target such as the hunter was a new whole-grid walk kept for every tile it stood on, with no limit, which `hunterBearing` already did whenever the hunter and player were in different places. Tests: `mapAreas.test.ts` "warns of a hunter on the doorstep of the room the player is in" and "keeps only a few walks however many tiles a moving target stands on" (fails before: 28 kept), and a pin in `WorldScene.test.ts`.
- How to use it: wait in a room while the hunter closes on its door - the chip says HUNTER S 2 as it reaches the step.
- Not checked live this iteration (the path is the one iteration 11 checked for the prize chip).

### 13. From a room, the contract chip named the stop on the far side of the map
- What a player met: on a contract with several stops (the braid survey, a standing board survey), standing in a room, cave or tunnel, the chip named whichever stop lay nearest the column the inside is laid at on the composed grid - east of the outdoors - not the stop just outside the door. Its heading was right for that stop, so it sent the player out of the door and away from the stop beside it.
- How reproduced: on the sample lane with Tam's House, from the mat (38,7), a stop a tile off the doorstep and one at the lane's east end: straight along the grid the east one is nearer (the room is laid east of the lane); walked, the doorstep one is 2 steps.
- What changed: `nearestByWalk` in `world/areaRoutes.ts` picks the target with the fewest `stepsTowards` steps (straight within one place, the walk through doors across places, from the same kept walks), and `WorldScene.contractNavigationCue` uses it in place of the straight-line `manhattan` pick (now gone). Tests: `mapAreas.test.ts` "names the contract stop nearest the room by the walk out through its door" (asserts the straight count picks the far stop, which is what the old code did), and a pin in `WorldScene.test.ts`.
- How to use it: on a survey contract, step into a building - the chip names the stop nearest by the walk out of the door.
- Not checked live (pure pick over the same `stepsTowards` path iterations 11-12 checked). Still straight-line and left: the friend chip's distance (WorldScene ~1590) and the resume-from-battle `hunterNear` check (~1061), both only wrong across a door.

### 14. After a fight, the hunter's heartbeat was judged by a straight line
- What a player met: the "hunter near" heartbeat sounds once as the hunter closes within 3 steps. Coming back from any fight, the world re-decided whether the hunter was already near by a straight count across the composed grid, so hiding in a room with the hunter on the doorstep, every fight in there sounded the heartbeat again; and a hunter two tiles off beyond a wall read as near, so it sounded nothing as it actually came round.
- How reproduced: the Floodplain's press house, player on a room tile 3 walking steps from a yard tile whose straight count across the grid is far more than 3; the old rule left `hunterNear` false, so the next pursuit step played `hunterNear` again.
- What changed: `WorldScene.resumeHunterProximity` counts the hunter's pursuit path to the player (through doors, round walls), the same count each pursuit step uses, and runs after the map, its figures and any flee breakaway are in place (it ran before `createMap`, on the last map's collision). Tests: `hunterIndoors.test.ts` "remembers a hunter on the doorstep was already near, counted by the walk through the door" (fails before) and "does not count a hunter far off by the walk as near".
- How to use it: fight something in a room while the hunter waits outside the door - no second heartbeat on the way back.
- Not checked live (a sound and a pure count over the pursuit path already used every tick). Still straight-line: nothing left on the hunter's side; the friend chip already returns no distance across places.

### 15. A raid room's phrase list read "10VER HERE!"
- What a player met: raiding with a friend, pressing T opened the six phrases written "1 OVER HERE!", "2 HUNTER COMING!" and so on; at the game's one type size Orange Kid's 1 is a single narrow stroke and its space barely wider than a letter gap, so the first row read "10VER HERE!" - a number ten and a word that is not one.
- How reproduced: `friendTalk.mjs` (t1-amy-phrase-list.png), zoomed with ffmpeg.
- What changed: `phraseListLines` in `input/keyBindings.ts` writes each row as the HUD writes every other key, `[1] OVER HERE!`, and `WorldScene`'s friend chip uses it. Test: `keyBindings.test.ts` "names each phrase by its number key in brackets, so a 1 never runs into the O after it" (each row's bracketed digit is the key bound to say it; fails before - there was no such line), and a pin in `WorldScene.test.ts`.
- How to use it: in a friend's room press T - the list reads [1] OVER HERE! to [6] THANKS!, and the number in brackets is the key.
- Also: `friendTalk.mjs` waits for the new wording; `makerDataLoss.mjs` tabbed from the map's name straight into REROLL (added beside it since) and typed the maker name into nothing - it tabs past it now, 11/11 pass. Also checked and clean: friendLoot.mjs, friendBoss.mjs, friendHunter.mjs, makerNav.mjs, makerGrow.mjs, abandonRaid.mjs, sharedHarbour.mjs, a first-contract raid at 640x480 (lost at level 9; the driver drinks no Potions).

### 16. TRY AGAIN on the radio still said the bot check had jammed while it was being taken again
- What a player met: sending feedback (the FEEDBACK tab) with a bot check that did not pass, the panel said BOT CHECK JAMMED with TRY AGAIN; pressing it took the check again, but the panel went on saying "Bot check jammed. The bot check didn't pass..." with TRY AGAIN still offered, under "Transmitting...", for as long as the new check took (a Turnstile question can take a while).
- How reproduced: `botCheck.mjs <url>?testmode=pixels <out>` - its 2-feedback-check-asking.png is taken while the retried check asks, and showed the jammed headline beside the check asking.
- What changed: `outcomeMarkup` takes `retrying` and then says `RETRYING_WORDS` ("Taking the check again." / "One more go at the bot check. If it passes, your message goes now.") with TRY AGAIN `aria-disabled`; `FeedbackScene.retryCheck` shows it before the check is asked. Test: `feedbackPanel.test.ts` "says the check is being taken again while TRY AGAIN runs, never that it jammed" (fails before: the third argument did not exist and the panel said jammed). Checked live with botCheck.mjs: every promise kept, and the picture shows the new heading.
- How to use it: press TRY AGAIN on a jammed check - the radio says it is taking the check again until it has an answer.
- Needs the captain: the map maker's Bike Shop carries leftover Cerulean ground (a pale green and tan speck below its sign, a green corner at the top right of its roof). It is in `public/assets/frlg-towns.png` from `scripts/cut-frlg-towns.mjs` (the speck touches the sign's shadow diagonally, so `sweepSpecks` keeps it); fixing it means regenerating the sheet and `world/generated/townPieces.ts`, which this run may not touch.
- Also checked and clean: makerCaves.mjs, makerBuildings.mjs, botCheck.mjs, a standing-board raid ("Past the Toll Bridge") from The Staithe at level 14.
