# Every menu closes with a little X, and with ESC

The captain, 25 Nov 2026: "surely there should just be a little X on the top
right-hand corner to get rid of things instead of having to click done or back
to the hall, or yeah, just that little X or escape".

Each pair is `<screen>-before.png` (main at bbc46b0d) and `<screen>-after.png`
(this change), at 1280x800 against a test-mode build (`VITE_EPTW_TEST_MODE=1`,
`?testmode=pixels`) served under the Pages folder.

- The named way back at the left of every title bar (`< CENTER`, `< RAID`,
  `< CLOSE`...) is gone; a drawn X stands at the right end instead
  (`pixelScreen`'s `close`, `.px-close`). ESC does the same as it always did.
- A screen with a page inside it keeps a step back on the left, named for where
  it goes, beside the X: a Pokédex page (`< LIST`), teaching a disc
  (`< PACK`, `< THINGS`), the partner swap (`< BILL'S PC`), a map close up on
  Oak's wall (`< WALL MAP`) and a mode at the Battle Arena counter (`< BACK`).
- The bench, rack and locker lose their DONE button, the Game Corner and
  promenade games theirs, and the jump-in card its NOT YET (`rim-*.png`): the
  card has no title bar, so its X stands in its own top corner. A card that
  opens away from JUMP IN (a hurt team, a player just home) now opens on its
  LAND row, and a key pressed on a row is a bump, so SPACE mashed through the
  result never moves the landing.

`stash`, `rack`, `locker`, `rim`, `party` and `bag` are
`node tools/playtest/menuShots.mjs <build url> <dir> --window=1280x800 --raid`;
`team`, `things`, `pokedex` and `pokedex-page` are `node extraShots.mjs <build
url> <dir>` (beside this file), which also closes YOUR TEAM and the Pokédex by
clicking the X and YOUR THINGS by ESC, and fails if any of them stays open.

Along the way: the jump-in card's TEAM tile cut its notes to PARTNER BULBASAU
and +22 AT BAS beside two icons; they now drop under the icons when they do not
fit beside them (`rim-after.png`).
