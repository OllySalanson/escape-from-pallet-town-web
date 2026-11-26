# YOUR THINGS: home on one side, the next raid on the other

The captain, 26 Nov 2026: "It's not clear how to decide your next raid pack when using your bag in the harbour ...
It needs to be intuitive, super intuitive." And: "the big yellow square saying two parts crates".

Taken through four rounds of fresh first-time critics (a Pokémon fan, a Tarkov veteran, a 10-year-old), each judging only
pictures. Round 1 found the root of it: the locker drew the Potions it keeps as a second store beside the pack, so every
persona counted eight Potions where there were four, and a Tarkov veteran read the box as extra room.

- `before.png` - `main`: RANGER PACK / AT RISK reads as an item's name, the locker shows the same four Potions again, the
  team is nowhere, and a cable coil looks as packable as a Poké Ball.
- `after-team-of-three.png` - HOME (safe) and NEXT RAID: the team in six places, each SAFE or AT RISK with the partner's
  rosette, the locker's padlock or a red torn corner; the worn pack at the end of the row; the pack, LOST ON A WIPE, and
  the locker beside it, KEPT ON A WIPE, here keeping a Pikachu.
- `after-kept-potions.png` - the locker keeping three Potions: the same three are lined in green with a padlock in the
  pack, and the cursor on one lights its one twin in the locker. L let one go a moment before.
- `after-locker-full.png` - the locker full with the Pikachu: the card's L reads LOCKER FULL, greyed. Pressing it shakes
  the locker and turns its count red.
- `after-home-only.png` - ENTER on two parts crates: nothing packs, the card says HOME ONLY, and the crates are a crate
  filling their four squares rather than a small picture adrift in a big one.
- `after-hauler-frame.png` - a Hauler frame worn (30 squares, five rows) with the Bicycle packed: it all still fits at
  1200x768.

Made against a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite build`) at 1200x768 by `tools/playtest/yourThings.mjs`
(`01b-unlocked.png` is `after-kept-potions.png`) and a scratch driver that seeds a save with a team of three, two parts
crates, a Bicycle and a Ranger pack or a Hauler frame, then focuses things and presses ENTER.

## The hall's rack and locker are the same screen, and L is the locker's key

- `before-hall-rack.png`, `before-hall-locker.png` - THE ARMOURY RACK and THE LOCKER were panels of their own: the
  same pack chosen again as rows of -/+ counts, and the locker's Pokémon and supplies as more counts.
- `after-hall-rack.png` - walking up to the rack (or the locker, which starts the cursor on the locker) opens YOUR
  THINGS on the hall's own choices.
- `after-lock-a-pokemon.png` - the cursor on the team's Rattata: the tile is gold with the bobbing arrow, and L says
  what it will do, LOCK · PIKACHU OUT, because the locker's one place is taken. The partner's tag is PARTNER.
- `after-pokemon-locked.png` - L pressed: Rattata is SAFE with the padlock and in the locker; Pikachu is AT RISK.
- `after-room-for-a-find.png` - Rattata let go, then L on two parts crates at home: the locker keeps a crate's room for
  one found on the raid, drawn faded, and the card says ROOM KEPT.

`after-hall-rack.png` is `tools/playtest/arenaHall.mjs` (`4-rack.png`); the rest are the scratch driver above, pressing
L on the team tile and on the crate.
