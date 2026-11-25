# A beaten trainer drops their bag

Before this, beating a trainer left nothing on their tile: the fight paid
experience and opened the road, and that was all.

- `after-trainer-worth-the-fight.png`: Greystone Vale, a few steps from FOWLER
  HUGH (a camper, left of the player), before the fight. His bag will hold a
  rare find, so he wears FireRed's emote bubble with a little bag in it. BLUE's
  bag lies top right, where the hunter was beaten a little earlier.
- `after-bag-dropped.png`: just after SCOUT TAM (a bug catcher) is beaten, a
  word from beside him. His COLLECTING TIN lies on the tile he stood on, at the
  player's feet, captioned `BAG: 3 TO FIND` and `SOMETHING GLINTS INSIDE` (a
  Miracle Seed, the tin's treasure, is in it).
- `after-bag-searched.png`: the same tin being searched with the cache search
  panel. The caption says `OPENED: 3 STILL INSIDE` and still
  `SOMETHING GLINTS INSIDE`, because the find is still to come to light.
- `icon-beside-cache-and-packs.png`: the new `trainer-bag` icon (left), drawn by
  `scripts/draw-trainer-bag-icon.mjs`, beside the supply cache, the Satchel and
  the Raid pack, at 8x on grass: a bag lying on its side with a Poke Ball rolled
  out, so it never reads as a pack item or a cache.

The screens were made with
`node tools/playtest/raid.mjs <test-mode build url> --pixels --stepped --window=pixel --level=20 --fight --rob=N --skip-contract --seed=S --shot=raid.png`
against a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite build`), served
under its Pages subpath: the first with `--rob=3 --seed=11`, the next two with
`--rob=1 --seed=23`. The icon sheet is the icon PNGs scaled 8x by a throwaway
script.
