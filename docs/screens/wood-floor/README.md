# The wood floor: white is a plate, never the floor

The captain, 26 Nov 2026, of the round-3 menus: "Some of them look great, but the ones
that just have that bright white background, they're not quite there yet, are they? And
I can't put my finger on why." A study of every menu that night found why, and he took
its picks: "Go with all of your decisions on the menu aesthetic." Two mock-ups came out of
it, one on dark trays and one on brown wood, and the next night he chose: "I actually
prefer the kind of brown ... the woody colour, over the black. The army aesthetic of
Tarkov shouldn't be used - it should all be Pokémon. It's just the mechanics of Tarkov
(extraction) that we want."

## What the study found

The menus that feel right are places with things in them: THE DAY-CARE's paddock, THE
TRADER's two Pokémon on grass, the prize window's wooden shelf. The white ones are
paperwork about things. It can be measured: the mean saturation of every pixel inside the
game's stage (`tools/playtest/colourScore.mjs`, 0 is grey or white, 100 pure colour).

| | colour |
|---|---|
| The world: the vale on a raid, the harbour by day | 35, 27 |
| Menus that feel right: prize window, a fight, the Trader, Day-Care, the raid's pack, YOUR TEAM, favours, Brock's | 55, 32, 31, 30, 26, 25, 21, 16 |
| Menus not there: YOUR THINGS, Bill's Cottage, the Chest's Pokémon, the boutique, the wardrobe, help, Bill's PC, the jump list, the full report, the Pokédex | 13, 11, 11, 10, 8, 8, 5, 4, 3, 1 |

Every screen that felt right scored 16 or more and every white one 13 or less, with no
overlap. The world has no white ground at all, so a sheet of white paper was the
brightest, greyest thing in the game, and at night nearly three times as bright as the
harbour behind it.

Five causes, in the order they are being fixed:

1. **White is the floor.** In the good menus white is a small plate of words on something
   colourful; in the weak ones it is the whole screen.
2. **Everything is flat.** A card was one fill and one thin line, with a shadow too faint
   to see.
3. **Two sizes of pixel.** The world is drawn at 3x and the menus at 2x in a 1280x800
   window.
4. **The place disappears.** A good menu shows where you are; a white one could be anywhere.
5. **Menus snap in.** One frame is the harbour, the next is the whole menu.

## The rules this folder is the record of

- **The floor of a screen is warm brown wood, or it is a place.** A card is boards, an
  empty square is sunk into them, and a thing or a button stands on a raised plate of
  lighter wood.
