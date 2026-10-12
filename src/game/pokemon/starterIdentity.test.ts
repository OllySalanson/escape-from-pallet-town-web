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
   * FireRed's own level-5 kits, which are the whole of the choice before a
   * move of the starter's own type arrives: Charmander's Scratch is the one
   * 40-power, never-missing attack of the three (Tackle is FireRed's 35 and
   * 95%), and Squirtle trades Growl for Tail Whip. Pinned so a regenerated
   * learnset that moves one is a diff somebody reads, and so the floors on the
   * starting maps (`districtEncounters.test.ts`) are read against the kits they
   * measured.
   */
  it("carries FireRed's own level-5 kit", () => {
    expect(STARTERS.map((species) => moveNames(STARTER_LEVEL, species).join('/'))).toEqual([
      'Growl/Tackle',
      'Growl/Scratch',
      'Tackle/Tail Whip',
    ]);
  });

  /**
   * Level 7 is where the choice becomes loud: FireRed teaches each starter a
   * move of its own type there - Leech Seed, Ember and Bubble. Bulbasaur's is
   * a status move rather than an attack, and it is the reason Leech Seed is
   * playable at all (`MoveEffects.seed`): without it a FireRed Bulbasaur had
   * nothing of its own until Vine Whip at 10.
   */
  it('teaches every starter a move of its own type at level 7', () => {
    const learned = STARTERS.map((species) =>
      new Pokemon(species, SIGNATURE_LEVEL).moves
        .map((move) => move.base)
        .filter((move) => move.type === species.primaryType)
        .map((move) => move.name),
    );
    expect(learned).toEqual([['Leech Seed'], ['Ember'], ['Bubble']]);
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
   * The first attack of its own type is what a starter's choice is measured
   * by, at the level FireRed teaches it: Ember and Bubble at 7, Vine Whip at
   * 10. That only means anything if the early roster contains something the
   * attack is good against - Water had nothing until a wild Charmander joined
   * the shared table.
   */
  it('gives each signature attack a target in the shared early table, at the level FireRed teaches it', () => {
    const signatures: [(typeof STARTERS)[number], PokemonType, number][] = [
      [BULBASAUR, PokemonType.Grass, 10],
      [CHARMANDER, PokemonType.Fire, SIGNATURE_LEVEL],
      [SQUIRTLE, PokemonType.Water, SIGNATURE_LEVEL],
    ];
    const wildSpecies = PALLET_TALL_GRASS.entries.map((entry) => getSpeciesById(entry.speciesId)!);

    const attack = (species: (typeof STARTERS)[number], level: number, type: PokemonType) =>
      new Pokemon(species, level).moves
        .map((move) => move.base)
        .find((move) => move.type === type && move.category !== MoveCategory.Status);

    for (const [species, type, level] of signatures) {
      expect(attack(species, level, type), `${species.name} should learn a ${type} attack by level ${level}`).toBeDefined();
      expect(attack(species, level - 1, type), `${species.name} learns its ${type} attack at ${level}`).toBeUndefined();

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
