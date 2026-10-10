# The map maker on the biggest map

`tools/playtest/makerHuge.mjs` against a test-mode build at real speed, 1280x800,
on the sample lane laid side by side.

| | before (`main`, 128x128, the old cap) | after (256x256, the new cap) |
|---|---|---|
| opening the map | 217-327 ms | 552 ms |
| one tile of a brush stroke | **268-292 ms** median | **0.3 ms** median, 4 ms worst |
| letting go of a stroke | 330-356 ms | 82-87 ms |
| the kept picture against one drawn whole | - | 0 pixels differ |
| TRY IT, walking | - | 16.7 ms median frame, none over 34 ms |

- `before-maker-128.png`: the biggest map the maker could draw before.
- `after-maker-256.png`: the biggest it draws now, after two strokes.
- `after-try-256.png`: walking it in TRY IT.
