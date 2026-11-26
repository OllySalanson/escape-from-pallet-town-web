# The chip counts down the grass that gives you away

A fresh critic's second pass (26 Nov 2026) on "a fight is loud": "the rule can't be seen: nothing on the map shows which grass gives you away or for how long." Its ask: put a countdown on the chip.

While the player stands in tall grass round a fight a hunter heard (`HunterPack.trampledLeftMs`) and no hunter is close enough to name its distance, the chip reads `BLUE HEARD THAT 0:56`, counting down the minute. A hunter in reach still says where it is, which is the more urgent line.

- `shout.png` - the moment the fight is heard: `BLUE HEARD THAT`.
- `countdown.png` - four seconds later, Blue still 24 steps off: `BLUE HEARD THAT 0:56`.

Made as `docs/screens/fight-is-loud/` was: a stepped driver on `?testmode=pixels` at 800x512, standing in the grass south of Mill Square, the scene's own after-fight path.
