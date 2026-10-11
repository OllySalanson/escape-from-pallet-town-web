# A raid paused while the window is not in use

Playtest 14 found that a raid kept running in a window that was on screen but
not in use - a second monitor, a chat window over the corner - so a player who
looked away came back to a hunter beside them and a minute gone. The captain
chose to pause, with a plate that says so, and to carry on only on a click or a
key (`src/game/world/windowPause.ts`, drawn by `src/game/ui/PausePlate.ts`).

- `paused-1200x768.png`: 3x of the 400x256 stage.
- `paused-640x480.png`: 2x of the smallest stage, 320x240.

The map is dimmed and the clock in its corner reads what it read when the
window went. Focus coming back changes nothing; the key that resumes is spent
on the plate, so an arrow pressed to come back does not also walk.
