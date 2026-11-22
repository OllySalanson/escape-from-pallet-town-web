# The wipe line-up says how many more it could not stand

The 22 Nov AI playtests saw the lost-raid line-up disagree with the sentence under it. In one case the sentence named a Lamp oil that had no tile. In another, RAID PACK ×1 HELD stood beside "your Raid pack ... gone for good".

The line-up stops at eight figures, and anything past that was dropped without a word. Now the last place is a MORE ×N tile counting what did not fit, with what was taken standing before what was held. A spare of the lost pack, kept in the secure container, is now called "Spare raid pack".

- `before.png` (`main`) and `after.png`, at 1200x768: three fallen Pokémon, the Raid pack, six kinds of supply, and a spare Raid pack in the container.
- `after-800x512.png` shows the same line-up's last beat at 800x512. Nothing overlaps at a real window size. The overlap the AI reported was only ever in its own 400x256 window.

They were made on a dev server at `?testmode=1` by a scratch copy of `tools/playtest/resultShots.mjs` that opens the result screen on a crowded lost-raid report and presses through its beats.
