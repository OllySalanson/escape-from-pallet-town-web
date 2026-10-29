# The hunter's warning

The hunter used to arrive with its rival's line in a dialogue box that stopped
the player where they stood. Now nothing stops: the screen's edges flush red
(`src/game/world/hunterWarning.ts`, drawn by `src/game/ui/HunterEdgeGlow.ts`),
the arrival sting plays, and the hunter chip names who it is. The rival speaks
first when it catches you, and what it says is about your loot.

- `arrival.png` - the top of the arrival's first pulse, the chip shouting `BLUE ON YOUR TAIL`.
- `trail.png` - a few steps behind, between beats of the trail's heartbeat.
- `arrival-reduced-motion.png` - with the browser asking for reduced motion: the border is held, never flashed.
- `caught.png` - Blue's catch: "Whatever you found, loser, it's mine!"

Made by `node tools/playtest/hunterWarning.mjs <test-mode build url> <out dir> [--reduced-motion]`,
which also prints the glow's strength every 50 ms, whether a dialogue box went
up (it must not), and how much raid clock ran during the arrival (all of it).
