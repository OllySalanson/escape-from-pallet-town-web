// Harvests Kanto's original 151 from PokeAPI into `frlg-species.json`, which is
// committed so the answer is reproducible and offline and so a future audit has
// something to diff against.
//
//   node tools/species/harvest.mjs > tools/species/frlg-species.json
//
// What it takes, and the generation III traps each one carries. The three
// harvesters in this repo share a discipline: PokeAPI serves the *modern* game
// unless a field carries its own history, so every field below is either read
// through that history or labelled as the modern value it is.
//
//  - **Types** through `past_types`, which reads *forwards* exactly as
//    `past_abilities` does: an entry names the typing that was right **through**
//    that generation, so the earliest entry at or after generation III wins.
//    Clefairy, Jigglypuff and their evolutions are Normal here, not Fairy.
//  - **Base stats** through `past_stats`, which reads forwards the same way:
//    `/pokemon/{id}` serves generation IX's numbers, and generation VI and VII
//    raised a stat on twenty of Kanto's own. A generation I entry names
//    `special`, a stat generation III had already split, and is never applied.
//    `verifyStats.mjs` beside this holds every row against the FireRed
//    disassembly and Bulbapedia as well, and `frlg-base-stats.json` is what
//    the game is pinned to.
//  - **Base experience is the modern value** for the same reason: generation V
//    re-tabulated every yield and PokeAPI serves only the current one. Nothing
//    in this engine spends it yet - `experienceForLevel` is level-cubed - so it
//    is imported labelled rather than wired in.
//  - **Catch rate and growth rate** come from `/pokemon-species/{id}` and have
//    not changed for these species since generation I.
//  - **The learnset is the FireRed/LeafGreen version group only**, level-up
//    method only. A level of 0 in that data is "known on evolution", which this
//    writes as level 1, the same thing every other level-1 entry means here.
//  - **Evolution** from `/evolution-chain/`, every trigger carried through as
//    PokeAPI names it, including `trade`: the game has no trading, and dropping
//    the rule would break the family the cargo grid and the save loader read.
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

/** The typing that was right in generation III, read forwards through `past_types`. */
const generationIIITypes = (pokemon) => {
  const past = [...pokemon.past_types]
    .filter((entry) => generationIndex(entry.generation.name) >= GEN_III)
    .sort((left, right) => generationIndex(left.generation.name) - generationIndex(right.generation.name))[0];
  const types = past ? past.types : pokemon.types;
  return [...types].sort((left, right) => left.slot - right.slot).map((entry) => entry.type.name);
};

/** The base stats generation III had, read forwards through `past_stats`. */
const generationIIIStats = (pokemon) => {
  const stats = Object.fromEntries(pokemon.stats.map((entry) => [entry.stat.name, entry.base_stat]));
  // Latest first, so the earliest entry at or after generation III is the one
  // left standing for each stat it names.
  const past = [...(pokemon.past_stats ?? [])]
    .filter((entry) => generationIndex(entry.generation.name) >= GEN_III)
    .sort((left, right) => generationIndex(right.generation.name) - generationIndex(left.generation.name));
  for (const entry of past) {
    for (const stat of entry.stats) {
      if (stat.stat.name in stats) stats[stat.stat.name] = stat.base_stat;
    }
  }
  return stats;
};

const chainCache = new Map();
const evolutionChain = async (url) => {
  if (!chainCache.has(url)) chainCache.set(url, await get(url));
  return chainCache.get(url);
};

/** Every `from -> to` in one chain, flattened, with the trigger PokeAPI gives. */
const rulesFromChain = (node, rules = []) => {
  for (const child of node.evolves_to) {
    for (const detail of child.evolution_details) {
      rules.push({
        from: node.species.name,
        to: child.species.name,
        trigger: detail.trigger.name,
        minLevel: detail.min_level ?? null,
        item: detail.item?.name ?? null,
      });
    }
    rulesFromChain(child, rules);
  }
  return rules;
};

const species = [];
const evolutions = new Map();
for (let dexId = 1; dexId <= 151; dexId += 1) {
  const pokemon = await get(`https://pokeapi.co/api/v2/pokemon/${dexId}`);
  const record = await get(`https://pokeapi.co/api/v2/pokemon-species/${dexId}`);

  const learnset = pokemon.moves
    .flatMap((entry) =>
      entry.version_group_details
        .filter(
          (detail) =>
            detail.version_group.name === 'firered-leafgreen' &&
            detail.move_learn_method.name === 'level-up',
        )
        .map((detail) => ({ level: Math.max(1, detail.level_learned_at), move: entry.move.name })),
    )
    .sort((left, right) => left.level - right.level || left.move.localeCompare(right.move));

  const stats = generationIIIStats(pokemon);
  const chain = await evolutionChain(record.evolution_chain.url);
  for (const rule of rulesFromChain(chain.chain)) {
    // Keyed by the whole rule: a species can carry several rows for the same
    // pair - Sandshrew's Sandslash is level 22 and, since generation VII, an
    // Ice Stone for the Alolan form - and keeping only the last read Vulpix as
    // an Ice Stone line. Which of them generation III meant is the generator's
    // question, not the harvest's.
    evolutions.set(
      `${rule.from}>${rule.to}>${rule.trigger}>${rule.item ?? ''}>${rule.minLevel ?? ''}`,
      rule,
    );
  }

  species.push({
    dexId,
    name: pokemon.name,
    displayName: record.names.find((entry) => entry.language.name === 'en')?.name ?? pokemon.name,
    types: generationIIITypes(pokemon),
    // Generation III's, read through `past_stats`. See the header.
    baseStats: {
      hp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      spAttack: stats['special-attack'],
      spDefense: stats['special-defense'],
      speed: stats.speed,
    },
    catchRate: record.capture_rate,
    // Modern yield. Generation V re-tabulated every one of these.
    baseExperience: pokemon.base_experience,
    growthRate: record.growth_rate.name,
    learnset,
  });
  process.stderr.write(`${dexId} ${pokemon.name}: ${learnset.length} level-up moves\n`);
}

process.stdout.write(
  `${JSON.stringify(
    {
      source: 'https://pokeapi.co/api/v2',
      harvestedAt: new Date().toISOString().slice(0, 10),
      versionGroup: 'firered-leafgreen',
      species,
      evolutions: [...evolutions.values()],
    },
    null,
    1,
  )}\n`,
);
