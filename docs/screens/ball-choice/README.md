# BALL always asks which ball

Olly, 25 Nov 2026: carrying one Poke Ball and two Great Balls, BALL opened a list
and the Poke Ball went. The very next BALL threw a Great Ball at once, with no
list, because only one kind was left. A double press of Enter, a double click or
a double tap on BALL also threw a ball nobody chose, and reading on through
"broke free!" with Enter walked straight into another throw.

Now BALL always opens the list, the list starts on the ball last thrown (the
weakest the first time), and the list takes no press, click or tap in its first
half second. Space and Enter are one key with the same wait.

| | before (`main` at `4bdd8dbd`) | after |
|---|---|---|
| BALL again, one kind left | `before-4-thrown-great.png`: thrown at once | `after-4-list-of-one.png`: the list, on GREAT BALL x2 |
| two Enter presses 120ms apart on BALL | `before-double-enter.png`: a Poke Ball thrown | `after-5-double-enter.png`: the list, nothing thrown |
| a double click on BALL | (thrown, the audit's `ball-doubleclick.png`) | `after-6-double-click.png`: the list, nothing thrown |

`after-1-menu.png` to `after-3-menu-again.png` are Olly's steps on the way.

## How they were made

The before pictures are the navigation audit's, taken on a test-mode build of
`main` at `4bdd8dbd`. The after pictures are
`node tools/playtest/ballChoice.mjs <test-mode build url> <dir>` against a
`VITE_EPTW_TEST_MODE=pixels` build of this branch, at 1200x768: it plays Olly's
steps with real keys and the double press and double click, logs the pack after
each, and fails on the first ball thrown that nobody chose.
