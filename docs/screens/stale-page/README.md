# A page from before a publish

A tab left asleep overnight woke holding a copy of the page from before that night's publishes. Its script and stylesheet had been deleted by GitHub Pages, so it said LOADING THE GAME... black on white, for good.

- `before.png` - main at 50a7700d, served a stale page: the bare line, unstyled, forever.
- `after-publish.png` - the same stale page with the fix: it reloads once, gets the current page and the game starts.
- `after-gone.png` - files that never come (gone for good, or no connection): it reloads once, then says so in the game's colours with TRY AGAIN.

Made by `tools/playtest/stalePage.mjs <build dir> --shot=<dir>` (`--before` for the old build), at 1200x768.