- **White is a plate**: the pill on a strip, a count, the description of the thing in
  hand, a question (a small window of paper, as FireRed's is), and the row under the
  cursor, which is a light bar with ink on it.
- **Wood is a middle tone**, so a board carries pictures and white labels, a raised plate
  dark ones, and a sentence goes on paper.
- **Three rules of light**: a card has a lit lip and a dark foot; an empty square is dark
  at its top left and lit at its bottom right, and a filled one the other way up; a
  shadow is drawn at full strength.
- **A screen that is a thing is drawn as that thing**: THE POKéDEX is a red machine with a
  screen of green glass, lit in three steps - never met, met, owned.
- The five colours keep their jobs: red can be lost, gold is the chosen thing, green is
  safe. No navy, blue or cream, and nothing that looks military: it is a FireRed world.

How it is built is in `docs/agents/ui-and-screens.md` ("White is a plate, never the floor").

## How a screen arrives and leaves

Cause 5: one frame was the harbour and the next was the whole menu. A screen now takes
about a fifth of a second to arrive and a tenth to leave, in steps, as the game's own
moves are (`src/game/ui/menuMotion.ts`).

| | |
|---|---|
| Before: a cut | ![](motion/before-cut.png) |
| After: the place dims, the title drops in, the cards step up, the help rises | ![](motion/after-open.png) |
| After: leaving, it sinks and clears over the place | ![](motion/after-close.png) |

The pictures are animated, played about three times slower than the game so the steps
can be seen, at half size. A tab or a question over a screen only steps its cards up, and
with reduced motion asked for nothing moves.

## The world's pixel

Cause 3: the world is drawn at 3x in a 1280x800 window and the menus at 2x (4x and 2x
at 1920x1080), so a menu's lines and letters were two thirds the size of the world's, or
half. A screen, or one window of a screen, can now be drawn in the world's own pixel
(`px-world`). It then holds as little as a FireRed screen does, so it is for a screen with
few things on it; a list keeps the finer pixel, which is what buys its rows.

| | Before | After |
|---|---|---|
| SETTINGS | ![](world-pixel/settings-before.png) | ![](world-pixel/settings-after.png) |
| A question | ![](world-pixel/question-before.png) | ![](world-pixel/question-after.png) |
| One Pokémon's page: its picture the size a Pokémon stands in a fight | ![](world-pixel/page-before.png) | ![](world-pixel/page-after.png) |

Still in the finer pixel, because they are lists or grids and would lose their rows: YOUR
THINGS and THE CHEST, the Pokédex's list, the shops, HELP, and the panels that stand
beside the map on a raid, where a wider column would cover the map.

## After a raid

The screen a raid that got out opens on was the last cause of the study by another
name: a card about the raid, in a black room, with a white bar under it. It is a scene now,
as the study's animated mock drew it (the captain, 26 Nov 2026: "I do like that
animation ... We still need to improve on the overall screen"):

- **the place is still there.** The world's last frame is handed to the result and stands
  behind it, dimmed, so nothing cuts to black and a night raid's result is as dark as its
  night;
- **the team that walked out stands on it**, each as big as it stands in a fight, its
  bar filling with what it earned and its new level called over its head; a catch comes
  on last, marked NEW!;
- **the finds fly out of the raid pack into the chest at home**, one by one, and fill
  the squares under it; then the lid shuts;
- no white bar: the two buttons stand on the stage, and the help strip is one line.

It is drawn in the world's pixel, on the wood floor's colours.

| A raid | Before | After | Colour (world 27-35) | White |
|---|---|---|---|---|
| A haul, out with 0:22 left | ![](after-raid/haul-before.png) | ![](after-raid/haul-after.png) | 15 to 34 | 11% to 4% |
| A catch | ![](after-raid/catch-before.png) | ![](after-raid/catch-after.png) | 15 to 33 | 11% to 4% |
| A job done, six finds | ![](after-raid/job-before.png) | ![](after-raid/job-after.png) | 16 to 36 | 12% to 4% |
| Nothing found | ![](after-raid/empty-before.png) | ![](after-raid/empty-after.png) | 14 to 32 | 11% to 4% |

| | |
|---|---|
| The haul playing, at the game's own speed | ![](after-raid/haul-playing.png) |
| A team of six closes up to stand in the room there is | ![](after-raid/six-after.png) |
| A raid the browser could not save: nothing went into the chest, so none is drawn | ![](after-raid/unsaved-after.png) |

Made with `node tools/playtest/resultMoment.mjs <test-mode build dir> <dir> --clip`, which
deploys into the vale, ends the raid there on a report of its own through the world's
own hand-over, and fails a part drawn off the stage, a stage with no place behind it, a
find that did not reach the chest or a lid left open. It passes at 1280x800, 1920x1080,
800x600 and 800x512. With no picture of the place (a stopped render loop never hands one
over) the stage is a floor of dark wood; with reduced motion it is drawn as it ends.

The full report behind L, a lost raid's account and a raid another window settled are
lists, so they keep the finer pixel, and they stand on the wood floor: what happened is
on a plate of paper, a tile washed by what became of its thing is a plate lettered in
dark ink, and the last line names where the haul is and no key ("in YOUR THINGS", never
"(B at base)"). `node tools/playtest/resultShots.mjs <test-mode build url> <dir>` takes
them, at 1280x800, 1920x1080, 1600x1024, 800x600 and 800x512.

| The account | Before | After | Colour | White |
|---|---|---|---|---|
| The full report (L) | ![](before/result-full-report.png) | ![](after/result-full-report.png) | 5 to 45 | 61% to 13% |
| A lost raid | ![](before/result-lost.png) | ![](after/result-lost.png) | 3 to 48 | 68% to 10% |
| A raid settled in another window | ![](before/result-settled.png) | ![](after/result-settled.png) | 2 to 50 | 84% to 9% |

## Every screen, as it is moved

`before/` and `after/` are the same save photographed the same way on the commit before
and the commit of each change: `node tools/playtest/menusAudit.mjs <test-mode build url>
<dir> --only=<names>` at 1280x800, and the score is `node tools/playtest/colourScore.mjs
<dir>`.

| Screen | Before | After | Colour | White |
|---|---|---|---|---|
| YOUR THINGS (B) | ![](before/your-things.png) | ![](after/your-things.png) | 11 to 49 | 37% to 11% |
| THE CHEST: its things | ![](before/chest.png) | ![](after/chest.png) | 11 to 49 | 37% to 11% |
| THE CHEST: its Pokémon | ![](before/chest-pokemon.png) | ![](after/chest-pokemon.png) | 8 to 57 | 37% to 1% |
| THE RAID ARENA's rack | ![](before/hall-rack.png) | ![](after/hall-rack.png) | 12 to 49 | 37% to 11% |
| THE RAID ARENA's locker | ![](before/hall-locker.png) | ![](after/hall-locker.png) | 12 to 49 | 38% to 12% |
| THE GAME CORNER: POKéMON JUMP | ![](before/game-corner-jump.png) | ![](after/game-corner-jump.png) | 3 to 59 | 86% to 0% |
| BERRY PICKING | ![](before/game-berry-picking.png) | ![](after/game-berry-picking.png) | 3 to 59 | 82% to 0% |
| THE FIELD-MOVE COURSE | ![](before/game-field-course.png) | ![](after/game-field-course.png) | 2 to 59 | 88% to 0% |
| THE PROMENADE DERBY | ![](before/game-promenade-derby.png) | ![](after/game-promenade-derby.png) | 3 to 54 | 76% to 0% |
| THE DIG | ![](before/game-the-dig.png) | ![](after/game-the-dig.png) | 2 to 58 | 87% to 0% |
| THE HARBOUR BOUTIQUE | ![](before/boutique-shop.png) | ![](after/boutique-shop.png) | 10 to 53 | 57% to 1% |
| THE HARBOUR BOUTIQUE: trying a look on | ![](before/boutique-trying-on.png) | ![](after/boutique-trying-on.png) | 14 to 56 | 58% to 1% |
| YOUR WARDROBE | ![](before/boutique-wardrobe.png) | ![](after/boutique-wardrobe.png) | 8 to 54 | 64% to 0% |
| THE POKéDEX (X): the list | ![](before/pokedex-list.png) | ![](after/pokedex-list.png) | 3 to 51 | 82% to 0% |
| THE POKéDEX: a page | ![](before/pokedex-page.png) | ![](after/pokedex-page.png) | 7 to 48 | 47% to 2% |
| THE POKéDEX: a page of one only met | ![](before/pokedex-page-met.png) | ![](after/pokedex-page-met.png) | 7 to 31 | 15% to 1% |

The Pokédex's pictures are `tools/playtest/pokedexShots.mjs`'s, which plays every key on it.

The games' screens were lists and nothing else, so the wood floor alone left each a big empty board with three lines on it. Whoever is chosen now stands over the list (`ui/pickerLineUp.ts`): as big as in a fight, with an empty square for each place still free, and a line of one beside the list rather than over it. Their pictures are `tools/playtest/gameCorner.mjs`, `berryCourse.mjs` and `outdoorGames.mjs`'s, which play each game through, at 1200x768 (scored inside `--box=20,50,1150,670`); POKéMON JUMP's is `menusAudit.mjs`'s at 1280x800. A small window has no line-up and is the list it was:

| 800x600 | Before | After |
|---|---|---|
| POKéMON JUMP | ![](before/game-corner-jump-800x600.png) | ![](after/game-corner-jump-800x600.png) |

The boutique's are `tools/playtest/boutique.mjs`'s, which tries a look on, buys it, walks out in it and changes back at the wardrobe. It also showed a fault older than the wood: in an 800x600 window the shelves' pager was drawn under the cards, because a small room gave that window two rows for three things.

| 800x600, trying a look on | Before | After |
|---|---|---|
| The pager (Q, LOOKS 1 OF 8, E) | ![](before/boutique-trying-on-800x600.png) | ![](after/boutique-trying-on-800x600.png) |

The states a still cannot show were played with `tools/playtest/yourThings.mjs`,
`chest.mjs` and `chestPokemon.mjs`, every check passing on the wood floor:

| | Before | After |
|---|---|---|
| Teaching a disc at home | ![](before/teach-at-home.png) | ![](after/teach-at-home.png) |
| A stone over a Pokémon it does nothing for | ![](before/stone-over-charmander.png) | ![](after/stone-over-charmander.png) |
| The question before a stone is used: a plate of paper | ![](before/ask-stone.png) | ![](after/ask-stone.png) |
