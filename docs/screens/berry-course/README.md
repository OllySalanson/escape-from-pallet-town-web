# Berry Picking and the field-move course

Step H4 of the harbour arenas plan: THE GAME CORNER's second cabinet and THE FIELD-MOVE COURSE on THE PROMENADE, played end to end by `tools/playtest/berryCourse.mjs` against a test-mode build, once with a team the games are for and once with one they are not.

    node tools/playtest/berryCourse.mjs <url> <out dir> --team=suited|unsuited

| | Suited (Dodrio, Krabby) | Unsuited (Doduo, Pikachu + Pidgeotto) |
| --- | --- | --- |
| BERRY PICKING | 7,930 - 30 tickets and a prize berry | 2,860 - 10 tickets |
| THE FIELD-MOVE COURSE | 0:13.13 and 0:14.27 on two runs (best possible 0:12.75) - 30 tickets | 0:18.93 (best possible 0:17.00) - 10 tickets |

- `00-the-course.png`: the course as `tools/minigames/drawCourse.mts` draws it - the copse (CUT), the quarry (ROCK SMASH), the boulder (STRENGTH) and the pond (SURF), each with its long way round.
- `suited-01-arcade.png`: the arcade's two cabinets side by side, JUMP and BERRY, each with its own marquee.
- `suited-02` to `05`, `unsuited-03` and `05`: who picks (only the bird), a Dodrio's three heads against a Doduo's two, and what each paid.
- `suited-07-course-gate.png`: the COURSE gate past the PRIZES window, its keeper and the TIME BOARD.
- `suited-09`, `unsuited-09`: the keeper's screen - who could do which field move.
- `suited-11-*`, `unsuited-12`: the run, a field move called as it is done.
- `suited-14`, `unsuited-14`, `suited-15`: the result and the TIME BOARD read.
