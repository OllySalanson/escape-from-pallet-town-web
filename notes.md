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
