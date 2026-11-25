# LINNET's race, round five

| picture | what it shows |
| --- | --- |
| `1-toe-the-mark.png` | asked from her east side: the white chalk box beside her, and the chip pointing at it ("RACE: TOE THE MARK / MARK W 2") rather than at the finish |
| `2-gold-under-the-judge.png` | over the line with the box raised: the mark and time below OLD REEVE, not over him; the pennant flies by the door |
| `3-the-purse-clear-of-the-judge.png` | the stone question seated where his call was, its answers hung under the box (a raised question no longer puts them off the top of the screen), the chips standing aside |

Made on a test-mode build (`VITE_EPTW_TEST_MODE=1 npx vite build`) at `?testmode=pixels`, 1200x768,
stepped at 60fps by `tools/playtest/race.mjs` (`--ask-from=east` for the first;
`--line=cut --opened=greystone-vale/door-2` for the others). `--call-off` plays asking, lining up,
talking to her ("The white box beside me! Or shall we call it off?"), CALL IT OFF, and asking again.
