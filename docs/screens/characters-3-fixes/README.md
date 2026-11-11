# Characters bug hunt fixes (11 Nov 2026)

Before is a test-mode build of `main` at `b7978968`; after is the same build of this branch. Both were played by
`tools/playtest/characters3Fixes.mjs` on stepped frames in one headless Chromium at 1200x768:

```sh
VITE_EPTW_TEST_MODE=pixels npx vite build --outDir "$SCRATCH/after/escape-from-pallet-town-web"
(cd "$SCRATCH/after" && python3 -m http.server "$PORT")
node tools/playtest/characters3Fixes.mjs "http://127.0.0.1:$PORT/escape-from-pallet-town-web/?testmode=pixels" "$SCRATCH/shots/after"
```

Each case starts from a new game whose save the driver edits: the partner turned into a Charizard (with both
Secure lockers built), a Charmeleon or a Pikachu. That is why their HP reads low - the edit changes the species
and level and leaves the HP the starter had.

| | before | after |
|---|---|---|
| A Charizard pressed in THE LOCKER, every locker built | `before-locker-charizard-pressed.png`: "Take something out, or grow the container", and the note sends you to a cordon ledger on a retired map | `after-locker-charizard-pressed.png`: too big for any secure container, a wipe will take it |
| A Charmeleon's row on a base with nothing built | `before-locker-charmeleon-row.png`: "Secure this Pokémon…" | `after-locker-charmeleon-row.png`: what to build to secure it |
| The make-room panel after a ball at a full pack | `before-make-room-opens.png`: the cursor on the Potions | `after-make-room-opens.png`: the cursor on KEEP THE PACK, first row |
| The press after it | `before-make-room-second-press.png`: a Potion put down | `after-make-room-second-press.png`: nothing put down, the fight goes on |
| A Thunder Stone on a Pikachu in YOUR THINGS | `before-stone-used.png`, then `before-stone-next-press.png`: one status line, gone at the next press | `after-stone-moment-flicker.png`, `after-stone-moment.png`, `after-stone-back-to-the-list.png` |
| The rim with a Sealed dispatch on the board | `before-rim-job-walk.png` | `after-rim-job-walk.png`: "Walked straight, it takes 1:18 of your 5:00." |
