# The telescope: OK drops, BACK steps back

The navigation audit (25 Nov 2026) found the Raid Arena's telescope swapping
Space and Enter. Its line read "[ENTER] DROP [SPACE] BACK": Space, which opened
the glass and means "yes" everywhere else, shut it. On a phone the same line read
"[OK] DROP HERE [OK] BACK", the pad's one OK button (which is Space) shut the
glass, and nothing on the pad could drop, zoom or step to the next landing, while
its row still offered LOOK, FAVOURS, THINGS, TEAM, DEX and SAY, all dead.

Now OK (Space or Enter, the pad's OK) drops and BACK (Esc, the pad's BACK) steps
back, as they do everywhere. The line reads "[SPACE] DROP HERE [ESC] BACK", which a
phone says as "[OK] DROP HERE [BACK]". While the glass is up the pad's row offers
the glass's own keys, ZOOM and NEXT, and none of the yard's.

| | before (`main` at `4bdd8dbd`) | after |
|---|---|---|
| the keys line | `before-keys.png` | `after-keys.png` |
| on a phone | `before-phone.png` | (the line as above; the pad's row is ZOOM, and NEXT with more than one landing) |
| Space on a landing | shut the glass | `after-space-drops.png`: round to the rail, and the first raid asked |

## How they were made

The before pictures are the navigation audit's. The after pictures are
`node tools/playtest/arenaTelescope.mjs <test-mode build url> <dir> --new --still`
against a `VITE_EPTW_TEST_MODE=pixels` build of this branch at 1200x768, which
now checks the keys line and drops with Space.
