# You choose where Brock's builds stand

The owner, 26 Nov 2026: "last night we decided on a new way of play, like you get
to place it and pick what you're doing ... And now there's just a huge tower out
between my house and the Day-Care man."

**Before.** Every build had one fixed spot in the yard, and it appeared there the
moment it was paid for. Nothing could be moved.

**After.**

- BUILD IT on a card in BROCK'S WORKSHOP asks once more, then takes the player out
  to the yard with the camera on the build's first place. The build is drawn there
  as it would stand, ringed in gold, with its name and the place's name over it
  ("THE STRONGROOM / IN HARBOUR SQUARE 1 OF 2"). The arrows step round its places,
  ENTER builds it there and spends the parts (nothing is spent before that), and
  ESC goes back to the workshop with the cursor on its card.
- A build that stands has MOVE IT on its card, which works the same way and costs
  nothing. That is how the owner's own Mast moves off the lawn by his house.
- Afterwards the player is put down in front of the build, facing it, and told
  where it now stands.

Where a build may stand is a short list per build (`places` in
`src/game/base/fixtures.ts`), and the yard's tests are run with **every build in
every one of its places at once**. That way no choice can wall a door off, block a
way that two people walk side by side, or stand where the harbour's regulars walk.
The yard is full, and some builds have fewer choices than others:

| Build | Places |
| --- | --- |
| THE MAST | by the Bolthole, beside the Battle Arena, beside the Pokémon Center |
| THE HARBOUR LIGHT | the breakwater head, the breakwater elbow, by the long pier |
| THE STRONGROOM | Harbour Square, above the cove |
| THE SECOND LOCKER | Harbour Square, on the quay |
| THE HEALING MACHINE | the clearing, beside the Day-Care |
| THE SECOND MACHINE | the clearing, beside Brock's workshop |
| THE WARD | the clearing (nowhere else passed) |

Pictures, in the order a player meets them:

- `1-move-the-mast-by-the-bolthole.png`, `2-beside-the-battle-arena.png`,
  `3-beside-the-pokemon-center.png`: MOVE IT on the Mast, stepping round its places.
- `4-moved.png`: put beside the Battle Arena.
- `5-build-it-on-the-card.png`: BUILD IT asks on the card.
- `6-placing-a-new-build.png`: out in the yard, choosing.
- `7-built-where-it-was-put.png`: built above the cove.
- `8-move-it-on-a-built-card.png`: a built card says MOVE IT.

Made against `npm run dev` in this machine's headless Chromium, at 1280x800:
`node tools/playtest/brockBuilds.mjs <url> <dir> --port=<cdp port>` for the Mast,
and `node tools/playtest/workshopBill.mjs <url> <dir> --port=<cdp port>` for
building, moving back and ESC. Both assert what they show. The night tint is the
real clock at the time.
