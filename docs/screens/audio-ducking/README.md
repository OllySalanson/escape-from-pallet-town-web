# Audio ducking

Music is off by design (`SILENCE_BACKGROUND_THEMES`), so there is nothing to hear
on the shipped game. The check was made in headless Chromium against a real
`AudioContext`: a fresh `AudioManager` (imported from the dev server), an eight
second tone on the music bus standing in for a theme, then a fanfare, reading
`musicLevel` - the music gain's own value - through the sting.

| moment | music level |
|---|---|
| before the sting | 1.000 |
| 200ms into `levelUp` (0.42s long) | 0.250 |
| 400ms in, as the sting ends | 0.346 |
| 900ms after it ended | 0.998 |
| after a `confirm` blip (ui never ducks) | 1.000 |

`__audio.musicLevel` reads the same number on a dev build.
