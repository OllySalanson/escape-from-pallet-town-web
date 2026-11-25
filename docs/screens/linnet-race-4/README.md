# LINNET's race, round four

`1-the-judge-in-view.png`: over the line down the woodcutter's ride - the box now seats itself
clear of OLD REEVE (in the hat, below the bench) while he calls the time, and the pennant stands a
column off the line, behind the player rather than out of their head. Made on a test-mode build
(`VITE_EPTW_TEST_MODE=1 npx vite build`) at `?testmode=pixels`, 1200x768, stepped at 60fps:
`node tools/playtest/race.mjs "$URL" --pixels --line=cut --opened=greystone-vale/door-2 --record-in=best.json --shot=out`.

The chalk mark is a white box on the ground beside LINNET while she waits for you on it; it goes at GO.
`node tools/playtest/race.mjs "$URL" --line=road --ask-from=east` asks from her other side, lines up
on the mark and follows her road: lost by 0.3s, as from every side now.
