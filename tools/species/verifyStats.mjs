// Verifies every one of the 151's base stats and types against three
// independent sources and writes the answer to `frlg-base-stats.json`, which is
// committed and is what the game's stats are pinned to.
//
//   node tools/species/verifyStats.mjs            # fetch, cross-check, write
//   node tools/species/verifyStats.mjs --check    # fetch, cross-check, compare
//
// The captain's ruling (2026-09-23) is that no stat is written from memory. So
// nothing here is: every number in the table is one that all three sources
// print, and the script refuses to write a row they disagree on.
//
//  - **pret/pokefirered**, `src/data/pokemon/species_info.h`, at a pinned
//    commit. This is the disassembly of FireRed itself - the table the
//    cartridge reads - so it is the primary source and the one a disagreement
//    would be settled by. Pinned so the answer cannot drift under us.
//  - **Bulbapedia**, "List of Pokemon by base stats in Generations II-V", at a
//    pinned revision: the reference the captain would reach for, and written
//    independently of the ROM tables.
//  - **PokeAPI**, `/pokemon/{id}`: the modern `stats` read *through*
//    `past_stats`, which reads forwards exactly as `past_types` does - an entry
//    names the value that was right **through** that generation, so the
//    earliest entry at or after generation III wins. A generation I entry names
//    `special`, a stat generation III split in two, and is never applied.
//
// Types are checked against pret and PokeAPI's `past_types`; Bulbapedia's
// table carries no typing.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'frlg-base-stats.json');

const PRET_COMMIT = 'c75f352304d529f6ba92d4f74b9cf8b5c3810788';
const PRET_URL = `https://raw.githubusercontent.com/pret/pokefirered/${PRET_COMMIT}/src/data/pokemon/species_info.h`;
const BULBAPEDIA_REVISION = 4487482;
const BULBAPEDIA_URL = `https://bulbapedia.bulbagarden.net/w/index.php?oldid=${BULBAPEDIA_REVISION}&action=raw`;
const POKEAPI = 'https://pokeapi.co/api/v2';

const STATS = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'];
const POKEAPI_STAT = {
  hp: 'hp', attack: 'attack', defense: 'defense',
  'special-attack': 'spAttack', 'special-defense': 'spDefense', speed: 'speed',
};
const GENERATIONS = [
  'generation-i', 'generation-ii', 'generation-iii', 'generation-iv',
  'generation-v', 'generation-vi', 'generation-vii', 'generation-viii', 'generation-ix',
];
const GEN_III = GENERATIONS.indexOf('generation-iii');
const generationIndex = (name) => GENERATIONS.indexOf(name);

const text = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': 'escape-from-pallet-town stat audit' } });
    if (response.ok) return response.text();
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};
const json = async (url) => JSON.parse(await text(url));

