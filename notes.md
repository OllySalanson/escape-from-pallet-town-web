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

### 17. Raiding with a friend, the hunter on your doorstep went after the friend down the lane
- What a player met: in a raid room, the one hunter chases whoever is nearest. Nearest was a straight count across the composed grid, where every room is laid far east of the outdoors past the dark, so a player who ducked into a house with the hunter on its doorstep was never the quarry: the hunter turned and walked off after a friend ten steps down the lane, and the hidden player's room was a free safe box for as long as a friend was out.
- How reproduced: the real Floodplain, player on the press house floor 3 walking steps from the hunter's doorstep, a friend 10 walking steps from it in the yard; `groupQuarry` chose the friend.
- What changed: `nearestQuarry` (`raidRoom/groupHunter.ts`) takes the scene's step count, and `WorldScene.groupQuarry` passes `stepsTowards` to the hunter (straight within one place, the walk through the doors across places, one search from the hunter shared by every player and the hunter chip). Test: `scenes/groupQuarry.test.ts` "chases whoever is nearest by the walk through the door, not by a straight line across the grid" (fails before: amy was chased).
- How to use it: in a friend's room, step into a house with the hunter at the door - it comes in after you, not your friend.
- Not checked live (the same count the hunter chip uses, already played).

### 18. Raiding with a friend, a piece you won while a line was up stayed on the ground
- What a player met: in a raid room, stepping onto a shared piece is a claim and the piece comes into the pack on the frame the database answers "you were first". If a line was on screen on that frame (the step that claimed it also walked into a trainer's watch, or the hunter arrived), the one try was spent unseen: the piece stayed drawn on the map, never came into the pack, and only stepping back onto its tile picked it up.
- How reproduced: `settleRoomLoot` on a scene with the real `LootLedger` holding the piece for this player and the dialogue box up, then again with it down - nothing was ever collected.
- What changed: `WorldScene.settleRoomLoot` asks `firstTry` only once nothing is on screen, so a win answered under a line is collected when the line is read. Test: `scenes/roomLootSettle.test.ts` "is collected once the line is read, not left on the ground for good" (fails before).
- How to use it: in a friend's room, win a race for a piece on the step a trainer stops you - read the line (or fight) and the piece is in your pack.
- Also seen this iteration: `raid.mjs` without `--window=pixel` runs a 400x256 window, under the game's 2x minimum, so its screenshots are the canvas overflowing (captions look cut at the top) - a driver artefact, not a game fault. walkJudder base and world: clean.

### 19. A console game played on under the bot check that was sending its score
- What a player met: at THE BOLTHOLE's console, finishing a game of Pallet Blocks sends the score to the Pallet Town board, which signs in behind the bot check. When the check had to ask ("One quick check that you're not a bot..."), its card was drawn in the middle of a dimmed window over the GAME OVER screen - but the keys still went to the game: Enter (PLAY AGAIN) started a new game under the card, with the card covering the middle of the well and the clock running. The map maker's keys went on under it the same way. The card's own comment promised "nothing behind it goes on until it is answered"; only the pointer was stopped.
- How reproduced: a scratch driver started the console from the title with a name kept, played a game to its end on Space presses, then pressed Enter: the screenshots showed a new game running under the card (Turnstile asks in a headless browser).
- What changed: `keysHeldByTheCheck` in `maker/playerSignIn.ts` claims the overlay keyboard (`ui/overlayKeyboard.ts`) the moment the check asks and hands it back when the check ends; every key but Tab is held, so the box can still be reached with Tab. An invisible pass never asks and never holds a key. Test: `playerSignIn.test.ts` "keeps every key from the console game behind the card until the check ends, then gives them back" (fails before: there was nothing holding the keys). Checked live: Enter and Escape on GAME OVER under the card leave the game where it is.
- How to use it: finish a console game when the bot check asks - tick the box (Tab reaches it) and the game's keys come back.
- Also checked this iteration and clean: makerCollisions.mjs (every case passes), Oak's Pokédex rewards for every milestone at 640x480 (a scratch save owning all 151 kinds; each box fits, in order). The console's score goes on this device's board while Pallet Town does not answer, as promised.

### 20. An explorer run at night never said it was night
- What a player met: an explorer run deployed after nine at night is a night raid - the final check says "night raid with no clock to beat", the night track is open and the night's wildlife is out - but in the world the clock chip said only PLAYTEST, and that chip is the one place a night raid is ever marked.
- How reproduced: `raid.mjs <url>?testmode=pixels --explorer --clock=night --window=pixel --shot=...`; the world picture's chip read PLAYTEST. `raidClockView` returned the playtest label before it looked at `night`.
- What changed: `raidClockView` (`scenes/raidHud.ts`) says `NIGHT PLAYTEST` for an explorer run at night. Test: `playtestMode.test.ts` "still says a raid is at night, because the clock chip is the only place that does" (fails before).
- How to use it: play the explorer run after nine at night - the corner chip reads NIGHT PLAYTEST.
- Also checked this iteration and clean: stormcrown.mjs (every step ok, Mew's one throw, out by the Cloud Stair). Note: drivers need `EPTW_CHROME_LIBS` from `tools/playtest/ensure-libs.sh` on this box or Chromium exits 127 (libasound).

### 21. A raid that found a spare pack said a wipe would cost "1 Raid pack and your Raid pack"
- What a player met: a Pallet Town raid from the Strand picked up a Raid pack on the walk to the South Gate. The result screen's gamble line read "A wipe would have cost you 3 Potions, 1 Raid pack and your Raid pack" - the same thing named twice, which reads like a typo or a double count. A lost raid said the same in "You lost ...".
- How reproduced: `raid.mjs <url> --testmode --stepped --window=pixel --insertion=pallet-strand --level=14 --completed=recover-lost-field-kit --fight --said --shot=...` (the run whose page seed was 671761143 found the pack).
- What changed: `describeStakes` (`run/extractionReport.ts`) calls a pack in the list beside the worn one a spare: "3 Potions, 1 spare Raid pack and your Raid pack", and "2 spare Raid packs" in a loss. Test: `extractionReport.test.ts` "calls a pack found on the raid a spare, never the same name twice beside the worn one" (fails before).
- How to use it: pick up a pack on a raid and walk out - the gamble line names it as a spare beside the one you wore.
- Not checked live with the new words (finding a pack is a roll of the loot); the line is the pure function the screen prints.

### 22. Walking down Bill's barter table left a blank band a row deep over its stones
- What a player met: in Bill's cottage at 1280x800, arrowing down OUT OF THE HOLD to HM06 ROCK SMASH left an empty band about 96 screen pixels deep at the top of the list, over LEAF STONE. The browser had scrolled just far enough to show the cursor's row, which left WATER STONE with 8 of its 104 pixels out of sight, and a cut row is hidden whole. Brock's ladder does the same when it is walked down.
- How reproduced: `shopScreens.mjs <url> <out> --window=1280x800` (bill-table picture), plus a probe of the `.px-scroll` panes at that moment: scrollTop 442, `data-above`, `--above-cover: 96px`.
- What changed: when an arrow key moves the cursor, `MenuOverlay.scrollPastTopCut` scrolls the pane on past a row the top edge cuts, whenever the cursor's row stays whole (`scrollPastTopCutBy`). The list then starts on a whole row, and the space left over sits above the MORE strip at the foot, which explains it. The pointer never triggers it, so a hovered list never moves under the mouse. Test: `resultLedger.test.ts` "scrolls on past a row the cursor left cut at the top, rather than hide it as a blank band".
- How to use it: arrow down any long list of tall rows (Bill's table, Brock's ladder) - the list starts on a whole row with no blank band above it.
- Also checked this iteration and clean: shopScreens.mjs at 1280x800 (all faults clean before and after).

### 23. The battle's POKéMON list ran a long row out past the panel's frame
- What a player met: in any fight with a ten-letter Pokémon in the party, opening POKéMON put "BUTTERFREE Lv 14 HP 32/32" in the right-hand column with its last characters drawn over and beyond the panel's right border (and, at 640x480, under the FEEDBACK tab). The left column was no better off: its 148-pixel column could not hold the same row either.
- How reproduced: a scratch probe started a wild battle from the title through the game's own modules (party Ivysaur, Butterfree, Pidgeotto, a fainted Nidoran) at 640x480 and 1200x768 and photographed each command; measured on the real face the row is 141 px against 125 px of room.
- What changed: `formatPartyRow` (`scenes/battlePresentation.ts`) has three forms - the full row, then without "HP", then without the level - and `partyRowForm` picks the longest that every row fits (`partyRowRoom`), one form for the whole list so the columns read alike; the two columns now share the panel's inner width evenly, as the command grid's do, so a ten-letter name keeps its level ("BUTTERFREE Lv 14 32/32"). Tests: `BattleScene.test.ts` "keeps every party row inside the panel, a ten-letter name with two-digit HP included" (fails before: the row ended at 316 against 302) and `battlePresentation.test.ts` "writes the party list in the longest form every row fits".
- How to use it: open POKéMON in a fight with a long-named Pokémon - every row sits inside the panel with its level and HP.
- Also checked this iteration and clean: a Viridian Forest raid (night, rain chip, result screen), a first-contract Floodplain raid at 640x480, the wall map and its close-ups, the Day-Care at 640x480 (the FEEDBACK tab over text there is the known captain's call).

### 24. The make-room panel ran a disc's row out past the battle panel's frame
- What a player met: throwing a ball with a full pack opens the panel that asks what to put down. With a TM in the pack, its row ("TM09 BULLET SEED x1 · 1sq") sat in the right-hand column and ran into the panel's right border; the same was true of any long name (HM06 ROCK SMASH, the furniture finds).
- How reproduced: a scratch probe started a wild battle from the title through the game's own modules with a full 6x3 pack (balls, Super Potions, Parts Crates, Mooring Rope, Thunder Stone, TM09) and called `throwBall`; the row measured 177 to 308 against the inner edge at 302, and the screenshot showed it touching the frame.
- What changed: the make-room rows take the party list's seats (`makeRoomRowLayout` is `partyRowLayout`, the two columns sharing the panel evenly), and `formatPackRoomRow` has three forms - the whole row, then without the squares (the line above says what the cursor's row frees), then the name alone - picked per page by `packRoomRowForm`, the longest that every row fits. Tests: `BattleScene.test.ts` "keeps every row inside the panel, a disc with a long name included" (fails before: the row ended at 316 against 302) and `battlePresentation.test.ts` "writes a page in the longest form every row on it fits".
- How to use it: carry a TM and catch something with a full pack - every row of what to put down sits inside the panel. Checked live: the disc's row now ends at 302 with its squares kept.

### 25. A wild Pokémon that broke free of a ball vanished for the rest of the fight
- What a player met: throwing balls at a wild Pokémon and reading the lines quickly, a throw that broke open at once ("Oh no! The POKéMON broke free!" straight after "Threw a POKé BALL!") left the foe's plate on screen with no Pokémon drawn above it; it stayed invisible for every later turn and throw.
- How reproduced: a probe started a battle from the title (Charmander 30 against a wild Caterpie 2, eight Poké Balls) and threw with `throwBall(0)`, pressing Space with no wait. After the third throw the foe's sprite stood at alpha 0 and scale 0.2 a hundred frames later. The throw's 420 ms arc starts the foe's shrink into the ball only when it lands; a break-out read before the landing put the foe back, then the late landing shrank it to nothing.
- What changed: `BattleScene.throwBallSprite` moves and lands only the ball that is still on the field (`this.ballSprite === ball`); a ball already broken out of draws nothing in. The test harness's fake tween clock now calls a counter's `onComplete`, as Phaser does. Test: `BattleScene.test.ts` "a wild Pokemon breaking free of a ball - stands whole on its spot however fast the throw is read" (fails before: alpha 0, scale 0.2).
- How to use it: throw balls and read through the shakes as fast as you like - a Pokémon that breaks free is always standing there again. Checked live: eight quick throws, the foe back at alpha 1 and full size after every break-out.
- Also checked this iteration and clean: walkJudder.mjs (harbour and Floodplain, 0 frames off the steady rate), the nickname screen after a catch (ten-letter limit, count line, OK hands the battle on), the battle's target and about-to-use rows (fit at their columns).

### 26. The battle's ITEM list drew a fifth medicine on the guidance line and the rest off the panel
- What a player met: with five or more kinds of medicine in the pack (Potions, Super Potions, an Antidote and a couple of berries picked off a map's berry trees - ten kinds exist), ITEM in a fight drew every kind in a two-column grid: the fifth row sat on top of "Restores 20 HP. Using it costs your turn.", and a seventh kind or more fell below the panel, unreadable and out of the pointer's reach.
- How reproduced: the row lists (`moveCommandLayout`) stack rows 17 pixels apart from the panel's top with the guidance lines at 37, so a third row starts at 36; a scratch probe started a battle from the title with six medicine kinds and opened ITEM.
- What changed: the move, item and ball lists hold one page of four (`ROW_LIST_PAGE`, `rowListPage` in `battlePresentation.ts`); the cursor walks the whole list and the page follows it, as the make-room panel's does, the pointer chooses the row's own item on a later page, and the free guidance line says "Page 1 of 2 - more with Up and Down." (`rowListPageNote`). Test: `BattleScene.test.ts` "holds a page of four medicines and pages on to the rest, never drawing one off the panel" (fails before: all six rows drawn).
- How to use it: carry five or more kinds of medicine into a fight and press ITEM - four at a time, Down past the second row for the rest. Checked live at 960x640: both pages drawn inside the panel.
- Seen and left for a later iteration: a berry's guidance ("Cures poison. Picked off a berry tree. Using it costs your turn.") runs past the panel's right edge - `fitCaption` cannot shorten it enough.

### 27. A berry's guidance in the battle's ITEM list ran past the panel's right edge
- What a player met: with a berry picked off a map's berry tree, pointing at it in a fight's ITEM list put "Cures poison. Picked off a berry tree. Using it costs your turn." on the guidance line, running past the panel's right border (seen in entry 26). `fitCaption` only closes up spacing, which could not save 70 pixels.
- How reproduced: a scratch probe started a wild battle from the title (Charmander 12, hurt, with a Pecha and a Chesto Berry) at 960x640 and opened ITEM.
- What changed: `describeItemGuidance` (`scenes/battlePresentation.ts`) hands `fitCaption` shorter ways of saying it - the description losing its last sentences first (`captionBySentence`), the price "Using it costs your turn." always kept, and "Costs your turn." last. Test: `BattleScene.test.ts` "keeps a berry's guidance inside the panel, saying what it does and that it costs the turn" (fails before: the line ended at 376 against 302).
- How to use it: point at a berry in a fight's ITEM list - the line says what it does and that it costs your turn, inside the panel. Checked live: "Cures poison. Using it costs your turn." ends at x 220 and the longest, Chesto's "Wakes a sleeping Pokémon. Using it costs your turn.", at 293 of 302.

### 28. The result screen counted fewer entries than it listed when the contract paid a kind the raid also found
- What a player met: walking out of Route 1's braid survey with a Great Ball picked up on the way, the BANKED pane drew five rows - the Great Ball found (BANKED) and the contract's two (REWARD) apart - under a heading that said "4 ENTRIES".
- How reproduced: `raid.mjs --stepped --pixels --window=pixel --insertion=route-1 --completed=floodplain-first-contract --level=12` (the first run happened to find a Great Ball); the note counted `report.ledger`, where the two Great Ball stacks are one entry, while the rows are drawn from `ledgerFound` and `ledgerPaid` apart.
- What changed: `ExtractionScene.ledgerPanel` counts the rows as drawn - found and paid apart. Test: `defeatScreen.test.ts` "counts a kind found in the field and also paid by the contract as the two rows it is drawn as" (fails before: "2 entries" over three rows).
- How to use it: bank a contract that pays something you also found - the heading's count matches the rows under it. Checked live with `--level=40 --grab=great-ball`: six rows, "6 ENTRIES" (5 before).

### 29. Berries counted as "Oran Berrys" in a sentence
- What a player met: a raid on a map with berry trees that picked three Oran Berries walked out to "A wipe would have cost you 2 Potions, 3 Oran Berrys ..."; every sentence that counts an item (the gamble line, "You lost ...", loot captions, Bill's and Brock's prices in words) built a plural by adding "s", so "Leftovers" became "Leftoverss", "Pretty Flowers" "Pretty Flowerss" and a disc "2 HM06 Rock Smashs".
- How reproduced: `itemNameFor` (`items/items.ts`) read through `buildExtractionReport` with three Oran Berries carried out - the gamble verdict said "3 Oran Berrys".
- What changed: `itemNameFor` asks `pluralName`: a name already ending in s stays as it is, a consonant and y becomes "ies", sh/ch/x/z take "es", and a disc keeps its name ("2 TM09 Bullet Seed" counts the discs). Tests: `extractionReport.test.ts` "names berries picked on the raid as berries, never "Berrys"" and `currency.test.ts` (both fail before).
- How to use it: pick berries on a raid and walk out - the result screen counts "3 Oran Berries".
- Not checked live (berries grow only on map-maker trees); the line is the pure function the screen prints.

### 30. A ball that shook three times and opened said the same flat line as one that burst at once
- What a player met: throwing at a wild Pokémon (or a beaten legend's one throw), a ball that wobbled "1... 2... 3..." and then opened ended on "PIDGEY broke free!" - the same words as a ball that burst on the spot, so nothing said how close the catch had come.
- How reproduced: a scratch probe started a legend fight from the title (Mewtwo 100 against a beaten Articuno 50) and threw the one ball: "ARTICUNO broke free!". The engine already counted the shakes; the break-out event did not carry them.
- What changed: the `broke-free` event carries `shakes` (absent is none, as an absent `slot` is the lead) and the line is FireRed's own for that count (`BROKE_FREE_LINES` in `battlePresentation.ts`, pret's `sText_PkmnBrokeFree` to `sText_ShootSoClose`): "Oh, no! The POKéMON broke free!", "Aww! It appeared to be caught!", "Aargh! Almost had it!", "Shoot! It was so close, too!". Test: `BattleScene.test.ts` "a ball that opens" (one case per shake count; all four fail before).
- How to use it: throw a ball and watch it shake - the line it opens on says how near you were.
- Also checked this iteration and clean: Warden Holt's double battle (two 10-letter nicknames with status tags on both plates, the target choice, a full turn's lines), an in-battle evolution (Charmeleon 35 to Charizard, the move chooser for Wing Attack, forgetting Metal Claw), a legend's refusal, one throw and flight.

### 31. Agility and Screech read like Growl: a two-stage change said only "rose" or "fell"
- What a player met: Agility, Swords Dance, Amnesia or Barrier moving a stat two stages said "Your BUTTERFREE's Speed rose!", and Screech, Charm or Cotton Spore "Wild CATERPIE's Defense fell!" - the same words as a one-stage Growl, so nothing said a stat had moved twice as far.
- How reproduced: a scratch probe started a wild battle from the title (Butterfree 30 knowing Agility and Screech, against a Caterpie) and used each; the engine already carried the stage count on `stat-stage-changed`, the line ignored it.
- What changed: `eventToMessage` (`scenes/battlePresentation.ts`) says FireRed's own words for two stages or more - "sharply rose" and "harshly fell" (`statChangeWords`, pret's `sText_StatSharply`/`sText_StatHarshly`). Intimidate's opening line now reports the change it made rather than the stage it left (`openingEventsFor` in `battleEngine.ts`), so two Intimidators in a double read as two "fell" lines, not two "harshly fell". Test: `BattleScene.test.ts` "says a stat moved by two stages sharply rose or harshly fell, as FireRed does" (fails before).
- How to use it: use Agility or Screech in a fight - the line says the stat sharply rose or harshly fell. Checked live at 960x640: both lines fit the dialogue box on one row.
- Seen and left: a status move whose stat is already at +6 or -6 says nothing after "used X!" (FireRed says "won't go higher!"); a candidate for a later iteration.

### 32. A status move on a stat already at its cap said nothing at all
- What a player met: using Agility a fourth time (Speed already at +6), or Growl on a foe whose Attack was at -6, read "Your BUTTERFREE used AGILITY!" and then nothing - the turn looked like a line had gone missing. FireRed says "won't go higher!" / "won't go lower!" (seen and left in entry 31).
- How reproduced: a scratch probe started a wild battle from the title (Butterfree 30 knowing Agility, against a Caterpie), set its Speed stage to +6 and used Agility; `applyStatBoosts` skipped a change of 0 silently.
- What changed: a status move's own effect that finds the stat at its cap emits `stat-capped` (`battleEngine.ts`), read as "X's Speed won't go higher!" or "... won't go lower!" (`battlePresentation.ts`), silent in `battleSounds.ts`. A rolled secondary at the cap (Metal Claw's raise) still says nothing, as FireRed's `ChangeStatBuffs` does for an uncertain change. Test: `BattleScene.test.ts` "says a stat already at its cap won't go higher, as FireRed does, rather than saying nothing" (fails before: the line after "used AGILITY!" was the foe's move).
- How to use it: keep using Agility or Growl past six stages - the line says the stat won't go higher or lower. Checked live at 960x640: "Your BUTTERFREE's Speed won't go higher!" on one row.
- Seen and left: Butterfree's Compound Eyes announces "has it in its sights!" after it uses Agility on itself, a move that cannot miss - an ability line where it changes nothing; a candidate for a later iteration.

