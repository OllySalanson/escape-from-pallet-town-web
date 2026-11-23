# The MORE strip and a row that only touches it

Taken at 960x600 in the machine's headless Chromium on test-mode builds
(`?testmode=1`) of main at 1fb5febb and of this branch, a TRUSTED save with
₽125.

- `before.png`: BILL'S COTTAGE's FOR SALE pane shows POKé BALL, then a cream
  band a row deep, then 4 MORE. The band is the strip raised over POTION:
  the strip needs 26 pixels at the foot of the 137-pixel pane, POTION's box
  reached 3 pixels into that band, and the box was counted as cut although
  its text ended above the line - those 3 pixels were its padding.
- `after.png`: rows are measured to where their content ends, so POTION shows
  and the strip says 3 MORE. (Its heading also reads 2 OTHERS TILL YOU RAID,
  which is a separate pull request.)
- `things-before.png`, `things-after.png`: YOUR THINGS, unchanged (2 MORE,
  a 34-pixel strip, either way). YOUR TEAM and the POKéDEX measured the same
  before and after too.
