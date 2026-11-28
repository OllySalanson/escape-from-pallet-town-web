# The chest's pocket tabs

YOUR THINGS (B anywhere in the harbour, and THE CHEST in THE BOLTHOLE) sorts the chest into pockets. They were ten - Medicine, Balls, Discs, Stones, Held, Tools, Packs, Found, Furniture, Clothes - and HELD and FOUND meant nothing to a new player, while at 1280x800 the strip ran off its edge at "FU".

They are seven words a new player reads at a glance:

| tab | holds |
|---|---|
| Medicine | potions and the like |
| Balls | Poké Balls |
| Training | discs and evolution stones, the two things used on a Pokémon at home |
| Gear | what a Pokémon holds |
| Tools | rods, pickaxes, lockpicks, keys, the bike, and packs |
| Salvage | radio valves, cable coils, parts crates, money and other finds |
| Style | furniture and clothes |

- `before-1280x800.png`, `after-1280x800.png`: the screen at 1280x800, the whole strip on show after.
- `before-390x844.png`, `after-390x844.png`: a phone-sized window.

Made with the menus-audit driver (`tools/playtest/menusAudit.mjs` on branch `fm/eptw-menus-audit-tool`, `--only=your-things`) against a `VITE_EPTW_TEST_MODE=1` build of `main` and of this branch, with a disc, a stone, a cushion, a hair piece and a lockpick added to the chest so most pockets have something in them.
