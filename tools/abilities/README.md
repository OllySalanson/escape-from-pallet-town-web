# What the engine can say about an ability

```bash
node tools/abilities/coverage.mjs                # the headline
node tools/abilities/coverage.mjs --list=weather # which abilities, and why
npx vite-node tools/abilities/measure.mts        # what a change to them moved
```

The 151 carry **55 distinct abilities** over 205 ability slots in
FireRed/LeafGreen. `coverage.mjs` walks that list and asks of each whether an
`AbilityBase` could be written for it that `resolveTurn` would play correctly -
not whether the ability is authored yet. It is the number an ability-engine
change is measured in, and it is where the PR that built the model got its
figures. The hook table in it is the contract: it is what
`src/game/pokemon/AbilityBase.ts` declares and `battle/abilityHooks.ts` reads,
and nothing else, so a row moves out of `missing` only when the engine grew.

`frlg-abilities.json` is a cached PokeAPI snapshot, committed so the answer is
reproducible and offline and so a future audit has something to diff against.
Three generation III traps were handled when it was harvested, and any
re-harvest must handle them again:

- **A hidden ability is generation V.** Slot 3 did not exist in FireRed, so
  `is_hidden` is dropped outright rather than trusted.
- **`past_abilities` reads *forwards*, not backwards** - the opposite of
  `past_values` on a move. An entry names the value that was right **through**
  that generation, so for each slot take the **earliest** entry at or after
  generation III. Pidgey's `generation-iii` entry sets slot 2 to `null` (Tangled
  Feet is generation IV); Gengar's `generation-vi` entry sets slot 1 to Levitate
  (Cursed Body is generation VII). Getting this backwards gives Pidgey an
  ability it will not have for two more games.
- **An ability can postdate generation III with no `past_abilities` row**, so
  every surviving ability is checked against its own `generation` too.

`effect_changes` is carried through per ability for the same reason, because an
ability that existed in generation III did not necessarily *mean* then what
PokeAPI's headline says it means now. Four of those matter: **Sturdy** blocked
only one-hit KO moves, **Stench** and **Pickup** did nothing at all in a battle,
**Shed Skin** shed at 1/3 rather than 30%, and **Guts** did not fire while
asleep.

`frlg-move-flags.json` is the contact, sound, bite and punch flags of the 36
moves this game ships, harvested by `harvest-move-flags.mjs`. The REST API does
not serve move flags - `/move/{name}` has no `flags` field - so that script
reads PokeAPI's own source tables instead. `abilityCanon.test.ts` holds both
snapshots against the game.

`measure.mts` prints the two things abilities move: every district's wild table
against each starter, and every hunter rung against a party at the rung's level
plus one. Run it before and after a change to abilities and diff the output -
that is where the numbers in the ability PR came from, and it is how a Static
that took the Floodplain's hardest grass under its own floor was caught.
