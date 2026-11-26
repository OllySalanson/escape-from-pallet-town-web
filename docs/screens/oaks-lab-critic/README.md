# OAK'S LAB, after the critic tour

The harbour critic tour of 26 Nov 2026 scored OAK'S LAB 4/10. Its worst
problems were the owner's own complaints:

- "Going to raid with a friend?" came at the end of every Oak talk and every
  reading of his board.
- The board was written in the code's own words: "banked", "new stops",
  "Banks only through", "A stronger hunter".
- Oak had nothing at all to say to a player with a partner who had not raided.

`before/` is the critic's own pictures, on `main` at `4391c17e`. `before/1-*`
and `before/2-*` were taken with the shared harbour on, as a real player has it.
`after/` is this change, played with `tools/playtest/ai-player/act` on a
test-mode build, with `act start --rebuild --harbour=local --save=<file>`:
the critic's mid-game save (MISTY beaten, ten raids), and a NEW GAME. Test mode
draws with the cheap renderer, so water and grass have no tint.

| What | Before | After |
|---|---|---|
| The friend question moves to the Raid Arena's marshal, where raids start | `before/1-oak-friend-question.png`, `before/2-board-friend-question.png` | `after/1-marshal-friend-question.png`, `after/2-friend-room-from-hall.png` |
| Oak tells a player who has not raided where to go | `before/3-oak-silent-before-first-raid.png` (nothing happened) | `after/3-oak-before-first-raid.png` |
| The board says jobs in plain words: what the job is, then its terms | `before/4-board-lead.png`, `before/5-board-banks-only-through.png` | `after/4-board-lead.png`, `after/5-board-job.png`, `after/5-board-terms.png` |
| The wall map calls a boss a boss | `before/6-wallmap-card.png` | `after/6-wallmap-card.png` |
| Places with the same wild Pokémon are one row, gyms have none, and the keys line says PG DN | `before/7-wallmap-wildlife.png` | `after/7-wallmap-wildlife.png` |
| The Pokédex strip says Oak gives the reward | `before/8-pokedex-goal.png` | `after/8-pokedex-goal.png` |
| The starters say what they are good for | `before/9-starter-preview.png` | `after/9-starter-preview.png` |