/** The first 151 entries of `gSpeciesInfo`, in dex order. */
const readPret = (source) => {
  const rows = [];
  // Each entry runs to the next one: some carry preprocessor lines inside
  // their braces, so matching a closing brace is not safe.
  const entry = /\[SPECIES_(\w+)\]\s*=([\s\S]*?)(?=\n    \[SPECIES_|$)/g;
  for (const match of source.matchAll(entry)) {
    if (match[1] === 'NONE') continue;
    const field = (name) => {
      const found = new RegExp(`\\.${name}\\s*=\\s*(\\d+)`).exec(match[2]);
      if (!found) throw new Error(`pret: SPECIES_${match[1]} has no ${name}`);
      return Number(found[1]);
    };
    const types = /\.types\s*=\s*\{TYPE_(\w+),\s*TYPE_(\w+)\}/.exec(match[2]);
    rows.push({
      constant: match[1],
      stats: {
        hp: field('baseHP'), attack: field('baseAttack'), defense: field('baseDefense'),
        spAttack: field('baseSpAttack'), spDefense: field('baseSpDefense'), speed: field('baseSpeed'),
      },
      // A single-typed species is written with its type twice.
      types: [...new Set([types[1], types[2]])].map((type) => type.toLowerCase()),
    });
    if (rows.length === 151) break;
  }
  return rows;
};

/** Every `{{lop/base|game=3|...}}` row, keyed by dex number. */
const readBulbapedia = (source) => {
  const rows = new Map();
  for (const match of source.matchAll(/\{\{lop\/base\|game=3\|(\d{3})\|([^|]+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\|(\d+)\}\}/g)) {
    const dexId = Number(match[1]);
    if (dexId > 151) continue;
    const values = match.slice(3, 9).map(Number);
    rows.set(dexId, { name: match[2], stats: Object.fromEntries(STATS.map((stat, index) => [stat, values[index]])) });
  }
  return rows;
};

/** A PokeAPI record's stats and typing as generation III had them. */
const readPokeApi = (pokemon) => {
  const stats = Object.fromEntries(pokemon.stats.map((entry) => [POKEAPI_STAT[entry.stat.name], entry.base_stat]));
  // Forwards: an entry is what was true through its generation, so for each
  // stat the earliest entry at or after generation III is generation III's.
  const past = [...(pokemon.past_stats ?? [])]
    .filter((entry) => generationIndex(entry.generation.name) >= GEN_III)
    .sort((left, right) => generationIndex(right.generation.name) - generationIndex(left.generation.name));
  for (const entry of past) {
    for (const stat of entry.stats) {
      const name = POKEAPI_STAT[stat.stat.name];
      if (name) stats[name] = stat.base_stat;
    }
  }
  const pastTypes = [...pokemon.past_types]
    .filter((entry) => generationIndex(entry.generation.name) >= GEN_III)
    .sort((left, right) => generationIndex(left.generation.name) - generationIndex(right.generation.name))[0];
  const types = [...(pastTypes ? pastTypes.types : pokemon.types)]
    .sort((left, right) => left.slot - right.slot)
    .map((entry) => entry.type.name);
  return { name: pokemon.name, stats, types, modern: Object.fromEntries(pokemon.stats.map((entry) => [POKEAPI_STAT[entry.stat.name], entry.base_stat])) };
};

const same = (left, right) => STATS.every((stat) => left[stat] === right[stat]);

const pret = readPret(await text(PRET_URL));
const bulbapedia = readBulbapedia(await text(BULBAPEDIA_URL));
if (pret.length !== 151) throw new Error(`pret: read ${pret.length} species, not 151`);
if (bulbapedia.size !== 151) throw new Error(`Bulbapedia: read ${bulbapedia.size} species, not 151`);

const species = [];
const disagreements = [];
for (let dexId = 1; dexId <= 151; dexId += 1) {
  const api = readPokeApi(await json(`${POKEAPI}/pokemon/${dexId}`));
  const rom = pret[dexId - 1];
  const wiki = bulbapedia.get(dexId);
  if (!same(rom.stats, wiki.stats)) disagreements.push(`${api.name}: pret ${JSON.stringify(rom.stats)} / Bulbapedia ${JSON.stringify(wiki.stats)}`);
  if (!same(rom.stats, api.stats)) disagreements.push(`${api.name}: pret ${JSON.stringify(rom.stats)} / PokeAPI ${JSON.stringify(api.stats)}`);
  if (rom.types.join('/') !== api.types.join('/')) disagreements.push(`${api.name}: pret ${rom.types} / PokeAPI ${api.types}`);
  const raised = STATS.filter((stat) => api.modern[stat] !== rom.stats[stat]);
  species.push({
    dexId,
    name: api.name,
    pret: rom.constant,
    types: rom.types,
    stats: rom.stats,
    // What a later generation changed, so a reader can see why the modern
    // number on a fan site is not the one this game fields.
    ...(raised.length > 0 ? { laterGenerations: Object.fromEntries(raised.map((stat) => [stat, api.modern[stat]])) } : {}),
  });
  process.stderr.write(`${dexId} ${api.name}${raised.length ? ` (raised later: ${raised.join(', ')})` : ''}\n`);
}

if (disagreements.length > 0) {
  process.stderr.write(`\nThe sources disagree - nothing written:\n${disagreements.join('\n')}\n`);
  process.exit(1);
}

const contents = `${JSON.stringify(
  {
    ruling: 'Generation III FireRed/LeafGreen base stats and types for the original 151. Every row is printed identically by all three sources below; verifyStats.mjs refuses to write a row they disagree on.',
    sources: {
      pokefirered: { url: PRET_URL, note: 'the FireRed disassembly - the table the cartridge reads' },
      bulbapedia: { url: BULBAPEDIA_URL, note: 'List of Pokemon by base stats in Generations II-V (stats only)' },
      pokeapi: { url: `${POKEAPI}/pokemon/{id}`, note: 'stats read through past_stats, types through past_types' },
    },
    species,
  },
  null,
  1,
)}\n`;

if (process.argv.includes('--check')) {
  const committed = readFileSync(OUT, 'utf8');
  if (committed !== contents) {
    process.stderr.write('frlg-base-stats.json is not what the three sources say today\n');
    process.exit(1);
  }
  process.stderr.write('frlg-base-stats.json agrees with all three sources\n');
} else {
  writeFileSync(OUT, contents);
  process.stderr.write(`wrote ${OUT}\n`);
}
