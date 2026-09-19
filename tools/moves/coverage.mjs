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
// The capability list below is the contract. It is what `MoveBase` declares and
// `battleEngine.ts` reads, and nothing else - so a row moves out of `missing`
// only when the engine really grew.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const moves = JSON.parse(readFileSync(join(here, 'frlg-level-up-moves.json'), 'utf8'));

/**
 * The 42 moves the audit found that no generic mechanism covers: each needs its
 * own hand-written rule behind a named effect id, and several (Metronome, Mimic,
 * Mirror Move, Sleep Talk, Transform) need the engine to run a move it was not
 * given, which is a structural ask rather than a field.
 */
const BESPOKE = new Set([
  'aromatherapy', 'baton-pass', 'belly-drum', 'block', 'camouflage', 'conversion',
  'conversion-2', 'curse', 'destiny-bond', 'detect', 'disable', 'encore', 'endure',
  'focus-energy', 'follow-me', 'future-sight', 'grudge', 'helping-hand', 'imprison',
  'lock-on', 'mean-look', 'memento', 'metronome', 'mimic', 'mind-reader', 'mirror-move',
  'protect', 'psych-up', 'recycle', 'refresh', 'rest', 'role-play', 'sleep-talk', 'spite',
  'splash', 'stockpile', 'substitute', 'teleport', 'transform', 'trick', 'roar', 'whirlwind',
]);

/** PokeAPI flags neither, so both are named by hand - the audit's own warning. */
const CHARGE = new Set(['solar-beam', 'dig', 'fly', 'razor-wind', 'sky-attack', 'skull-bash', 'bounce']);
const RECHARGE = new Set(['hyper-beam', 'blast-burn', 'frenzy-plant', 'hydro-cannon']);
/** Repeats for two or three turns and then confuses the user. Not modelled. */
const LOCK_IN = new Set(['thrash', 'petal-dance', 'outrage', 'rollout', 'ice-ball', 'uproar', 'bide']);

/** Volatile conditions with a lifetime of their own. Flinch is the one modelled. */
const VOLATILE = new Set([
  'trap', 'leech-seed', 'nightmare', 'perish-song', 'yawn', 'ingrain', 'disable',
  'protect', 'no-type-immunity', 'unknown',
]);

const classify = (move) => {
  if (BESPOKE.has(move.name)) return { ok: false, why: 'bespoke' };
  if (LOCK_IN.has(move.name)) return { ok: false, why: 'lock-in' };
  if (move.meta === 'ohko') return { ok: false, why: 'one-hit KO' };
  if (move.meta === 'whole-field-effect' || move.meta === 'field-effect') {
    return { ok: false, why: 'field or side effect' };
  }
  if (move.meta === 'force-switch') return { ok: false, why: 'forced switch' };
  if (VOLATILE.has(move.ailment)) return { ok: false, why: 'volatile status' };

  // Everything below is a field on `MoveBase` and a branch in `applyMove`.
  const needs = [];
  if (CHARGE.has(move.name)) needs.push('two-turn charge');
  if (RECHARGE.has(move.name)) needs.push('recharge');
  if (move.priority !== 0) needs.push('priority');
  if (move.min_hits) needs.push('multi-hit');
  if (move.crit_rate > 0) needs.push('raised crit rate');
  if (move.drain > 0) needs.push('drain');
  if (move.drain < 0) needs.push('recoil');
  if (move.healing > 0) needs.push('healing');
  if (move.flinch_chance > 0) needs.push('flinch');
  if (move.ailment !== 'none') {
    needs.push(move.ailment_chance > 0 || move.effect_chance ? 'status on a chance' : 'status');
  }
  if (move.stat_changes.length > 0) {
    const accuracy = move.stat_changes.some((s) => s.stat === 'accuracy' || s.stat === 'evasion');
    needs.push(accuracy ? 'accuracy or evasion stage' : 'stat stage');
    if (move.target === 'user') needs.push('stat stage on the user');
    if (move.stat_chance > 0) needs.push('stat stage on a chance');
  }
  if (move.accuracy === null) needs.push('always hits');
  return { ok: true, why: needs.length === 0 ? 'plain damage' : needs.join(' + ') };
};

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
