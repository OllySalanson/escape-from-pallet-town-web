# A pack with no room, and the way out of it

The captain, playing on 2026-09-20:

> "I'm just battling a Magikarp and it says that I need to make space in my bag
> to catch a Magikarp - but there's no bag management."

He was right, and it was a trap of our own making: the Pokemon footprint work
made a catch cost four pack squares, and the refusal told the player to drop
something from a bag a battle has no door to. The only obedient move was to
flee, which loses the Pokemon the refusal was about.

**The refusal is now the doorway.** It names the price in squares as it always
did, and then the panel lists what is in the pack and what each piece stands
on. The ball is thrown the moment a drop has bought the room; KEEP THE PACK
(and Escape) puts nothing down and hands the fight back whole. No turn is
charged for the drop - the throw that follows is the turn the player meant to
spend - and what is put down stays in the mud, which is the honest cost.

Shot at 3x (1200x768) from real play through real key events and clicks:
`node tools/playtest/packFull.mjs <url> docs/screens/pack-full --pixels
--window=pixel --potions=15 --balls=3`, which deploys with the loadout filled
to its last square and walks the tall grass until something comes out of it.

| | what it shows |
|---|---|
| `1-battle-1200x768.png` | the wild fight, with a pack of fifteen Potions and three balls - eighteen of eighteen squares |
| `2-refusal-1200x768.png` | the refusal: the squares the catch needs, and what the panel is about to ask |
| `3-make-room-1200x768.png` | the panel - the pack's kinds priced in squares, KEEP THE PACK, and a prompt that answers the row the cursor is on |
| `4-thrown-1200x768.png` | the held ball thrown the instant the room exists, with no second trip through the menu |
| `5-caught-1200x768.png` | back in the world, the catch carried home |
| `4-kept-1200x768.png` | KEEP THE PACK: every command back, nothing spent, no turn taken |
| `loot-refused-1200x768.png` | the same pack meeting ground loot - the piece is still on the ground and the bag is one key away |
| `gift-refused-1200x768.png` | the same pack meeting the Reedbeds giver - she keeps the Pikachu and says so |

The two world refusals were already recoverable and are unchanged in substance;
they are here because the class was checked, not only the fight. What did
change in the world: a boss's gear now **waits** for room instead of being
destroyed, and a landmark's cache is taken whole or not at all and says what
did not fit (`src/game/scenes/WorldScene.ts`, `src/game/world/pois.ts`).
