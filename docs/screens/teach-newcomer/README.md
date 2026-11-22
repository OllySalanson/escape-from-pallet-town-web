# Teaching a newcomer in the moment: the first raid's briefing and the type chart

Two of the four lessons from release plan item 4. The other two are already on `main`: the Potion
hint (#681) and "wear its HP down first" after a ball breaks (#682).

- `first-raid-briefing.png`: a new save's first raid now lands on two short boxes. It used to land
  on none, because the first raid carries no job and only a job's briefing was ever said. The
  second box is "Get out and you keep it all. Faint, or run out of time, and the pack is lost. And
  keep moving: a hunter is coming."
- `type-lesson.png`: the fight's first hit that types changed is followed by one line naming them:
  `FIRE beats GRASS!` after "It's super effective!", "FIRE does little to WATER." after "not very
  effective", and "NORMAL can't touch GHOST." after "It doesn't affect". It is said once a fight.

Both come from a test-mode build (`?testmode=pixels`, 1200x768), 22 Nov 2026:
- the briefing is a fresh save deployed by `tools/playtest/deploy.mjs` with no options, which is the
  first raid, on MILLBROOK, with SPACE pressed once to finish typing the line;
- the type line is the battle scene started over that raid against a wild Lv 5 Bulbasaur, with the
  scene's Lv 10 Charmander choosing EMBER.
