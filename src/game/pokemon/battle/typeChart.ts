import type { PokemonType } from '../PokemonType';
import { PokemonType as Types } from '../PokemonType';

/**
 * This order and every multiplier were ported from `PokemonBase.cs` in the
 * Unity project, which took them in turn from the tutorial the captain followed
 * - a tutorial whose author invented his own monsters and so never needed Dark,
 * Steel or Fairy. That is why there are fifteen types here and not eighteen,
 * and it is a real limit: a Gen III species that is Dark or Steel cannot be
 * added until this grows. None of the evolved forms in `species.ts` is either.
 *
 * Three cells were wrong against generation III, inherited from that tutorial
 * and kept knowingly until the roster grew (the captain's ruling of
 * 2026-09-19). The roster grew, so they are corrected here: Water and Grass
 * both did double damage to Electric and Electric did double damage to Ice,
 * where canon is neutral in all three. Two of them were live - a Squirtle's
 * Water Gun and a Bulbasaur's Vine Whip both hit a Pikachu for double, and
 * Pikachu is in the forest grass, on Raider Maya's team and on the hunter's
 * third tier. Nothing in the game is Ice, so the third was theory.
 */
const UNITY_TYPE_ORDER: readonly PokemonType[] = [
  Types.Normal,
  Types.Fire,
  Types.Water,
  Types.Electric,
  Types.Grass,
  Types.Ice,
  Types.Fighting,
  Types.Poison,
  Types.Ground,
  Types.Flying,
  Types.Psychic,
  Types.Bug,
  Types.Rock,
  Types.Ghost,
  Types.Dragon,
];

const TYPE_CHART: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.5, 0, 1],
  [1, 0.5, 0.5, 1, 2, 2, 1, 1, 1, 1, 1, 2, 0.5, 1, 0.5],
  [1, 2, 0.5, 1, 0.5, 1, 1, 1, 2, 1, 1, 1, 2, 1, 0.5],
  [1, 1, 2, 0.5, 0.5, 1, 1, 1, 0, 2, 1, 1, 1, 1, 0.5],
  [1, 0.5, 2, 1, 0.5, 1, 1, 0.5, 2, 0.5, 1, 0.5, 2, 1, 0.5],
  [1, 0.5, 0.5, 1, 2, 0.5, 1, 1, 2, 2, 1, 1, 1, 1, 2],
  [2, 1, 1, 1, 1, 2, 1, 0.5, 1, 0.5, 0.5, 0.5, 2, 0, 1],
  [1, 1, 1, 1, 2, 1, 1, 0.5, 0.5, 1, 1, 1, 0.5, 0.5, 1],
  [1, 2, 1, 2, 0.5, 1, 1, 2, 1, 0, 1, 0.5, 2, 1, 1],
  [1, 1, 1, 0.5, 2, 1, 2, 1, 1, 1, 1, 2, 0.5, 1, 1],
  [1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 0.5, 1, 1, 1, 1],
  [1, 0.5, 1, 1, 2, 1, 0.5, 0.5, 1, 0.5, 2, 1, 1, 0.5, 1],
  [1, 2, 1, 1, 1, 2, 0.5, 1, 0.5, 2, 1, 2, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
];

export const getTypeEffectiveness = (
  attackingType: PokemonType,
  defendingTypes: readonly PokemonType[],
): number =>
  defendingTypes.reduce(
    (multiplier, defendingType) =>
      multiplier *
      TYPE_CHART[UNITY_TYPE_ORDER.indexOf(attackingType)][UNITY_TYPE_ORDER.indexOf(defendingType)],
    1,
  );
