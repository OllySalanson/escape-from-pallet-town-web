import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// The generator is the contract this file holds the repository to, so it is
// imported rather than described. Importing it writes nothing: it only writes
// files when it is the process's entry point, and `generate.d.mts` beside it is
// what lets a test read a tool.
import { generated } from '../../../tools/species/generate.mjs';
import { Pokemon } from './Pokemon';
import { MoveCategory } from './MoveBase';
import { PokemonType } from './PokemonType';
import { ALL_SPECIES, SPECIES_BY_ID, getSpeciesById } from './species';
import { GENERATED_MOVES } from './generated/moveCatalogue';
import { GENERATED_SPECIES } from './generated/speciesCatalogue';
import { AUTHORED_MOVES, MOVE_CATALOGUE } from './moveCatalogue';
import { SHIPPED_DEVIATIONS } from './shippedSpecies';
import { EVOLUTIONS } from './evolution';

const REPO = join(__dirname, '..', '..', '..');
const STATS = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'] as const;

describe('the imported roster', () => {
  /**
   * The generated files are committed so a reader can see them in a diff, which
   * only means anything if they are what the generator would write today. This
   * is `node tools/species/generate.mjs --check` as a test.
   */
  it('is what the generator would write from the committed snapshots', () => {
    for (const { path, contents } of generated()) {
      expect(readFileSync(join(REPO, path), 'utf8'), `${path} is stale`).toBe(contents);
    }
  });

  it('holds all 151, once each, in dex order', () => {
    expect(ALL_SPECIES).toHaveLength(151);
    expect(ALL_SPECIES.map((species) => species.dexId)).toEqual(
      Array.from({ length: 151 }, (_, index) => index + 1),
    );
    expect(new Set(ALL_SPECIES.map((species) => species.id)).size).toBe(151);
  });

  /**
   * Fairy is generation VI. `past_types` is what keeps Clefairy, Jigglypuff and
   * their evolutions Normal, and a Fairy in the roster means that reading went
   * wrong in the harvest rather than here.
   */
  it('types everything out of generation III\'s own seventeen', () => {
    const seventeen = new Set<string>(Object.values(PokemonType));
    for (const species of ALL_SPECIES) {
      expect(seventeen.has(species.primaryType), species.id).toBe(true);
      if (species.secondaryType) {
        expect(seventeen.has(species.secondaryType), species.id).toBe(true);
      }
    }
    expect(getSpeciesById('clefairy')!.primaryType).toBe(PokemonType.Normal);
    expect(getSpeciesById('clefable')!.secondaryType).toBeUndefined();
  });

  /**
   * The floor under leaving a move out rather than approximating it. A species
   * knows its last four moves by level, so dropping one can leave a run of
   * status moves with nothing behind it - and a Pokemon with nothing that hurts
   * cannot win a fight, cannot be measured, and is a wild encounter that ends
   * only when the player walks away from it.
   *
   * It is pinned as a list rather than asserted away, because every row is a
   * fact about canon meeting this engine and each has its own reason:
   *
   * - **Metapod and Kakuna** learn Harden and nothing else in FireRed. A cocoon
   *   that cannot attack is what they *are*; giving them a move would be
   *   inventing one.
   * - **Abra and Ditto** know one move each - Teleport and Transform - and both
   *   are on the bespoke list, so both come out of the import with no move at
   *   all. `districtEncounters.test.ts` refuses either in a wild table, which is
   *   what keeps them out of a fight nobody can finish; what would let them in
   *   is Struggle, which this engine does not have.
   * - **Everything else** is a stretch of levels where the dropped move was the
   *   only damaging thing in reach. A wild one there is a free catch rather
   *   than a fight.
   * - **Pikachu from 33** is not the import's doing: the shipped learnset has
   *   Tackle at 1 and three status moves after it, so the fourth pushes Tackle
   *   off the end. Canon gives it Thunderbolt at 26 and would fix it, which is
   *   one of the arguments for adopting the canon learnsets for the seventeen.
   */
  it('names every species that cannot hurt anything, and at which levels', () => {
    const toothless: string[] = [];
    const silent: string[] = [];
    for (const species of ALL_SPECIES) {
      const levels: number[] = [];
      for (let level = 1; level <= 60; level += 1) {
        const moves = new Pokemon(species, level).moves;
        if (moves.length === 0) {
          if (!silent.includes(species.id)) silent.push(species.id);
          continue;
        }
        if (!moves.some((move) => move.base.category !== MoveCategory.Status)) {
          levels.push(level);
        }
      }
      if (levels.length > 0) {
        toothless.push(
          `${species.id} ${levels[0]}-${levels[levels.length - 1]}`,
        );
      }
    }

    // Gyarados is on that list and cannot be met: Magikarp becomes one at 20,
    // which is the level its own Bite arrives at.
    expect(silent).toEqual(['abra', 'gyarados', 'ditto']);
    expect(toothless.sort()).toEqual([
      'bellsprout 19-22',
      'clefairy 37-44',
      'cubone 1-8',
      'dratini 1-14',
      'ekans 1-7',
      'gloom 14-23',
      'kakuna 1-60',
      'machamp 1-12',
      'machoke 1-12',
      'machop 1-12',
      'magikarp 1-14',
      'metapod 1-60',
      'mr-mime 1-4',
      'oddish 18-22',
      'pikachu 33-60',
      'weepinbell 19-23',
    ]);
  });

  it('teaches nothing the engine cannot play, and nothing by a name it does not know', () => {
    for (const row of GENERATED_SPECIES) {
      const played = SPECIES_BY_ID[row.id].learnset.map((entry) => entry.move.name);
      const canon = row.learnset.filter((entry) => MOVE_CATALOGUE[entry.move]);
      // Every canon entry the catalogue holds is taught, unless the species is
      // one of the seventeen that authored its own list.
      if (!SHIPPED_DEVIATIONS[row.id]?.learnset) {
        expect(played).toHaveLength(canon.length);
      }
      for (const entry of SHIPPED_DEVIATIONS[row.id]?.learnset ?? []) {
        expect(MOVE_CATALOGUE[entry.move], `${row.id} is authored with ${entry.move}`).toBeDefined();
      }
    }
  });
});

