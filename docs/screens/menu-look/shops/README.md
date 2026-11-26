# Bill's Cottage and Brock's Workshop in the menu look

Olly picked these from the round-3 mock-ups on 25 Nov 2026: Bill as "cards with price
tags", and Brock with "the builds along the bottom" and a better-styled box for the
build in hand.

## What changed

**Bill's Cottage** (`HubScene.traderView`)

- FOR MONEY and FOR PARTS are rows of cards: the thing big, its name, and its price.
- Money prices are gold tags. Parts are tags with the part's picture and how many,
  green when there is enough and grey with a cross when not.
- A locked card has the game's own padlock and the standing that opens it (TRUSTED,
  PARTNER) on a grey strip. A rationed one says RATIONED; the locker shelf says THIS RAID.
- One gold-headed card on the right answers for the card the cursor is on: the thing
  big, how many as `< 1 >` (Tab crosses to it, Left and Right change it), the money
  before and after (`₽640 ▸ ₽550`), one line of what it does, and ENTER BUY ONE.
- Under it, Bill in his own cottage, drawn live from the room the yard walks into -
  whole, at the largest scale that fits his column (a third, at 1280x800), filled round
  with its own wall and floor colours - and his trust as one bar with the next
  standing at its end (`8 / 14 ▸ TRUSTED`).
- A barter held back for his trust shows the padlock and the standing it waits for
  where ALL HERE would stand - never both.
- A buy plays the coin sound and the money in the title pill rolls down to what is
  left (`bill-bought.png` caught it at ₽561 on the way to ₽550).
- Buying still asks once more before anything is spent.

**Brock's Workshop** (`HubScene.workshopView`)

- His room is the stage, drawn live and whole - Brock and every bay in view - at the
  largest whole-number scale that fits (its own size at 1280x800, under the controls
  bar), centred, with the room's own wall colour
  above and floor colour below round it, and the black void its outer tiles carry
  cleared. Chalk marks the floor where each machine not built yet will stand, and the
  chosen build's bay is ringed in a winking gold box.
- The builds are a compact row of cards along the bottom, so the room above keeps
  its full size: a 48-pixel picture box with every machine whole in it (the beacon at
  half, the mast at a third), the mock's one-line names (LOCKER I, HEALING II, WARD),
  and the part tags or a padlock with the build it waits for. The row has no heading
  strip: BUILT n OF 7 is on the card on the right, and a short part is its crossed
  grey tag. A build that waits on another shows
  the padlock and AFTER LOCKER I instead of a price.
- The card on the right is green when the build can be made, and shows what it does
  in a raid as a picture: the radio mast is the hunter chip the HUD prints with it up,
  a locker is its squares with the new ones blinking gold, a healing machine is the
  raid clock a revive costs. Then the parts as tags with ALL HERE, ENTER BUILD IT, and
  BUILT n OF 7.
- The title pill counts Brock's parts at base, each by its picture.
- A build lands with two knocks and gold stars rising off its card
  (`brock-built.png`), and the machine appears in the room.
- Building still asks once more before anything is spent.

## Pictures

- `../before/bills-cottage-shop.png`, `../before/brocks-workshop.png` - `main` before
  the menu look.
- `../after/` - every screen with the whole menu rebuild merged.
- `bill-open.png`, `bill-bought.png`, `bill-locked-barter.png` - Bill opened, a Poké Ball
  just bought, and the cursor on a barter held back for a trusted friend.
- `brock-open.png`, `brock-locker.png`, `brock-asked.png`, `brock-built.png`,
  `brock-short.png` - Brock opened, the cursor on a locker (the gold ring on its bay),
  a build asking once more, a build just made, and a base short of parts.

Made with `tools/playtest/shopStates.mjs <test-mode build url> <out> [--rich]` at
1280x800 (`--rich` gives the save every part, for the ready states), against a
test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite build`).
