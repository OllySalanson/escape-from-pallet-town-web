# THE BATTLE ARENA, after the critic tour

The harbour critic tour of 26 Nov 2026 scored THE BATTLE ARENA 5/10: "Good
idea, honest bouts." Then it found a room of regulars reading out team lists,
a four-box welcome, two rental "pairs" that undo themselves, and a rental line
that said "today has paid" after a run that paid nothing.

`before/` is the critic's own pictures, on `main` at `4391c17e`. `after/` is
this change, played with `tools/playtest/ai-player/act` on a test-mode build,
on the critic's new-player save. Test mode draws with the cheap renderer.

| What | Before | After |
|---|---|---|
| A regular speaks in their own voice, then names their team; HIDEKI says "3 straight wins, kid. Then we talk." | `before/1-room.png` (every one "X trains here: ...") | `after/1-regular-voice.png` |
| The counter says "Today's first run pays" / "Practice now: only today's first run pays", "Up to 3 a side", and "No bag · nothing lost" over a cup that may be Lv 15 | `before/2-today-has-paid.png` | `after/2-counter.png` |
| Today's pair is a real combo: GASTLY's sleep with CUBONE's bone, POLIWHIRL's Hypnosis with GASTLY's Dream Eater | `before/3-rental-pair.png` | held by `rentals.test.ts` |
| After a win the cursor starts on a regular who still counts towards the run | `before/4-in-run-cursor.png` | held by the counter's markup |

The receptionist's welcome is two boxes (seen in play), and a win's tickets say
they are for the PRIZE WINDOW.
