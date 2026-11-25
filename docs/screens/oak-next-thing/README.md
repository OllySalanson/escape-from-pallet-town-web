# Oak says the one next thing, and favours come one at a time

The overnight critic (25 Nov 2026) came home from a first raid to four keepers who each
asked a favour, plus a job, a stake, a gym and rumours, and Oak read his whole cork board
aloud every time (problems 8 and 9). Now:

- Oak says the one next thing (`hub/nextStep.ts`), not the board: after raid 1, the job
  on the rail; after the first job, the next one; once the near jobs are banked, one line
  marking that (said once), a landing to walk to, and the next gym. If the board holds
  more than he named, he says so in one line and leaves it to the board.
- Nobody asks a favour until a job is banked, and only one favour is in hand at a time
  (`errands.ts` `mayAskAFavour`).

- `before-favour-after-raid-1.png`: main, the first visit to Oak after raid 1. His parcel
  favour is asked on top of the briefing.
- `after-the-next-thing.png`: this branch, the same visit. He names the job on the rail.

Both shots: a test-mode build at 1200x768, a fresh save, `raid.mjs --fresh` for one raid
out by the Westward Road, then the lab mat and SPACE through Oak's lines.
