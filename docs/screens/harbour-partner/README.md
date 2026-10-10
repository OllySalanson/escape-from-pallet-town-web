# The partner at your heel

The starter you picked now walks round The Harbour with you, one step behind,
in your own footsteps - the way HeartGold and SoulSilver's following Pokemon
do, and in that game's own following-Pokemon art. It is a trial: only in the
harbour, never chosen, and nobody follows once the partner is lost.

Everything here was taken by
`node tools/playtest/harbourPartner.mjs <test-mode build url> <dir> --clips`,
which plays a new game at exact 60fps frames and fails - a thrown error, not a
picture - if any promise below is broken. The `clip-*.png` files are animated
PNGs at 30 frames a second, 2x, cropped round the player.

| | |
|---|---|
| `clip-arrive-and-walk.png` | Opening the game: Charmander pops in behind you and says hello, then follows a walk left, down and right a step behind. |
| `clip-turn-and-talk.png` | A tap towards it turns you to face it (the hint says `[SPACE] CHARMANDER`), and Space gets a line, a bubble and a hop. |
| `clip-swap.png` | Holding towards it walks straight through: it never blocks you, it steps back past you. |
| `clip-door.png` | Into Oak's Lab: it follows you in, stands beside the mat and looks up at you; back out, it is at your side, then falls in behind. |
| `arrive.png` | Where it stands on opening the game: behind you. |
| `facing.png` / `talk.png` | Turned to face it, and spoken to. |
| `room.png` / `door-out.png` | Beside the mat inside, and at your side coming back out - never in the doorway, which the building is drawn over. |
| `lost.png` | A save whose partner is gone walks the harbour alone, even after a wipe has handed it a fresh starter of the same species. |
| `gallery.png` | All nine Pokemon a partner can be - the three starters and both their evolutions - standing behind the player on the yard, and a fainted Charmander saying it needs Nurse Joy. |

## What it does

- **Footsteps.** Every step you take, it takes one onto the tile you just
  left, in exactly the time yours takes, turning the way it walks. So it never
  stands anywhere you have not, and never walks through a wall, the water or a
  counter.
- **Never in the way.** It is not solid. Walk back into it and the two of you
  swap places. A tap towards it from standing turns you to face it instead -
  FireRed's own tap-to-turn, kept for the one tile worth stopping to face - and
  holding the key walks you on through it a tenth of a second later.
- **Life.** The moment it reaches its spot behind you it stands still, then
  turns to look up at you, glances around, and now and then hops and chirps.
  Spoken to, it answers in its own words and a FireRed emotion bubble - happy, humming, nuzzling, curious
  about whichever room it is in - unless it is hurt, poisoned or out cold, when
  it says so and does not bounce about.
- **Doors.** Through a door it tucks in after you as the screen goes dark; inside
  it arrives beside the mat; back out it is at your side.
- **Who.** The very Pokemon you picked as your starter, evolved or not, and
  nobody else - recorded by the Pokemon, not the species, so a fresh starter a
  wipe hands back is not it.

The art is `public/assets/followers/`, cut by `scripts/cut-hgss-followers.mjs`
from `pret/pokeheartgold`; see `public/assets/ASSET_PROVENANCE.md`.
