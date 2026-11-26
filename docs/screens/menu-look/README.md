# The menu look: "a Poke Ball, opened"

The captain picked one look for every menu on 25 Nov 2026, from the round-3 mock-ups:
"It must be the new way of doing it. And yeah, build all of this all in this style. Do not
keep any of the old menu style." This folder is the before and after of building it.

## The rules

- **Five colours, one job each.** Ink and white are everything else. **Red** can be lost
  (the raid pack, a wipe, the cursor's arrow); its one named exception is the title strip's
  seam. **Gold** is the chosen thing and prices. **Green** is safe, ready, go (the main
  button, the locker, healing). No navy, blue or cream in a menu's own colours.
- **Every menu**: an ink title strip with the Poke Ball's red seam under it and a drawn
  Poke Ball before the name, the one number that matters in a white pill, and a small X
  (Esc or Backspace does the same).
- **Cards**: white, one line of ink with clear corners, a hard pixel shadow. A heading
  strip's colour says what kind of card it is, never a tint over the paper.
- **Chosen**: gold. The row under the cursor is gold's wash; a focused card, tile or prize
  is ringed in gold. The arrow stays red.
- **Types**: an ink chip with a small square of FireRed's own colour.
- **Behind a menu**: the place it was opened in, dimmed, never a pattern.
- **Under the game**: the controls bar - the screen's keys either side of the team, SETTINGS
  and HELP.

## Every screen, ticked off

`before/` is `main` at 7eae8a46 (the navy, blue-rim and cream style; THE MAP's is from #952's before). `after/` is the game
with every PR below merged, photographed the same way (`tools/playtest/menusAudit.mjs`,
1280x800, the controls bar under the game).

| Screen | Rebuilt by | Before | After |
|---|---|---|---|
| Title | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895), [#952](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/952) | ![](before/title.png) | ![](after/title.png) |
| The harbour, its dialogue and the controls bar | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895), [#902](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/902), [#945](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/945), [#956](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/956) | ![](before/harbour-yard.png) | ![](after/harbour-yard.png) |
| Oak's Lab | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895), [#902](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/902) | ![](before/oaks-lab-room.png) | ![](after/oaks-lab-room.png) |
| Oak's wall map | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895), [#937](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/937) | ![](before/oaks-wall-map.png) | ![](after/oaks-wall-map.png) |
| THE MAP (M) | [#952](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/952), [#956](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/956) | ![](before/the-map.png) | ![](after/the-map.png) |
| YOUR THINGS (B) | [#907](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/907) | ![](before/your-things.png) | ![](after/your-things.png) |
| YOUR TEAM (P) | [#919](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/919) | ![](before/your-team.png) | ![](after/your-team.png) |
| The bench in THE RAID ARENA (now YOUR TEAM) | [#919](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/919) | ![](before/hall-bench.png) | ![](after/hall-bench.png) |
| The armoury rack | [#907](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/907) | ![](before/hall-rack.png) | ![](after/hall-rack.png) |
| The locker | [#907](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/907) | ![](before/hall-locker.png) | ![](after/hall-locker.png) |
| Bill's PC at the Pokémon Center | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895), [#954](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/954) | ![](before/pokemon-centre-stash.png) | ![](after/pokemon-centre-stash.png) |
| Bill's Cottage | [#912](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/912) | ![](before/bills-cottage-shop.png) | ![](after/bills-cottage-shop.png) |
| Brock's Workshop | [#912](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/912) | ![](before/brocks-workshop.png) | ![](after/brocks-workshop.png) |
| THE DAY-CARE | [#927](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/927) | ![](before/day-care.png) | ![](after/day-care.png) |
| THE TRADER | [#927](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/927) | ![](before/trades.png) | ![](after/trades.png) |
| THE HARBOUR BOUTIQUE | [#932](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/932) | ![](before/boutique-shop.png) | ![](after/boutique-shop.png) |
| Your wardrobe | [#932](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/932) | ![](before/boutique-wardrobe.png) | ![](after/boutique-wardrobe.png) |
| THE POKéDEX (X) | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895) | ![](before/pokedex.png) | ![](after/pokedex.png) |
| Favours (O) | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895) | ![](before/favours.png) | ![](after/favours.png) |
| Quick phrases (T) | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895) | ![](before/phrases.png) | ![](after/phrases.png) |
| FEEDBACK (F) | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895) | ![](before/feedback.png) | ![](after/feedback.png) |
| The console's games | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895) | ![](before/console-games.png) | ![](after/console-games.png) |
| THE BATTLE ARENA counter | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895) | ![](before/dojo-counter.png) | ![](after/dojo-counter.png) |
| THE GAME CORNER | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895) | ![](before/game-corner.png) | ![](after/game-corner.png) |
| THE GAME CORNER's prize window | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895), [#957](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/957) | ![](before/game-corner-prizes.png) | ![](after/game-corner-prizes.png) |
| Raid with a friend | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895) | ![](before/friend-room.png) | ![](after/friend-room.png) |
| THE GREAT LIBRARY's book (kept: drawn as a real book) | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895) | ![](before/library-book.png) | ![](after/library-book.png) |

## Screens not in the harbour photo set

| Screen | Rebuilt by | Pictures |
|---|---|---|
| Controls bar, SETTINGS and HELP (new) | [#902](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/902), [#943](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/943), [#945](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/945), [#956](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/956) | `../controls-bar/`, `../settings-tooltips/` |
| The fight: plates, panel, inks | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895), [#939](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/939) | `battle/` |
| The bag in a fight (ITEM and BALL) | [#949](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/949) | `battle-bag/` |
| Dialogue boxes, questions, the phrase list (canvas pop-ups) | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895) | `after/harbour-yard.png`, `after/phrases.png` |
| The jump-in card (the rim) | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895), [#957](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/957) | (the foundation's parts; its rings gold) |
| The raid's pack, party and field guide; the raid result; the starter picker; naming, teaching and the move chooser; the map maker; play stats | [#895](https://github.com/OllySalanson/escape-from-pallet-town-web/pull/895) | re-skinned by the shared parts: one palette, title strip, cards and buttons |

## Left for a decision

- **The touch pad** (phones and tablets) has no SETTINGS, so the map-tooltips switch cannot be reached there.
- **Labels drawn on the map itself** - THE HARBOUR's place sign, a player's name plate, the quick-phrase key strip - are still the cream world labels. They are the map's, not a menu's, so they were left; they could take the paper-and-ink look too.
- **Raid with a friend** opens with the cursor on its X, because it has nothing else to choose until a name is set.
