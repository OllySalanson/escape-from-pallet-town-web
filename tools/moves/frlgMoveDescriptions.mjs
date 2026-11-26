// Reads FireRed's own move descriptions and writes `frlg-move-descriptions.json`,
// which is committed and is what the generator and `moves.ts` describe a move with.
//
//   node tools/moves/frlgMoveDescriptions.mjs            # fetch and write
//   node tools/moves/frlgMoveDescriptions.mjs --check    # fetch and compare
//
// A move's description was written here from its row ("Lowers the target's
// Attack by one stage."), which read as a rules sheet beside FireRed's own
// ("The user growls in a cute way, making the foe lower its ATTACK stat."):
// the churchyard critic, round 3, 26 Nov 2026, and Olly's rule that the game
// says things its own way. This is pret/pokefirered's `src/move_descriptions.c`
// at the commit `frlgBattleMoves.mjs` pins, its line breaks made spaces, and
// "paralyzed" spelt as this game's battle lines spell it.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'frlg-move-descriptions.json');
const SNAPSHOTS = ['frlg-level-up-moves.json', 'frlg-machines.json'];

const PRET_COMMIT = 'c75f352304d529f6ba92d4f74b9cf8b5c3810788';
const PRET_URL = `https://raw.githubusercontent.com/pret/pokefirered/${PRET_COMMIT}/src/move_descriptions.c`;

/** FireRed's constant for a move PokeAPI names differently today (as `frlgBattleMoves.mjs`). */
const RENAMED = {
  'feint-attack': 'FAINT_ATTACK',
  'high-jump-kick': 'HI_JUMP_KICK',
  'smelling-salts': 'SMELLING_SALT',
  'vise-grip': 'VICE_GRIP',
};
const constantOf = (name) => RENAMED[name] ?? name.toUpperCase().replace(/-/g, '_');

/**
 * The moves `src/game/pokemon/moves.ts` authors by hand that no snapshot
 * lists, by PokeAPI name, so they are described in FireRed's words too.
 */
const AUTHORED = ['struggle'];

const fetchText = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': 'escape-from-pallet-town move audit' } });
    if (response.ok) return response.text();
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

const source = await fetchText(PRET_URL);
const texts = new Map();
for (const entry of source.matchAll(/const u8 (gMoveDescription_\w+)\[\] = _\("((?:[^"\\]|\\.)*)"\);/g)) {
  texts.set(entry[1], entry[2]);
}
const byConstant = new Map();
for (const entry of source.matchAll(/\[MOVE_([A-Z0-9_]+)\s*- 1\] = (gMoveDescription_\w+)/g)) {
  byConstant.set(entry[1], texts.get(entry[2]));
}

/** One line, as a screen of this game sets it: FireRed's line breaks made spaces. */
const asLine = (text) =>
  text
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/paralyz/g, 'paralys')
    .trim();

const names = new Set(AUTHORED);
for (const file of SNAPSHOTS) {
  const snapshot = JSON.parse(readFileSync(join(HERE, file), 'utf8'));
  const rows = Array.isArray(snapshot) ? snapshot.map((row) => row.name) : Object.keys(snapshot.machines);
  for (const name of rows) names.add(name);
}
names.delete(undefined);

const missing = [];
const descriptions = Object.fromEntries(
  [...names].sort().flatMap((name) => {
    const text = byConstant.get(constantOf(name));
    if (!text) {
      missing.push(name);
      return [];
    }
    return [[name, asLine(text)]];
  }),
);
if (missing.length > 0) {
  console.error(`no FireRed description for: ${missing.join(', ')}`);
  process.exit(1);
}

const written = `${JSON.stringify({
  ruling: "FireRed/LeafGreen's own move descriptions, as its summary screen shows them, for every move the 151 learn by level or by machine and every move the game authors.",
  source: { pokefirered: { url: PRET_URL, note: 'the FireRed disassembly; line breaks made spaces, "paralyzed" spelt "paralysed" as the battle lines spell it' } },
  descriptions,
}, null, 1)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== written) {
    console.error('frlg-move-descriptions.json does not match FireRed; re-run without --check');
    process.exit(1);
  }
  console.log(`frlg-move-descriptions.json matches FireRed for all ${Object.keys(descriptions).length} moves.`);
} else {
  writeFileSync(OUT, written);
  console.log(`wrote ${OUT}: ${Object.keys(descriptions).length} moves`);
}
