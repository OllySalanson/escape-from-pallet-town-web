# THE GREAT LIBRARY, looped: fix, then a fresh critic, until it stops moving

The fresh critic of 26 Nov 2026 (`docs/screens/harbour-recritic/`) scored THE
GREAT LIBRARY 4/10. Each round since, the critic's findings were fixed and a
new critic, who had not seen the earlier reviews, played it again on a fresh
test-mode build, on the same two saves (a player just home from the free first
raid, and a mid-game player with MISTY beaten).

| Round | Score | What it found worst |
|---|---|---|
| 1 (on `main` at `7f12e5e2`) | 4 | One book in a "great" library, a house manual; the golden book an answer key |
| 2 | 5 | RAIDS wrong about the flee cost and a catch's squares; the golden book's pages bare |
| 3 | 6 | "WHEN: any raid" on nooks that wait for something; the librarian's lectern line wrong |
| 4 | 6 | A page running off the paper; unfound nooks hiding what they need |
| 5 | 6 | RAIDS missing the last stand; the crypt only open at night |
| 6 | 6 | The golden book now gives away the rumours; RAIDS's clock order |

Round 6's two clear errors are fixed in this change (RAIDS's clock and a
cushion "anywhere"), and the golden book's unfound pages now sit between
rounds 4 and 6: where, and when if it waits for a time, with what it needs and
holds left to the sign and the rumours.

The score has stopped moving at 6: each round's worst finding is fixed, and the
next round finds a smaller one, or asks for the opposite of the round before
(round 4 wanted unfound pages to say more, round 6 less). The reviews are under
`reviews/`. `before/room-one-lectern.png` is round 1's room; `after/` is round
6's: three lecterns, RAIDS's clock page, THE HARBOUR book, and the golden
book's cover with its found count.
