// Reads every one of the 151's experience yield, growth rate and catch rate out
// of FireRed itself and writes `frlg-experience.json`, which is committed and
// is what the game's experience is pinned to.
//
//   node tools/species/verifyExperience.mjs            # fetch, cross-check, write
//   node tools/species/verifyExperience.mjs --check    # fetch, cross-check, compare
//
// The yield is the reason this exists. `frlg-species.json` carries PokeAPI's
// `base_experience`, which is the *modern* yield - generation V re-tabulated
// them and PokeAPI serves no historical value - and experience in this game is
// FireRed's (the owner's ruling, 2026-10-06: "use FireRed for all of them"). So
// the yield is read straight out of the table the cartridge reads,
// pret/pokefirered's `src/data/pokemon/species_info.h`, at the same pinned
// commit `verifyStats.mjs` reads the base stats from.
//
// The growth rate and the catch rate are in that table too, and the snapshot
// already carries both: they are read again here and the script refuses to
// write if the two disagree, so a harvest that went wrong cannot slip a modern
// value past the experience curve or the capture formula.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'frlg-experience.json');
const SNAPSHOT = JSON.parse(readFileSync(join(HERE, 'frlg-species.json'), 'utf8'));

const PRET_COMMIT = 'c75f352304d529f6ba92d4f74b9cf8b5c3810788';
const PRET_URL = `https://raw.githubusercontent.com/pret/pokefirered/${PRET_COMMIT}/src/data/pokemon/species_info.h`;

/** FireRed's `GROWTH_*` constants, by the name PokeAPI gives the same curve. */
const GROWTH = {
  GROWTH_MEDIUM_FAST: 'medium',
  GROWTH_ERRATIC: 'slow-then-very-fast',
  GROWTH_FLUCTUATING: 'fast-then-very-slow',
  GROWTH_MEDIUM_SLOW: 'medium-slow',
  GROWTH_FAST: 'fast',
  GROWTH_SLOW: 'slow',
};

const fetchText = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': 'escape-from-pallet-town experience audit' } });
    if (response.ok) return response.text();
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

/** `nidoran-f` -> `SPECIES_NIDORAN_F`, `mr-mime` -> `SPECIES_MR_MIME`. */
const constantOf = (name) => `SPECIES_${name.toUpperCase().replace(/-/g, '_')}`;

const pret = await fetchText(PRET_URL);
const problems = [];
const species = SNAPSHOT.species.map((row) => {
  const entry = pret.match(new RegExp(`\\[${constantOf(row.name)}\\]\\s*=\\s*\\{([\\s\\S]*?)\\n    \\}`));
  if (!entry) {
    problems.push(`${row.name}: no ${constantOf(row.name)} in species_info.h`);
    return null;
  }
  const field = (name) => entry[1].match(new RegExp(`\\.${name} = ([A-Z_0-9]+)`))?.[1];
  const expYield = Number(field('expYield'));
  const catchRate = Number(field('catchRate'));
  const growthRate = GROWTH[field('growthRate')];
  if (!Number.isInteger(expYield) || expYield <= 0) problems.push(`${row.name}: no expYield`);
  if (catchRate !== row.catchRate) problems.push(`${row.name}: catch rate ${row.catchRate} in the snapshot, ${catchRate} in FireRed`);
  if (growthRate !== row.growthRate) problems.push(`${row.name}: growth ${row.growthRate} in the snapshot, ${growthRate} in FireRed`);
  return { name: row.name, expYield, growthRate, catchRate };
});
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const table = {
  ruling:
    "Generation III FireRed/LeafGreen experience yield, growth rate and catch rate for the original 151, read from FireRed's own species table. The growth and catch rates agree with frlg-species.json; the yield replaces PokeAPI's modern base_experience.",
  source: { pokefirered: { url: PRET_URL, note: 'the FireRed disassembly - the table the cartridge reads' } },
  species,
};
const written = `${JSON.stringify(table, null, 1)}\n`;
if (process.argv.includes('--check')) {
  const committed = readFileSync(OUT, 'utf8');
  if (committed !== written) {
    console.error('frlg-experience.json does not match FireRed; re-run without --check');
    process.exit(1);
  }
  console.log('frlg-experience.json matches FireRed for all 151.');
} else {
  writeFileSync(OUT, written);
  const changed = species.filter((row, index) => row.expYield !== SNAPSHOT.species[index].baseExperience);
  console.log(`wrote ${OUT}: 151 species, ${changed.length} yields differ from PokeAPI's modern base_experience`);
}
