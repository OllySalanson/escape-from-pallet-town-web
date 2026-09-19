// Harvests the level-up moves of Kanto's original 151 from PokeAPI into
// `frlg-level-up-moves.json`, the snapshot `coverage.mjs` and the species
// generator both read.
//
//   node tools/moves/harvest.mjs > tools/moves/frlg-level-up-moves.json
//
// The file was harvested by hand when the move data model was built and the
// script was not kept; this reproduces it row for row and adds the one field
// the import needs, `displayName`, so a move can be named the way its own dex
// entry names it rather than by title-casing its identifier ("Double-Edge",
// "Sonic Boom", "Vice Grip").
//
// The three generation III traps `README.md` names, handled here:
//
//  - **`past_values` describe the value *before* the change**, and they are
//    keyed by version group rather than generation. For each field take the
//    earliest entry **strictly later than generation III** that names it.
//    Getting this wrong reads Vine Whip as 45 power; it is 35 in FireRed.
//  - **Physical against special is decided by the move's *type*** in generation
//    III, not per move: 38 of the 273 disagree with PokeAPI's generation IV
//    `damage_class`. A status move is still a status move, and so is anything
//    with no power of its own - a fixed-damage move like Sonic Boom has no
//    power field to be split by.
//  - **`past_types`** gives generation III typing where a move changed type
//    later.
import { readFileSync } from 'node:fs';

const PHYSICAL_TYPES = new Set([
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
]);
const GENERATIONS = [
  'generation-i', 'generation-ii', 'generation-iii', 'generation-iv',
  'generation-v', 'generation-vi', 'generation-vii', 'generation-viii', 'generation-ix',
];
const GEN_III = GENERATIONS.indexOf('generation-iii');

const get = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response.json();
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

// Version groups in release order, each with the generation it belongs to, so
// "strictly later than generation III" can be asked of a `past_values` row.
// Colosseum and XD are generation III side games and sort after FireRed.
const versionGroups = new Map();
{
  const index = await get('https://pokeapi.co/api/v2/version-group?limit=100');
  const records = await Promise.all(index.results.map((entry) => get(entry.url)));
  for (const record of records) {
    versionGroups.set(record.name, {
      order: record.order,
      generation: GENERATIONS.indexOf(record.generation.name),
    });
  }
}
const laterThanGenerationIII = (versionGroup) => {
  const record = versionGroups.get(versionGroup);
  if (!record) throw new Error(`unknown version group ${versionGroup}`);
  return record.generation > GEN_III;
};

// Which moves, and how many species each one reaches, is read off the species
// snapshot rather than asked of PokeAPI again: the two are then the same list
// by construction. The union is the 273 this file has always held.
const learners = new Map();
{
  const species = JSON.parse(
    readFileSync(new URL('../species/frlg-species.json', import.meta.url), 'utf8'),
  );
  for (const row of species.species) {
    for (const move of new Set(row.learnset.map((entry) => entry.move))) {
      learners.set(move, (learners.get(move) ?? 0) + 1);
    }
  }
}

const rows = [];
for (const name of [...learners.keys()].sort()) {
  const move = await get(`https://pokeapi.co/api/v2/move/${name}`);

  // Every `past_values` row later than generation III, oldest first: the first
  // one that names a field is what that field was in FireRed.
  const past = move.past_values
    .filter((entry) => laterThanGenerationIII(entry.version_group.name))
    .sort(
      (left, right) =>
        versionGroups.get(left.version_group.name).order -
        versionGroups.get(right.version_group.name).order,
    );
  const before = (field, current) => {
    for (const entry of past) {
      if (entry[field] !== null && entry[field] !== undefined) return entry[field];
    }
    return current;
  };

  const type = past.find((entry) => entry.type)?.type?.name ?? move.type.name;
  const power = before('power', move.power);
  const damageClass = move.damage_class.name;
  rows.push({
    name,
    displayName: move.names.find((entry) => entry.language.name === 'en')?.name ?? name,
    learners: learners.get(name),
    type,
    power,
    accuracy: before('accuracy', move.accuracy),
    pp: before('pp', move.pp),
    category:
      damageClass === 'status' || power === null
        ? 'Status'
        : PHYSICAL_TYPES.has(type)
          ? 'Physical'
          : 'Special',
    damage_class: damageClass,
    priority: move.priority,
    target: move.target.name,
    meta: move.meta.category.name,
    ailment: move.meta.ailment.name,
    ailment_chance: move.meta.ailment_chance,
    flinch_chance: move.meta.flinch_chance,
    stat_chance: move.meta.stat_chance,
    crit_rate: move.meta.crit_rate,
    drain: move.meta.drain,
    healing: move.meta.healing,
    min_hits: move.meta.min_hits,
    max_hits: move.meta.max_hits,
    effect_chance: before('effect_chance', move.effect_chance),
    stat_changes: move.stat_changes.map((entry) => ({ stat: entry.stat.name, change: entry.change })),
  });
  process.stderr.write(`${name}\n`);
}

process.stdout.write(`${JSON.stringify(rows, null, 1)}\n`);
