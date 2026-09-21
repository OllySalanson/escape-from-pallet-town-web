# The base is four Kanto people

Evidence for the change that gave the base's four jobs the names and the faces
of the people who hold them. They exist so the art and the copy can be judged by
looking rather than by reading a diff, and they are safe to delete once that has
happened - nothing in the game or the build reads this folder.

Every capture is a real browser at a real window size, through the project's own
`tools/playtest/menuShots.mjs`, on the realistic save that tool seeds: four maps
unlocked, two dozen Pokemon, four of them hurt, and a shelf of supplies.

| what it was | what it is | why |
| --- | --- | --- |
| Base | **Oak's Lab** | Every Kanto adventure starts in Oak's lab in Pallet Town, and this game is called *Escape from Pallet Town*. Oak is the man who sends you into the flood, so he stands on the raid card. |
| the Outfitter | **Brock's Workshop** | Brock is the practical one - the fixer who repairs and maintains and keeps everyone supplied. A hideout that turns salvage into permanent fittings is what he would run. |
| the recovery bay | **the Pokemon Center**, with **Nurse Joy** | The canonical healer. The mechanic is unchanged and is stronger than canon's free heal: it is priced in raid time. |
| the Ferryman | **Bill** | He invented the storage system, so the stash is literally his work, and he lives alone by the sea. A collector who trades oddity for oddity is why the best things on his boat cannot be bought at any price. |

Nothing mechanical moved. **Brock builds, Bill deals** is the one sentence that
keeps the two shops apart, and it is the same sentence `src/game/hub/trader.ts`
carried before the rename.

## The screens

| Before | After | What to look at |
| --- | --- | --- |
| `lobby-before.png` | `lobby-after.png` | The title bar, the three renamed cards, and a face on every one of the four |
| `workshop-before.png` | `workshop-after.png` | BROCK'S WORKSHOP, Brock's own line above his ladder, and HEALING MACHINE I and II where RECOVERY BAY I and II were |
| `bill-before.png` | `bill-after.png` | BILL, and Bill standing beside the standing he has with you |
| `stash-before.png` | `stash-after.png` | The bill along the foot: POKEMON CENTER, with Nurse Joy on it |
| `lobby-smallest-before.png` | `lobby-smallest-after.png` | `BASE_STAGE` (640x480, two game pixels a screen pixel). The figures are **not** drawn here and the cards hold no room for them, so the smallest stage is the screen it always was - `menuShots` counts the same rows on it before and after |
| `bill-smallest-before.png` | `bill-smallest-after.png` | The same, on the screen that was hardest to keep: his standing line is hidden at this size, and standing him beside it had quietly exempted the line from its own rule and cost his shelf a row |

## The art

`cast-4x.png` is the four of them at 4x on the pixel-ui cream, in the order the
base meets them: Professor Oak, Nurse Joy, Brock, Bill.

They are cut from the same sheet, by the same script, into the same 64x128
frames as the seventeen overworld designs that shipped before them
(`scripts/cut-frlg-characters.mjs`, `public/assets/ASSET_PROVENANCE.md`), so a
person on a base screen and a person on a map are one piece of art at one scale.
`pixelFigure()` in `src/game/ui/pixelUi.ts` draws the down-idle frame of one,
cropped to the ink by the design's own `headPixelY`, at two game pixels a source
pixel - one is a speck on a screen 800 game pixels wide, and two keeps every
edge on the grid.

Which unlabelled row of that sheet is which person was **not** guessed: each of
the four was matched frame for frame against `pret/pokefirered`'s own named
object-event graphics, and the match is exact. Guessing had put Bill three rows
off, on a sprite that turned out to be Bruno.
