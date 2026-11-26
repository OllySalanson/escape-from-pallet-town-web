# A full pack says "No room in the pack!" and the panel says the rest

Churchyard critic, round 3 (26 Nov 2026), and Olly's rule that the game says things its own way: a ball thrown with the pack full said "No room in the pack!", then "GASTLY needs 4 squares, and none are free. Choose what to put down - what you drop stays here." before the panel to make room opened. It says "No room in the pack!" now, and the panel opens on the next press, still on KEEP THE PACK so a press too many drops nothing.

| | before | after |
|---|---|---|
| the ball's line | `before/3-no-room.png`: "No room in the pack!" | `after/3-no-room.png`: "No room in the pack!" |
| the next press | `before/4-make-room.png`: "GASTLY needs 4 squares, and none are free. Choose what to put down - what you drop stays here." | `after/4-make-room.png`: the panel, on KEEP THE PACK |

Made with `node tools/playtest/battleLines.mjs <url> <dir> --hp=25 --full-pack` against a test-mode build of each (`VITE_EPTW_TEST_MODE=pixels npx vite build --outDir <dir> --base=/`, served as static files).
