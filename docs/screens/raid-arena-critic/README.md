# THE RAID ARENA, after the critic tour

The harbour critic tour of 26 Nov 2026 scored THE RAID ARENA 5/10: "A knockout
building. The locker says NOTHING HERE with its cursor on a Diglett." And of
the door: "the Gym Guide talks for 17."

`before/` is the critic's own pictures, on `main` at `4391c17e`. `after/` is
this change, played with `tools/playtest/ai-player/act` on a test-mode build,
on the critic's mid-game save. Test mode draws with the cheap renderer.

| What | Before | After |
|---|---|---|
| The Gym Guide says one line for the day's job, and only a job that fits one raid, then the gym (4 boxes on a repeat talk, from 10 to 17) | `before/1-gym-guide.png` | `after/1-gym-guide.png` |
| The marshal's welcome is three lines, with the catch rule beside the pack | `before/2-marshal.png` | `after/2-marshal.png` |
| THE BENCH's caption follows the team as YOUR TEAM closes | `before/3-bench-caption-stale.png` | "THE BENCH 2 of 6 coming" (seen in play) |
| Room kept for a find shows as room, not "₽ ×250" | `before/4-rim-wipe-250.png` | held by the rim's own markup |
| The jump card's tiles are white cards, not the gold of "chosen" | `before/5-rim-gold-tiles.png` | `after/5-rim-white-tiles.png` |
