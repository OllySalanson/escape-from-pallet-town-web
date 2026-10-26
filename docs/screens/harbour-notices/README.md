# Today's notice on the harbour board

Round 14 of the badass harbour: a reason to read the board every time a raid comes home.

## What changed

- The harbour's notice board, on the quay where the boat ties up, has **today's notice** pinned on
  top of its own words: a different one each day by the player's clock
  (`src/game/base/harbourNotices.ts`), so a returning player reads what is new first.
- Every notice is something true that nobody else in the harbour says out loud: the angler's rod
  and where the good ones bite, the captain's spyglass after dark, night raids meeting different
  wildlife, the Day-Care's level every two raids and no fee, Nurse Joy charging in raid time, what a
  lost raid takes and what the secure container keeps, Bill trading for found goods and never
  money, the telly's rival forecast, the town map, Oak's Pokédex rewards from 10 kinds, the L key,
  and Brock's builds standing in the harbour.
- `harbourNotices.test.ts`: a notice stays up all day and changes at midnight, every notice comes
  round before any repeats, and each is short enough to read.

## How to use it

Read the board on the quay beside the jetty whenever you come home.
