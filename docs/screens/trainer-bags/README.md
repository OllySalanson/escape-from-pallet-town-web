# A beaten trainer drops their bag

Before this, beating a trainer left nothing on their tile: the fight paid
experience and opened the road, and that was all.

- `after-bag-dropped.png`: Greystone Vale, just after FOWLER HUGH (a camper) is
  beaten. His KNAPSACK lies on the tile he stood on, under the player, with its
  caption (`BAG: 1 TO FIND`). BLUE's RAID PACK lies to the right, where the
  hunter was beaten a little earlier.
- `after-bag-searched.png`: the same bag being searched with the cache search
  panel, its caption now `OPENED: ... STILL INSIDE`.
- `icon-beside-cache-and-packs.png`: the new `trainer-bag` icon (left), drawn by
  `scripts/draw-trainer-bag-icon.mjs`, beside the supply cache, the Satchel and
  the Raid pack, at 8x on grass: a bag lying on its side with a Poke Ball rolled
  out, so it never reads as a pack item or a cache.

The two screens were made with
`node tools/playtest/raid.mjs <test-mode build url> --pixels --stepped --window=pixel --level=20 --fight --rob=4 --skip-contract --seed=11 --shot=raid.png`
against a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite build`), served
under its Pages subpath. The icon sheet is the icon PNGs scaled 8x by a
throwaway script.
