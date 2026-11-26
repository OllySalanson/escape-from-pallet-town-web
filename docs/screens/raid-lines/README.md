# An arrow under a raid's line names SPACE, and reads nothing on

The navigation audit (25 Nov 2026) found that in a raid an arrow key read on a
hunter's or a trainer's line - lines nobody asked for, so a player trying to walk
away was let go - but not Oak's opening line, a sign or a person, so the same
key did two jobs depending on who was talking.

Now only SPACE, ENTER or a click reads a line on, everywhere. An arrow under a
line, whoever is talking, makes the prompt name the key that does - "SPACE ▼", or
"OK ▼" on a phone - and stand steady for a second, so the game still answers the
press and never seems frozen. The player does not walk on that press.

`after-arrow-under-a-line.png`: Oak's first line, after ArrowRight - the line is
still up, the player has not moved, and the prompt says SPACE.

Made with a short driver against a `VITE_EPTW_TEST_MODE=pixels` build at
1200x768: deploy, wait for the line, ArrowRight, photograph, then SPACE must read
on.
