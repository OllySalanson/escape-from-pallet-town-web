# What the engine can say about a move

```bash
node tools/moves/coverage.mjs                 # the headline
node tools/moves/coverage.mjs --list=bespoke  # which moves, and why
```

The 151 learn **273 distinct moves by level** in FireRed/LeafGreen. `coverage.mjs`
walks that list and asks of each whether a `MoveBase` could be written for it
that `resolveTurn` would play correctly - not whether the move is authored yet.
It is the number a move-engine change is measured in, and it is where the PR
that grew the data model got its figures.

`frlg-level-up-moves.json` is a cached PokeAPI snapshot, committed so the answer
is reproducible and offline, and so a future audit has something to diff
against. Three generation III traps were handled when it was harvested, and any
re-harvest must handle them again:

- **`past_values` describe the value *before* the change**, so for each field
  take the earliest entry strictly later than generation III that names it.
  Getting this wrong reads Vine Whip as 45 power; it is 35 in FRLG.
- **Physical against special is decided by the move's *type*** in generation
  III, not per move. PokeAPI's `damage_class` is the generation IV split and
  **38 of the 273 disagree** - Bite, Crunch, Fire Punch, Crabhammer and Feint
  Attack are Special here; Acid, Air Cutter and Ancient Power are Physical. A
  generator that trusts `damage_class` gets 38 moves wrong in a way no test
  catches.
- **`past_types`** gives generation III typing (Clefairy is Normal, not
  Normal/Fairy; Magnemite is Electric/Steel).

- **`target` has no `past_values` at all**, so a move's generation III target has
  to be checked by hand. The five shipped moves that carry `all-opponents` -
  Growl, Tail Whip, Razor Leaf, Heat Wave and Bubble - were each checked against
  generation III, where all five were already all-adjacent-foes. It is the field
  `MoveTarget.BothFoes` is read from; see `moves.ts`.

PokeAPI flags charge and recharge moves **not at all**, and `min_turns`/
`max_turns` is usually the *ailment's* duration rather than the move's, so Dig
and Hyper Beam are named by hand in the script or they read as plain damage.

The capability list in `classify()` is the contract: it is what `MoveBase`
declares and `battleEngine.ts` reads, and nothing else, so a move leaves
`missing` only when the engine really grew.
