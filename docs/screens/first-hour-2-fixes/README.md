# First-hour bug hunt 2 fixes (11 Nov 2026)

Before is the hunt's own pictures, taken on a test-mode build of `main` at `9436cc53`. After is a test-mode build of
this branch, played by `tools/playtest/firstHour2Fixes.mjs` on stepped frames in one headless Chromium at 1200x768:

```sh
VITE_EPTW_TEST_MODE=pixels npx vite build --outDir "$SCRATCH/after/escape-from-pallet-town-web"
(cd "$SCRATCH/after" && python3 -m http.server "$PORT")
node tools/playtest/firstHour2Fixes.mjs "http://127.0.0.1:$PORT/escape-from-pallet-town-web/?testmode=pixels" "$SCRATCH/shots/after"
```

Each case starts from a new game whose save the driver edits: out twice already, with every ball taken out of the
vault, or with every Pokémon fainted.

| | before | after |
|---|---|---|
| The marshal, no balls anywhere and Bill still sees a stranger | `before-marshal-no-balls.png`: "Bill sells them, on the quay", and he sells a stranger nothing | `after-marshal-no-balls.png`, `after-marshal-no-balls-then.png`: Bill sells none to a stranger; pick them up out there, and bank a few jobs until he trusts you |
| The rim card with no balls at base | `before-rim-no-balls.png`: "nothing can be caught this raid" | `after-rim-no-balls.png`: you can only catch with a ball you find out there |
| The rim card with everyone fainted | `before-rim-all-fainted.png`: "Safe: nothing: a wipe costs you everything", in red | `after-rim-all-fainted.png`: no Safe line; the foot says Nurse Joy can revive them |

The hunt's second finding, the partner's gear said to have come home in the secure slot, was already fixed by #510
(`docs/screens/double-press-and-badges/`).
