// How much of the 151's ability list this engine can express.
//
//   node tools/abilities/coverage.mjs                  # the headline
//   node tools/abilities/coverage.mjs --list=weather   # which abilities, and why
//
// The 151 carry **55 distinct abilities** across 205 ability slots in
// FireRed/LeafGreen. This walks that list and asks, of each, whether an
// `AbilityBase` could be written for it that the resolver would play correctly.
//
// `frlg-abilities.json` beside it is a cached PokeAPI snapshot, committed so the
// answer is reproducible and offline, harvested by `harvest.mjs` with the three
// generation III traps its header names handled explicitly.
//
// The hook list below is the contract, exactly as `classify()` is in
// `tools/moves/coverage.mjs`: it is what `AbilityBase` declares and
// `abilities.ts` reads, and nothing else - so a row moves out of `missing` only
// when the engine really grew.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { species, abilities } = JSON.parse(readFileSync(join(here, 'frlg-abilities.json'), 'utf8'));

/** The hooks `AbilityBase` declares, and which ability needs each. */
const HOOKS = {
  modifyAttack: ['overgrow', 'blaze', 'torrent', 'swarm', 'guts'],
  modifyAccuracy: ['compound-eyes'],
  modifyDamageTaken: ['thick-fat'],
  blocksCriticalHits: ['shell-armor', 'battle-armor'],
  blocksRecoil: ['rock-head'],
  absorbsMoveType: ['levitate', 'flash-fire', 'water-absorb', 'volt-absorb'],
  blocksMoveFlag: ['soundproof'],
  blocksBoost: ['keen-eye', 'hyper-cutter', 'clear-body'],
  blocksStatus: [
    'insomnia', 'vital-spirit', 'limber', 'immunity', 'water-veil', 'own-tempo', 'inner-focus',
  ],
  blocksSecondaries: ['shield-dust'],
  secondaryChance: ['serene-grace'],
  onDamagingHit: ['static', 'poison-point', 'flame-body', 'effect-spore'],
  onStatusInflicted: ['synchronize'],
  endOfTurnCure: ['shed-skin'],
  sleepsLightly: ['early-bird'],
  onSendOut: ['intimidate'],
  curesOnSwitchOut: ['natural-cure'],
  drainBackfires: ['liquid-ooze'],
  extraPpCost: ['pressure'],
  escapeAlwaysSucceeds: ['run-away'],
  preventsEscape: ['arena-trap', 'magnet-pull'],
  // Four that are only ever about the weather. They read `weather.ts`'s table
  // rather than restating any of its rules, which is why they cost four hooks
  // and no new arithmetic.
  modifySpeed: ['chlorophyll', 'swift-swim'],
  modifyIncomingAccuracy: ['sand-veil'],
  suppressesWeather: ['cloud-nine'],
};

/**
 * Why the rest are out, and every one of them is a thing the *battle* does not
 * have rather than a hook that was skipped for being dull.
 */
const MISSING = {
  'infatuation, which needs a gender': ['cute-charm', 'oblivious'],
  'one-hit KO moves, of which this engine has none': ['sturdy'],
  'a move that knocks its user out': ['damp'],
  'a move that takes a held item': ['sticky-hold'],
  'a second foe to redirect a move to': ['lightning-rod'],
  'copies whatever the foe has': ['trace'],
  'the overworld encounter roll': ['illuminate'],
  'nothing at all in a generation III battle': ['stench', 'pickup'],
};

const hookOf = new Map();
for (const [hook, names] of Object.entries(HOOKS)) for (const name of names) hookOf.set(name, hook);
const missingWhy = new Map();
for (const [why, names] of Object.entries(MISSING)) for (const name of names) missingWhy.set(name, why);

const verdicts = abilities.map((ability) => {
  const hook = hookOf.get(ability.name);
  const why = missingWhy.get(ability.name);
  if (hook && why) throw new Error(`${ability.name} is both covered and missing`);
  if (!hook && !why) throw new Error(`${ability.name} is unclassified - the contract must say`);
  return { ability, ok: Boolean(hook), why: hook ?? why };
});

const expressible = verdicts.filter((verdict) => verdict.ok);
const missing = verdicts.filter((verdict) => !verdict.ok);
const slots = (rows) => rows.reduce((total, row) => total + row.ability.carriers, 0);
const all = slots(verdicts);
const pct = (part, whole) => `${((part / whole) * 100).toFixed(0)}%`;

console.log(`FireRed/LeafGreen abilities the 151 carry: ${abilities.length}, over ${all} ability slots`);
console.log(`  expressible: ${expressible.length} (${pct(expressible.length, abilities.length)})`);
console.log(`  missing:     ${missing.length} (${pct(missing.length, abilities.length)})`);

const tally = (rows) => {
  const counts = new Map();
  for (const row of rows) counts.set(row.why, (counts.get(row.why) ?? 0) + 1);
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
};
console.log('\nthe hook each one needs:');
for (const [hook, count] of tally(expressible)) console.log(`  ${String(count).padStart(3)}  ${hook}`);
console.log('\nwhy the rest are out:');
for (const [why, count] of tally(missing)) console.log(`  ${String(count).padStart(3)}  ${why}`);

console.log(
  `\nweighted by the species that carry them: ${slots(expressible)} of ${all} ability slots ` +
    `(${pct(slots(expressible), all)})`,
);

// A species is playable as itself only if *every* ability it can be sent out
// with is expressible, because which of the two a wild Pokemon has is not the
// player's to choose.
const whole = species.filter(
  (row) => row.abilities.length > 0 && row.abilities.every((name) => hookOf.has(name)),
);
console.log(
  `species whose whole ability set is expressible: ${whole.length} of ${species.length} ` +
    `(${pct(whole.length, species.length)})`,
);

const wanted = process.argv.find((argument) => argument.startsWith('--list='))?.slice(7);
if (wanted) {
  for (const row of verdicts.filter((verdict) => verdict.why.includes(wanted))) {
    console.log(`  ${row.ability.name.padEnd(16)} ${String(row.ability.carriers).padStart(2)}  ${row.why}`);
  }
}
