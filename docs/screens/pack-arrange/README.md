# The pack you laid out yourself

The captain's first raid with the grid, in his own words (2026-09-20):

> I'm currently using 11 out of 18 squares [...] now I have just found something
> a coil of rope which is 4 squares so even though I've got 7 squares free it
> won't fit in. I feel like I should be able to tilt the super potion sideways
> and the potion and put them on the bottom row to make a space of 4.

He was right on both counts. A caught Pidgey (2x2), a cable coil (2x2), a Super
Potion (1x2 standing up) and a Potion filled the top two rows and left the
bottom one, so there was no pair of adjacent free rows anywhere and a four-square
find was refused with seven squares free. Three 2x2 blocks in a six-wide pack
fill two whole rows between them, so nothing but laying the Super Potion on its
side can seat all four - which is why rotation is part of the model rather than
a convenience, and why `src/game/items/gridArrange.test.ts` walks that exact
pack as a regression test.

What the screens do now:

| | |
|---|---|
| `loadout-packed.png` | The pack as it packs itself. Every block is a control the cursor can land on. |
| `carrying.png` | ENTER picks the Super Potion up. What is being carried is drawn where it would land. |
| `carried-and-turned.png` | R turns it, the arrow keys carry it: the shape is answered before it is committed. |
| `arranged.png` | Put down lying across the bottom row - and drawn lying down. |
| `dragging.png` | The same gesture with a pointer. |
| `secure.png` | The container a wipe cannot touch is a container too, and behaves the same. |
| `in-raid-bag.png` | The raid opens the pack laid out exactly as it was packed. |
| `tidied.png` | TIDY packs it again from scratch - a deed the player asks for, never one done to them. |
| `arranged-in-raid.png` | Arranged in the field, where finds are actually seated. |

`node tools/playtest/packArrange.mjs <url> docs/screens/pack-arrange` takes every
one of them and checks each claim above; `node tools/playtest/raid.mjs <url>
--arrange` plays the other half, a whole raid arranged mid-way and banked.
