# Cut and Surf: a door opened by what a Pokemon knows

A field move is a boss gate with a different key (`src/game/world/gates.ts`,
`src/game/world/fieldMoves.ts`). Two are authored: **COPPICE RIDE** in Viridian
Forest, one tile of growth across the mouth of an old ride below Deep Stand, and
**SHOAL CROSSING** on the Floodplain, two rows of deep water between Old Town's
reeds and the bar under Market Isle's south treeline. Both open for good and are
written to `raidProgress.openedGates` on the press that opens them.

Shot at 3x (1200x768) from real play through `?testmode=pixels`, real key events
and real clicks:

```
node tools/playtest/raid.mjs <url> --stepped --pixels --window=pixel \
  --insertion=viridian-forest --level=12 --starter=Bulbasaur \
  --stash=hm01-cut --pack=hm01-cut --read=hm01-cut \
  --open=coppice-ride --work=coppicer --exit=forest-clearing --shot=cut.png
```

The refusals are the same run with no disc packed and a starter canon refuses;
the "still open" pass is `--opened=forest-coppice-ride` with a party that could
not have opened it.

| | what it shows |
|---|---|
| `cut-shut-1200x768.png` | the ride grown over, a stool either side of the mouth, and the caption saying what it wants |
| `cut-refused-1200x768.png` | a Squirtle walking up to it: two lines, nothing spent, the door still shut |
| `cut-open-1200x768.png` | cut, on the press, with the player still standing where they were |
| `coppice-1200x768.png` | THE COPPICE on the arrival plate - twenty tiles of clearing the survey had never lit |
| `surf-shut-1200x768.png` | the reach from Old Town's reeds, with the bar and its cache in sight across it |
| `surf-refused-1200x768.png` | the refusal, naming the move rather than the door |
| `surf-open-1200x768.png` | the crossing drawn as the shallow it turned out to be |
| `shoal-1200x768.png` | THE SHOAL, and the stranded lighter worked |
| `overview-forest-*.png` | the drop-in screen's bird's-eye picture at 10x (`tools/tileset/minimap.mts --survey= --beaten=`), before and after: the door's own mark turns from held to open, and the ground behind it fills in from 24 tiles of coppice lit to 45 |