### 33. Compound Eyes said "has it in its sights!" after Agility, then stayed quiet when it mattered
- What a player met: a Butterfree (or Venonat) using Agility on itself read "Your BUTTERFREE's Compound Eyes has it in its sights!" - a line about aim on a move that cannot miss. The line is said once a battle, so when it then threw a move the eye does sharpen (Sleep Powder, Supersonic) it said nothing (seen and left in entry 32).
- How reproduced: the probe from entry 32 (Butterfree 30 with Agility against a Caterpie); in the engine, `sayAccuracy` fired for any move whenever the ability's multiplier was not 1, `alwaysHits` included.
- What changed: `sayAccuracy` in `battleEngine.ts` keeps quiet for a move with `alwaysHits` (Agility, Swift, every self-targeted status move), so the once-a-battle line waits for the first move that rolls accuracy. Test: `abilities.test.ts` "keeps Compound Eyes quiet on a move that cannot miss, and says it on the first that can" (fails before).
- How to use it: lead with Agility on a Compound Eyes Pokémon - nothing about aim is said until it uses a move that can miss.
- Not re-checked live: the line is the engine's event, which the test reads directly; seen live in entry 32 before the fix.

### 34. A miss said "The attack missed!" without saying whose
- What a player met: every miss in a fight read "The attack missed!" - in a double battle, after a run of lines from four Pokémon, nothing said which one had swung and missed. FireRed names the attacker ("CHARMANDER's attack missed!").
- How reproduced: the `BattleScene.test.ts` blink harness (rolls held at a half) with Zap Cannon against Dynamic Punch, both 50% moves; the `missed` event carried only the side.
- What changed: the `missed` event carries the attacker's name (`battleEngine.ts`) and the line is FireRed's `sText_AttackMissed` - "Your PIDGEY's attack missed!" / "Wild RATTATA's attack missed!" (`battlePresentation.ts`). Test: `BattleScene.test.ts` "says whose attack missed, as FireRed does, rather than an attack nobody threw" (fails before: "The attack missed!").
- How to use it: miss with any move - the line names whose attack it was.
- Not checked live: the line is the presentation function the dialogue prints, and is shorter than the 40-character stat-cap line already seen to fit one row.
- Seen and left: "No PP left for X!" (FireRed: "There's no PP left for this move!") and "X is already at full HP." (FireRed: "X's HP is full!") are other lines in this game's own words.

