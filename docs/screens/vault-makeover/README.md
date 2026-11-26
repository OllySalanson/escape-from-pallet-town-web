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
