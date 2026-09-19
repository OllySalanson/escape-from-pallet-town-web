# What weather costs a real fight

```bash
npx vite-node tools/weather/measure.mts                        # both halves
npx vite-node tools/weather/measure.mts -- --wild
npx vite-node tools/weather/measure.mts -- --hunter --trials=300
```

It plays the real engine, so nothing here is argued from a multiplier. Two
halves, because weather lands on two different kinds of fight.

**Lead.** The same wild fight with the honest move choice. `bestMove`, which
both shared harnesses use, scores a move by power times type effectiveness and
**cannot see the same-type bonus**, so through it a Squirtle answers a Pidgey
with Tackle - and a fight with no Water move in it is a fight rain cannot touch.
This half plays the lead's own signature move instead, and it is the one that
says what rain is worth:

| place | lead | clear | rain |
| --- | --- | --- | --- |
| THE REEDBEDS / THE FLOOD | Squirtle 9 | 100% (82% HP) | 100% (**94%**) |
| THE REEDBEDS / THE FLOOD | Charmander 9 | 100% (90% HP) | 100% (**70%**) |
| THE REEDBEDS / THE FLOOD | Bulbasaur 9 | 94% (74% HP) | 94% (74%) |
| BROOK HEAD | Squirtle 9 | 69% (57% HP) | **77%** (64%) |
| BROOK HEAD | Charmander 9 | 88% (67% HP) | **44%** (59%) |
| BROOK HEAD | Charmander 14 | 100% (84% HP) | **85%** (65%) |

Brook Head is the one place where rain decides a wild fight outright, and it is
not the player's move that does it: the waterside's Squirtles are level 7-9, so
they carry Water Gun, and rain hands it to them. Everywhere else rain is paid in
health rather than in losses - which is the currency this game keeps, since the
recovery bay charges raid time for it.

**Wild.** Every district's own table, played by each fresh starter through the
shared harness, clear and then under each weather. The headline is that a
chipping weather *helps* the player here: the chip is a sixteenth of maximum HP **with a floor of one**, and
at the levels this game is played at nothing on either side has sixteen HP to
spare, so it is a flat one HP a turn to everybody - and a flat charge favours
the bigger pool, which in a one-on-one wild fight is the starter. Rain and harsh
sunlight do *nothing at all* to a fresh party, because every typed move is gated
to level 7; they first bite in the forest, where the partner is level 8.

**Hunter.** Each rung of `HUNTER_TIERS`, met by the party that opens it, clear
and then under each weather. This is where the same flat chip reverses: the
hunter fields up to four Pokemon against three, so it pays the charge fewer
times. Measured at 300 fights a cell:

| rung | clear | sandstorm/hail | rain | harsh sun |
| --- | --- | --- | --- | --- |
| 1: Lv6 x1 | 100% (68% HP) | 100% (71%) | 100% (68%) | 100% (68%) |
| 2: Lv9 x2 | 94% (43%) | 99% (49%) | 93% (39%) | 94% (48%) |
| 3: Lv12 x3 | 98% (32%) | 98% (30%) | 94% (28%) | 99% (37%) |
| 4: Lv15 x4 | 49% (19%) | **17% (9%)** | 39% (18%) | **63% (22%)** |

That table is what decided the authoring in `districts.ts`: a place may bend
damage and may never chip HP, and of the two that bend, only rain is authored -
harsh sunlight is a fourteen-point gift on the hardest fight in the game,
because the hunter's team carries no Water and the player's Fire starter does.

The hunter half runs through `world/trainerMeasure.ts`, the same harness the
authored trainers are measured with (`tools/trainers/report.mts`), so these sit
beside those rather than beside a harness of their own. It is **harsher than the
one the rungs were originally set in** - no items, no switching before a faint,
always the best damaging move - which is why its clear column reads 49% where
`HUNTER_TIERS` records 90-100%. Read the columns against each other, not against
that note.
