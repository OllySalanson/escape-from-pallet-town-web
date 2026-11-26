# The portal: THE RAID ARENA's pit, seen whole

The captain, 25 Nov 2026: "I really like the big portal that we've got, but it is very janky at the moment. It doesn't feel intuitive to use, and the animation isn't good, and the camera kind of hovers half over the arena floor and half over the map, and you can't really see that it's like a whole portal. But I really like that, and I really like the fog of war in the portal, so I really want to keep that."

## What was janky (played before the change)

- At the rail only the near curve of the pit shows: it is far bigger than the screen (`before-1-at-the-rail.png`).
- SPACE swung the camera out to the way in, so the screen was a slice of stone on one side and map on the other, the player off the screen, and the card along the foot covering half of what was left (`before-2-looking-down.png`, `before-3-another-landing.png`).
- The rail said `[SPACE] JUMP IN AT MILL SQUARE`, and SPACE opened a card instead.
- The jump cut from the rail to high over the pit in one move (`before-4`, `before-5`), and the fall had the pit's wall down one side of the screen (`before-6-falling-half-wall.png`).
- The first raid's question was asked over the same half-and-half view (`before-7-first-jump-question.png`).

## What it does now

- SPACE at the rail draws the view back: the pit under the rail shrinks into one round portal, with the kerb, fence posts, steps and dark wall, and the map with its cloud at the bottom. The player and partner stand on its edge where they stand round the rim, and the hall goes dark round it (`after-2a`, `after-2b`, `after-2c`, `after-2d` at night).
- The card stands down the right, as the bench, rack and locker do, so the portal has the rest of the screen. TEAM and A WIPE TAKES sit side by side, and HUNTERS and PAYS each take the full width.
- Choosing another way in hops the mark over to its light and puts its name over it (`after-3a`, `after-3b`). A click on a light chooses that light.
- ESC plays the draw-back in reverse, back to the rail (`after-4`).
- JUMP IN: the portal comes to the middle of the screen with the hall moving with it, and the AT RISK words go up over it. Then a hop off the edge, a fall into it while the steps and the floor come up together, and the cloud (`after-5-jump-*`).
- Coming home, the cloud lifts off newly walked ground in the portal, glinting where it goes (`after-6-home-the-cloud-lifts.png`). That frame's trail is dead straight because the driver walked straight lines.
- The first raid's question is asked under the whole portal (`after-7`, `after-7b`).
- The rail's prompt says `[SPACE] LOOK DOWN`, which is what SPACE does there.
- Window sizes: `after-8-1024x768.png` and `after-8-1600x1024.png`. A phone on its side has no room for a portal beside or above the card, so it keeps the old look round to the way in and still jumps down into the portal (`after-8-phone-on-its-side.png`). With reduced motion the portal appears with no movement and the jump is a plain fade (`after-9-reduced-motion.png`).

## How the pictures were made

Against a `VITE_EPTW_TEST_MODE=1` build served under its Pages path (`tools/playtest/README.md`):

- `node tools/playtest/portal.mjs <build url> <out> --tz=Asia/Tokyo` plays a returning player on a stepped loop: the walk to the rail, the draw-back (80 ms frames), ESC and back, changing the landing (50 ms frames), the jump (300 ms frames), and home with new ground walked. `--tz` sets the pit's clock to daytime. Without it the run takes the machine's own hour, which was night (`after-2d`, and all the `before-*` shots).
- `--window=WxH` or `--device=landscape` give the other sizes. `--eval=1` stops once the portal is up.
- `node tools/playtest/firstRaid.mjs <build url> <out> --window=1280x800 --shots` plays a brand-new save's first raid (`before-7`, `after-7*`).
- `node tools/playtest/arenaHall.mjs <build url> <out> --window=1280x800 --still` gives the reduced-motion shot.
- The `before-*` shots are the same drivers run against a build of `main` at 0f7327a8.
