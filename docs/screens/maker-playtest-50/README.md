# The map maker and playtest mode: playtest 50's findings

Taken on a test-mode build at 1280x800 by `tools/playtest/makerFixes50.mjs`, which also checks each fix and prints PASS or FAIL.

- `02-drafts-open.png`: with DRAFTS open, the bottom bar stays one row (the button now says MAP, not BACK TO MAP), and a map only a few pixels too big for its window gets no overview over its corner (`mapNeedsOverview`).
- `04-fit.png`: FIT on a map with an inside. It measures again once the screen is laid out, and steps out a zoom if the map still does not fit.
- `21-open-other.png`, `22-open-broken.png`: OPEN FILE says what it did. The very map already in the drafts opens that draft. Another map of the same name comes in numbered (`Sample Lane 2`). A broken file says what is wrong when the problem is in a maker's words.
- `24-escape-asks.png`, `25-back-in-maker.png`: Escape in WALK IT or RAID IT asks to go back to the maker, with the cursor on KEEP TRYING. The clock chip says `[ESC] MAKER`.
- `26-drawn-by.png`: the first check's "Type your name in Drawn by" line is a button. It brings the field into view and puts the cursor in it.
- `10-playtest-landing.png`, `11-board-caption.png`: the PLAYTEST BOARD is FireRed's TRAINER TIPS sign, named by an ordinary seated caption. Nothing is nailed over the board any more, and "Nurse Joy" reads whole.
- `13-upstairs.png`: UPSTAIRS from the board asks nobody YOUR NAME?, because the explorer run never claims a player's name.
- `14-battle-arena.png`: in a room as tall as the screen, the hint stands at the foot beside the player, clear of the class board, rather than over the top of the room.
