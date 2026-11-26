# One set of words on every keys line

The navigation audit (25 Nov 2026) found the same key named many ways: "ARROWS"
and "Arrows", "ARROWS choose" and "ARROWS move", and a way out said as "ESC back",
"ESC leaves", "ESC leave", "ESC close", "ESC or O back", "O or ESC back to the
raid", "P close", "B close", "X close" and "ESC back to the title".

Now every keys line reads `ARROWS move` (or `ARROWS read` where nothing is
chosen), the panel's OK word and what it does, the screen's own letters, and
`ESC back`. A panel's OK word stays ENTER, as its own help lines say. The
move chooser keeps what ESC does there (`ESC decide later`), because that is a
choice and not a way back. The boutique's line is left to its redesign.

`before-pokedex.png`: "ARROWS move · ENTER opens a page · X close".
`after-pokedex.png`: "ARROWS move · ENTER opens a page · ESC back" (the Pokédex's
new colours came from another change).

Made with `node tools/playtest/pointerOnly.mjs` against a
`VITE_EPTW_TEST_MODE=pixels` build at 1200x768.
