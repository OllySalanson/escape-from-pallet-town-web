// Turns the committed snapshots into the generated half of the roster.
//
//   node tools/species/generate.mjs            # write the files
//   node tools/species/generate.mjs --check    # fail if they are out of date
//
// Three snapshots go in - `frlg-species.json` beside this, `../moves/frlg-level-up-moves.json`
// and `../abilities/frlg-abilities.json` - and four files come out:
//
//   src/game/pokemon/generated/moveCatalogue.ts    every move the engine can play
//   src/game/pokemon/generated/speciesCatalogue.ts all 151, as canon has them
//   src/game/pokemon/generated/evolutionRules.ts   every generation III rule
//   docs/pokemon/roster.md                         what came in and what did not
//
// **Nothing here decides anything.** Which moves exist is `../moves/classify.mjs`,
// the same function `coverage.mjs` counts with; which of a species' abilities it
// actually carries is decided in TypeScript, by whether `abilities.ts` holds it;
// and every place the shipped game differs from canon is a row in the
// hand-authored `src/game/pokemon/shippedSpecies.ts`, not a silent edit here.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { classify, CHARGE, RECHARGE, WEATHER } from '../moves/classify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const read = (path) => JSON.parse(readFileSync(join(repo, path), 'utf8'));

const SPECIES = read('tools/species/frlg-species.json');
const MOVES = read('tools/moves/frlg-level-up-moves.json');
const FLAGS = new Map(read('tools/abilities/frlg-move-flags.json').map((row) => [row.name, row.flags]));
const ABILITIES = new Map(read('tools/abilities/frlg-abilities.json').species.map((row) => [row.name, row.abilities]));

