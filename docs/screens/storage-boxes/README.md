# Storage boxes

The stash was one flat list. It is now boxes of thirty (`Stash`, `BOX_CAPACITY`),
named, that the player moves Pokemon between - but boxes only decide where a
Pokemon is *kept*. `Stash.listPokemon()` is still every Pokemon, so the
Outfitter's payment, the swap-partner offer, the loadout, the secure slot and a
wipe all still see everything, and a Pokemon about to be spent is never hidden by
its box. A vault that is full grows a box, so banking a raid cannot fail.

Finding beats capacity, so the strip that leads every list of Pokemon at base
(the stash, the loadout, the Outfitter's payment) has a sort - as kept, species,
level, fit first - and a find that matches the start of a name across every box.
Nothing about how the player is looking is saved; the boxes are (`SavedStash.boxes`,
optional, so versions 1 to 6 load with everything in box one and no version bump).

Shot at 3x (1200x768) and at the smallest stage (640x480, which is 2x of 320x240),
from a pre-boxes save with 34 Pokemon written by hand into a real game's save.

| | 3x | smallest |
|---|---|---|
| a full box, the strip on top | `stash-box-1200x768.png` | `stash-box-640x480.png` |
| picking a Pokemon up: where to? | `stash-move-1200x768.png` | `stash-move-640x480.png` |
| finding `pika` across every box | `stash-find-1200x768.png` | `stash-find-640x480.png` |
| the loadout draws from every box | | `loadout-640x480.png` |
| paying the Outfitter, every box at once | `outfitter-pay-1200x768.png` | |
