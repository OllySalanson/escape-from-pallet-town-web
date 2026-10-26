# The harbour holds still for players who ask it to

Round 16 of the badass harbour: rounds 3, 5, 6 and 10 put a lot of motion into the harbour - the
sea and flowers animate, the boats ride the swell, the Seagallop glides in, a bird crosses the sky
and the harbour light sweeps the bay. The title screen already honours the browser's
**reduce motion** setting; now the harbour does too.

## What changed

- With `prefers-reduced-motion: reduce`, the harbour's own motion holds still (`BaseScene.still`):
  the sea, surf and flowers stay on their first frame (which is the art as it always was), the
  boats sit at their berths, no bird flies over, and the harbour light's beam stays put. People
  and Pokémon still walk, because they are how the harbour is played.

## How to check it

Turn on "reduce motion" in the operating system (or emulate `prefers-reduced-motion: reduce` in the
browser's developer tools) and walk the quay: the water is still and the boats don't bob.
