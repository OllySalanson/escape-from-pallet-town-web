# The first raid begins with a catch

The overnight critic (25 Nov 2026, problems 4 and 6) found the first raid was a walk: two
dense boxes from Oak, then 130 tiles of empty road and out with ₽110, and no decision.
Separately, a one-Pokémon team was wiped by the first wild Pokémon it met. Now the nearest
of Mill Square's Pidgey is wild on a new save's first raid (`world/firstCatch.ts`):

- `before-landing.png` - main: the chip says TAKE ₽10 ON THE WAY TO ₽75, after Oak's two
  boxes about packs, hunters and fainting.
- `after-landing.png` - this branch: one box, CATCH THE PIDGEY on the chip.
- `after-throw-a-ball-now.png` - the fight teaches the rule the moment it is true.
- `after-caught.png` - Oak: the pack, then the risk and the choice. The hunter is already
  on the player's tail.

Played on a test-mode build at 1200x768 by a scratch driver that follows the chip like a
newcomer: it walks to the target, presses SPACE, fights, and throws a ball once the foe is
under half HP. In one run the just-caught Pidgey, on 1 HP, finished BLUE's Rattata after
Charmander fell. With `--ko` the first Pidgey is knocked out, Oak points at the second,
and the raid goes on as before.