### 35. Choosing a move with no PP said "No PP left for Tackle!" in mixed case and in the game's own words
- What a player met: picking a move marked "--" in the move list read "No PP left for Tackle!" - the move's name in lower case where every other battle line shouts it (TACKLE), and not FireRed's line (seen and left in entry 34).
- How reproduced: the `BattleScene.test.ts` harness with a Pidgey whose Tackle is at 0 PP, clicking FIGHT then TACKLE: the one line shown was "No PP left for Tackle!".
- What changed: the `no-pp` line is FireRed's own, "There's no PP left for this move!" (pret's `sText_NoPPLeft`, `battlePresentation.ts`); still no turn is spent. Test: `BattleScene.test.ts` "says there's no PP left for this move, as FireRed does, and spends no turn" (fails before).
- How to use it: run a move dry and pick it again - the line says there's no PP left for this move, and you choose again.
- Not checked live: the line is the presentation function the dialogue prints and is shorter than lines already seen to fit one row.
- Seen and left: a healing move at full HP still reads "X is already at full HP." (FireRed: "X's HP is full!").

### 36. A healing move at full HP said "X is already at full HP." in the game's own words
- What a player met: using Recover (or any healing move) with a full HP bar read "Your PIDGEY is already at full HP." - not FireRed's line, and the only battle line ending in a full stop rather than "!" (seen and left in entries 34 and 35).
- How reproduced: the `BattleScene.test.ts` blink harness with a full-HP Pidgey using Recover against Growl: the `heal-failed` line read "Your PIDGEY is already at full HP.".
- What changed: the `heal-failed` line is FireRed's `sText_PkmnHPFull`, "Your PIDGEY's HP is full!" (`battlePresentation.ts`). Medicine at full HP keeps its own refusal ("is already at full HP!"), because that one is said before the item is spent and costs no turn, which FireRed's bag says differently and is not a battle line. Test: `BattleScene.test.ts` "says a Pokemon at full HP that tries to heal has its HP full, as FireRed does" (fails before).
- How to use it: use Recover or Soft-Boiled at full HP - the line says the HP is full.
- Not checked live: the line is the presentation function the dialogue prints and is shorter than lines already seen to fit one row.

### 37. A burned Pokémon was "hurt by a burn!" rather than by its own
- What a player met: at the end of every turn a burned Pokémon read "Your SQUIRTLE is hurt by a burn!" - as if some passing burn had hit it. FireRed says "Your SQUIRTLE is hurt by its burn!" (pret's `sText_PkmnHurtByBurn`); poison was already FireRed's "is hurt by poison!".
- How reproduced: `eventToMessage` for a `status-damage` event with status `burn`; the existing test pinned the game's own wording.
- What changed: the `status-damage` line in `battlePresentation.ts` says "is hurt by its burn!" for a burn and keeps "is hurt by poison!" for poison. Test: `battlePresentation.test.ts` "says a burn hurts a Pokemon as its own burn, and poison as poison, as FireRed does" (fails before).
- How to use it: get burned (Ember, Flame Body) and end a turn - the line says the Pokémon is hurt by its burn.
- Not checked live: the line is the presentation function the dialogue prints, and is the same length as lines already seen to fit one row.
- Seen and left, other lines still in the game's own words: "X flinched and couldn't move!" (FireRed: "X flinched!"), "X was hurt by the recoil! -N HP" (FireRed: "X is hit with recoil!"), "X hurt itself in confusion!" (FireRed: "It hurt itself in its confusion!").

### 38. A flinch said "flinched and couldn't move!" in the game's own words
- What a player met: when a faster foe's Bite or Headbutt made a Pokémon flinch, the line read "Your CHARMANDER flinched and couldn't move!". FireRed says only "CHARMANDER flinched!" (pret's `sText_PkmnFlinched`). This was seen and left in entry 37.
- How reproduced: `eventToMessage` for a `flinched` event, the line the dialogue prints when the engine's `flinched` event comes up.
- What changed: the `flinched` line in `battlePresentation.ts` now reads "Your CHARMANDER flinched!" / "Wild RATTATA flinched!". Test: `battlePresentation.test.ts` "says a Pokemon that flinched simply flinched, as FireRed does" (fails before).
- How to use it: let a faster foe flinch you with Bite or Headbutt. The line says your Pokémon flinched.
- Not checked live: the line is the presentation function the dialogue prints, and it is shorter than lines already seen to fit on one row.
- Still left in the game's own words: recoil ("was hurt by the recoil! -N HP") and the confusion self-hit ("hurt itself in confusion!"). The recoil line's HP figure follows this game's rule that a line says what it cost, so a change there would be a design choice, not a wording fix.

### 39. A confused Pokémon never said it was confused, and hurt itself "in confusion"
- What a player met: a confused Pokémon's turn gave no sign of the confusion until the coin went against it, then read "Your SQUIRTLE hurt itself in confusion!". When it beat the coin, its move just happened, with nothing to say it had been at risk. FireRed says "SQUIRTLE is confused!" every turn before the coin, then "It hurt itself in its confusion!" (pret's `sText_PkmnIsConfused`, `sText_ItHurtConfusion`). This was seen and left in entries 37 and 38.
- How reproduced: `resolveEnemyTurn` with a confused Bulbasaur. The engine emitted nothing before the coin, and the self-hit line was the game's own wording.
- What changed: the engine now emits a `confused` event each turn a confused Pokémon tries to move, both when it acts and when it hurts itself, but not on the turn it snaps out (`battleEngine.ts`). It reads "Your SQUIRTLE is confused!" / "Wild PIDGEY is confused!", and the self-hit now reads "It hurt itself in its confusion!" (`battlePresentation.ts`). It sounds the status voice (`battleSounds.ts`). No roll moved, so no measured number changes. Tests: `battleEngine.test.ts` "says a confused Pokemon is confused before every move it tries, as FireRed does" and `battlePresentation.test.ts` "says a confused Pokemon is confused, then that it hurt itself in its confusion, as FireRed does" (both fail before).
- How to use it: get confused (Supersonic, Confusion) and try to move. Each turn first says your Pokémon is confused.
- Not checked live: the lines come from the presentation function the dialogue prints, and are shorter than lines already seen to fit on one row.

### 40. Paralysis never said what it does
- What a player met: a Thunder Shock or Static that paralysed a Pokémon read "Foe PIDGEY was paralysed!" and nothing more, so a newcomer had no way to learn that paralysis costs turns until one was lost, which then read "is fully paralysed and can't move!" (later generations' words). FireRed says "is paralyzed! It may be unable to move!" when it lands (pret's `sText_PkmnWasParalyzed`) and "is paralyzed! It can't move!" when it holds (`sText_PkmnIsParalyzed`).
- How reproduced: `eventToMessage` for `status-applied` and `status-prevented` with `paralysis`; the existing test pinned the game's own wording.
- What changed: both lines in `battlePresentation.ts` are FireRed's, spelt "paralysed" as this game spells it everywhere: "Foe PIDGEY is paralysed! It may be unable to move!" and "Your SQUIRTLE is paralysed! It can't move!". The battle dialogue wraps a long line into whole boxes (`DialogBox.shareIntoBoxes`), so the longer line is never cut. Test: `battlePresentation.test.ts` "says paralysis may stop a Pokemon moving when it lands, and that it did when it does, as FireRed does" (fails before).
- How to use it: get paralysed (Thunder Shock, Stun Spore, a Pikachu's Static) - the line says it may be unable to move, and a lost turn says it can't move.
- Not checked live: the lines are the presentation function the dialogue prints.

### 41. Every two-turn move "is gathering itself..." whatever it was doing
- What a player met: the first turn of Solar Beam, Dig, Skull Bash, Sky Attack or Bounce read "Your BULBASAUR is gathering itself..." - one line for a Pokémon soaking up sunlight and one burrowing underground alike, in the game's own words. FireRed says what each is doing ("took in sunlight!", "dug a hole!", "lowered its head!", "is glowing!", "sprang up!" - pret's `sText_PkmnTookSunlight` and its neighbours).
- How reproduced: `eventToMessage` for the engine's `charging` event, which already carries the move's name; every move gave the same line. Also played this iteration with nothing found: Route 1 braid survey, a Viridian Forest raid and the first contract with Maya (`raid.mjs --said --fight`).
- What changed: `chargeWords` in `battlePresentation.ts` gives each two-turn move FireRed's first-turn line (Fly, Razor Wind and Dive too, for when they are expressible); any other keeps "is gathering itself...". Test: `battlePresentation.test.ts` "says what a two-turn move is doing on its first turn, as FireRed does" (fails before).
- How to use it: use Solar Beam or Dig - the first turn says the Pokémon took in sunlight or dug a hole.
- Not checked live: the line is the presentation function the dialogue prints, and is shorter than lines already seen to fit one row.

### 42. "A EKANS doll", "a ORAN BERRY tree" and "a LEFTOVERS"
- What a player met: a doll of a Pokémon whose name starts with a vowel read "A EKANS doll" (also Eevee, Oddish, Abra, Onix and the rest), a ripe berry tree said "It's a ORAN BERRY tree.", a beaten boss "was carrying a LEFTOVERS", and Bill's help line offered "for a Old Rod". Only Oak's Pokédex rewards got the article right, with a helper private to `pokedex.ts`.
- How reproduced: the doll's `line` in `home/furniture.ts`, `berryTreeLines('oran', false)`, the boss-gear lines in `WorldScene.claimBossGear` and the barter help in `HubScene` all typed a bare "a".
- What changed: `ui/article.ts` is the one rule (`aOrAn`, `withArticle`: "an" before a vowel or an HM, "some" before a plural name like Leftovers, in any case), used by the doll, the berry tree, the boss gear, Bill's help line and Oak's rewards. Tests: `ui/article.test.ts`, `furniture.test.ts` 'says "An EKANS doll"...' and `world/berries.test.ts` (the last two fail before).
- How to use it: face an Oran tree or look at an Ekans doll in THE BOLTHOLE - each takes "an".
- Not checked live: the lines are the strings the dialogue prints.

### 43. The map maker offered to plant "a underground path" and "a two crates"
- What a player met: the help line under each thing in the map maker's plant lists typed a bare "a": "Plants a underground path", "a orange-roof house", "a awning", "a old gravestone", "a crates", "a two crates", "a stone steps". Select and Remove said "Chooses a drop-in, exit, item spot, ..., surf water ... or building".
- How reproduced: `makerScreen` with every plant group open; the `data-help` of each plant row and of the Select and Remove tools.
- What changed: the plant rows and both tools go through `withArticle` in `ui/article.ts`, which now reads the word a name is about ("a block of flats", "a house with flowers", "some stone steps"), leaves a name that counts itself bare ("two crates") and gives ground that is never one of "some" ("some surf water"); a plural piece is planted "with their top-left corner". Every thing in the Select and Remove lists has its own article. Tests: `makerView.test.ts` 'plants "an underground path"...' (fails before) and `article.test.ts` 'reads the word a name is about...'.
- How to use it: open MAKE A MAP, open Buildings or Things and rest the pointer on Underground Path or Crates - the help line reads "Plants an underground path..." / "Plants some crates...".
- Not checked live: the lines are the markup the help bar reads.

