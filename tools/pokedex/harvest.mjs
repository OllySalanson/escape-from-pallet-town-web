// Reads FireRed's own Pokédex - what each of the 151 is called a kind of, how
// tall and heavy it is, and the words of its entry - out of the disassembly and
// writes `frlg-pokedex.json`, which is committed so the answer is reproducible
// offline and a later audit has something to diff against.
//
//   node tools/pokedex/harvest.mjs            # fetch and write
//   node tools/pokedex/harvest.mjs --check    # fetch and compare
//
// Two tables, at the same pinned commit `tools/species/verifyExperience.mjs`
// reads the species table from:
//
//  - `src/data/pokemon/pokedex_entries.h`: the category ("SEED"), the height in
//    decimetres and the weight in hectograms, and the name of the text.
//  - `src/data/pokemon/pokedex_text_fr.h`: the entries FireRed prints.
//    LeafGreen's are a different set of sentences (`pokedex_text_lg.h`) and are
//    not taken: the game is held to FireRed wherever the two differ.
//
// The text is kept as the cartridge has it - POKéMON in capitals, its own line
// breaks as `\n` - so what the screen does with it (`ui/pokedexView.ts` runs the
// lines together and lets the window wrap them) is the screen's decision and
// not a second copy of the words.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'frlg-pokedex.json');
const SNAPSHOT = JSON.parse(readFileSync(join(HERE, '..', 'species', 'frlg-species.json'), 'utf8'));

const PRET_COMMIT = 'c75f352304d529f6ba92d4f74b9cf8b5c3810788';
const PRET = `https://raw.githubusercontent.com/pret/pokefirered/${PRET_COMMIT}/src/data/pokemon`;
const ENTRIES_URL = `${PRET}/pokedex_entries.h`;
const TEXT_URL = `${PRET}/pokedex_text_fr.h`;

const fetchText = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': 'pokedex text harvest' } });
    if (response.ok) return response.text();
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

/** `nidoran-f` -> `NATIONAL_DEX_NIDORAN_F`, `mr-mime` -> `NATIONAL_DEX_MR_MIME`. */
const constantOf = (name) => `NATIONAL_DEX_${name.toUpperCase().replace(/-/g, '_')}`;

/** A C string literal's contents, as the characters it stands for. */
const unescape = (literal) => literal.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

const [entries, text] = await Promise.all([fetchText(ENTRIES_URL), fetchText(TEXT_URL)]);

/** Every `const u8 gNamePokedexText[] = _( "..." "..." );` by its name. */
const texts = new Map(
  [...text.matchAll(/const u8 (g\w+PokedexText)\[\] = _\(([\s\S]*?)\);/g)].map(([, name, body]) => [
    name,
    [...body.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(([, piece]) => unescape(piece)).join(''),
  ]),
);

const problems = [];
const species = SNAPSHOT.species.map((row) => {
  const entry = entries.match(new RegExp(`\\[${constantOf(row.name)}\\]\\s*=\\s*\\{([\\s\\S]*?)\\n    \\}`));
  if (!entry) {
    problems.push(`${row.name}: no ${constantOf(row.name)} in pokedex_entries.h`);
    return null;
  }
  const category = entry[1].match(/\.categoryName = _\("([^"]*)"\)/)?.[1];
  const height = Number(entry[1].match(/\.height = (\d+)/)?.[1]);
  const weight = Number(entry[1].match(/\.weight = (\d+)/)?.[1]);
  const words = texts.get(entry[1].match(/\.description = (\w+)/)?.[1] ?? '');
  if (!category) problems.push(`${row.name}: no category`);
  if (!Number.isInteger(height) || height <= 0) problems.push(`${row.name}: no height`);
  if (!Number.isInteger(weight) || weight <= 0) problems.push(`${row.name}: no weight`);
  if (!words) problems.push(`${row.name}: no entry text`);
  if (words && /[{}]/.test(words)) problems.push(`${row.name}: the entry carries a control code`);
  return { dexId: row.dexId, name: row.name, category, heightDm: height, weightHg: weight, text: words };
});
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const table = {
  ruling:
    "FireRed's own Pokédex for the original 151: the category, the height in decimetres, the weight in hectograms and the entry's text with the cartridge's own line breaks. LeafGreen's entries differ and are not taken.",
  source: {
    pokefirered: {
      entries: ENTRIES_URL,
      text: TEXT_URL,
      note: 'the FireRed disassembly - the tables the cartridge reads',
    },
  },
  species,
};
const written = `${JSON.stringify(table, null, 1)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== written) {
    console.error('frlg-pokedex.json does not match FireRed; re-run without --check');
    process.exit(1);
  }
  console.log('frlg-pokedex.json matches FireRed for all 151.');
} else {
  writeFileSync(OUT, written);
  console.log(`wrote ${OUT}: ${species.length} entries`);
}
