import { describe, expect, it } from 'vitest';
import { Pokemon } from './Pokemon';
import { PokemonType } from './PokemonType';
import { MoveCategory } from './MoveBase';
import { BULBASAUR, CHARMANDER, SQUIRTLE, getSpeciesById } from './species';
import { PALLET_TALL_GRASS } from './encounters';
import { getTypeEffectiveness } from './battle/typeChart';

const STARTERS = [BULBASAUR, CHARMANDER, SQUIRTLE];
const STARTER_LEVEL = 5;
const SIGNATURE_LEVEL = 7;

const moveNames = (level: number, species: (typeof STARTERS)[number]): string[] =>
  new Pokemon(species, level).moves.map((move) => move.base.name).sort();

describe('starter identity', () => {
  /**
   * Unity's stat formula is `floor(base * level / 100) + 5`, so at level 5 a 43
   * and a 65 in the same stat are one point apart. Nothing about the starter
   * choice can be carried by stats at the level the player picks, which is why
   * the movesets below have to carry it instead. If this ever stops holding,
   * the differentiation argument needs re-measuring rather than patching.
   */
  it('cannot express the choice through level-5 stats', () => {
    const stats = STARTERS.map((species) => new Pokemon(species, STARTER_LEVEL).stats);

    for (const stat of ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'] as const) {
      const values = stats.map((entry) => entry[stat]);
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    }
  });

  it('gives every starter a different set of options at the level it is chosen', () => {
    const kits = STARTERS.map((species) => moveNames(STARTER_LEVEL, species).join('/'));

    expect(new Set(kits).size).toBe(STARTERS.length);
  });

  /**
   * Every starter carries an off-type 40-power physical move, so before the
   * signature move lands the only thing that can differ turn to turn is the
   * non-damaging option each one brings. Bulbasaur has carried Super Sonic
   * since Unity; Squirtle's Tail Whip is the matching tool for the bulkiest
   * starter, and Charmander - the fastest and frailest - has Growl.
   */
  it('gives every starter a non-damaging line of its own at level 5', () => {
    const tools = STARTERS.map(
      (species) =>
        new Pokemon(species, STARTER_LEVEL).moves
          .filter((move) => move.base.category === MoveCategory.Status)
          .map((move) => move.base.name)
          .sort()
          .join('/'),
    );

    expect(tools).toEqual(['Growl/Super Sonic', 'Growl', 'Growl/Tail Whip']);
    expect(new Set(tools).size).toBe(STARTERS.length);
  });

  it('keeps Squirtle the bulkiest starter its setup move is meant for', () => {
    const bulk = (species: (typeof STARTERS)[number]) => {
      const stats = species.baseStats;
      return stats.defense + stats.spDefense;
    };

    expect(bulk(SQUIRTLE)).toBeGreaterThan(bulk(CHARMANDER));
    expect(bulk(SQUIRTLE)).toBeGreaterThan(bulk(BULBASAUR));
  });

  /**
   * Level 7 is where the choice becomes loud: each starter learns a move of its
   * own type. That only means anything if the early roster contains something
   * the move is good against - Water had nothing until a wild Charmander joined
   * the shared table.
   */
  it('gives each level-7 signature move a target in the shared early table', () => {
    const signatures: [(typeof STARTERS)[number], PokemonType][] = [
      [BULBASAUR, PokemonType.Grass],
      [CHARMANDER, PokemonType.Fire],
      [SQUIRTLE, PokemonType.Water],
    ];
    const wildSpecies = PALLET_TALL_GRASS.entries.map((entry) => getSpeciesById(entry.speciesId)!);

    for (const [species, type] of signatures) {
      const learned = new Pokemon(species, SIGNATURE_LEVEL).moves.map((move) => move.base);
      const signature = learned.find(
        (move) => move.type === type && move.category !== MoveCategory.Status,
      );
      expect(signature, `${species.name} should learn a ${type} move by level ${SIGNATURE_LEVEL}`).toBeDefined();

      expect(
        wildSpecies.some(
          (base) =>
            getTypeEffectiveness(type, [
              base.primaryType,
              ...(base.secondaryType ? [base.secondaryType] : []),
            ]) > 1,
        ),
        `${type} should be super effective against something in the early grass`,
      ).toBe(true);
    }
  });
});
