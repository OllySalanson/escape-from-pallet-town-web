# The Repel

FireRed's Repel, bartered at Bill's for one lamp oil and sprayed from the raid
pack: for 100 steps, wild Pokémon weaker than the lead keep away
(`src/game/world/repel.ts`).

- `pack-before-spray.png`, `pack-after-spray.png`, `pack-second-press.png`: the
  raid pack in a real raid (dev server, `?testmode=1`, deployed with
  `level: 20, stash: ['repel:3'], pack: ['repel:2']` through
  `tools/playtest/deploy.mjs`), before the Repel's row is pressed, after it
  (the line at the foot of the pack), and a second press while it still works,
  which is refused and keeps the can. DOM screens draw the same in test mode.
- `cottage-before.png`, `cottage-after.png`: Bill's cottage with every tier open
  (`npx vite-node tools/base/renderBase.mts -- out.png 2 --room=bills-cottage
  --traded=500 --spent=5200`). The back row now runs to the walls each side of
  the aisle; the Repel stands at the end of his tools, beside the Lockpick.
- `icon-beside-medicine.png`: the new icon (`scripts/draw-repel-icon.mjs`) at 8x,
  beside the Potion, Super Potion and Antidote it shares a pack with. Teal, so
  it is never the purple Antidote.