interface VerifiedRow {
  readonly dexId: number;
  readonly name: string;
  readonly types: readonly string[];
  readonly stats: Record<(typeof STATS)[number], number>;
  readonly laterGenerations?: Partial<Record<(typeof STATS)[number], number>>;
}

/**
 * The captain's ruling of 2026-09-23: no stat is written from memory. Every
 * number below is one the FireRed disassembly, Bulbapedia's generation II-V
 * table and PokeAPI's `past_stats` all print - `tools/species/verifyStats.mjs`
 * refuses to write a row they disagree on, and `--check` re-asks all three.
 */
describe('base stats and types, against FireRed', () => {
  const { species: verified } = JSON.parse(
    readFileSync(join(REPO, 'tools/species/frlg-base-stats.json'), 'utf8'),
  ) as { species: readonly VerifiedRow[] };

  it('covers all 151, in dex order', () => {
    expect(verified.map((row) => row.dexId)).toEqual(Array.from({ length: 151 }, (_, index) => index + 1));
    expect(verified.map((row) => row.name)).toEqual(ALL_SPECIES.map((species) => species.id));
  });

  it('is what every one of the 151 fields in a fight', () => {
    const wrong: string[] = [];
    for (const row of verified) {
      const species = getSpeciesById(row.name)!;
      for (const stat of STATS) {
        if (species.baseStats[stat] !== row.stats[stat]) {
          wrong.push(`${row.name}.${stat}: ${species.baseStats[stat]} not ${row.stats[stat]}`);
        }
      }
      const types = [species.primaryType, species.secondaryType].filter(Boolean).join('/').toLowerCase();
      if (types !== row.types.join('/')) {
        wrong.push(`${row.name}: ${types} not ${row.types.join('/')}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  /**
   * The twenty a later generation raised, pinned by name: these are the numbers
   * a modern fan site gets wrong for this game, and the ones recall got wrong
   * before this table existed - Dugtrio fielded generation VII's 100 Attack.
   */
  it('names every species whose modern stat line is not FireRed\'s', () => {
    const raised = verified
      .filter((row) => row.laterGenerations)
      .map((row) =>
        `${row.name} ${Object.entries(row.laterGenerations!)
          .map(([stat, modern]) => `${stat} ${row.stats[stat as (typeof STATS)[number]]}->${modern}`)
          .join(' ')}`,
      );
    expect(raised).toEqual([
      'butterfree spAttack 80->90',
      'beedrill attack 80->90',
      'pidgeot speed 91->101',
      'arbok attack 85->95',
      'pikachu defense 30->40 spDefense 40->50',
      'raichu speed 100->110',
      'nidoqueen attack 82->92',
      'nidoking attack 92->102',
      'clefable spAttack 85->95',
      'wigglytuff spAttack 75->85',
      'vileplume spAttack 100->110',
      'dugtrio attack 80->100',
      'poliwrath attack 85->95',
      'alakazam spDefense 85->95',
      'victreebel spDefense 60->70',
      'golem attack 110->120',
      'farfetchd attack 65->90',
      'dodrio speed 100->110',
      'electrode speed 140->150',
      'exeggutor spDefense 65->75',
    ]);
  });
});

describe('what the game decided, against what canon says', () => {
  const snapshot = new Map(GENERATED_SPECIES.map((row) => [row.id, row]));

  /**
   * The list of disagreements is exactly the disagreements. Anything the game
   * fields that canon does not say is a row in `shippedSpecies.ts`, and a new
   * one cannot arrive quietly.
   */
  it('is the whole of the difference between the game and the snapshot', () => {
    const differs: string[] = [];
    for (const species of ALL_SPECIES) {
      const canon = snapshot.get(species.id)!;
      for (const stat of STATS) {
        if (species.baseStats[stat] !== canon.baseStats[stat]) {
          differs.push(`${species.id}.${stat}`);
        }
      }
      const played = species.learnset.map((entry) => `${entry.level}:${entry.move.name}`).join(',');
      const expected = canon.learnset
        .filter((entry) => MOVE_CATALOGUE[entry.move])
        .map((entry) => `${entry.level}:${MOVE_CATALOGUE[entry.move].name}`)
        .join(',');
      if (played !== expected) {
        differs.push(`${species.id}.learnset`);
      }
    }

    const declared = Object.entries(SHIPPED_DEVIATIONS).flatMap(([id, deviation]) =>
      deviation.learnset ? [`${id}.learnset`] : [],
    );
    expect(differs.sort()).toEqual(declared.sort());
  });

  /**
   * The moves this game wrote by hand win over the generated ones, so the
   * places they disagree with FireRed are a decision rather than a drift.
   *
   * Eleven of them, over six moves, and they are worth reading as a group.
   * **Tackle** and **Vine Whip** are the two AGENTS.md already records as being
   * on a later generation's values or on none, and every early fight in the
   * game has been measured against them. **PP is uniformly shorter** here,
   * which is a raid game's answer rather than an overworld one. And the three
   * **accuracies of 100** - Sing, Supersonic and Poison Powder - are the loud
   * ones: canon pitches all three between 55 and 75, and Bulbasaur's Super
   * Sonic landing every time is the whole of what makes its level-5 kit
   * different from the other two starters'. Adopting canon there is a balance
   * change with measurements, not part of an import.
   */
  it('names every authored move that does not match its own dex entry', () => {
    const differs: string[] = [];
    for (const [identifier, authored] of Object.entries(AUTHORED_MOVES)) {
      const canon = GENERATED_MOVES[identifier];
      if (!canon) {
        continue;
      }
      for (const field of ['power', 'accuracy', 'pp', 'category', 'type'] as const) {
        if (authored[field] !== canon[field]) {
          differs.push(`${identifier}.${field}: ${String(authored[field])} not ${String(canon[field])}`);
        }
      }
    }
    expect(differs.sort()).toEqual([
      'growl.pp: 30 not 40',
      'poison-powder.accuracy: 100 not 75',
      'poison-powder.pp: 20 not 35',
      'sing.accuracy: 100 not 55',
      'sing.pp: 20 not 15',
      'supersonic.accuracy: 100 not 55',
      'tackle.accuracy: 100 not 95',
      'tackle.power: 40 not 35',
      'tackle.pp: 20 not 35',
      'vine-whip.power: 45 not 35',
      'vine-whip.pp: 20 not 10',
    ]);
  });
});

describe('evolution, imported', () => {
  it('runs between species the game has, and never backwards', () => {
    for (const rule of EVOLUTIONS) {
      expect(getSpeciesById(rule.from), rule.from).toBeDefined();
      expect(getSpeciesById(rule.to), rule.to).toBeDefined();
      expect(rule.from).not.toBe(rule.to);
    }
    // Eevee is the one species with more than one way out of it, and generation
    // III has exactly three.
    expect(EVOLUTIONS.filter((rule) => rule.from === 'eevee').map((rule) => rule.to).sort()).toEqual(
      ['flareon', 'jolteon', 'vaporeon'],
    );
  });
});
