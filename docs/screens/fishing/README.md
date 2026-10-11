# Fishing

Playtest 25 asked whether wild tables should follow FireRed or stay habitat by
place, and noted that water had no encounters anywhere: Magikarp, Poliwag,
Krabby and the rest lived in the tall grass beside it. The captain's answer was
option (c): give water species their FireRed method. This is the first half of
that, fishing. Surfing is still to come.

Face open water with a rod in the pack and press the interact key. FireRed's
own cast plays out: a second's cast, four to ten dots, then a coin. It is
either `Not even a nibble...` or `A POKéMON's on the hook!` and a wild fight
against what that water's FireRed table holds for that rod. The whole cast is
spent on the raid clock. `src/game/world/fishing.ts` has the rules and their
sources.

Shot at 3x (1200x768) by `tools/playtest/fishing.mjs`, played through real key
events on the Floodplain's landing (fresh water, FireRed's Viridian City pond):

- `fishing-no-rod.png` - no rod in the pack: the water says what lives in it,
  and the next line says what would reach it.
- `fishing-pack.png` - the Good Rod packed, two squares on its end.
- `fishing-dots.png` - the cast: the float on the water, the dots in the box.
  The box sits at the top so the float stays in view.
- `fishing-on-the-hook.png` - a bite: the float pulled under, FireRed's line.
- `fishing-fight.png` - the fight that follows, here at real speed.
