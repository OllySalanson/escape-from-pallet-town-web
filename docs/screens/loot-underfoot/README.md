# A refused find is taken where it lies

First-hour playtest, 26 Nov 2026. A new save walked onto Nurse Joy's medicine
bag at ORCHARD TERRACES with a full pack and was told "Drop something from the
PACK and come back for it". They opened the pack, dropped a Lamp oil, closed it
and pressed SPACE where they stood, on the bag. Nothing happened: only a step
off the tile and back onto it picked the bag up.

Now the hint line names the piece underfoot while nobody is faced, and SPACE
takes it.

| | |
|---|---|
| `before-refused.png` | Before: the refusal on the medicine bag. After making room, standing on the same tile, SPACE did nothing and the hint line was empty. |
| `after-hint.png` | After: back from the PACK with room made, standing on the Mooring rope, the hint line reads `[SPACE] MOORING ROPE`. |
| `after-taken.png` | After: SPACE takes the rope where it lies (the Potions dropped to make room are on the same tile, and are refused as a step onto them always did). |

Made with the AI player's `act` on a test-mode build (`tools/playtest/ai-player/README.md`),
so the frames are Canvas and 400 wide: `act shot` after `act walk` onto the
piece, `act press KeyB`, `act press KeyX` to drop, `act press Escape` and
`act press Space`.
