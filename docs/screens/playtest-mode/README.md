# The explorer run: a third row, and a second save behind it

A playtest run is a whole second game kept in its own file, for walking the maps
rather than surviving them. What the mode is and why each part of it is the way
it is lives in `src/game/dev/playtestMode.ts`; what it deals is
`src/game/dev/playtestSave.ts`. In short: its own save key, a player side that
cannot be knocked out, an eight-hour clock, every gate and extraction open with
every keeper still standing, every drop-in point offered, a level-99 Charizard,
and shift to walk three times faster - taught on the objective chip's own hint
row beside `[O] GUIDE` and `[L] LOOK`, because a key nothing on the screen names
is a key nobody presses.

Shot at 3x (1200x768) through `?testmode=pixels`, real key events and real
clicks, from the title screen down to a raid on Viridian Forest.

| | what it shows |
|---|---|
| `title-1200x768.png` | the third row, and the line under the menu that speaks for it |
| `title-question-1200x768.png` | the second question, asked only once there is a run to carry on |
| `raid-1200x768.png` | the corner where the raid clock lives, saying which game this is |
| `lobby-960x720.png` | the lobby at the smallest stage: the title bar names the run, and Bill deals |
| `raid-960x720.png` | the same stage with the objective chip open, so the third hint can be checked against the clock chip |

The thing worth checking by eye on the title is that nothing about the ordinary
two rows moved: CONTINUE still carries the save's own summary, NEW GAME still
says what it costs, and the promise that matters - that none of this touches the
saved game - is the hint line rather than a third detail row, because three
detail rows do not fit the 320x240 stage.
