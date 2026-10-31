# THE RAID ARENA's great hall

These are the hall as it first shipped, before raids started from it: `docs/screens/arena-raid-start/` is what it does now.

What is behind the Arena's door once its trailer has played. Photographed by
`tools/playtest/arenaHall.mjs` (`--tour`, `--survey=`, `--window=`) against a test-mode
build; `whole-hall-from-above.png` is `tools/base/renderArena.mts --whole`, a view no
player ever gets. Geometry and the promises it keeps: `src/game/base/arenaHall.ts`.

- `new-save-arrival.png`, `new-save-looking-down.png`: a save that has walked nothing. Nobody speaks on arrival.
- `explored-south-fence.png`, `explored-east-fence.png`: a save that has walked part of Greystone Vale.
- `north-wall.png`, `north-fence-steps.png`: the wall, its torches and banner, and the steps at their deepest.
- `marshal.png`: a newcomer's words, said once and only when asked, in the room's own box.
- `small-window-arrival.png`, `small-window-all-walked.png`: the smallest stage, 320x240 at 2x.
- `large-window-all-walked.png`: 1920x1080, every tile walked.
