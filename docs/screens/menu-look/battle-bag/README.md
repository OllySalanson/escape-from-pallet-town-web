# The bag in a fight, as cards

The round-3 mock-up's option B, kept for the bag in a fight: each thing its picture, its
name and how many, and the chosen one gold.

- `before-items.png`, `before-balls.png` - ITEM and BALL as text rows.
- `after-items.png` - each row a card with its item's picture; the cursor's card gold.
- `after-items-next-card.png` - Right moves the cursor to the next card, as it moved to the next row.
- `after-balls.png` - BALL the same way; the catch chance under it is unchanged.

Made with `tools/playtest/battleBag.mjs <test-mode build url> <dir>` (PIXEL_WINDOW): a new
save deployed into Greystone Vale with medicine and balls packed, a wild fight started as
the grass starts one.
