# The menu look: "a Poke Ball, opened"

The captain picked one look for every menu on 25 Nov 2026, from the round-3 mock-ups:
"It must be the new way of doing it. And yeah, build all of this all in this style. Do not
keep any of the old menu style." This folder is the before and after of building it.

## The rules

- **Five colours, one job each.** Ink and white are everything else. **Red** can be lost
  (the raid pack, a wipe, the cursor's arrow); its one named exception is the title strip's
  seam. **Gold** is the chosen thing and prices. **Green** is safe, ready, go (the main
  button, the locker, healing). No navy, blue or cream in a menu's own colours.
- **Every menu**: an ink title strip with the Poke Ball's red seam under it and a drawn
  Poke Ball before the name, the one number that matters in a white pill, and a small X
  (Esc does the same).
- **Cards**: white, one line of ink with clear corners, a hard pixel shadow. A heading
  strip's colour says what kind of card it is, never a tint over the paper.
- **Chosen**: gold. The row under the cursor is gold's wash; a focused card is outlined in
  gold two pixels deep. The arrow stays red.
- **Types**: an ink chip with a small square of FireRed's own colour, so a type never
  competes with the five.
- **Behind a menu**: the place it was opened in, dimmed, never a pattern.

## How the pictures were made

`tools/playtest/menusAudit.mjs` against a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite
build`, served under `/escape-from-pallet-town-web/`), at 1280x800, on a save with Squirtle
(partner) Lv8, Pikachu Lv9, a few supplies and ₽640:

    node tools/playtest/menusAudit.mjs http://127.0.0.1:<port>/escape-from-pallet-town-web/ <out dir>

- `before/` - `main` at 7eae8a46, the navy, blue-rim and cream style.
- `after-foundation/` - the shared parts re-drawn: palette, title strip, X, cards, headings,
  buttons, type chips, the dimmed place behind. Each screen's own layout is unchanged; the
  screens are rebuilt group by group after this.

THE GREAT LIBRARY's book stays paper-coloured: it is drawn as a real book, not a menu.
