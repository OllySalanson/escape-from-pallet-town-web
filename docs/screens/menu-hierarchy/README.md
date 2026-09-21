# Typographic hierarchy on the pixel-ui screens

The captain, on the new menus: *"I like the improvement to the menu screens.
However the titles such as like Stash and Drop in, they're the same text as the
writing inside the boxes, so it's easy to miss and be overwhelmed by the
information as a result."*

He is right and the diagnosis is narrow. A section heading was plain `--ink`
caps at the one type size over a `--cream-dim` hairline, which on `--cream` is
all but invisible - so `POKÉMON` and `BULBASAUR` under it carried exactly the
same weight, and a screen of true things read as a wall. Orange Kid has no bold
cut (`.pixel-ui strong { font-weight: 400 }`) and the system has one type size,
so neither weight nor size is a lever. What is left is inversion, ink, a rule
that can be seen, and space that groups - all of which the games this is dressed
as use.

## Three ranks, one language

| rank | device | what it answers |
|---|---|---|
| screen | `.px-title` - dark strip, cream caps, 16 pixels deep, the full width of the screen | where am I |
| section | `.px-heading` - the same strip in miniature: 14 pixels deep, bled out to its own window's frame | what is this panel |
| in-list section | `.px-subheading` - a `--cream-dim` band across the list, full ink caps, ruled off in `--frame`, three times the room above it as below | what is this part of the list |
| name | `.px-name`, a card's `<strong>`, a commit bar's title - plain caps in `--ink` | what are my choices |
| detail | `--ink-soft` sentences, `small` | what it costs, what it is |

A note inside a lid takes the title bar's own `--bar-muted`, so a count reads as
a note on both. Nothing new was introduced: every rank is the title bar or the
window, reused.

## Read the pairs

`<view>-before-1200x768.png` / `<view>-after-1200x768.png` is 3x under
`?testmode=pixels`. `base`, `workshop-pay` and `result` also have a
`640x480` pair: that is the smallest stage the game presents (320x240 logical at
`MIN_STAGE_ZOOM`), where `workshop-pay` shows the other fault this pass found -
the title bar's `nowrap` aside was sizing the whole screen, so the lobby pushed
itself 19 pixels past the canvas and clipped its own count off the right edge.
`.px-screen` now has a `minmax(0, 1fr)` column and nothing inside a screen can
resize the screen.

Both sets are taken by the same driver, `tools/playtest/` with a seeded save;
the shipped tools were not changed for it.

## What was cut rather than ranked

"Overwhelmed by the information" is not only a hierarchy fault, so where a panel
said the same thing twice it now says it once: the stash's next-raid clock (the
Pokémon lid *and* the Pokemon Center's line), the secure slot's slot counts (both
lids *and* the bar), "packed" and "protected" in the loadout and final-check
bars, "Pallet Town" on all five sub-screens that are reached from the one that
names it, and the field guide's eyebrow over a title that repeated it.

## Not in this pass

The in-raid bag, party and field guide are still the older rounded language
(`10-bag`, `11-party`, `12-guide` in a full tour). The fault the captain named
does not exist on them - they already lead with a teal eyebrow over a large
bold title - so making them pixel-ui is a restyle, not a hierarchy fix, and it
belongs in its own change.
