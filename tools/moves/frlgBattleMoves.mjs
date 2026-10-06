// Reads FireRed's own move table and writes `frlg-battle-moves.json`, which is
// committed and is what the generator corrects PokeAPI's move rows with.
//
//   node tools/moves/frlgBattleMoves.mjs            # fetch and write
//   node tools/moves/frlgBattleMoves.mjs --check    # fetch and compare
//
// PokeAPI keeps `past_values` for a move's power, accuracy, PP, type and effect
// chance, and nothing else: a move's priority, its target, its stat changes and
// whether it flinches are today's, so a later generation's change reads as if it
// had always been there (playtest 22, W2: String Shot at -2 Speed, Growth
// raising Attack, Acid and Crunch lowering the wrong Defence, Waterfall
// flinching, Extreme Speed at +2, Poison Gas hitting both foes). The table the
// cartridge reads - pret/pokefirered's `src/data/battle_moves.h`, at the commit
// `../species/verifyStats.mjs` pins - says what each of those was in FireRed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'frlg-battle-moves.json');
const SNAPSHOTS = ['frlg-level-up-moves.json', 'frlg-machines.json'];

const PRET_COMMIT = 'c75f352304d529f6ba92d4f74b9cf8b5c3810788';
const PRET_URL = `https://raw.githubusercontent.com/pret/pokefirered/${PRET_COMMIT}/src/data/battle_moves.h`;

/** FireRed's constant for a move PokeAPI names differently today. */
const RENAMED = {
  'feint-attack': 'FAINT_ATTACK',
  'high-jump-kick': 'HI_JUMP_KICK',
  'smelling-salts': 'SMELLING_SALT',
  'vise-grip': 'VICE_GRIP',
};
const constantOf = (name) => RENAMED[name] ?? name.toUpperCase().replace(/-/g, '_');

const fetchText = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': 'escape-from-pallet-town move audit' } });
    if (response.ok) return response.text();
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

const source = await fetchText(PRET_URL);
const table = new Map();
for (const entry of source.matchAll(/\[MOVE_([A-Z0-9_]+)\] =\s*\{([\s\S]*?)\n    \}/g)) {
  const fields = {};
  for (const field of entry[2].matchAll(/\.(\w+) = ([^,\n]+)/g)) fields[field[1]] = field[2].trim();
  table.set(entry[1], fields);
}

const names = new Set();
for (const file of SNAPSHOTS) {
  const snapshot = JSON.parse(readFileSync(join(HERE, file), 'utf8'));
  // The level-up snapshot is a list of rows; the machine snapshot is keyed by move.
  const rows = Array.isArray(snapshot) ? snapshot.map((row) => row.name) : Object.keys(snapshot.machines);
  for (const name of rows) names.add(name);
}
names.delete(undefined);

const missing = [];
const moves = [...names].sort().flatMap((name) => {
  const row = table.get(constantOf(name));
  if (!row) {
    missing.push(name);
    return [];
  }
  return [{
    name,
    effect: row.effect,
    power: Number(row.power),
    accuracy: Number(row.accuracy),
    pp: Number(row.pp),
    secondaryEffectChance: Number(row.secondaryEffectChance),
    target: row.target,
    priority: Number(row.priority),
  }];
});
if (missing.length > 0) {
  console.error(`no FireRed row for: ${missing.join(', ')}`);
  process.exit(1);
}

const written = `${JSON.stringify({
  ruling: "FireRed/LeafGreen's own move table for every move the 151 learn by level or by machine: what PokeAPI keeps no history for.",
  source: { pokefirered: { url: PRET_URL, note: 'the FireRed disassembly - the table the cartridge reads' } },
  moves,
}, null, 1)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== written) {
    console.error('frlg-battle-moves.json does not match FireRed; re-run without --check');
    process.exit(1);
  }
  console.log(`frlg-battle-moves.json matches FireRed for all ${moves.length} moves.`);
} else {
  writeFileSync(OUT, written);
  console.log(`wrote ${OUT}: ${moves.length} moves`);
}
