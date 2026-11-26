# Brock's builds drawn for what they are

The owner, 26 Nov 2026, standing in front of THE MAST: "why is it just a big
tower? Brock needs artwork making or finding."

**Before.** Four of Brock's seven builds stood in the yard as CC0 stand-ins from
`Overworld.png`: THE MAST was its grey stone tower, seven tiles tall, which read
as a silo; THE HARBOUR LIGHT its grey stone roundhouse; THE SECOND MACHINE and
THE WARD the same brown hut twice, which read as a pair of kennels.

- `before-1-the-mast.png`: the owner's own screenshot.
- `before-2-the-cards.png`: the same four on BROCK'S WORKSHOP's cards.

**After.** Drawn by `scripts/draw-promenade.mjs` ("Brock's builds") onto the
promenade sheet's free cells, in the front's own hand (15-bit colours, a dark
outline, light from the top left):

- THE MAST: a red and white lattice aerial, cross-braced, with a dish turned
  to sea and a red light on its tip, on a concrete footing. 2x3, so its card
  shows it whole at its own size: at four tiles the card halved it to a smudge.
- THE HARBOUR LIGHT: a red and white lighthouse with its gallery and lit lamp
  room, at the breakwater head. 2x4. Its night beam now leaves from the glass.
- THE SECOND MACHINE: a white treatment tent with a red cross and its flap tied
  back on a bed. 2x3, where the hut stood.
- THE WARD: a white cabin under a teal roof, a red cross over its door. 2x3,
  where the hut stood, with its colours beside it as before.

Pictures:

- `after-0-the-four-drawings.png`: the four drawings at 6x.
- `after-1-the-mast.png`: THE MAST in the yard, where the owner's tower stood.
- `after-2-the-cards.png`: the cards. This picture also shows a fix to the
  room above them. Opened from Brock's plans, his room used to be drawn at one
  game pixel a pixel in the middle of a stage that would take it at two, because
  it was fitted to its box before the screen had finished laying out. A room
  picture is fitted again whenever its box changes size now
  (`watchRoomPictures`).
- `after-3-the-harbour-light.png`, `after-4-the-tent-and-the-ward.png`: in
  the yard.

Made by `node tools/playtest/brockBuilds.mjs http://localhost:<port>/ <dir>
--port=<cdp port> --window=1280x800` against `npm run dev`, in this machine's
headless Chromium: it builds all seven, walks up to each in the yard, and opens
the workshop on his plans.
