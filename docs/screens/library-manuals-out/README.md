# The library's manuals out

The RAIDS, THE HARBOUR and THE BOLTHOLE books are gone (27 Nov 2026, the harbour loop audit, decision 3): a manual inside the game is the opposite of show, don't tell, and every feature had to rewrite it. THE GREAT LIBRARY keeps its room, its librarian, MARLOW's bookcase and VALE SECRETS on the golden plinth.

- `before-room.png` - the room on `main` with the three lecterns (`docs/screens/great-library-loop/after/room-three-lecterns.png`, 400x256).
- `after-room.png` - the room now: the golden plinth alone on the runner (1200x768).
- `after-door.png` - the door from the yard: its name, and no "3 books to read" under it.

Made with `tools/playtest/greatLibrary.mjs <cdp port> <url> <dir>` against a `VITE_EPTW_TEST_MODE=pixels` build served under the Pages subpath, in the machine's one headless browser.
