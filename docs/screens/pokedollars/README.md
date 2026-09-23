# Pokédollars

The money was called scrip. It is the Pokédollar now, and an amount is written
the way these games write one: `₽190`, the sign in front. Orange Kid has no ₽,
so `scripts/draw-pokedollar-glyph.mjs` draws one on the face's own grid and
`style.css` joins it to the family by `unicode-range`.

Photographed from a `VITE_EPTW_TEST_MODE` build at 1280x800 with
`?testmode=pixels`.

- `bill-shelf.png` - Bill's quay: the vault total in the title bar, shelf
  prices, the berth and the standing line, all in ₽.
  (`tools/playtest/shopScreens.mjs`)
- `bill-table.png` - his barter table, which no money buys.
- `raid-pack.png` - the pack mid-raid after picking up every bundle on the
  Floodplain (`tools/playtest/raid.mjs --level=30 --grab=money --shot=...`).
- `result-banked.png` - the result screen of the same raid: "plus 4 Potions,
  ₽190 and 1 Super Potion".
