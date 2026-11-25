# The title's CONTINUE counts badges

CONTINUE's second line used to read `1 POKÉMON · 0 CONTRACTS`; it now reads
Pokémon and gym badges won, counted as the badge case counts them (`wonBadges`).

`before/` is `main` at 65c4a4c7, `after/` this change. Each folder holds the
same four saves: `new.png` (no save), `no-badges.png` (a fresh game),
`one-badge.png` (Misty beaten) and `all-badges.png` (Misty and Koga beaten).

Made against a `VITE_EPTW_TEST_MODE=pixels` build at 1200x768: start a game,
take the starter, reload, then set `raidProgress.defeatedBosses` in the save
and reload again for each picture.