### 44. The raid pack offered to "Use Oak's Parcel on a Pokémon"
- What a player met: in the raid pack (B), the help line under a Lockpick, a Card Key or a map's key, an errand's thing (Oak's Parcel, Joy's medicine bag, Brock's crate, Old Amber) or a piece of furniture read "Use X on a Pokémon.", and pressing Enter on one opened a "Use X on" list of the party. Choosing a Pokémon then only said "Oak's Parcel is somebody's errand. Carry it home to them." Gear (Leftovers) also read "Use Leftovers on a Pokémon." and then, pressed, said gear is given on the PARTY screen.
- How reproduced: `BagScene.pressItem` on each of those items with one Pokémon in the party (`packTools.test.ts`'s harness): it set `usingItemId`, which is the recipient list. Only rods, the Pickaxe, a spare pack, balls, materials and money were refused at the row (`USELESS_IN_THE_FIELD`).
- What changed: `BagScene.ts` refuses a Lockpick, a key, an errand's thing, furniture and gear at the row, with a buzz and their own line ("Face a locked crate and press the interact key to pick it.", "Face its own locked gate and press the interact key.", "Carry it home to whoever asked for it.", "Carry it home and put it down in THE BOLTHOLE.", "Gear is given on the PARTY screen..."), and the help line says the same before the press. Tests: `packTools.test.ts` '%s says where it is used, and its help never offers to use it on a Pokemon' and 'says gear is given on the PARTY screen, in its help as when it is pressed' (both fail before).
- How to use it: carry a Lockpick or Oak's Parcel in a raid, press B and rest on it - the help says where it is used, and Enter says so rather than opening the party.
- Not checked live: the test drives the scene's own press and row markup.

### 45. Recoil said "was hurt by the recoil! -6 HP" in the game's own words
- What a player met: after Take Down, Double-Edge, Submission or a Struggle, the line read "Your PIKACHU was hurt by the recoil! -6 HP". FireRed says "Your PIKACHU is hit with recoil!" (pret's `sText_PkmnHitWithRecoil`). This was the last of the lines seen and left in entry 37.
- How reproduced: `eventToMessage` for a `recoil` event printed the old wording; no test pinned it.
- What changed: the `recoil` line in `battlePresentation.ts` is FireRed's. Like the confusion self-hit (entry 39), it gives no number, as the HP bar shows the cost. Test: `battlePresentation.test.ts` "says a Pokemon hurt by its own move is hit with recoil, as FireRed does" (fails before).
- How to use it: use a recoil move such as Take Down, or run out of PP and Struggle - the line says the Pokémon is hit with recoil.
- Also checked this iteration: the friend chip's straight-line distance (from entry 13) is only shown when the friend is in the same place, and a friend through a door reads INDOORS, so it is not a bug. Rendered the yard and the Pokémon Center with every rung built and five waiting - both clean.

### 46. A move an ability took read "let it straight past!" whatever the ability did
- What a player met: an Ember into a Vulpix or Growlithe said "Foe VULPIX's FLASH FIRE let it straight past!" - nothing said its Fire power had risen, and the second Ember read the same. A Ground move at a Gastly or Koffing, a Growl at a Voltorb and a Water Gun at a full-health Lapras all read "... let it straight past!" too, and a heal read "drank it in. +8 HP". FireRed has a line for each (pret's `battle_message.c` and `battle_util.c`'s ABILITYEFFECT_ABSORBING).
- How reproduced: `resolveTurn` with an attacker using Ember, a Ground move, Growl or a Water move into a Flash Fire, Levitate, Soundproof or Water Absorb holder, each `ability` event read through `eventToMessage`.
- What changed: the engine's `absorbed` ability event now carries the move and how it ended (`AbsorbedOutcome`: charged, ineffective, useless, missed, blocked; a heal by its amount), and `battlePresentation.ts` says FireRed's lines: "X's FLASH FIRE raised its FIRE power!", then "... made EMBER ineffective!"; "X makes GROUND moves miss with LEVITATE!"; "X's SOUNDPROOF blocks GROWL!"; "X restored HP using its WATER ABSORB! +N HP" or "... made WATER GUN useless!" at full health. Test: `abilities.test.ts` "a move an ability took, said in FireRed's own words" (4 cases, all fail before).
- How to use it: use Ember on a wild Vulpix or Ponyta, or a Ground move on a Gastly - the line names what the ability did.
- Also played: raids from viridian-kilns (Lv 14) and viridian-city-league-road (Lv 12) with `--said`; both clean.
- Seen and left (mechanics, a later candidate): FireRed's Volt Absorb and Water Absorb only take a move with power (`gBattleMoves[move].power != 0`), so Thunder Wave still paralyses a Jolteon there; this game's `absorbsMoveType` checks the type alone.

### 47. Thunder Wave did nothing to a Jolteon (Volt Absorb)
- What a player met: Thunder Wave at a wild or trainer Jolteon (Volt Absorb) was swallowed by the ability, so it could never be paralysed. FireRed's Volt Absorb and Water Absorb take only a move with power (`battle_util.c`: `gBattleMoves[move].power != 0`), so there Thunder Wave paralyses it.
- How reproduced: `resolveTurn` with Thunder Wave into a Volt Absorb holder - an `absorbed` event fired and no paralysis.
- What changed: `absorbsMoveType` is handed the move's power as well as its type, and Volt Absorb and Water Absorb take a move only when its power is above zero. Flash Fire, Levitate and Soundproof are unchanged (FireRed's Flash Fire takes any Fire move, Will-O-Wisp included). Test: `abilities.test.ts` "lets Thunder Wave through a Volt Absorb, which FireRed only lets take a move with power" (fails before).
- How to use it: Thunder Wave a Jolteon - it is paralysed, as in FireRed.

### 48. Intimidate "sized up the other side!" and then a separate fall line
- What a player met: a wild Growlithe or Ekans, or a trainer's Arbok, opened the fight with "Foe ARBOK's INTIMIDATE sized up the other side!" and then "Your BULBASAUR's Attack fell!" - two lines in the game's own words. FireRed says it in one line for each Pokémon cut: "Foe ARBOK's INTIMIDATE cuts BULBASAUR's ATTACK!" (pret's `sText_PkmnCutsAttackWith`), and says nothing for a foe already at the floor.
- How reproduced: `openingAbilityEvents` and `replacePlayerPokemon` with an Intimidate holder, each event read through `eventToMessage`.
- What changed: the engine's arrival (`applySendOut`, `openingEventsFor` in `battleEngine.ts`) gives one `sent-out` ability event for each foe whose stat it cut, carrying the stat and a `target`, in place of the announcement plus a `stat-stage-changed`; a Clear Body still says it would not let its Attack drop. `battlePresentation.ts` says "Foe ARBOK's INTIMIDATE cuts your BULBASAUR's Attack!". Test: `abilities.test.ts` "says an Intimidate in FireRed's one line, naming who it cut" (fails before); `doubleBattle.test.ts`'s Arbok test reads the targets off the new events.
- How to use it: meet a wild Growlithe or Ekans - the opening line names whose Attack its Intimidate cut.

### 49. Shed Skin "shed sleep with its skin!" in the game's own words
- What a player met: a wild Ekans or Metapod, or a player's Kakuna, shrugging off a status read "Wild EKANS's SHED SKIN shed poison with its skin!". FireRed says "Wild EKANS's SHED SKIN cured its poison problem!" (pret's `sText_PkmnsXCuredYProblem`, the status named by `gText_Poison`, `gText_Burn`, `gText_Ice` and the rest - so a freeze is an "ice problem").
- How reproduced: `eventToMessage` for an `ability` event with effect `shed` printed the old line, which a test pinned.
- What changed: the `shed` line in `battlePresentation.ts` is FireRed's, through a small `problemLabel` (burn and ice in FireRed's words, the rest as before). Test: `battlePresentation.test.ts` "says a Shed Skin cured its problem, in FireRed's own words" (fails before); the old pin is gone from the "names a status..." test.
- How to use it: poison a wild Ekans and keep fighting - when its Shed Skin works, the line says it cured its poison problem.
- Ability lines still in the game's own words: powered-up, sharpened, shrugged-off, hardened, blocked-status, cured-on-switch (FireRed's Natural Cure says nothing), reflected, contact, quickened, hidden, weathered-out.

