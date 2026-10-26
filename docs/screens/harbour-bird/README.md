# A bird over the harbour

Round 10 of the badass harbour: the brief asked for gulls, and Kanto has none (Wingull is from
Hoenn, and this game never adds a species). So the bird over the harbour is FireRed's own: the Fly
bird from its Fly animation, with nobody riding it, cut from pret with the palette FireRed draws it
in (`scripts/cut-frlg-fly-bird.mjs`).

## What changed

- Every 40-80 seconds by day and at dusk (never at night) a bird glides in from beyond the top
  right of the harbour and out past the bottom left, rising and falling a little on the air, its
  shadow sliding across the ground and the water far below it (`src/game/base/harbourBird.ts`).
  The first comes soon after you arrive.
- It flies over everything, and is gone in nine seconds; nothing about the harbour is in its way.

## How to use it

Stand about in the harbour by day and look up.
