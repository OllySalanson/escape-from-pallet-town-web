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