### 50. An ability refusing a status "kept sleep off it!" in the game's own words
- What a player met: a Thunder Wave at a wild Persian's Limber, a Sleep Powder at a Drowzee's Insomnia or a Headbutt flinch on an Inner Focus read "... kept paralysis off it!", "... kept sleep off it!", "... would not let it flinch!". FireRed says "Wild PERSIAN's LIMBER prevents paralysis!", "Wild DROWZEE stayed awake using its INSOMNIA!", "... prevents poisoning!", "... prevents burns!", "... prevents confusion!", "... prevents flinching!" (pret's `battle_message.c`).
- How reproduced: `eventToMessage` for an `ability` event with effect `blocked-status` and each status printed the old lines.
- What changed: the `blocked-status` line in `battlePresentation.ts` is FireRed's for each status. FireRed says nothing when Magma Armor refuses a freeze, so that one keeps the game's words. Test: `battlePresentation.test.ts` "says an ability refused a status in FireRed's own words" (fails before).
- How to use it: Thunder Wave a Persian or Sleep Powder a Drowzee - the line says the ability prevents it, as in FireRed.
- Ability lines still in the game's own words: powered-up, sharpened, shrugged-off, hardened, blocked-boost (FireRed: "prevents stat loss!"), cured-on-switch, reflected, contact, quickened, hidden, weathered-out.

### 51. A refused stat drop "would not let its Attack drop!" in the game's own words
- What a player met: a Growl or Tickle at a wild Tentacool's Clear Body, a Sand-Attack at a Pidgey's Keen Eye or a Growl at a Krabby's Hyper Cutter read "... would not let its Attack drop!" - and a Tickle at Clear Body said it twice, once for each stat. FireRed says "Wild TENTACOOL's CLEAR BODY prevents stat loss!" once a move (`sText_PkmnPreventsStatLossWith`, guarded by `statLowered`), and Keen Eye and Hyper Cutter name the stat they keep: "... KEEN EYE prevents accuracy loss!" (`sText_PkmnsXPreventsYLoss`, pret's `battle_script_commands.c` `ChangeStatBuffs`).
- How reproduced: `resolveTurn` with a two-stat drop at a Clear Body foe gave two `blocked-boost` events, which `eventToMessage` printed in the old words.
- What changed: `applyStatBoosts` in `battleEngine.ts` gives an ability that refuses every stat one event without a stat, once per call; `battlePresentation.ts` prints FireRed's two lines. Test: `abilities.test.ts` "says a refused stat drop in FireRed's own words, once a move for Clear Body" (fails before).
- How to use it: Growl a wild Tentacool or Sand-Attack a Pidgey - one line says the ability prevents the loss.
- Ability lines still in the game's own words: powered-up, sharpened, shrugged-off, hardened, cured-on-switch, reflected, contact, quickened, hidden, weathered-out.

### 52. A Static "answered the touch!" and then a second line said the paralysis
- What a player met: Scratching a wild Pikachu (Static), or touching a Poison Point Nidoran, a Flame Body Ponyta or an Effect Spore Paras, gave two lines: "Wild PIKACHU's STATIC answered the touch!" and then "CHARMANDER is paralysed! It may be unable to move!". A Thunder Wave at an Abra read "... SYNCHRONIZE passed paralysis straight back!" plus a second status line. FireRed says it in one line that names the ability and whom it hit: "Wild PIKACHU's STATIC paralyzed CHARMANDER! It may be unable to move!" (pret's `sText_PkmnWasParalyzedBy`, `sText_PkmnPoisonedBy`, `sText_PkmnBurnedBy`, `sText_PkmnMadeSleep`, chosen by `HITMARKER_STATUS_ABILITY_EFFECT`). Synchronize has no line of its own.
- How reproduced: `resolveTurn` with Scratch into a Static holder, or Thunder Wave into a Synchronize holder, each event read through `eventToMessage`.
- What changed: `applyStatus` in `battleEngine.ts` takes an optional `by` (the ability's holder and name), carried on the `status-applied` event. The contact abilities and Synchronize pass it in place of their own `contact`/`reflected` ability event. `battlePresentation.ts` says FireRed's line ("your X" for the player's side, as Intimidate's does). Liquid Ooze still uses the `contact` kind. Test: `abilities.test.ts` "says a status an ability gave in FireRed's one line, naming the ability and whom it hit" (fails before); the Static, Synchronize and double-battle tests read `by` now.
- How to use it: Scratch a wild Pikachu until its Static works - one line says the Static paralysed your Pokémon.
- Ability lines still in the game's own words: powered-up, sharpened, shrugged-off, hardened, cured-on-switch, contact with an amount (Liquid Ooze; FireRed: "It sucked up the LIQUID OOZE!"), quickened, hidden, weathered-out. The `reflected` kind is now unused by the engine.

### 53. A drain into a Liquid Ooze said "tasted foul! -6 HP" and then "is hit with recoil!"
- What a player met: an Absorb or Mega Drain into a wild Tentacool (Liquid Ooze) read "Wild TENTACOOL's LIQUID OOZE tasted foul! -6 HP" and then "BULBASAUR is hit with recoil!" - two lines, the first in the game's own words and the second calling it recoil, which it is not. FireRed says one line in place of the drain's: "It sucked up the LIQUID OOZE!" (pret's `sText_ItSuckedLiquidOoze`, `BattleScript_AbsorbLiquidOoze`), as the Leech Seed path here already did.
- How reproduced: `resolveTurn` with a draining move into a Liquid Ooze holder, each event read through `eventToMessage`.
- What changed: the drain path in `battleEngine.ts` no longer announces a `contact` ability event; its `recoil` event carries `oozed`, and `battlePresentation.ts` prints FireRed's line for it (the bar still moves on that one line). The `contact` kind is Static-style only now. Test: `abilities.test.ts` "says a drain into a Liquid Ooze in FireRed's one line, never as recoil" (fails before).
- How to use it: Absorb a wild Tentacool - one line says it sucked up the LIQUID OOZE.
- Ability lines still in the game's own words: powered-up, sharpened, shrugged-off, hardened, cured-on-switch, quickened, hidden, weathered-out.

### 54. A drain said "Your BULBASAUR drained +4 HP." in the game's own words
- What a player met: an Absorb, Mega Drain or Giga Drain read "Your BULBASAUR drained +4 HP." (or a wild Oddish's "Wild ODDISH drained +3 HP."). FireRed says "Wild PIDGEY had its energy drained!" - naming the Pokémon drained, not the drainer, and giving no number (pret's `sText_PkmnEnergyDrained`, `BattleScript_EffectAbsorb`); the drainer's HP bar shows what it took.
- How reproduced: `resolveTurn` with Absorb at a Pidgey from a hurt Bulbasaur, the `drained` event read through `eventToMessage`.
- What changed: the engine's `drained` event carries `from`, the Pokémon the drain hit (`battleEngine.ts`), and `battlePresentation.ts` prints FireRed's line about it. Test: `moveEffects.test.ts` "says a drain in FireRed's words, naming the Pokemon whose energy was drained" (fails before).
- How to use it: use Absorb with a hurt Oddish or Paras - the line says the foe had its energy drained.
- Checked and left: the remaining ability lines (powered-up, sharpened, shrugged-off, hardened, cured-on-switch, quickened, hidden, weathered-out) print nothing at all in FireRed; AGENTS.md says every ability arrives as a battle line here on purpose, so they keep the game's words. Other lines still in the game's own words: a healing move's "X restored +N HP." (FireRed: "X regained health!"), and hail's chip "is buffeted by the hail!" (FireRed: "is pelted by HAIL!"; no shipped place or learnset brings hail).

### 55. A healing move said "Your BULBASAUR restored +34 HP." in the game's own words
- What a player met: Synthesis, Recover, Soft-Boiled, Milk Drink and the other healing moves read "Your BULBASAUR restored +34 HP." (or "Wild CHANSEY restored +N HP."). FireRed says "BULBASAUR regained health!" with no number (pret's `sText_PkmnRegainedHealth`, `BattleScript_EffectRestoreHp`); the HP bar shows what came back.
- How reproduced: `resolveTurn` with Synthesis from a hurt Bulbasaur, the `healed` event read through `eventToMessage`.
- What changed: `battlePresentation.ts` prints FireRed's line for `healed`. Test: `moveEffects.test.ts` "says a healing move in FireRed's words, with no number" (fails before: received "Your BULBASAUR restored +34 HP.").
- How to use it: use Synthesis or Recover while hurt - the line says the Pokémon regained health.
- Still in the game's own words: an absorbing ability's "restored HP using its WATER ABSORB! +N HP" (FireRed's `sText_PkmnRestoredHPUsing` has no number), and hail's chip line.

### 56. A Water Absorb said "restored HP using its WATER ABSORB! +8 HP"
- What a player met: a Water move into a hurt Lapras, Poliwag or Vaporeon line (Water Absorb), or an Electric move into a Volt Absorb, read "Foe LAPRAS restored HP using its WATER ABSORB! +8 HP" - FireRed's sentence with the game's own number tacked on. FireRed says "Foe LAPRAS restored HP using its WATER ABSORB!" (pret's `sText_PkmnRestoredHPUsing`); the HP bar shows what came back, as the drain and healing lines (54, 55) now do.
- How reproduced: `resolveTurn` with a Water move into a hurt Water Absorb holder, the `absorbed` event read through `eventToMessage`.
- What changed: `battlePresentation.ts` drops the "+N HP" from the `absorbed` line. Test: `abilities.test.ts` "says a Water Absorb restored HP in FireRed's words..." (fails before).
- How to use it: Water Gun a hurt wild Poliwag - the line says it restored HP using its WATER ABSORB.
- Still in the game's own words: hail's chip line (no shipped place or learnset brings hail).

### 57. The map maker's zoom bar and overview spilled out of the map window
- What a player met: opening MAKE A MAP in any window under about 1100 pixels wide, the map window's row of zoom buttons ran out of it, OVERVIEW drawn over the X of the first check in DOES IT WORK (at 1024x700), or half the row over the checks (800x600); and at 800x600 the overview minimap was bigger than the map window it stands in, covering all of it and spilling out over the paint tools.
- How reproduced: a probe that opens the maker from the title at 640x480, 800x600 and 1024x700 and photographs it. `.maker-zooms` was a flex row with no wrap, and `showOverview` only asked whether the map fits its window, never whether the overview does.
- What changed: the zoom row wraps (`style.css`), and the overview stands aside while it would cover more than half the map window across or down (`overviewLeavesRoom` in `maker/overview.ts`, asked by `MapMakerScene.showOverview`); the OVERVIEW button's help says so. Tests: `style.test.ts` "the map maker's zoom buttons wrap..." (fails before) and `maker/overview.test.ts`.
- How to use it: open MAKE A MAP in a small window - the zoom buttons stay in the map's window, on two rows if they must, and the overview shows only where there is room for it.
- Needs the captain: at 640x480 (the smallest menu stage) the maker's two side columns (132 and 188 game pixels) leave the map column no width at all, so there is nothing to draw on; a small-window layout for the maker is a design call. Also checked this iteration: baseRooms.mjs at 640x480 --hurt=3 (clean) and a Viridian City raid at 640x480. Seen and left: at Viridian City's front door the follower arrives behind the player on JOY'S NIGHT HATCH (the only landing where it stands on a cache; walking up swaps with it and works the hatch).

### 58. A prize's gleam stayed over the empty tile after it was picked up
- What a player met: picking up a rare find (a TM, a key, a stone) took its icon and its gold caption away, but the pulsing gold star over it stayed - first over the player's face while "Found TM28 Dig!" was read, then over an empty tile for the rest of the raid, until the next fight rebuilt the map.
- How reproduced: `raid.mjs --stepped --pixels --window=pixel --insertion=town-square --level=12 --clock=night --fight --shot=... --shot-dialogs` (the "Found TM28 Dig!" picture shows the star over the player). `collectLootHere` and `takeLootOffTheMap` destroyed the icon and caption, but the gleam was only kept in `mapObjects`.
- What changed: `WorldScene` keeps each prize's gleam by loot id (`prizeGleams`), and one `takeLootMarksOff` stops its tween and destroys it with the icon and caption, for both a pickup and a friend's claim. Test: `scenes/prizeGleam.test.ts` (fails before: the gleam is never destroyed and its tween runs on).
- How to use it: pick up any rare find - its light goes out with it.
- Checked and left: a Floodplain night raid and a Pallet night raid (wording, result screen, lobby) were otherwise clean. The result line "Banked 1 TM28 Dig" reads a little stiffly but is the same sum every item uses.

### 59. A failed wild run said "Couldn't get away from PIDGEY!" in the game's own words
- What a player met: choosing RUN against a faster wild Pokemon and losing the roll put up "Couldn't get away from PIDGEY!". FireRed says "Can't escape!" and names nobody (pret's `HandleAction_Run` in `battle_main.c` sets chooser 3, `B_MSG_CANT_ESCAPE_2`, which is `sText_CantEscape2`).
- How reproduced: `BattleScene.test.ts` "keeps the fight going on a failed roll..." presses RUN 38% against a level-20 Pidgey with the roll forced to fail, and reads the first line.
- What changed: `battlePresentation.ts` has `WILD_ESCAPE_FAILURE_MESSAGE`, FireRed's line, in place of `wildEscapeFailureMessage(name)`, and `BattleScene.ts` shows it. Test: that test now expects "Can't escape!" (fails before the fix).
- How to use it: run from a faster wild Pokemon - a failed roll says "Can't escape!" before the foe moves.

### 60. A knockout paid "SQUIRTLE gained 12 XP!" in the game's own shorthand
- What a player met: every knockout that paid experience read "SQUIRTLE gained 12 XP!". FireRed says "SQUIRTLE gained 12 EXP. Points!" (pret's `sText_PkmnGainedEXP` in `battle_message.c`; its `B_BUFF2` is " a boosted" only for a traded Pokemon, which this game has none of).
- How reproduced: `BattleScene.test.ts` "says what the knockout paid straight after the faint..." knocks out Raider Maya's lead and reads the line after the faint.
- What changed: `experienceGainedLine` in `battlePresentation.ts` holds FireRed's line and `BattleScene.awardVictoryExperience` prints it. Test: that test now expects "gained N EXP. Points!" (fails before the fix).
- How to use it: knock out any wild or trainer Pokemon - the line says how many EXP. Points it paid.
- Seen and left: the level-up line is "grew to Lv 12!" (FireRed: "grew to LV. 12!"); `levelLabel` is the one level format every plate and list uses, so changing that line alone would make the dialogue disagree with the plate it updates.

### 61. Choosing the Pokemon already fighting said "CHARMANDER is already out!"
- What a player met: opening POKEMON in a fight and choosing the one already on the field put up "CHARMANDER is already out!", the game's own words. FireRed's party menu says "CHARMANDER is already in battle!" (`gText_PkmnAlreadyInBattle`, beside the `gText_PkmnHasNoEnergy` line this list already uses for a fainted Pokemon).
- How reproduced: `BattleScene.test.ts` "keeps the way back on the line that says the lead is already out (playtest 47)" opens the party list with one Pokemon and chooses it.
- What changed: `BattleScene.switchPokemon` shows FireRed's line. Tests: that test now expects "is already in battle!  ESC: cancel" (fails before the fix); `battlePresentation.test.ts`'s prompt examples use the same line.
- How to use it: in any fight, open POKEMON and choose the one fighting - it says it is already in battle, with ESC to go back.
- Still to check against FireRed: the move-learning question "wants to learn X, but already knows four moves." (FireRed asks it over several lines).

### 62. A fifth move was asked about as "X wants to learn Y, but already knows four moves."
- What a player met: a level-up offering a move with all four slots full (a Charmeleon reaching 36 and Wing Attack, a Squirtle line at Rain Dance) put up one line of the game's own: "CHARMELEON wants to learn WING ATTACK, but already knows four moves.". FireRed asks it over two boxes before its chooser: "CHARMELEON is trying to learn WING ATTACK." and "But, CHARMELEON can't learn more than four moves." (pret's `sText_TryToLearnMove1` and `sText_TryToLearnMove2` in `battle_message.c`; its third line, "Delete a move to make room for X?", is the chooser this game opens).
- How reproduced: `BattleScene.test.ts`'s levelling trainer fight with a Squirtle that already knows four moves, reading the lines up to the chooser.
- What changed: `tryingToLearnLines` in `battlePresentation.ts` holds FireRed's two lines and `BattleScene` (`moveOfferNotes`, used by both the knockout and the evolution path) puts them up one box each, opening the chooser only after the second. Test: `BattleScene.test.ts` "asks about a fifth move in FireRed's two lines..." (fails before the fix).
- How to use it: level a Pokemon that knows four moves to its next move - two lines say it is trying to learn it and cannot hold more than four, then the chooser asks which to forget.
- Seen and left: after the choice the battle says "X forgot Y and learned Z!" in one line (FireRed: "1, 2, and... Poof!", "X forgot Y.", "And... X learned Z!"); a candidate for a later iteration.

### 63. A forgotten move was said as "X forgot Y and learned Z!" in one line of the game's own
- What a player met: after choosing a move to forget in a fight, the battle put up one line, "SQUIRTLE forgot TACKLE and learned BUBBLE!", and the learned fanfare played as the chooser closed rather than on the learned line. FireRed says it over four boxes: "1, 2, and... ... ... Poof!", "SQUIRTLE forgot TACKLE.", "And...", "SQUIRTLE learned BUBBLE!" (pret's `BattleScript_ForgotAndLearnedNewMove`: `sText_123Poof`, `sText_PkmnForgotMove`, `sText_AndEllipsis`, `sText_PkmnLearnedMove`, the fanfare on the last).
- How reproduced: `BattleScene.test.ts`'s levelling trainer fight with a Squirtle that already knows four moves, answering the chooser (stubbed, it is a DOM overlay) with "forget TACKLE" and reading on.
- What changed: `forgotAndLearnedLines` in `battlePresentation.ts` holds FireRed's four lines and `BattleScene.openMoveOffer` puts them up one box each, with `moveLearned` sounding on the learned line. Declining still says "X did not learn Y.", which is FireRed's `sText_DidNotLearnMove` already. The base and the pack keep their one-line status (`moveChoiceMessage`), which is a status bar, not a dialogue. Test: `BattleScene.test.ts` "says a forgotten move in FireRed's four boxes, the fanfare on the last" (fails before the fix).
- How to use it: level a Pokemon with four moves to its next one in a fight and pick a move to forget - the battle counts "1, 2, and... Poof!", says what was forgotten, then what was learned.

### 64. A Potion said "CHARMANDER recovered 12 HP!" in the game's own words
- What a player met: every Potion, Super Potion or healing berry used - in a fight, from the raid pack, or at base's treatment bench - said "CHARMANDER recovered 12 HP!". FireRed's party menu says "CHARMANDER's HP was restored by 12 point(s)." in a fight and out of one (pret's `gText_PkmnHPRestoredByVar2` in `strings.c`).
- How reproduced: `battleItems.test.ts` uses a Potion on a hurt Charmander through `applyBattleItem`; `treatment.test.ts` treats one at base; `BattleScene.test.ts` presses ITEM.
- What changed: `hpRestoredLine` in `items/items.ts` holds FireRed's line, and both `useFieldItem` (pack and base) and `applyBattleItem` (fight) print it. Tests: those three now expect the new line (fail before the fix).
- How to use it: use a Potion on a hurt Pokémon anywhere - the line says its HP was restored by so many point(s).
- Still in the game's own words (a candidate for later): the cure lines, "was cured of poison!" (FireRed's party menu: "was cured of its poisoning."), "woke up!" ("woke up."), "'s burn was healed!", "was thawed out!"; and the full-HP refusal "HP is already full." (FireRed: "It won't have any effect.").

### 65. An Antidote said "CHARMANDER was cured of poison!" in the game's own words
- What a player met: every status cure from medicine or a berry - in a fight, from the raid pack or at base's treatment bench - ended in "!" and the poison one said "was cured of poison!". FireRed's party menu says "CHARMANDER was cured of its poisoning.", "was cured of paralysis.", "'s burn was healed.", "woke up." and "was thawed out." (pret's `gText_PkmnCuredOfPoison` and neighbours in `strings.c`), in a fight and out of one.
- How reproduced: `battleItems.test.ts` uses an Antidote on a poisoned Charmander through `applyBattleItem`; `treatment.test.ts` treats one at base; `boulders.test.ts` reads `curedLine` for all five statuses.
- What changed: `curedLine` in `items/items.ts` holds FireRed's five lines. Tests: those three now expect them (fail before the fix). The battle engine's own "woke up!" and "thawed out!" (a Pokemon waking on its own) are FireRed's battle lines and were left.
- How to use it: use an Antidote (or any cure) on a poisoned Pokémon - the line says it was cured of its poisoning.
- Still in the game's own words (a candidate for later): the full-HP refusal "HP is already full." (FireRed: "It won't have any effect.").

### 66. A Potion on a full Pokemon said "CHARMANDER's HP is already full." in the game's own words
- What a player met: a Potion on a Pokemon at full HP, an Antidote on one that is not poisoned, or a stone on a Pokemon it does not evolve each had their own wording - "X's HP is already full." from the raid pack and base, "X is already at full HP!" and "It would not have any effect on X." in a fight, "It will not have any effect." for a cure or a stone. FireRed's party menu says one thing for all of them, in a fight and out of one: "It won't have any effect." (pret's `gText_WontHaveEffect` in `strings.c`).
- How reproduced: `items.test.ts` uses a Potion and an Antidote on a healthy Bulbasaur through `useFieldItem`; `battleItems.test.ts` does the same through `applyBattleItem`; `BattleScene.test.ts` presses ITEM on a full Pokemon; `packStoneTargets.test.ts` reads the pack's stone hint.
- What changed: `WONT_HAVE_EFFECT_LINE` in `items/items.ts` is FireRed's line, used by `useFieldItem` (pack and base), `applyBattleItem`'s refusal (fight) and the pack's stone hint (`BagScene`). Nothing is spent, as before. The fainted-Pokemon refusals keep their own words, because they say this game's rule that medicine never revives. Test: `items.test.ts` "says FireRed's 'It won't have any effect.'..." (fails before the fix); the other three now expect the line.
- How to use it: use a Potion on a Pokémon at full HP anywhere - it says it won't have any effect and keeps the Potion.

### 67. THE BOLTHOLE went unnamed every time the player walked out of it
- What a player met: coming out of their own house, the player stands on THE BOLTHOLE's step with the partner tucked in behind them, and the house had no caption at all (L held or not) while BROCK'S WORKSHOP two buildings away was named. It stayed missing for as long as they stood there.
- How reproduced: `tools/playtest/bolthole.mjs` (`--beaten=floodplain-toll-keeper --raids=floodplain-relay:3:2`), then reading every label's visibility on the step for four seconds and asking `explainSeats` why: the seats over the roof are under the wood's canopy, the left seats are on the workshop, the right ones off the view and under the FEEDBACK tab, and the only clear row, under the step, was refused because the harbour kept the partner's figure clear outright.
- What changed: `BaseScene.containWorldLabels` passes the partner as the soft `follower` the raid already uses (a caption sits clear of it while anywhere else is clear, never goes unseated for it) and keeps only its speech bubble as hard ground; the partner goes faint under a caption that took its tile, through a new shared `seatedOver` in `labelPlacement.ts` that `WorldScene` now uses too. Test: `scenes/boltholeStepCaption.test.ts` (the real `containWorldLabels` with the real yard canopy; fails before the fix, passes after).
- How to use it: walk out of THE BOLTHOLE - its name and badge count are under the step, with the partner showing faintly through them.

### 68. Leftovers and a Focus Band spoke in the game's own words in a fight
- What a player met: a Pokémon holding Leftovers read "Your CHARMANDER took +2 HP from its Leftovers." at the end of every hurt turn, and one saved by a Focus Band read "Foe PIDGEY hung on with its Focus Band!". FireRed says "Your CHARMANDER's LEFTOVERS restored its HP a little!" (pret's `sText_PkmnsItemRestoredHPALittle`, no number - the HP bar shows it) and "Foe PIDGEY hung on using its FOCUS BAND!" (`sText_PkmnHungOnWithX`), the item in capitals.
- How reproduced: `eventToMessage` for a `gear-heal` and a `gear-endured` event printed the old lines.
- What changed: those two cases in `battlePresentation.ts` print FireRed's lines, the item through `battleCaps`. Quick Claw (silent in FireRed) and Life Orb (not in FireRed) keep the game's words. Test: `battlePresentation.test.ts` "says Leftovers and a Focus Band in FireRed's own words" (fails before).
- How to use it: give a Pokémon Leftovers and take a hit - at the end of the turn the line says its LEFTOVERS restored its HP a little.
- Checked and left: the weather lines are FireRed's except harsh sunlight ("turned harsh" / "is harsh"; FireRed: "got bright" / "is strong"), which no shipped learnset or place brings. FireRed's "Rain continues to fall." every turn is not said here; adding it is a pacing call. Playtest 48's "cave encounters thick" is `PALLET_DELVE_WILDLIFE` at a deliberate 0.05 a step (two expected in 40 steps), luck, left.

### 69. Every wild fight opened "A wild ZAPDOS appeared!"
- What a player met: walking up to Route 1's Zapdos on the Overlook (and every wild fight in tall grass, fishing or the teaching fight) opened on "A wild ZAPDOS appeared!". FireRed says "Wild ZAPDOS appeared!" with no article (pret's `sText_WildPkmnAppeared`; a double is `sText_TwoWildPkmnAppeared`, "Wild X and Y appeared!").
- How reproduced: a tour driver (tour.mjs with an interact press added) deployed to `route-1`, stood the player beside Zapdos at 35,6 facing right and pressed Space; the battle's first line was read off the screenshot.
- What changed: `battleOpeningMessages` and `teachingBattleMessages` in `pokemon/battle/battleFlow.ts` say FireRed's line. Test: `battlePresentation.test.ts` "opens a wild fight in FireRed's own words" (single and double; fails before).
- How to use it: step into tall grass until something bites - the fight opens "Wild PIDGEY appeared!".
- Seen and left (later candidates): a trainer fight opens "X wants to battle!" (FireRed: "X would like to battle!") and sends out with "Go, X!" (FireRed: "Go! X!"). Route 1's southern places (Steading, Pound, Hollow Oak, Brook, Common, South Gate, Water Meadows) and their signs were toured and read fine.

### 70. Every trainer fight opened "X wants to battle!"
- What a player met: every trainer fight (Raider Maya, every keeper, the hunter) opened on "RAIDER MAYA wants to battle!", and a trainer on a player's map with no lines of their own said the same before the fight. FireRed says "X would like to battle!" (pret's `sText_Trainer1WantsToBattle`).
- How reproduced: `battleOpeningMessages('LASS ADA', ...)` and `firstRaidFlow.test.ts`'s hunter opening printed the old line; seen on the trainer fights in earlier tours.
- What changed: a new `trainerChallengeLine` in `pokemon/battle/battleFlow.ts` holds FireRed's line, used by the battle's opening and by `mapFile.ts`'s fallback line for a map-file trainer. Test: `battlePresentation.test.ts` "opens a trainer fight in FireRed's own words" (fails before the fix); `firstRaidFlow.test.ts` now expects the new line.
- How to use it: walk into a trainer's watch - the fight opens "X would like to battle!".
- Left: the README's battle picture still shows "BLUE wants to battle!" and its alt text describes that picture truthfully; it changes when the picture is made again (`tools/playtest/readmeShots.mjs`). Still a later candidate: the send-out "Go, X!" (FireRed: "Go! X!").

### 71. Every send-out said "Go, X!"
- What a player met: every trainer fight's opening, every switch and every replacement after a faint said "Go, CHARMANDER!". FireRed says "Go! CHARMANDER!" (pret's `sText_GoPkmn`; a double is `sText_GoTwoPkmn`, "Go! X and Y!").
- How reproduced: `battleOpeningMessages('LASS ADA', ...)` printed the old line last; `BattleScene.test.ts`'s switch and forced-replacement tests read it off the dialogue.
- What changed: a new `sendOutLine` in `pokemon/battle/battleFlow.ts` holds FireRed's line, used by the opening and by `BattleScene`'s three send-out paths (chosen switch, forced replacement, about-to-use switch). Test: `battlePresentation.test.ts` "sends a Pokemon out in FireRed's own words" (single and double; fails before); `BattleScene.test.ts` and `firstRaidFlow.test.ts` now expect the new line.
- How to use it: switch Pokémon in any fight - the new one comes out with "Go! X!".
- Later candidate: the withdraw line "Come back, X!" (FireRed: "X, come back!", `sText_PkmnComeBack`, with HP-dependent variants) in `BattleScene.ts`.

### 72. Every switch said "Come back, X!"
- What a player met: switching Pokémon in a fight (from the commands, or when offered a switch against a trainer's next Pokémon) called the old one back with "Come back, SQUIRTLE!". FireRed says "SQUIRTLE, come back!" (pret's `sText_PkmnComeBack`).
- How reproduced: `BattleScene.test.ts`'s about-to-use switch test reads the line off the dialogue.
- What changed: a new `withdrawLine` in `pokemon/battle/battleFlow.ts` holds FireRed's line, used by both of `BattleScene`'s withdraw paths. Test: `battlePresentation.test.ts` "calls a Pokemon back in FireRed's own words" (fails before); `BattleScene.test.ts` now expects the new line.
- How to use it: switch Pokémon in any fight - the old one goes back with "X, come back!".
- Left on purpose: FireRed's HP-dependent variants ("that's enough!", "OK!", "good!", chosen by how hurt the foe is) - choosing among them is a wording design call.

### 73. One score waiting on the console was "they"
- What a player met: sitting back down at THE BOLTHOLE's console with one score left over from a game whose bot check did not pass (or that Pallet Town did not answer), the GAMES menu said "One score is still waiting: the bot check didn't pass. They go next time you sit down here." - one score, then "they".
- How reproduced: `waitingLine({ sent: 0, left: 1, stopped: 'bot-check' })` in `console/gamesMenu.ts` printed the line; the old test only matched its first half.
- What changed: `waitingLine` says "It goes" for one score and "They go" for several. Test: `gamesMenu.test.ts` 'says one waiting score goes up as "it", and several as "they"' (fails before).
- How to use it: leave one score waiting and sit at the console again - the line reads "One score is still waiting... It goes next time you sit down here."
- Read and left: the console menu's keys and name flow (`ConsoleScene.ts`); a claim answered after the menu is closed still calls `keepName` on the stopped scene (harmless: the overlay is gone, so it draws nothing). The playtest 48 nudge to plant a building by its door rather than its top-left corner touches the ghost, the drag-planting and every maker driver's clicks - a bigger change, left for its own iteration.

### 74. Every won fight ended on an extra "You won the battle!"
- What a player met: after every wild fight's experience lines (and after a trainer's own defeat words), one more box said "You won the battle!" and waited for a press before the map came back. FireRed says nothing there: the fight fades out on its last line.
- How reproduced: `BattleScene.onMessagesComplete` with the fight won and the rewards paid showed the line in `finished` mode; nothing tested it.
- What changed: a won fight goes back to the map once its last line is read (`BattleScene.ts`); "You blacked out!" (outside a raid only) is kept. Test: `BattleScene.test.ts` "goes back to the map on its last line, with no "You won the battle!" after it" (fails before: the map never came back without the extra press).
- How to use it: win any fight - pressing past the last experience line takes you straight back to the map.
- Read and left: every authored trainer, the hunter and map-file trainers carry `defeatText`, so the "X was defeated!" fallback is never seen. The Day-Care's lines are FireRed's.

### 75. A stone used from the pack said "Pikachu evolved into Raichu!" in the game's own words
- What a player met: using a Thunder Stone (or any of the five stones) from the raid's pack, the pack's line read "Pikachu evolved into Raichu!", while the same evolution by level in a fight says FireRed's "Congratulations! Your CHARMANDER evolved into CHARMELEON!" (`gText_CongratsPkmnEvolved`), which FireRed also says for a stone.
- How reproduced: `useFieldItem(thunder-stone, pikachu)` returned the old line; `evolution.test.ts` and `nickname.test.ts` pinned it.
- What changed: `useFieldItem` in `items/items.ts` says "Congratulations! Your X evolved into Y!" (X the nickname if it has one, in the pack's own casing). Tests: `evolution.test.ts` "turns the one species that answers to it, and says so in FireRed's own words" and `nickname.test.ts` now expect FireRed's line (both fail before).
- How to use it: use an evolution stone from the pack in a raid - the pack says "Congratulations! Your Pikachu evolved into Raichu!".
- Read and left: medicine on a fainted Pokémon in the pack says "It will not have any effect on a fainted Pokémon." where FireRed says only "It won't have any effect."; the longer line explains the no-revive rule, so it stays.

### 76. The field guide spelled the Floodplain's radio exit two ways in one list
- What a player met: pressing O on a Floodplain raid, the field notes said "Ranger Station stays switched on: the Radio Exit is open from the first second of every raid." straight above "The nearest open exit is RADIO EXIT, to the south-west." - one exit in two spellings, and the only lines in the guide that named places in title case (with "South Gate is always open; Ferry Dock opens on its signal." when no exit is near).
- How reproduced: `menuShots.mjs <url> <out> --window=1280x800 --raid` (the field-guide picture); the four lines are typed by hand in `ObjectiveGuide.ts`'s Floodplain hints.
- What changed: the station's three lines are written from the landmark's own `label` and `unlockedExtractionLabel` ("The RANGER STATION stays switched on: the RADIO EXIT is open...", "The RADIO EXIT is active at the RANGER STATION.", "The RANGER STATION gives a hunter forecast and activates the RADIO EXIT."), and the no-exit fallback names the SOUTH GATE and FERRY DOCK in capitals. Test: `ObjectiveGuide.test.ts` "names the ranger station and its exit as the map labels them, in every state" (fails before).
- How to use it: press O on a Floodplain raid - every place in the field notes is named in the capitals its caption uses.
- Also checked this iteration and clean: dayCare.mjs (every Day-Care line matches pret's `Route5_PokemonDayCare/text.inc`, read from the local clone at `~/.cache/pret-pokefirered-037335f`), fishing.mjs, bolthole.mjs, bunker.mjs, menuShots.mjs --raid at 1280x800, a first-contract raid with --said. Seen and left: the drop-in pane's "3 MORE" strip stands under a blank band 45 game pixels deep, because the WAYS OUT heading and its first row both go under it (the designed orphan-heading rule); the Good Rod's own description does not say how to fish, but the pack's help line does.

### 77. A lone partner came home as "1 Pokémon came home hurt"
- What a player met: a newcomer (one Pokémon) back from a rough raid read "1 Pokémon came home hurt. NURSE JOY is across the yard." on Oak's Lab - counted like a stranger, while the all-fainted line already named a lone Pokémon ("Bulbasaur has fainted, so nobody can raid").
- How reproduced: `raid.mjs --insertion=pallet-quarry --completed=all --level=12 --hp=5`, then the lobby line; `teamConditionLine` in `ui/condition.ts` counted every case but all-fainted.
- What changed: `teamConditionLine` names one Pokémon rather than counting it ("Bulbasaur came home hurt", "Bulbasaur fainted", "Bulbasaur fainted and Pidgey came home hurt"), and still counts two or more. Test: `condition.test.ts` "names one Pokemon rather than counting it" (fails before); `HubScene.test.ts` now expects the name.
- How to use it: come home with one Pokémon hurt - Oak's Lab says "Bulbasaur came home hurt."
- Also fixed: `tools/playtest/deploy.mjs` set HP back to full whenever `--level` was given, so `--level=N --hp=1` (the way to lose a raid at a level) deployed a fit team; `--hp` now holds with `--level`. Also checked and clean: a Viridian Forest raid at level 22 with --fight --said (every battle line FireRed's), a Pallet Town raid. Left on purpose: the Pokémon Center door caption's short "1 Pokémon hurt" (`base/doorStatus.ts`), a two-line caption with no room for a name.

### 78. The raid-with-a-friend screen still promised your own loot
- What a player met: Oak's Lab's RAID WITH A FRIEND said "You each bring your own team and pack, keep your own clock and loot", and the lab card's help said "Two players on one map". Since the room's later stages, loot goes to whoever steps on it first, one hunter chases the whole room, a keeper one of you beats opens his doors for everyone, and a room holds four - so a player read the rules wrong before their first shared raid.
- How reproduced: `friendRaid.mjs <url> <out> --window=640x480`, photo `1-olly-make-a-room.png`; the words were written with the first stage (#305) and never changed.
- What changed: the TOGETHER, APART paragraph and the card's help in `hub/friendRoomView.ts` say what the room shares now; still fits the smallest stage. Test: `friendScreens.test.ts` "says what a room shares as the raid plays it" (fails before).
- How to use it: open Raid with a friend in Oak's Lab - TOGETHER, APART says the loot is first come, the hunter is shared and a beaten keeper's doors open for all.
- Seen and left: at 640x480 the FEEDBACK tab stands over the JOIN button's right edge (the designed "no room on either edge" case in AGENTS.md).

### 79. A thawed Pokémon "thawed out!" in a fight
- What a player met: a frozen Pokémon coming out of it in battle (one in five on its own turn, or hit by a Fire move) read "Foe SEEL thawed out!" - a later generation's line. FireRed says "Foe SEEL was defrosted!" (pret's `sText_PkmnWasDefrosted`, and `sText_PkmnWasDefrosted2` for its own-turn thaw).
- How reproduced: `eventToMessage({ type: 'status-cured', status: 'freeze', ... })` in `scenes/battlePresentation.ts`; checked against `src/battle_message.c` at pret 037335f, fetched with curl (the local clone has no `src/`).
- What changed: the freeze line of `status-cured` says "X was defrosted!". Test: `battlePresentation.test.ts` "says a thawed Pokemon was defrosted, in FireRed's own words" (fails before).
- How to use it: freeze a Pokémon (Ice Beam) and wait - it comes out of it with "X was defrosted!".
- Read and left: the Ice Heal's field line "was thawed out." is FireRed's own (`gText_PkmnThawedOut`). Later candidates, both checked in `battle_message.c`: "The sunlight turned harsh!" (FireRed: "The sunlight got bright!") and the hail chip "is buffeted by the hail!" (FireRed: "is pelted by HAIL!") - neither is reachable yet (no place has sun or hail, and nothing learns Sunny Day or Hail by level); a ball thrown at a trainer's Pokémon says "You can't catch a trainer's POKéMON!" where FireRed says "The TRAINER blocked the BALL!" then "Don't be a thief!".

### 80. A sleeping Pokémon was "fast asleep!"
- What a player met: every turn a Pokémon slept through, the fight said "Foe PIDGEY is fast asleep!" - shouted. FireRed says "Foe PIDGEY is fast asleep." with a full stop (pret's `sText_PkmnFastAsleep`), the one turn-lost line it does not shout.
- How reproduced: `eventToMessage({ type: 'status-prevented', status: 'sleep', ... })` in `scenes/battlePresentation.ts`; checked against `src/battle_message.c` at pret 037335f.
- What changed: `statusHolds` carries each line's own stop, so sleep ends on "." and the rest keep "!". Test: `battlePresentation.test.ts` "says why a turn was lost in the words of the condition that took it" now expects "is fast asleep." (fails before).
- How to use it: put a foe to sleep (Sing, Sleep Powder) - each turn it sleeps through reads "Foe X is fast asleep."
- Checked and left: the trainer-ball refusal ("You can't catch a trainer's POKéMON!") cannot be met - a trainer fight's commands have no BALL.

### 81. The contracts named their places in two spellings
- What a player met: on the cordon ledger, the field guide read "Only the West Culvert banks it - ... until the Sluice Wheel is wound" straight above "Only WEST CULVERT, to the south-west, banks this contract. It stays sealed until SLUICE WHEEL is worked", and picking the ledger up said "Only the West Culvert will take it." under a chip reading "SLUICE WHEEL: SE, THEN WEST CULVERT". All four authored contracts wrote their places in title case (the Allotments, the Meadows, Route Head, East Rise, the Fire Tower, the Forest Clearing...), while every caption, plate and chip - and every standing-board contract's briefing - says them in capitals.
- How reproduced: `raid.mjs <url> --stepped --window=640x480 --insertion=town-square --completed=recover-lost-field-kit,survey-the-braid --level=14 --shot=... --shot-dialogs` (the opening briefing and the ledger's line); the words are typed by hand in `objectives/contracts.ts`.
- What changed: the four contracts' briefings, raid-opening lines and stop lines name each place as the map captions it (THE ALLOTMENTS, WEST CULVERT, SLUICE WHEEL, THE FLOOD, SOUTH GATE, THE LANDING, RANGER STATION - the "ranger hut" of the first contract is that landmark - WEST ROAD, MIDDLE FIELD, EAST ROAD, THE MEADOWS, ROUTE HEAD, THE OUTPOST, EAST RISE, FIRE TOWER, TOWER STEPS, FOREST CLEARING, BROOK FORD). The board's own one-line descriptions keep title case, as the standing board's do. Test: `contracts.test.ts` "names every place the way the map captions it" (every exit, landmark and district on a contract's map, in every line a raid says about it; fails before with 44 lines).
- How to use it: take the cordon ledger - the briefing, the field guide and the ledger's line all say WEST CULVERT and SLUICE WHEEL as the chip and the captions do.
- Needs the captain: every battle line names the player's own Pokémon "Your BULBASAUR used ..." where FireRed says only "BULBASAUR used ..." (pret's `HANDLE_NICKNAME_STRING_CASE` puts a prefix on the foe's side only). It is the game's "always by side" rule (`combatantName`) and touches nearly every battle test, so it is a design call. Also seen: `raid.mjs --fight` presses whatever move the cursor remembers, so a Bulbasaur 16 sits on Leech Seed until its PP runs out and the driver stops ("interruption never cleared") - a driver limit, not the game's; the night Pallet Town raid otherwise played clean, as did a Route 1 raid from THE STEADING.

### 82. Two worked landmarks named themselves in lowercase on the result screen
- What a player met: banking the braid survey, the result screen's reward said "Oak's field station is signed off: the STATION RELAY is open..." and banking the warden's resupply said "The warden keeps the fire tower lit: the TOWER STEPS are open..." - the landmark in lowercase beside its exit in capitals, while the caption over it on the map reads OAK'S FIELD STATION and FIRE TOWER (and the other two notes already said RANGER STATION and SLUICE WHEEL).
- How reproduced: read `WORKED_LANDMARKS[].note` in `world/workedLandmarks.ts` against each landmark's `label` in `world/pois.ts`; the test that held the note to its landmark compared both in lowercase, so it passed.
- What changed: the two notes say OAK'S FIELD STATION and the FIRE TOWER. Test: `workedLandmarks.test.ts` "names on the result screen the landmark the player worked, in its caption's capitals..." now compares the label as captioned (fails before on survey-the-braid).
- How to use it: bank the braid survey or the warden's resupply - the result screen names the landmark as its caption does.
- Checked and left: the battle's weather lines - "It is raining." at a rainy fight's start is the RSE line FireRed keeps for that case (`sText_ItIsRaining`), and FireRed's per-turn "Rain continues to fall." is not said here (it would add a line to every rainy turn); the sun and hail lines differ but cannot be met.

### 83. The drop-in's MORE strip cut "Doors 5 held" through its middle
- What a player met: choosing a drop-in at the smallest stage (640x480), the WHAT IS IN THERE pane showed Wild, Fights and then the top half of "Doors 5 held" sliced off by the 4 MORE strip - a line with no bottom, which the screens' "no glyph is ever half-drawn" rule exists to prevent.
- How reproduced: `menuShots.mjs <url> <out> --window=640x480`, photo `dropin-640x480.png` (the audit still said clean, because it only counts what the fold measures). Each fact is a `dt` and `dd` in a `div` of `dl.dropin-facts`, and the fold's row list (`SCROLL_ROWS` in `ui/MenuOverlay.ts`) never named them, so the whole strip of facts was one row and the fold fell through it - the dossier's stats had the same fault once.
- What changed: `SCROLL_ROWS` names `.dropin-facts > div`, so each fact is a line the fold falls between. Test: `HubScene.test.ts` "measures the place's facts as lines, so the fold never cuts one through" (fails before). Re-photographed: the strip now takes the whole Doors line.
- How to use it: open the drop-in step in a small window - the place's facts end on a whole line above MORE.
- Checked and left: a sealed standing contract with two caches would brief "The cache is behind..." then "Both caches..." (`standingBoard.ts`), but over 300 boards every gated district on a shipped map has its own way out, so only the one-cache wording is ever dealt. Port 5291 was another worker's dev server - check `ss -ltnp` for your own PID before driving a URL.

### 84. The Floodplain's field guide sent every raid looking for Maya, even where no road reaches her
- What a player met: on a Floodplain raid with no contract, the field guide (O) always opened on "Floodplain Relay: the shore road narrows to one tile where Maya is watching it, and walking that means fighting her..." - the front door's toll. Dropped at THE QUARRY, THE LIGHT, Mill Weir, Beacon Keep, the Vault or the Cider Yard, every door between is shut, so she is on no road that raid can take and the first thing the guide said was about a fight that could not happen.
- How reproduced: `menuShots.mjs <url> <out> --window=640x480 --raid` (field-guide photo shows the line), then walking steps from each of the ten landings to her tile (22,26) with every gate shut: 32 from the front door, 20 from Market Isle, 67 and 129 from the Saltings and the Staithe, and unreachable from the other six.
- What changed: `laterRunHints` in `objectives/ObjectiveGuide.ts` names her road only when the scene's measured walk reaches her (`stepsTo`), read off her own trainer entry rather than a typed tile. Test: `ObjectiveGuide.test.ts` "names Maya's shore road only where the player can walk to her" (fails before).
- How to use it: drop in at THE QUARRY and press O - the guide starts on the nearest landmark, not on Maya.
- Also: `menuShots.mjs` appends its own `?testmode=pixels`, so give it a bare URL (a URL with a query timed out waiting for the starter screen). Photographed every menu at 640x480 and found them clean apart from the known FEEDBACK-tab overlap.

### 85. The opening briefing hid a player who landed by the map's edge
- What a player met: dropping in at THE STRAND (Pallet Town, three tiles from the bottom edge), the raid opened on its contract briefing with the box over the bottom of the screen - and the camera, stopped at the map's edge, had the player standing exactly there. The first thing a raid shows, while it says where the job is, was the jetty with nobody on it.
- How reproduced: `raid.mjs <url>?testmode=1 --stepped --window=640x480 --insertion=pallet-strand --completed=recover-lost-field-kit,survey-the-braid,cordon-ledger,wardens-resupply --level=16 --shot=... --shot-dialogs` (the `-world.png` picture). `showFirstDeploymentBriefing` showed its lines without `seatDialog`, which every unasked line the world raises already uses to keep the box off whoever it is about.
- What changed: the briefing is seated clear of the player (`WorldScene.showFirstDeploymentBriefing`), measured off the camera's scroll because `startFollow` sets it at once while its `worldView` is only updated on the first draw; `seatDialog` takes the view as an optional argument. Test: `openingBriefing.test.ts` "stands clear of a player the camera cannot centre..." (fails before); the scene harnesses' fake dialogue boxes gained `setY`. Re-photographed: the box is at the top and the player, partner and jetty show under it.
- How to use it: drop in at THE STRAND with a contract - the briefing goes to the top and you can see where you stand.
- Checked and left: the item lines' apostrophes are mixed (Brock’s curly, Bill's straight) across the game's strings, but both draw; every `dl` pane is now named in `SCROLL_ROWS`.

### 86. The drop-in's facts read "5 held Raids" and "none yet Known"
- What a player met: choosing a drop-in in a wide window (1366x657, a laptop's browser), the WHAT IS IN THERE strip laid its five facts across the pane with each value pushed to the far end of its column - "Wild ........ Lv 3-7 Fights ........ 7 · Lv 13 Doors ........ 5 held Raids ........ none yet Known 0/24 · 0%". Every value stood a gap from the next fact's label and a whole column from its own, so the strip read in the wrong pairs.
- How reproduced: `menuShots.mjs <url> <out> --window=1366x657` (`dropin-1366x657.png`); the rule is `.dropin-facts > div` in `src/style.css` (`justify-content: space-between`, values `text-align: right`).
- What changed: each fact is a two-track grid - a label column of one width, then the value with the rest of the track (wrapping inside it rather than running into the next fact, which only a map's name could) - so a value sits just after its own label and the values still stand in one column when the facts are stacked at 640x480. Test: `style.test.ts` "sets each value beside its own label, never at the far end of its track" (fails before). Re-photographed at 1366x657, 1024x640 and 640x480.
- How to use it: open the drop-in step in any window - each fact reads "Doors 5 held", "Raids none yet".
- Checked and left: the DAY-CARE plays end to end at 640x480 (`dayCare.mjs`), and his band is its heading strip alone at the smallest stage, as Bill's is (deliberate); its two take-back buttons (the dossier's deed and the bar) are the dossier's usual pattern. At 1024x640 the Pokemon Center's list shows one Pokemon of 24 above a MORE strip: the box strip wraps to two lines and the dossier holds its floor - worth a look as a layout question, not a fold fault. A first `fishing.mjs` run on a cold dev server failed every cast (the walk to the bank never finished); two reruns passed, so it is the driver's first-compile timing. A Viridian City raid from SOUTH ROAD played clean (the briefing sat at the top, clear of the player at the map's foot).
