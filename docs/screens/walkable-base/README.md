# The base is a map you walk, and it fills up with what you built

The lobby was four cards on one page. It is a town now - THE HARBOUR - and the
four screens are four places in it: Oak's Lab, the Pokémon Center, Brock's
Workshop and Bill's quay. Nothing about the screens changed. What changed is
that you reach one by walking to its door, and that **every rung of Brock's
ladder now stands somewhere on the ground**.

That second half is the point. A rung used to be a row that went grey when you
paid for it; it is a cellar door in the quay wall now, or seven tiles of stone
rising out of the wood behind the workshop. The pleasure of a base is watching
it fill with the things you earned, which is the one thing a list cannot do.

## The two pictures

| | |
|---|---|
| `base-empty.png` | A fresh save: three buildings, a yard, a quay, and a lot of room. |
| `base-built.png` | The same map with the whole ladder built. Seven things stand that were not there. |

Both are the real map through the real layer builder:

```sh
npx vite-node tools/base/renderBase.mts -- base-empty.png 3 --built=none
npx vite-node tools/base/renderBase.mts -- base-built.png 3 --built=all
```

## The numbers it is designed against

A player re-kits between raids many times an hour, so the walk has to stay a
pleasure rather than become a corridor. `--walks` measures it over the real
collision with every rung built and every keeper standing in the way - the
longest the walk ever gets:

```sh
npx vite-node tools/base/renderBase.mts -- base.png 3 --built=all --walks
```

```
from the yard: OAK’S LAB 2 · POKÉMON CENTER 7 · BROCK’S WORKSHOP 7 · BILL’S QUAY 4
from the quay (home from a raid): OAK’S LAB 6 · POKÉMON CENTER 11 · BROCK’S WORKSHOP 11 · BILL’S QUAY 2
```

At `STEP_DURATION_MS` (150ms a tile) the worst door is about a second from where
a raid puts the player down, and the lab - the one a raid is prepared in - is
two steps. `baseMap.test.ts` holds the seven.

`--marks` names the doors, the keepers and the fixtures on the picture, and
`--collision` hatches what is solid, which is how you see whether something
built has quietly walled a corner of the yard off.

## What it looks like played

`walked-*.png` are the real game at 3x through the project's own driver
(`tools/playtest/`):

| | |
|---|---|
| `walked-empty.png` | A fresh save, standing in the yard. Three buildings and a lot of room. |
| `walked-built.png` | The same view with the ladder built: the mast on the skyline, the lamp house on the quay, the lockers in the quay wall, the healing machines and the ward up the west side - and the four of them standing in it, drawn from the same sheets the screens behind their doors put a face on. |
| `walked-look.png` | Holding **L**, the game's own look: every caption in view at once. |
| `walked-out-of-the-centre.png` | Coming back out of a door puts you on its step, and the caption says what is waiting inside. |
| `room-oaks-lab.png` | And what is behind a door: the same contract board, in a room named after the door you walked through. |
| `room-pokemon-centre.png` | The same for the Center, whose stash is what Nurse Joy keeps in it. |

A door's caption is two lines and no more - the name, and what is waiting
inside today (`src/game/base/doorStatus.ts`, which is the whole of what the
lobby's four cards carried). Three was tried: the yard is four rows deep, two
captions speak at once from the middle of it, and at three lines each there was
no base left to look at.
