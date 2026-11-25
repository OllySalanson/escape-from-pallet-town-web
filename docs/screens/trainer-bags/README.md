# A beaten trainer drops their bag

Before this, beating a trainer left nothing on their tile: the fight paid
experience and opened the road, and that was all.

- `after-trainer-worth-the-fight.png`: Greystone Vale, a few steps from FOWLER
  HUGH (a camper, left of the player), before the fight. His bag will hold a
  rare find, so he wears FireRed's emote bubble with a little bag in it. BLUE's
  bag lies top right, where the hunter was beaten a little earlier.
- `after-bag-dropped.png`: just after HUGH is beaten. His KNAPSACK lies on the
  tile he stood on, under the player, captioned `BAG: 2 TO FIND` and
  `SOMETHING GLINTS INSIDE`.
- `after-bag-searched.png`: the same bag being searched with the cache search
  panel, its caption now `OPENED: ... STILL INSIDE`.
- `icon-beside-cache-and-packs.png`: the new `trainer-bag` icon (left), drawn by
  `scripts/draw-trainer-bag-icon.mjs`, beside the supply cache, the Satchel and
  the Raid pack, at 8x on grass: a bag lying on its side with a Poke Ball rolled
  out, so it never reads as a pack item or a cache.

The two screens were made with
`node tools/playtest/raid.mjs <test-mode build url> --pixels --stepped --window=pixel --level=20 --fight --rob=3 --skip-contract --seed=11 --shot=raid.png`
against a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite build`), served
under its Pages subpath. The icon sheet is the icon PNGs scaled 8x by a
throwaway script.
