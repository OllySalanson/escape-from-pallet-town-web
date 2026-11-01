# THE RAID ARENA, walked on one key

The captain, 1 Nov 2026: "I have to zigzag with the arrow keys the whole way ... and I keep getting stuck behind things, and I don't feel like the two tables are very obvious."

The two tables are the bench and the armoury rack: the two things a player has to find to get going (with the locker beside the rack, which reads the same).

Counted by `tools/playtest/arenaFlow.mjs`, which walks the real scene by arrow keys on a new save and a veteran one (they count the same). A person holds the key that takes them nearer until something stops them or they have gone far enough. Numbers are from the door there, then back.

| To | Before: keys, stops, tiles | After: keys, stops, tiles |
|---|---|---|
| Bench | 3, 1, 10 / 2, 0, 10 | 1, 0, 8 / 2, 0, 8 |
| Rack | 3, 1, 9 / 2, 0, 9 | 1, 0, 7 / 2, 0, 7 |
| Locker | 3, 1, 12 / 2, 0, 12 | 1, 0, 10 / 2, 0, 10 |
| West telescope | 7, 3, 55 / 8, 2, 57 | 2, 0, 14 / 2, 0, 14 |
| East telescope | 7, 3, 55 / 8, 2, 57 | 2, 0, 14 / 2, 0, 14 |
| Rail in front of the door | 1, 0, 6 / 1, 0, 6 | 1, 0, 6 / 1, 0, 6 |

Every lap of the hall is now four held keys, one a side. Before, the far side took a change of key at every stair of the oval, and the walk to the bench or the rack went behind a pillar.

- `before-from-the-door.png`, `after-from-the-door.png`: the first screen of the hall.
- `before-at-the-telescope.png`, `after-at-the-telescope.png`: a telescope.
- `after-at-the-bench.png`: standing on the runner's arm in front of the bench.
- `after-round-the-curve.png`: one key held round the south-west of the hall.
