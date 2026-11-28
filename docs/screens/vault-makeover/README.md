# THE CHEST (vault makeover, part 1)

The captain, 26 Nov 2026: "your vault should be your storage chest in your
house, in your Bolthole". He saw a mock-up of the whole makeover, liked the
chest, and asked for it three tiles down and one east of where the mock-up
stood it, and movable like any other furniture.

| Before | After |
|---|---|
| ![](before-front-room.png) The front room had nowhere you kept anything. | ![](after-01-walked-up.png) THE CHEST stands by the stairs, named on the hint line. |
| ![](before-your-things.png) YOUR THINGS called storage HOME. | ![](after-02-lid-open.png) SPACE throws the lid back... |
| ![](before-bills-pc.png) Your things were found at BILL'S PC, at the Center. | ![](after-03-the-chest.png) ...and the same grid opens, headed THE CHEST, its storage headed CHEST. |

- ![](after-05-b-your-things.png) B anywhere still opens it, as YOUR THINGS.
- ![](after-06-carrying-the-chest.png) Decorating (H) picks it up like any piece...
- ![](after-08-moved.png) ...and puts it down where you like.
- ![](after-07-chest-stays-out.png) X never puts it in the box: THE CHEST STAYS OUT.

The next parts, from the same mock-up: a POKéMON tab in the chest with every
Pokémon in one grid, no boxes (![](plan-pokemon-tab.png)), things dragged onto a
Pokémon with one question (![](plan-give-a-berry.png)), and BILL'S PC sending
the player home.

Made with `node tools/playtest/chest.mjs <test-mode build url>/?testmode=pixels <dir> --window=1280x800`
against a `VITE_EPTW_TEST_MODE=1` build (`tools/playtest/README.md`, "Memory").
The before pictures are the same build of `main` at 8ba3ce0e.

# THE CHEST's POKéMON tab (part 2)

The captain: "It should just be a grid system, and then when you click on a
Pokemon, then you can see its stats and stuff. And put it in the garden."

| Before | After |
|---|---|
| ![](before-bills-pc.png) Boxes, PREV, NEXT, SORT, FIND, RENAME, NEW BOX, and a garden chip. | ![](pokemon-tab-02-pokemon-tab.png) Every Pokémon in one grid, big, in the order kept; THE NEXT RAID and the GARDEN beside it. |

- ![](pokemon-tab-01-things-tab.png) THE CHEST has two tabs now: THINGS, and P for POKéMON.
- ![](pokemon-tab-03-pikachu-leads.png) ENTER takes Pikachu on the next raid and L puts it in front; its berry shows in its corner and on its card.
- ![](pokemon-tab-04-dragged.png) Machop dragged onto NEXT RAID, Rattata dragged out of the GARDEN back into the grid.
- ![](pokemon-tab-05-clicked-geodude.png) A click was a look: Geodude's card, and nothing changed. Part 5 replaced it: a mouse now looks by hovering, and a click is nothing.

Made with `node tools/playtest/chestPokemon.mjs <test-mode build url>/?testmode=pixels <dir> --window=1280x800`.

# Giving things to a Pokémon (part 3)

The captain: "they shouldn't be these horrible stacked buttons like the
berries, for example, you should be able to drag them and drop them onto the
Pokémon, and then it'll pop up being like, give Oran Berry".

| Before | After |
|---|---|
| ![](before-bills-pc.png) A stack of "Give ORAN BERRY ×3" buttons under each Pokémon. | ![](give-09-ask-berry.png) Click the berry, click Machop: one question. (Part 5: with a mouse it is dragged instead.) |

- ![](give-real-berry-over.png) At real speed: the berry carried over Pikachu, which lights green.
- ![](give-06-stone-over-charmander.png) A Thunder Stone over Charmander: red and shaking, and nothing is asked.
- ![](give-07-ask-stone.png) Dropped on Eevee instead: USE THE THUNDER STONE ON EEVEE? ...
- ![](give-08-evolved.png) ... and YES evolves it.
- ![](give-10-machop-holds.png) Machop holding its Sitrus Berry: on its tile, in its card, and T to take it back.
- ![](give-11-taken-back.png) Both berries back in TO GIVE: T on Pikachu, and Machop's dragged off its card.
- ![](give-02-pokemon-tab.png) The tab now: NEXT RAID and GARDEN across the top, three whole rows of Pokémon, the card and TO GIVE beside them, and how many are kept in the title bar.

Made with `node tools/playtest/chestPokemon.mjs <test-mode build url>/?testmode=pixels <dir> --window=1280x800`;
the real-speed picture against a plain build with a real mouse.

# No boxes, and BILL'S PC sends you home (part 4)

The captain's picks: boxes go, one grid in the order kept; the Center's PC
says it is all at home.

| Before | After |
|---|---|
| ![](before-bills-pc.png) BILL'S PC: boxes, PREV, NEXT, RENAME, NEW BOX. | ![](no-boxes-bills-pc-says.png) BILL'S PC opens nothing: BILL says everything went home to THE CHEST. |

- ![](no-boxes-old-save-in-order.png) A save written in two boxes, its Pokémon stored in another order: THE CHEST stands them as the boxes kept them, Box 1 then Box 2, and writes no box again.
- ![](no-boxes-swap-offered.png) The partner swap BILL'S PC used to offer is on the only Pokémon's card: C, Change partner...
- ![](no-boxes-swap-screen.png) ... and it opens the swap screen it always did.

Made with `tools/playtest/chest.mjs` and `tools/playtest/chestPokemon.mjs` (which seeds the old two-box save) at 1280x800.

# Hover to look, drag to move (part 5)

The captain, 28 Nov 2026, in place of his 26 Nov "click on a Pokemon to see
its stats": with a mouse, THE CHEST is hover to inspect and drag to move, on
both tabs, from B and from the chest in THE BOLTHOLE alike.

The rule, for the mouse only:

1. **Hovering is the look.** Resting on a Pokémon or a thing puts its card and
   description in the card box; moving off puts back the card of the thing the
   cursor is on.
2. **Press, drag, release is the only move**: a Pokémon onto THE NEXT RAID, the
   GARDEN or back into the grid; a thing into or out of the pack, onto the
   locker or round the chest; a berry, stone, disc or held item onto a
   Pokémon. Letting go finishes the drag wherever it is let go: where nothing
   fits, or off every container, the thing goes back where it was. Nothing
   stays carried or chosen, and the cursor stays where it was.
3. **A click does nothing on its own.** No click-to-choose, no click-then-click
   giving, no click to show a card, no right-click to take one out, and the
   card's keys that act on a thing or a Pokémon (ENTER, G, L, T, U, R, BKSP)
   are only the keys they name. The tabs, the doors to other screens, the X
   and the give question's YES and NO still click.

The keyboard is exactly as it was (the arrows, ENTER, SPACE, L, T and the rest),
and so is touch. Giving still asks its one question.

| | |
|---|---|
| ![](mouse-01-things-hovered.png) The mouse rests on the disc: its card, while the cursor stays on the Poké Balls. | ![](mouse-02-things-dragged.png) A Poké Ball dragged into the pack, and nothing left carried. |
| ![](mouse-03-hovered-geodude.png) The mouse rests on Geodude: its card, while the cursor stays on Charmander. | ![](mouse-04-berry-dragged-asks.png) The Sitrus Berry dragged onto Machop: the one question. |

Made with `node tools/playtest/chestPokemon.mjs <test-mode build url>/?testmode=pixels <dir> --window=1280x800`,
which plays every rule above with a real mouse (CDP mouse events) and fails on a
click that changes anything.
