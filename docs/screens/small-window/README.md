# The small-window pass

Every menu, opened in an 800x600 window. That window is the smallest the game is laid
out for: a screen's body is about 400x210 game pixels in it.

Four screens were broken there, and are whole now:

| 800x600 | Before | After |
|---|---|---|
| YOUR THINGS: ROOM FOR A FIND stood out of the locker's card, over the bar under it, and the chest showed three and a half of its eight squares across | ![](your-things-before.png) | ![](your-things-after.png) |
| BILL'S COTTAGE: the shelf for parts was pushed off the screen, and Bill's standing cut through | ![](bills-cottage-before.png) | ![](bills-cottage-after.png) |
| BROCK'S WORKSHOP: the builds wrapped to two rows and left his room a sliver | ![](brocks-workshop-before.png) | ![](brocks-workshop-after.png) |
| HELP: four cards cut through their rows, the last keys of each out of reach | ![](help-before.png) | ![](help-after.png) |

THE CHEST and the Raid Arena's rack and locker are YOUR THINGS' own screen, and were
fixed with it.

## What a small window gets

- **YOUR THINGS**: the locker stands beside the team, over the pack, so the chest has
  the width for all eight of its squares across. It does not scroll sideways, so
  whatever was kept past the third could not be seen at all; `yourThings.mjs` failed on
  it at this size, on main too, and passes now. It shows fewer rows, and scrolls down.
  The locker's heading says KEPT, as the chest's says SAFE and the pack's LOST ON A
  WIPE; its count is under its squares, and ROOM FOR A FIND stands beside them.
- **Bill's Cottage**: each shelf has half the height and scrolls under its own MORE; a
  card draws its thing at the icon's own size, so a card for money is whole; Bill's
  standing is his name, his rank and his bar, without the picture of his room.
- **Brock's Workshop**: the builds stand in one row, each its name and what it is built
  with, without its picture (it is chalked in the room above); the card beside the room
  gives up its tally of how many are built.
- **HELP**: one pane, read on with the arrows, with a MORE strip.

## Found on the way

A pane of words that is read with the arrows could be read down and never back up, in
any window: HELP here, and the raid's full report. The pane holds the keyboard's focus
while it is read, and was taken for a row standing under its own MORE strip, so every
scroll pushed it on again (`standsOnARowOf` in `ui/MenuOverlay.ts`).

## How it is checked

`node tools/playtest/menusAudit.mjs <test-mode build url> <dir> --window=800x600 --fit`
opens all thirty menus and names anything not inside its screen: a card, a row or a line
of words drawn past the body's edge, or cut through from above or below by a card that
is not a list. On the commit before this change it named twelve things; on this one,
five.

It does not see everything. It named neither Brock's Workshop, whose cards were all
inside the screen and merely squeezed to slivers, nor the Day-Care, below; both were
found by looking.

## The second pass: the Day-Care, the Trader, THE CHEST's Pokémon

The same day. A save with fifteen Pokémon, six of them on the team, each with four
moves with long names, and seven kinds of thing to give: the first pass looked at a
new save's two Pokémon, and a screen that is whole for two is not whole for fifteen.

| 800x600 | Before | After |
|---|---|---|
| THE DAY-CARE: the tiles under WHO STAYS? stood out of their pane, over the help line | ![](day-care-before.png) | ![](day-care-after.png) |
| THE TRADER: the same, and KANGASKHAN lost its N | ![](trader-before.png) | ![](trader-after.png) |
| THE CHEST's POKéMON: the card too narrow for its own numbers, its keys under the screen's foot, the garden's six places squeezed to slivers | ![](chest-pokemon-before.png) | ![](chest-pokemon-after.png) |

What a small window gets:

- **The Day-Care and the Trader**: the list has the height it asks for and the stage
  the rest. The paddock is drawn twenty higher, so the Day-Care Man's feet are on it.
  Who the Trader shows stands at the art's own size, not twice it, and NEW IN THE
  POKéDEX stands on top of its plate rather than making it too wide to stand beside
  the other.
- **THE CHEST's Pokémon**: the grid is three across, the garden goes under it, and the
  card has the height of the next raid and the grid together. The card keeps what
  choosing needs: HP and its bar, the five numbers two abreast, what it holds, its
  moves. Its picture is the square the cursor is on. Its keys are on the keys line and
  where it is on the line above. The way to the next level is not shown. What there is
  to give is one row, and the rest is scrolled to.

And in any window:

- **A list of Pokémon tiles is as tall as its bar and one row.** The bar is SORT and
  FIND. At the old height a list of one row scrolled, for nothing, and rested with a
  sliver of its bar showing; in a longer one the MORE strip took the foot of the row
  under the cursor, which was pushed up out of the top of the pane to clear it,
  cutting the partner's rosette. Before and after at 1280x800:
  ![](list-before-1280.png) ![](list-after-1280.png)
- **A tile is wide enough for KANGASKHAN.** It was called wide enough for ten letters
  and was not, for the widest ten.
- **THE CHEST's empty places come in twelves**, so the last row is whole at four
  across and at three.

After it the check names two things at 800x600, both YOUR TEAM's, and none at
1280x800. It was run on a new save, as before: the fifteen were looked at.

## Still broken

Not fixed in this change, and next:

| | |
|---|---|
| YOUR TEAM, and the bench in the Raid Arena, at 800x600: the stat card is cut through its moves, the platform stands over its labels, and the chest's list has no row | ![](still-your-team.png) |
| YOUR TEAM with six, in any window: the six stand over one another, the first one's plate is cut by the edge of the stage, the last stands under the card, and the card of anyone but the leader is wider than its frame | ![](still-your-team-six.png) |
