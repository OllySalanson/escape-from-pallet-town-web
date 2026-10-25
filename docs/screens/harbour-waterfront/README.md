# The harbour gets a waterfront

The owner, 2026-10-25: *"make Pallet Town the badass harbour that you've ever seen."*

## What made it ordinary

Walked as a player walks it today, at the real 3x window (`before-*.png`), against FireRed's own
Vermilion City and its pier, Cinnabar and the Sevii quays:

- **The water is empty.** A third of the map is sea and nothing is on it. No boat, though every raid
  "comes home by boat"; the jetty a raid lands on is four planks with nothing tied to them. Vermilion
  is the S.S. Anne at the end of a pier; this was a lawn's edge.
- **The quay is a pavement.** Three rows of grey slab with two barrels and a crate on it, the same depth
  end to end, and no reason to walk east along it - it just stopped.
- **The yard is a sand rectangle** across the middle, with nothing in it and nobody on it.
- **Nobody lives here.** The keepers are inside; the only figures outdoors are you, your partner and
  the Day-Care man. No townspeople, no Pokemon about, no gulls.
- **Few landmarks have names.** The doors are captioned; nothing else in the harbour says what it is.
- **No sound** of a harbour - no sea, no gulls, no ship's horn.

## This change: the waterfront

- **THE SEAGALLOP**, FireRed's islands ferry, is tied up at the raid jetty: the boat every raid
  sails out on and comes home in.
- **The long pier** - Vermilion's own, bollard towers, rope and awning - runs out from a deeper east
  quay to the **S.S. ANNE**.
- **THE WAREHOUSES**, Fuchsia's brick terrace, stand along the east quay with the cargo stacked
  outside them, and mooring posts along the edge.
- **THE COVE**: a beach past the warehouses, a jetty to fish off and rocks out in the water.
- Every one of them is **captioned and read by facing it**, in a sea-blue caption of its own, and the
  pier and the cove have signs.
- The map is 64x34 now (was 64x24): the sea is room for what floats on it.

Nothing on the land moved: every door, room, fixture and the shared harbour are where they were,
and every walk is the same length - from the yard: Raid Arena 9, Center 5, Lab 11, Workshop 17,
Bill 14, Bolthole 24; from the boat: Raid Arena 11, Bill 4 (`renderBase.mts --walks`, before and
after).

## How to use it

Come home from a raid: you step off onto the jetty beside the Seagallop. Walk east along the quay
past the lockers to the bollards and go down the long pier under the awning to the S.S. Anne; face
the ship (or the ferry, or the warehouses) and press Space to read it. Carry on east past the
warehouses to the cove.

## Pictures

`node tools/playtest/harbourTour.mjs <test-mode build url> <dir> --built=all --at=pier-end:29:27,the-cove:54:20`
photographs every spot; `npx vite-node tools/base/renderBase.mts -- out.png 2 --built=all` draws
the whole map.
