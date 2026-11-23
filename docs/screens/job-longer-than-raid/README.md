# The rim card says when a job needs more than the raid

The card gives a job's straight walk and what to allow (2.5 times it). When the allowance is longer than the whole raid clock, the Job line now turns red and adds "That is longer than this raid." An AI playtester was offered "it takes 2:45 of your 4:00; allow 6:52" first and took it.

- `fits.png`: a Line survey that fits a 5:00 raid, unchanged.
- `too-long.png`: the same job with the raid clock set to 1:00 in the page (`raidClockMs` overridden through the dev handle), to show the warning.

Made with `tools/playtest/ai-player/act` on a test-mode build (`?testmode=1`).
