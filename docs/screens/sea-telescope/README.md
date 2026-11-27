# THE POINT's coin telescope, looked through

The owner, 27 Nov 2026: by the telescope, press the interact key and the camera "goes from being bird's eye and zooms down, spins round, goes behind the player's head, and then zooms in with a telescope view", with Pokémon off in the distance - any that would be in the ocean - to look at by zooming in and moving the telescope with the arrow keys, "a way of getting them in your Pokédex as seen but not captured".

## Before

`../harbour-telescope/after-read.png`: faced, the telescope said "It wants a coin you have not got. Through the dusty glass: the open sea, and nothing on it."

## After

- `clip.png` (animated, the game's own pixels, real time): SPACE at the telescope, the camera down and round behind the player, the shot over their shoulder, the push into the eyepiece, the glass, Z in twice, the arrows onto the nearest kind and held there until it is seen, and ESC back out the same way.
- `1-at-the-telescope.png`: stood on the walk behind it, the hint says `[SPACE] TELESCOPE`.
- `2-swooping.png`: the harbour's camera on its way down and round.
- `3-behind.png`: the shot over the player's shoulder - the rail, the telescope's eyepieces, the far coast of GREYSTONE VALE, and the sea with something swimming on it.
- `4-pushing-in.png`: in to the eyepiece, the glass's dark closing round it.
- `5-the-glass.png`: the whole sea at 1x; the brass pips beside the rim are the zoom.
- `6-holding-near.png`: at 4x, a near kind held in the sights, the ring of brass marks filling.
- `7-seen-far.png`: a far kind (here a GYARADOS breaching on the horizon) seen at 4x; both kinds spotted on this look are down the left, framed gold because they were new to the Pokédex.
- `night-behind.png`, `night-glass.png`: the same sea by the harbour's night, its stars, moon and the moon's road on the water.

## How they were made

`node tools/playtest/seaTelescope.mjs <test-mode build url>?testmode=pixels <dir> --clip [--clock=night]` against a test-mode build (`tools/playtest/README.md`, "Memory"), driven through a browser the machine's watchdog can see (`--port=`). The driver steers the glass with the arrow keys, and fails unless the kinds it sees are met and not owned in the save and the harbour's camera comes back exactly as it was. The sea is different every look, so the kinds in the pictures will be too.
