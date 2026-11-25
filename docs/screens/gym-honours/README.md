# Gym honours

What beating a gym leader puts on the player (`src/game/look/gymHonours.ts`):
MISTY's CASCADE NECKERCHIEF and KOGA's SOUL BAND, worn over any look, the
classic figure and the Bicycle's rider, with or without a pack, and seen by
everybody in the harbour.

Before this change no figure wore anything for a gym: a badge showed only in
the badge case at home. The `none` block of `every-body.png` is how every
figure looked.

- `every-body.png` - every body (classic, the rider, the starter look and five
  boutique looks) in every facing, standing and mid-step, wearing nothing, the
  neckerchief, the band, both, and both with a raid pack. Made with
  `npx vite-node tools/look/gymHonours.mts -- docs/screens/gym-honours/every-body.png --zoom=3`.
- `yard.png` - the player two gyms in, at real scale in the harbour.
- `wardrobe.png` - YOUR WARDROBE with the neckerchief taken off: gold for worn, the
  figure dimmed for taken off.
- `shop.png` - THE HARBOUR BOUTIQUE's GYM HONOURS shelf, which sells nothing.
- `plate-pips.png`, `yard-pips.png` - a regular wearing MISTY's honour, with her badge's
  drop as a pip on the name plate. Before, a plate held only the name and any Battle Arena
  class ball.
- `result-card.png` - the card a gym's badge opens on: the player turning round in
  what they won.

The screenshots are from `node tools/playtest/gymHonours.mjs <test-mode build url>/?testmode=pixels <dir>`
against a test-mode build (`tools/playtest/README.md`, "Memory").
