# The harbour keeps hours, and Lapras sings at night

Round 13 of the badass harbour: something to do after dark, and the harbour's one secret.

## What changed

- **The harbour's people keep the player's hours** (`harbourLifeAt` in `src/game/base/harbourLife.ts`).
  After dark the little girl, the old man and the Pidgey have gone home; the policeman is still on
  his beat, with a night word of his own.
- **Lapras sings at night.** By day it swims in the bay; after dark it comes in along the breakwater
  and sings to the harbour light - and, faced from the breakwater, something out at sea sings back.
  The policeman drops a hint.
- **The head chevron gives way** to anybody standing in the tile above the player, as it already
  does on a raid: it sat on Lapras's head (and on any townsperson's) through a whole conversation.
- `harbourLife.test.ts` now holds both hours to every rule: nobody walls anything off or lengthens
  a walk by day or by night.

## How to use it

Play after dark. Walk out along the breakwater from the cove, and face the water where Lapras is.
