// Reads every one of the 151's level-up learnset out of FireRed itself and
// writes `frlg-learnsets.json`, which is committed and is what the generator
// orders each learnset by.
//
//   node tools/species/verifyLearnsets.mjs            # fetch, cross-check, write
//   node tools/species/verifyLearnsets.mjs --check    # fetch, cross-check, compare
//
// The order is the reason this exists. `frlg-species.json` carries PokeAPI's
// FireRed/LeafGreen learnset, which has the right moves at the right levels but
// lists the moves of one level alphabetically - Charmander's Growl before its
// Scratch, Pikachu's Growl before its Thunder Shock. A Pokemon knows its moves
// in the order it learned them (`Pokemon.initializeMoves`, FireRed's
// `GiveBoxMonInitialMoveset`), and the battle menu's cursor opens on the first,
// so a fresh Charmander opened its first fight pointing at Growl. The order is
// read straight out of the table the cartridge reads, pret/pokefirered's
// `src/data/pokemon/level_up_learnsets.h`, at the commit `verifyStats.mjs` and
// `verifyExperience.mjs` pin.
//
// The moves themselves are in that table too, and the snapshot already carries
// them: the script refuses to write if the two disagree on which move is learnt
// at which level, so a harvest that went wrong cannot slip past it.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'frlg-learnsets.json');
const SNAPSHOT = JSON.parse(readFileSync(join(HERE, 'frlg-species.json'), 'utf8'));

const PRET_COMMIT = 'c75f352304d529f6ba92d4f74b9cf8b5c3810788';
const PRET = `https://raw.githubusercontent.com/pret/pokefirered/${PRET_COMMIT}/src/data/pokemon`;
const LEARNSETS_URL = `${PRET}/level_up_learnsets.h`;
const POINTERS_URL = `${PRET}/level_up_learnset_pointers.h`;

/** FireRed's constant for a move PokeAPI names differently today. */
const RENAMED = {
  FAINT_ATTACK: 'feint-attack',
  HI_JUMP_KICK: 'high-jump-kick',
  SMELLING_SALT: 'smelling-salts',
};

const fetchText = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': 'escape-from-pallet-town learnset audit' } });
    if (response.ok) return response.text();
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

/** `SOFT_BOILED` and `soft-boiled` alike, so a hyphen is never a disagreement. */
const plain = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const [learnsets, pointers] = await Promise.all([fetchText(LEARNSETS_URL), fetchText(POINTERS_URL)]);

const tables = new Map();
for (const table of learnsets.matchAll(/static const u16 (s\w+LevelUpLearnset)\[\] = \{([\s\S]*?)\};/g)) {
  tables.set(
    table[1],
    [...table[2].matchAll(/LEVEL_UP_MOVE\(\s*(\d+),\s*MOVE_([A-Z0-9_]+)\)/g)].map((entry) => ({
      level: Number(entry[1]),
      move: entry[2],
    })),
  );
}
// Species order is national order for the 151, after SPECIES_NONE.
const bySpecies = [...pointers.matchAll(/\[SPECIES_(\w+)\] = (s\w+LevelUpLearnset)/g)]
  .filter((entry) => entry[1] !== 'NONE')
  .slice(0, SNAPSHOT.species.length)
  .map((entry) => tables.get(entry[2]));

const problems = [];
const species = SNAPSHOT.species.map((row, index) => {
  const cartridge = bySpecies[index];
  if (!cartridge) {
    problems.push(`${row.name}: no learnset in level_up_learnsets.h`);
    return null;
  }
  const known = new Map(row.learnset.map((entry) => [plain(entry.move), entry.move]));
  const seen = new Set();
  const learnset = [];
  for (const { level, move } of cartridge) {
    const name = known.get(plain(move)) ?? known.get(plain(RENAMED[move] ?? ''));
    if (!name) {
      problems.push(`${row.name}: FireRed teaches ${move} at ${level}, the snapshot never does`);
      continue;
    }
    const key = `${level}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    learnset.push({ level, move: name });
  }
  const asWritten = (list) => list.map((entry) => `${entry.level}:${entry.move}`).sort().join(',');
  if (asWritten(learnset) !== asWritten(row.learnset)) {
    problems.push(`${row.name}: FireRed teaches ${asWritten(learnset)}, the snapshot ${asWritten(row.learnset)}`);
  }
  return { name: row.name, learnset };
});
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const table = {
  ruling:
    "Generation III FireRed/LeafGreen level-up learnsets for the original 151, in the order FireRed's own table teaches them. The moves and levels agree with frlg-species.json; the order of the moves learnt at one level replaces PokeAPI's alphabetical one.",
  source: { pokefirered: { url: LEARNSETS_URL, note: 'the FireRed disassembly - the table the cartridge reads' } },
  species,
};
const written = `${JSON.stringify(table, null, 1)}\n`;
if (process.argv.includes('--check')) {
  const committed = readFileSync(OUT, 'utf8');
  if (committed !== written) {
    console.error('frlg-learnsets.json does not match FireRed; re-run without --check');
    process.exit(1);
  }
  console.log('frlg-learnsets.json matches FireRed for all 151.');
} else {
  writeFileSync(OUT, written);
  const reordered = species.filter(
    (row, index) => row.learnset.map((entry) => entry.move).join() !== SNAPSHOT.species[index].learnset.map((entry) => entry.move).join(),
  );
  console.log(`wrote ${OUT}: 151 species, ${reordered.length} listed in an order PokeAPI does not use`);
}
