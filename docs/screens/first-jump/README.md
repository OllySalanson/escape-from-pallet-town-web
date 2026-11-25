# The first jump asks, and a catch at base is offered

The overnight critic (25 Nov 2026, problem 5): nothing explained BENCH, RACK or LOCKER
before the first jump, and one press of SPACE threw him into the vale with no
confirmation.

- `before-at-the-rail.png` - main: one SPACE from here is the jump.
- `after-the-question.png` - the first jump asks once, naming what each station packed
  (`hub/firstRaid.ts` `firstJumpQuestion`), with the cursor on JUMP IN.
- `after-bench-reason.png`, `after-bench-question.png` - the raid after: a lone Pokémon at
  the rail with a fit one at base hears the reason once, then is asked
  (`hub/benchOffer.ts`).
- `after-the-card.png` - after YES, the rim's card: TEAM has both, and SAFE / AT RISK
  say where each one rides.

The first is from `tools/playtest/firstRaid.mjs --shots` on a test-mode build at
1200x768. The bench shots come from a scratch driver: one raid by `raid.mjs --fresh`,
a second Pokémon added to the save, then the walk to the rail (`walkIntoBase`,
`openHallPanel`). That is why the "catch" in them is a second Bulbasaur.
