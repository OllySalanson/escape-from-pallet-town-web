// Harvests the 151's **generation III** abilities from PokeAPI into
// `frlg-abilities.json`, which is committed so the answer is reproducible and
// offline.
//
//   node tools/abilities/harvest.mjs > tools/abilities/frlg-abilities.json
//
// Three generation III traps, exactly in the spirit of `tools/moves/README.md`:
//
//  - **A hidden ability is generation V.** Slot 3 never existed in FireRed, so
//    `is_hidden` is dropped outright rather than trusted.
//  - **`past_abilities` names the value *through* that generation**, which is
//    the opposite reading to `past_values` on a move. For each slot, take the
//    **earliest** entry whose generation is at or after generation III: Pidgey's
//    `generation-iii` entry sets slot 2 to `null` (Tangled Feet is generation
//    IV), and Gengar's `generation-vi` entry sets slot 1 to Levitate (Cursed
//    Body is generation VII).
//  - **An ability can postdate generation III with no `past_abilities` row at
//    all**, so every surviving ability is checked against its own
//    `generation` and dropped if it is later. Anything that leaves a species
//    with no ability is reported on stderr rather than silently shipped.
//
// `effect_changes` is carried through per ability, because an ability that
// existed in generation III does not necessarily mean in generation III what
// PokeAPI's headline `effect_entries` says it means now.
const GENERATIONS = [
  'generation-i', 'generation-ii', 'generation-iii', 'generation-iv',
  'generation-v', 'generation-vi', 'generation-vii', 'generation-viii', 'generation-ix',
];
const GEN_III = GENERATIONS.indexOf('generation-iii');
const generationIndex = (name) => GENERATIONS.indexOf(name);

const get = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response.json();
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

const abilityCache = new Map();
const ability = async (name) => {
  if (!abilityCache.has(name)) {
    abilityCache.set(name, await get(`https://pokeapi.co/api/v2/ability/${name}`));
  }
  return abilityCache.get(name);
};

const english = (entries, key) =>
  entries.find((entry) => entry.language.name === 'en')?.[key]?.replace(/\s+/g, ' ').trim() ?? '';

const species = [];
for (let dexId = 1; dexId <= 151; dexId += 1) {
  const pokemon = await get(`https://pokeapi.co/api/v2/pokemon/${dexId}`);

  // Slot by slot, newest-first overrides applied oldest-first.
  const slots = new Map();
  for (const entry of pokemon.abilities) {
    if (entry.is_hidden || entry.slot > 2) continue;
    slots.set(entry.slot, entry.ability?.name ?? null);
  }
  const past = [...pokemon.past_abilities]
    .filter((entry) => generationIndex(entry.generation.name) >= GEN_III)
    .sort((left, right) => generationIndex(left.generation.name) - generationIndex(right.generation.name));
  const overridden = new Set();
  for (const entry of past) {
    for (const row of entry.abilities) {
      if (row.slot > 2 || overridden.has(row.slot)) continue;
      overridden.add(row.slot);
      slots.set(row.slot, row.ability?.name ?? null);
    }
  }

  const names = [];
  for (const [, name] of [...slots].sort(([left], [right]) => left - right)) {
    if (!name) continue;
    const record = await ability(name);
    if (generationIndex(record.generation.name) > GEN_III) {
      process.stderr.write(`dropped ${name} from ${pokemon.name}: introduced in ${record.generation.name}\n`);
      continue;
    }
    names.push(name);
  }
  if (names.length === 0) {
    process.stderr.write(`!! ${pokemon.name} has no generation III ability\n`);
  }
  species.push({ dexId, name: pokemon.name, abilities: names });
  process.stderr.write(`${dexId} ${pokemon.name}: ${names.join(', ')}\n`);
}

const learners = new Map();
for (const row of species) {
  for (const name of row.abilities) learners.set(name, (learners.get(name) ?? 0) + 1);
}

const abilities = [...learners.keys()].sort().map((name) => {
  const record = abilityCache.get(name);
  return {
    name,
    carriers: learners.get(name),
    generation: record.generation.name,
    effect: english(record.effect_entries, 'short_effect'),
    // What the ability meant *then*. PokeAPI records a change against the
    // version group the *old* behaviour was last correct in, so an entry here is
    // read as "up to and including this, the ability did that" - which is how
    // Sturdy is known to block only one-hit KO moves in FireRed, Stench and
    // Pickup to do nothing in a battle at all, and Shed Skin to cure at 1/3
    // rather than the 30% PokeAPI's headline gives.
    pastEffects: record.effect_changes.map((change) => ({
      versionGroup: change.version_group.name,
      effect: english(change.effect_entries, 'effect'),
    })),
  };
});

process.stdout.write(`${JSON.stringify({ species, abilities }, null, 1)}\n`);
