// How much of the 151's move list this engine can express.
//
//   node tools/moves/coverage.mjs [--list=<verdict>]
//
// The 151 learn 273 distinct moves by level in FireRed/LeafGreen. This walks
// that list and asks, of each, whether a `MoveBase` could be written for it that
// the resolver would play correctly - not whether the move is authored yet.
//
// `frlg-level-up-moves.json` beside it is a cached PokeAPI snapshot, committed
// so the answer is reproducible and offline, and so a future audit has
// something to diff against. It was harvested with the three generation III
// traps the audit named handled explicitly: `past_values` merged field by field
// with the boundary strictly later than generation III, the physical/special
// split taken from the move's **type** rather than PokeAPI's Gen-IV
// `damage_class` (38 of the 273 disagree), and `past_types` applied.
//
// The capability list is `classify.mjs` beside this, which is also what
// `tools/species/generate.mjs` builds the move catalogue with - so the number
// printed here and the moves a Pokemon actually knows cannot disagree.
import { readFileSync } from 'node:fs';
import { classify } from './classify.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const moves = JSON.parse(readFileSync(join(here, 'frlg-level-up-moves.json'), 'utf8'));

const verdicts = moves.map((move) => ({ move, ...classify(move) }));
const expressible = verdicts.filter((v) => v.ok);
const missing = verdicts.filter((v) => !v.ok);

const tally = (rows, key) => {
  const counts = new Map();
  for (const row of rows) {
    for (const part of row[key].split(' + ')) counts.set(part, (counts.get(part) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
};

const pct = (n) => `${((n / moves.length) * 100).toFixed(0)}%`;
console.log(`FireRed/LeafGreen level-up moves the 151 learn: ${moves.length}`);
console.log(`  expressible: ${expressible.length} (${pct(expressible.length)})`);
console.log(`  missing:     ${missing.length} (${pct(missing.length)})`);
console.log('\nwhat the expressible ones need:');
for (const [what, count] of tally(expressible, 'why')) console.log(`  ${String(count).padStart(4)}  ${what}`);
console.log('\nwhy the rest are out:');
for (const [what, count] of tally(missing, 'why')) console.log(`  ${String(count).padStart(4)}  ${what}`);

// Weighted the way a player meets them: a move counted once per species.
const slots = (rows) => rows.reduce((total, row) => total + row.move.learners, 0);
const all = slots(verdicts);
console.log(
  `\nweighted by the species that learn them: ${slots(expressible)} of ${all} learnset entries ` +
    `(${((slots(expressible) / all) * 100).toFixed(0)}%)`,
);

const wanted = process.argv.find((a) => a.startsWith('--list='))?.slice(7);
if (wanted) {
  for (const row of verdicts.filter((v) => v.why.includes(wanted))) {
    console.log(`  ${row.move.name.padEnd(18)} ${row.why}`);
  }
}
