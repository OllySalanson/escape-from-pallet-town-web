# The way into a first raid

The captain, 1 Nov 2026: "Feels like there's too many barriers to entry. I feel like it's all jumbled. Make it really slick and smooth." And on the hall: "The benches ... just simply aren't visible enough ... two corners squared off when you come in, and they're in those corners." The rule is in `src/game/hub/firstRaid.ts`.

Counted by `tools/playtest/firstRaid.mjs`, which plays a brand new save as somebody who does not read: SPACE on anything that asks, and the key that goes where they can see they want to go. Game seconds, with a quarter of a second of reaction before each press.

| Stretch | Before | After |
|---|---|---|
| Title to the lab | 1.1s, 1 press | 1.1s, 1 press |
| Choosing a partner | 5.4s, 10 presses | 3.5s, 5 presses |
| Oak afterwards, and out of the lab | 4.0s, 12 presses, then an 8-tile walk | 2.4s, 7 presses, and he sends you out |
| The yard, to the Arena's door | 7.3s, 9 presses | 4.1s, 4 presses |
| The door | 2.7s, 1 press (50s if the trailer is watched) | 0.5s, no press |
| The door to the rail | 1.4s, 1 press | 1.8s, 1 press (three tiles more ring) |
| Looking down: the words and the card | 3.2s, 8 presses | 0.3s, 1 press |
| The jump and the landing | 4.3s, no press | 4.4s, no press |
| The raid's first box | 1.6s, 4 presses | 0.3s, no press |
| **Title to walking in the raid** | **31.0s, 46 presses** | **18.6s, 19 presses** |
| **Arena door to walking in the raid** | **13.2s, 14 presses** | **7.3s, 2 presses** |

Routes in the hall, by `tools/playtest/arenaFlow.mjs` (keys, stops, tiles, from the door there, then back):

| To | Before | After |
|---|---|---|
| Bench | 1, 0, 8 / 2, 0, 8 | 1, 0, 7 / 2, 0, 7 |
| Rack | 1, 0, 7 / 2, 0, 7 | 1, 0, 6 / 2, 0, 6 |
| Locker | 1, 0, 10 / 2, 0, 10 | 1, 0, 9 / 2, 0, 9 |
| Either telescope | 2, 0, 14 / 2, 0, 14 | 2, 0, 14 / 2, 0, 14 |
| Rail in front of the door | 1, 0, 6 / 1, 0, 6 | 1, 0, 9 / 1, 0, 9 |

The rail is the one number that went up, and it is what a wider ring means: three more tiles on the same held key.

- `before-from-the-door.png`, `after-from-the-door.png`: the first screen of the hall.
- `before-the-card.png`: what the first raid used to stop on. It has no after: a first raid goes straight over.
- `after-the-fall.png`, `before-the-fall.png`: the peak of the jump.
- `before-the-raid.png`, `after-the-raid.png`: the raid's first screen.
- `before-the-yard.png`, `after-the-yard.png`: the yard, with the chevron and without the favours.
- `after-whole-hall.png`: the hall from above, which no player sees.
