# Icon review evidence

Before/after captures for the change that replaced the placeholder item and
marker glyphs with `public/assets/icons`. They exist so the art can be judged by
looking rather than by reading a diff, and they are safe to delete once that has
happened - nothing in the game or the build reads this folder.

"Before" is `main` at `2dc737c`, so both sides already have the redesigned
in-raid overlays and the only difference in a pair is the art. Every world
capture is the game's own canvas at its on-screen scale. Loot placement is
seeded per raid, so the two sides of a world figure are two different raids and
do not spawn caches in the same places; the marker art is what the pair shows.

| File | Shows |
| --- | --- |
| `icon-sheet.png` | All twelve icons at 6x, at the 32px the menus draw, and at the 16px the map draws |
| `world-spawn.png` | Signpost, supply crate and extraction pad at the insertion point |
| `world-field-kit.png` | The contract objective, with an open and a locked exit |
| `world-cache.png` | The flooded supply vault |
| `world-radio.png` | The ranger station and a locked exit, captions and all |
| `world-radio-mast.png` | The mast and the cache in one frame, captions hidden - before, the two landmarks were the same box |
| `menu-stash.png` | Stash supply cards |
| `menu-confirm.png` | Final check: at-risk and protected rows |
| `menu-secure.png` | Secure slot item stacks |