const TYPES = {
  normal: 'Normal', fire: 'Fire', water: 'Water', grass: 'Grass', electric: 'Electric',
  ice: 'Ice', fighting: 'Fighting', ground: 'Ground', rock: 'Rock', flying: 'Flying',
  poison: 'Poison', bug: 'Bug', ghost: 'Ghost', psychic: 'Psychic', dragon: 'Dragon',
  dark: 'Dark', steel: 'Steel',
};
const STATS = {
  attack: 'attack', defense: 'defense', 'special-attack': 'spAttack',
  'special-defense': 'spDefense', speed: 'speed', accuracy: 'accuracy', evasion: 'evasion',
};
const STATUSES = {
  poison: 'PrimaryStatus.Poison', burn: 'PrimaryStatus.Burn', paralysis: 'PrimaryStatus.Paralysis',
  sleep: 'PrimaryStatus.Sleep', freeze: 'PrimaryStatus.Freeze', confusion: "'confusion'",
};
const WEATHERS = {
  'rain-dance': 'WeatherId.Rain', 'sunny-day': 'WeatherId.HarshSunlight',
  sandstorm: 'WeatherId.Sandstorm', hail: 'WeatherId.Hail',
};
const FLAG_NAMES = { contact: 'MoveFlag.Contact', punch: 'MoveFlag.Punch', bite: 'MoveFlag.Bite', sound: 'MoveFlag.Sound' };
/** The six stones generation III has. A later one is a later game's form. */
const GEN_III_STONES = new Set(['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'sun-stone']);

const statName = (stat) => {
  const name = STATS[stat];
  if (!name) throw new Error(`unknown stat ${stat}`);
  return name;
};
/** `stat` here is already this game's own name, from `statName` above. */
const readableStat = (stat) =>
  ({ attack: 'Attack', defense: 'Defense', spAttack: 'Sp. Atk', spDefense: 'Sp. Def',
     speed: 'Speed', accuracy: 'accuracy', evasion: 'evasion' })[stat];
const STAGES = ['', 'one stage', 'two stages', 'three stages'];

// -- the move catalogue ------------------------------------------------------

/** A move's effects, split the way `MoveBase` splits them. */
const effectsOf = (move) => {
  const status = move.ailment === 'none' ? null : STATUSES[move.ailment];
  if (move.ailment !== 'none' && !status) throw new Error(`unknown ailment ${move.ailment}`);
  const boosts = move.stat_changes.map((change) => ({ stat: statName(change.stat), stages: change.change }));
  const weather = WEATHER.has(move.name) ? WEATHERS[move.name] : null;
  // A status move does exactly what it says, every time. On a damaging move
  // everything extra is rolled, so it is a secondary with its own chance - and
  // a boost aimed at the user says so, which is how Metal Claw raises its own
  // Attack rather than its target's.
  if (move.category === 'Status') {
    return { guaranteed: { boosts, status, weather }, secondaries: [] };
  }
  const secondaries = [];
  const chance = move.ailment_chance > 0 ? move.ailment_chance : (move.effect_chance ?? 0);
  if (status && chance > 0) secondaries.push({ chance, status });
  if (move.flinch_chance > 0) secondaries.push({ chance: move.flinch_chance, flinch: true });
  if (boosts.length > 0) {
    secondaries.push({
      chance: move.stat_chance > 0 ? move.stat_chance : (move.effect_chance ?? 100),
      boosts,
      self: move.target === 'user',
    });
  }
  return { guaranteed: null, secondaries };
};

const describe = (move, effects) => {
  const type = TYPES[move.type];
  const sentences = [];
  if (move.category === 'Status') {
    sentences.push(`A ${type} status move.`);
  } else {
    sentences.push(`A ${type} ${move.category.toLowerCase()} attack.`);
  }
  // A move that lands on both foes says so wherever it names who it lands on.
  // The player reads this line in the move list before choosing, and "the
  // target" is the wrong noun for a move that has two of them.
  const spread = move.target === 'all-opponents';
  const them = spread ? 'both foes' : 'the target';
  if (spread) sentences.push(move.category === 'Status' ? 'Lands on both foes.' : 'Hits both foes.');
  const boostLine = (boosts, self, chance) => {
    const whose = self ? "the user's" : spread ? "both foes'" : "the target's";
    const grouped = boosts.map((boost) => readableStat(boost.stat)).join(', ');
    const stages = STAGES[Math.abs(boosts[0].stages)] ?? `${Math.abs(boosts[0].stages)} stages`;
    const up = boosts[0].stages > 0;
    return chance !== null && chance < 100
      ? `${chance}% chance to ${up ? 'raise' : 'lower'} ${whose} ${grouped} by ${stages}.`
      : `${up ? 'Raises' : 'Lowers'} ${whose} ${grouped} by ${stages}.`;
  };
  const statusWord = {
    poison: 'poisoned', burn: 'burned', paralysis: 'paralysed', sleep: 'asleep',
    freeze: 'frozen', confusion: 'confused',
  };
  if (effects.guaranteed) {
    const { boosts, status, weather } = effects.guaranteed;
    if (boosts.length > 0) sentences.push(boostLine(boosts, move.target === 'user', null));
    if (status) sentences.push(`Leaves ${them} ${statusWord[move.ailment]}.`);
    if (weather) {
      sentences.push(
        { 'rain-dance': 'Brings on rain.', 'sunny-day': 'Brings out harsh sunlight.',
          sandstorm: 'Whips up a sandstorm.', hail: 'Brings on hail.' }[move.name],
      );
    }
  }
  for (const secondary of effects.secondaries) {
    if (secondary.status) sentences.push(`${secondary.chance}% chance to leave ${them} ${statusWord[move.ailment]}.`);
    if (secondary.flinch) sentences.push(`${secondary.chance}% chance to make ${them} flinch.`);
    if (secondary.boosts) sentences.push(boostLine(secondary.boosts, secondary.self, secondary.chance));
  }
  if (move.min_hits) sentences.push(`Hits ${move.min_hits} to ${move.max_hits} times.`);
  if (move.drain > 0) sentences.push(`Heals the user for ${move.drain}% of the damage dealt.`);
  if (move.drain < 0) sentences.push(`The user takes ${-move.drain}% of the damage dealt.`);
  if (move.healing > 0) sentences.push(`Restores ${move.healing}% of the user's health.`);
  if (move.crit_rate > 0) sentences.push('Lands a critical hit more often.');
  if (move.priority > 0) sentences.push('Always strikes first.');
  if (move.priority < 0) sentences.push('Always strikes last.');
  // A move a Pokemon uses on itself has nothing to miss, so saying so would be
  // noise on half the status moves in the catalogue.
  if (move.accuracy === null && !(move.category === 'Status' && move.target === 'user')) {
    sentences.push('Never misses.');
  }
  if (CHARGE.has(move.name)) sentences.push('Spends the first turn winding up.');
  if (RECHARGE.has(move.name)) sentences.push('The user must recharge the turn after.');
  if (sentences.length === 1) sentences.push('No side effect.');
  return sentences.join(' ');
};

const quote = (value) => `'${value.replace(/'/g, "\\'")}'`;
/** A PokeAPI percentage as the share `MoveBase` wants, with no trailing zero. */
const share = (percent) => String(Number((percent / 100).toFixed(4)));
const boostList = (boosts) =>
  `[${boosts.map((boost) => `{ stat: '${boost.stat}', stages: ${boost.stages} }`).join(', ')}]`;

const renderMove = (move) => {
  const effects = effectsOf(move);
  const lines = [
    `  name: ${quote(move.displayName)},`,
    `  description: ${quote(describe(move, effects))},`,
    `  type: PokemonType.${TYPES[move.type]},`,
    `  power: ${move.power ?? 0},`,
    `  accuracy: ${move.accuracy ?? 100},`,
    `  pp: ${move.pp},`,
    `  category: MoveCategory.${move.category},`,
  ];
  if (move.priority !== 0) lines.push(`  priority: ${move.priority},`);
  if (move.accuracy === null) lines.push('  alwaysHits: true,');
  if (move.category === 'Status' && move.target === 'user') lines.push('  target: MoveTarget.Self,');
  // PokeAPI's `all-opponents` is the double battle's spread move. It means
  // nothing at all with one foe on the field - which is why this could be left
  // flat until there could be two - and it has no `past_values`, so the
  // generation III target is the modern one for every move in this snapshot;
  // `tools/moves/README.md` says so. `all-other-pokemon` (Earthquake and the
  // three like it) also hits your own partner and has no `MoveTarget`, so those
  // four are left aiming at one foe rather than silently made into something
  // this engine cannot say.
  if (move.target === 'all-opponents') lines.push('  target: MoveTarget.BothFoes,');
  if (move.min_hits) lines.push(`  hits: { min: ${move.min_hits}, max: ${move.max_hits} },`);
  if (move.crit_rate > 0) lines.push(`  critStage: ${move.crit_rate},`);
  if (move.drain < 0) lines.push(`  recoil: ${share(-move.drain)},`);
  if (move.drain > 0) lines.push(`  drain: ${share(move.drain)},`);
  if (move.healing > 0) lines.push(`  healing: ${share(move.healing)},`);
  if (CHARGE.has(move.name)) lines.push('  charge: MoveCharge.Charge,');
  if (RECHARGE.has(move.name)) lines.push('  charge: MoveCharge.Recharge,');
  if (effects.guaranteed) {
    const parts = [];
    if (effects.guaranteed.boosts.length > 0) parts.push(`boosts: ${boostList(effects.guaranteed.boosts)}`);
    if (effects.guaranteed.status) parts.push(`status: ${effects.guaranteed.status}`);
    if (effects.guaranteed.weather) parts.push(`weather: ${effects.guaranteed.weather}`);
    if (parts.length > 0) lines.push(`  effects: { ${parts.join(', ')} },`);
  }
  if (effects.secondaries.length > 0) {
    const rendered = effects.secondaries.map((secondary) => {
      const parts = [`chance: ${secondary.chance}`];
      if (secondary.status) parts.push(`status: ${secondary.status}`);
      if (secondary.flinch) parts.push('flinch: true');
      if (secondary.boosts) parts.push(`boosts: ${boostList(secondary.boosts)}`);
      if (secondary.self) parts.push('target: MoveTarget.Self');
      return `{ ${parts.join(', ')} }`;
    });
    lines.push(`  secondaries: [${rendered.join(', ')}],`);
  }
  const flags = (FLAGS.get(move.name) ?? []).map((flag) => FLAG_NAMES[flag]);
  if (flags.length > 0) lines.push(`  flags: [${flags.join(', ')}],`);
  return `  ${quote(move.name)}: new MoveBase({\n  ${lines.join('\n  ')}\n  }),`;
};

const expressible = MOVES.filter((move) => classify(move).ok);
const leftOut = MOVES.filter((move) => !classify(move).ok);

const moveCatalogue = `${header('tools/species/generate.mjs')}
import { MoveBase, MoveCategory, MoveCharge, MoveFlag, MoveTarget } from '../MoveBase';
import { PokemonType } from '../PokemonType';
import { PrimaryStatus } from '../battle/status';
import { WeatherId } from '../battle/weather';

/**
 * Every level-up move of Kanto's original 151 that this engine can play, keyed
 * by the identifier PokeAPI and both snapshots use.
 *
 * ${expressible.length} of the ${MOVES.length} the 151 learn are here. What the other ${leftOut.length} need is
 * \`node tools/moves/coverage.mjs\`, which counts with the same function this
 * was generated with, and \`docs/pokemon/roster.md\` lists them by species.
 *
 * Every number is generation III's: the power, accuracy and PP a move had in
 * FireRed rather than the one it has now, and the physical/special split taken
 * from the move's **type**, which is how generation III decided it. The
 * description is written from the row rather than imported with it.
 *
 * \`../moves.ts\` holds the moves the game authored by hand and overrides this
 * where the two disagree - see \`moveCatalogue.ts\` beside it for the merge and
 * \`shippedSpecies.ts\` for every place the shipped game and canon differ.
 */
export const GENERATED_MOVES: Readonly<Record<string, MoveBase>> = {
${expressible.map(renderMove).join('\n')}
};
`;

// -- the species catalogue ---------------------------------------------------

const catalogued = new Set(expressible.map((move) => move.name));
const renderSpecies = (species) => {
  const types = species.types.map((type) => {
    const name = TYPES[type];
    if (!name) throw new Error(`${species.name} has type ${type}`);
    return `PokemonType.${name}`;
  });
  const abilities = ABILITIES.get(species.name);
  if (!abilities) throw new Error(`no abilities for ${species.name}`);
  const learnset = species.learnset
    .map((entry) => `{ level: ${entry.level}, move: ${quote(entry.move)} }`)
    .join(', ');
  return [
    '  {',
    `    dexId: ${species.dexId},`,
    `    id: ${quote(species.name)},`,
    `    name: ${quote(species.displayName)},`,
    `    types: [${types.join(', ')}],`,
    `    baseStats: { hp: ${species.baseStats.hp}, attack: ${species.baseStats.attack}, ` +
      `defense: ${species.baseStats.defense}, spAttack: ${species.baseStats.spAttack}, ` +
      `spDefense: ${species.baseStats.spDefense}, speed: ${species.baseStats.speed} },`,
    `    abilityIds: [${abilities.map(quote).join(', ')}],`,
    `    catchRate: ${species.catchRate},`,
    `    baseExperience: ${species.baseExperience},`,
    `    growthRate: ${quote(species.growthRate)},`,
    `    learnset: [${learnset}],`,
    '  },',
  ].join('\n');
};

const growthRates = [...new Set(SPECIES.species.map((row) => row.growthRate))].sort();
const speciesCatalogue = `${header('tools/species/generate.mjs')}
import { PokemonType } from '../PokemonType';
import type { PokemonStats } from '../PokemonBase';

/** How fast a species climbs its own experience curve, as PokeAPI names it. */
export type GrowthRate = ${growthRates.map(quote).join(' | ')};

/**
 * One of the 151 exactly as canon has it, before this game has an opinion.
 *
 * \`abilityIds\` is every generation III slot the species has, not the one it
 * plays with: whether an ability can be expressed is a question for
 * \`abilities.ts\`, and \`species.ts\` asks it. \`learnset\` is the whole
 * FireRed/LeafGreen level-up list, including the moves this engine cannot yet
 * play, for the same reason - the data is what canon says and the filtering is
 * the engine's business, which is what stops a snapshot quietly disagreeing
 * with the count in \`tools/moves/coverage.mjs\`.
 */
export interface GeneratedSpecies {
  readonly dexId: number;
  readonly id: string;
  readonly name: string;
  readonly types: readonly PokemonType[];
  readonly baseStats: PokemonStats;
  readonly abilityIds: readonly string[];
  /** Generation III's own capture rate, out of 255. Nothing spends it yet. */
  readonly catchRate: number;
  /**
   * PokeAPI's \`base_experience\`, which is the **modern** yield: generation V
   * re-tabulated every one of these and PokeAPI serves no historical value.
   * Nothing spends it yet either - \`experienceForLevel\` is level-cubed - so it
   * is imported labelled rather than wired into a fight.
   */
  readonly baseExperience: number;
  readonly growthRate: GrowthRate;
  readonly learnset: readonly { readonly level: number; readonly move: string }[];
}

export const GENERATED_SPECIES: readonly GeneratedSpecies[] = [
${SPECIES.species.map(renderSpecies).join('\n')}
];
`;

// -- evolution ---------------------------------------------------------------

const dexIds = new Map(SPECIES.species.map((row) => [row.name, row.dexId]));
const evolutionRows = [];
const byPair = new Map();
for (const rule of SPECIES.evolutions) {
  if (!dexIds.has(rule.from) || !dexIds.has(rule.to)) continue;
  const key = `${rule.from}>${rule.to}`;
  byPair.set(key, [...(byPair.get(key) ?? []), rule]);
}
for (const [, rules] of byPair) {
  // A pair can carry several rows, because a species can carry a later game's
  // form: Voltorb is level 30 here and a Leaf Stone in Legends Arceus, and
  // Sandshrew is level 22 here and an Ice Stone in Alola. The oldest trigger
  // that generation III actually had is the one taken.
  const level = rules.find((rule) => rule.trigger === 'level-up' && rule.minLevel !== null);
  const stone = rules.find((rule) => rule.trigger === 'use-item' && GEN_III_STONES.has(rule.item));
  const trade = rules.find((rule) => rule.trigger === 'trade');
  const chosen = level ?? stone ?? trade;
  if (!chosen) continue;
  evolutionRows.push(chosen);
}
evolutionRows.sort((left, right) => dexIds.get(left.from) - dexIds.get(right.from) || left.to.localeCompare(right.to));

const renderEvolution = (rule) => {
  const trigger =
    rule.trigger === 'level-up'
      ? `{ kind: 'level', level: ${rule.minLevel} }`
      : rule.trigger === 'use-item'
        ? `{ kind: 'stone', itemId: ${quote(rule.item)} }`
        : "{ kind: 'trade' }";
  return `  { from: ${quote(rule.from)}, to: ${quote(rule.to)}, trigger: ${trigger} },`;
};

const evolutionRules = `${header('tools/species/generate.mjs')}
import type { EvolutionRule } from '../evolution';

/**
 * Every evolution among the 151 that generation III had, from PokeAPI's
 * \`/evolution-chain/\` data.
 *
 * Three things the filtering does, because an evolution chain is served as the
 * *modern* one. A rule whose other end is outside the 151 is dropped, which is
 * what leaves out the baby forms (Pichu, Cleffa, Igglybuff) and the later
 * generations' additions (Espeon, Steelix, Politoed, Annihilape). A stone that
 * did not exist in generation III is dropped, which is what stops Vulpix
 * reading as an Ice Stone line and Sandshrew as an Alolan one. And where a pair
 * carries both a level and a stone, the level is generation III's - Voltorb
 * became Electrode at 30 long before a Leaf Stone did it in Hisui.
 *
 * **The four trade lines are here and nothing triggers them.** This game has no
 * trading, so Kadabra, Machoke, Graveler and Haunter cannot evolve; the rule is
 * kept because the *family* is what \`evolutionFamily\` reads when a save looks
 * a move up, and what \`pokemonCargo.ts\` counts stages with, and dropping it
 * would make an Alakazam a first-stage Pokemon in the pack.
 */
export const GENERATED_EVOLUTIONS: readonly EvolutionRule[] = [
${evolutionRows.map(renderEvolution).join('\n')}
];
`;

// -- the report --------------------------------------------------------------

const missingBySpecies = SPECIES.species.map((species) => ({
  species,
  missing: species.learnset.filter((entry) => !catalogued.has(entry.move)),
}));
const tally = new Map();
for (const move of leftOut) tally.set(classify(move).why, [...(tally.get(classify(move).why) ?? []), move]);

const abilityless = SPECIES.species.filter((species) => (ABILITIES.get(species.name) ?? []).length === 0);

const roster = `# The roster, and what came in with it

*Generated by \`node tools/species/generate.mjs\`. Do not edit by hand.*

All ${SPECIES.species.length} of Kanto's originals are imported from the snapshots in
\`tools/species/\`, \`tools/moves/\` and \`tools/abilities/\`, harvested from PokeAPI's
FireRed/LeafGreen data. This file is the honest half: what the engine cannot yet
play, and what a species does instead.

## Moves

The 151 learn **${MOVES.length}** distinct moves by levelling. **${expressible.length}** of them are in
\`src/game/pokemon/generated/moveCatalogue.ts\`; the other **${leftOut.length}** are not, because
nothing in \`MoveBase\` can say what they do.

**A move that is not in the catalogue is simply not learned.** It is left out of
the species' learnset rather than approximated, so a Pokemon that would know
Leech Seed at 7 knows one move fewer at 7 - never a move that looks right and
does nothing. \`speciesImport.test.ts\` holds the floor that matters: every
species can still field a damaging move at every level it can be met at.

${[...tally].sort((a, b) => b[1].length - a[1].length).map(([why, moves]) =>
  `### ${why} (${moves.length})\n\n${moves.map((move) => move.displayName).join(', ')}.`).join('\n\n')}

## Species with the most left out

| Species | Left out | Moves |
| --- | --- | --- |
${missingBySpecies
  .filter((row) => row.missing.length > 0)
  .sort((a, b) => b.missing.length - a.missing.length)
  .slice(0, 20)
  .map((row) =>
    `| ${row.species.displayName} | ${row.missing.length} | ${row.missing
      .map((entry) => `${entry.move} (${entry.level})`)
      .join(', ')} |`,
  )
  .join('\n')}

## Abilities

An ability the engine cannot express leaves its species with none, which is what
\`PokemonBase.abilityId\` being \`null\` means and what Jigglypuff has shipped as
since Cute Charm needed a gender nothing here has. \`node tools/abilities/coverage.mjs\`
names every one with its reason.

${abilityless.length === 0 ? 'Every one of the 151 carries at least one generation III ability.' : abilityless.map((row) => row.displayName).join(', ')}

## Everything else

- **Base stats** are PokeAPI's, which are generation IX's: it serves no
  historical stats at all. Generation VI raised one stat on a number of Kanto
  species, and \`src/game/pokemon/statCorrections.ts\` is where that is put back -
  hand-authored knowledge rather than either source, and the first thing to
  check in this import.
- **Catch rate** and **growth rate** are generation III's own and have not
  changed for these species. Neither is spent yet: catching reads HP, status and
  the ball, and experience is level-cubed for everything.
- **Base experience** is the modern yield, for the same reason as the stats.
- **Sprites** are the FireRed/LeafGreen rip of the same PokeAPI sprite
  repository the first seventeen came from; \`public/assets/ASSET_PROVENANCE.md\`
  carries the licence question they raise.
`;

function header(script) {
  return `// GENERATED FILE - do not edit by hand.
//
// Written by \`node ${script}\` from the committed snapshots in \`tools/\`.
// Change the snapshot or the generator, re-run it, and commit the result;
// \`speciesImport.test.ts\` fails if this file and the generator disagree.`;
}

const outputs = [
  ['src/game/pokemon/generated/moveCatalogue.ts', moveCatalogue],
  ['src/game/pokemon/generated/speciesCatalogue.ts', speciesCatalogue],
  ['src/game/pokemon/generated/evolutionRules.ts', evolutionRules],
  ['docs/pokemon/roster.md', roster],
];

export const generated = () => outputs.map(([path, contents]) => ({ path, contents }));

if (process.argv[1] && process.argv[1].endsWith('generate.mjs')) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [path, contents] of outputs) {
    const full = join(repo, path);
    if (check) {
      const current = readFileSync(full, 'utf8');
      if (current !== contents) {
        process.stderr.write(`stale: ${path}\n`);
        stale += 1;
      }
      continue;
    }
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
    process.stderr.write(`wrote ${path}\n`);
  }
  if (stale > 0) process.exit(1);
}
