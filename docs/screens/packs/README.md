# Packs

The pack is **gear, not an upgrade**. The stash grows for good - that is the
Outfitter's ladder and the secure container, and they are untouched - but the
thing a raid's haul is carried in is an item you own, choose before every raid,
and lose with everything in it if you do not walk out.

Four sizes, six squares apart: Satchel 12, Raid pack 18 (what every save starts
with, and what the game was played with when the pack was a constant), Ranger
pack 24, Hauler frame 30. A Hauler frame brings a fortune home and is a fortune
to go down with; a Satchel risks almost nothing because it holds almost nothing.
That decision is made fresh every raid, which is the whole point of it.

Pack size is **derived and never stored**, like every Outfitter effect: the save
records which packs are in the vault, because they are items and the vault
already counts items, and how big one is lives in the catalogue beside its name
(`src/game/items/items.ts`, read back through `src/game/items/packs.ts`).

Nobody is ever stranded. The Satchel is a line of `MINIMUM_SUPPLIES`, and the kit
is read as a *capability*, so holding any pack at all answers it: a player with a
Hauler frame is never handed a Satchel, and a player who lost their last pack
always is.

Shot from real play at 3x (1200x768), `?testmode=pixels`, real clicks and real
key events; the loadout is shot at the smallest stage too (640x480, 2x of
320x240), because that is the one where the squares and the list have to share a
column.

| | what it shows |
|---|---|
| `loadout-1200x768.png` | the loadout opening on the biggest pack at base, with all four listed under the squares and what losing it costs in the bar |
| `loadout-satchel-1200x768.png` | the same screen wearing the Satchel: four squares by three, and the loadout is measured against them |
| `loadout-refused-1200x768.png` | 24 squares packed and the Satchel refusing out loud rather than putting something of the player's down |
| `loadout-640x480.png` | the smallest stage: the squares keep their full size and the pack list is behind the pane's own MORE strip |
| `final-check-1200x768.png` | the pack at the head of *Lost if you wipe*, because nothing in the container beside it can protect it |
| `raid-bag-1200x768.png` | the raid carrying the pack it was packed against |
| `result-1200x768.png` | a lost raid: the pack named as gone, with how many squares went with it |

## Where a pack comes from

Field loot on every map, rolled on its own like the machines and the stone
rather than drawn from the pool - a pack at pool odds would be a formality, and
the point of one is the raid you remember finding it on. The gentle maps hold the
workaday packs; the two vast maps hold the big ones, because the walk is the
price. Carrying one out costs four squares of the pack you are already wearing,
which on a Satchel is a third of it.

Nothing that repeats may hand one out - not a contract, not the Ferryman's shelf,
not an Outfitter rung. `SupplyItemId` excludes packs exactly as it excludes gear,
so the compiler refuses it, and `packs.test.ts` says so out loud as well.

## What a wipe takes

The pack being *worn* was never in the bag - it **is** the bag - so the supply
accounting cannot see it and the secure container cannot protect it: the
container is something the pack is carried past, not something the pack is
inside. A *spare* pack found in the field is ordinary loot and is protected like
a material, so a player who wore a Ranger pack and found another keeps the one
they secured and loses the one they wore.
