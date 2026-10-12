# Leech Seed

The captain ruled on 2026-10-11 that every learnset matches FireRed exactly, so a
Bulbasaur learns Leech Seed at 7 and Vine Whip at 10, as it does in FireRed. Leech
Seed is now playable (`MoveEffects.seed`). It follows FireRed's own rules
(pret/pokefirered at 037335f): it seeds the target, and at the end of every turn
an eighth of the seeded Pokemon's maximum HP goes to whoever stands where the
seeder stood. Grass types are immune. Every line uses FireRed's own words.

Shot at 1280x800 through `chrome-devtools-axi` on a `?testmode=pixels` dev page.
The battle was started from the page with a level-10 Bulbasaur against a wild
level-10 Pidgey:

- `move-list.png` - the move list. A status move's caption is its description
  less the opening sentence the line above already says. A description too long
  for the panel loses whole sentences from its end (`captionBySentence`). Before
  this, every generated status move's description ran off the right of the
  battle screen.
- `seeded.png` - "Wild PIDGEY was seeded!"
- `sapped.png` - the end of the turn. Both bars move on the one line: the Pidgey's
  goes down and the Bulbasaur's goes up from 16 to 19.
