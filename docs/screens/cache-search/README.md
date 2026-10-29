# Searching a cache

A cache used to pay out whole the moment it was touched. Now opening one starts
a search (`src/game/world/cacheSearch.ts`, drawn by `src/game/ui/SearchPanel.ts`):
the lid, then one piece at a time, each slower the bigger it is, while the raid
clock runs and the hunter keeps coming. A number takes that piece, Space takes
the lot (and everything still to come), and walking away keeps what was taken -
the cache keeps the rest, and coming back carries on.

- `searching.png` - the Heron Hide on Greystone Vale, its first Poké Ball found and the second coming to light; the caption on the map now says how many are left rather than listing the cache's contents.
- `searched.png` - both found, `[1-2] TAKE [SPACE] ALL`.

Made by `node tools/playtest/raid.mjs <test-mode build url> --stepped --pixels --window=pixel --seed=3 --level=12 --work="heron hide" --shot=<dir>/raid.png`.
- `hunter-while-searching.png` - the hunter arriving while the War Room is being searched: the edge glows red over the panel and the chip names the rival, and nothing stops (`node tools/playtest/hunterWarning.mjs <url> <dir> --with-search`).
