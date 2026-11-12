// Turns the committed snapshot of FireRed's Pokédex into the file the game reads.
//
//   node tools/pokedex/generate.mjs            # write the file
//   node tools/pokedex/generate.mjs --check    # fail if it is out of date
//
// `frlg-pokedex.json` beside this goes in (`harvest.mjs` writes it from the
// disassembly) and `src/game/pokemon/generated/pokedexEntries.ts` comes out.
// Nothing here decides anything: the words, the sizes and the categories are
// the cartridge's, and how a screen prints them is the screen's
// (`src/game/ui/pokedexView.ts`).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const SNAPSHOT = JSON.parse(readFileSync(join(here, 'frlg-pokedex.json'), 'utf8'));

const quote = (value) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

const contents = `// GENERATED FILE - do not edit by hand.
//
// Written by \`node tools/pokedex/generate.mjs\` from \`tools/pokedex/frlg-pokedex.json\`,
// which \`tools/pokedex/harvest.mjs\` reads out of the FireRed disassembly.
// Change the snapshot or the generator, re-run it, and commit the result;
// \`pokedexEntries.test.ts\` fails if this file and the generator disagree.

/** One kind's page in FireRed's Pokédex, as the cartridge has it. */
export interface PokedexEntry {
  readonly dexId: number;
  /** What it is a kind of: "MOUSE", printed as "MOUSE POKéMON". */
  readonly category: string;
  /** Height in decimetres: 4 is 0.4 m. */
  readonly heightDm: number;
  /** Weight in hectograms: 60 is 6.0 kg. */
  readonly weightHg: number;
  /** FireRed's entry, with the cartridge's own line breaks. */
  readonly text: string;
}

/** All 151, in national dex order: the entry for dex number \`n\` is at \`n - 1\`. */
export const POKEDEX_ENTRIES: readonly PokedexEntry[] = [
${SNAPSHOT.species
  .map(
    (row) =>
      `  { dexId: ${row.dexId}, category: ${quote(row.category)}, heightDm: ${row.heightDm}, weightHg: ${row.weightHg}, text: ${quote(row.text)} },`,
  )
  .join('\n')}
];
`;

const outputs = [['src/game/pokemon/generated/pokedexEntries.ts', contents]];

/** What the generator would write, for the test that holds the committed file to it. */
export const generated = () => outputs.map(([path, contents]) => ({ path, contents }));

if (process.argv[1] && process.argv[1].endsWith(join('pokedex', 'generate.mjs'))) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [path, body] of outputs) {
    const full = join(repo, path);
    if (check) {
      let committed = '';
      try {
        committed = readFileSync(full, 'utf8');
      } catch {
        committed = '';
      }
      if (committed !== body) {
        console.error(`${path} is out of date; run node tools/pokedex/generate.mjs`);
        stale += 1;
      }
    } else {
      writeFileSync(full, body);
      console.log(`wrote ${path}`);
    }
  }
  if (stale > 0) process.exit(1);
}
