# The FEEDBACK tab

A player can tell us what happened from any screen in the game: the tab on the
right edge of the window, or the F key. The panel is a column down the right
over the paused game, the shape of the review tool the owner reads his boards
in, and it speaks in the raid's voice (the owner's ruling on the plan board,
2026-10-10).

Taken with `node tools/playtest/feedbackShots.mjs <url> <out-dir>` (Chromium's fake microphone for TALK) against a dev
server in `?testmode=pixels`, at 1280x800 and at a 390x844 phone.

| Shot | What it shows |
|---|---|
| `title-tab.png` | The tab in the window's empty right margin, beside the title. |
| `raid-panel.png` | F in a raid: the raid paused on the left, the message and everything attached on the right. |
| `see-it-all.png` | SEE IT ALL: every line that rides along, before anything is sent. |
| `scrap-question.png` | Escape with words in the box asks first, with the cursor on KEEP WRITING. |
| `kept.png` | SEND before the game has anywhere to send to: kept in the pack, with the tag to quote. |
| `talk.png` | TALK under the box, before anything is recorded. |
| `on-air.png` | Recording: STOP, the blinking dot, the level meter and the tape's time. |
| `recorded.png` | After a stop: TALK MORE adds a clip, PLAY hears it back, DELETE throws it away. |
| `mic-refused.png` | A refused microphone leaves typing, and says so in the raid's voice. |
| `phone-tab.png`, `phone-panel.png` | A phone held upright: the tab under the game, the panel the width of the screen. |
