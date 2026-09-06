import type { PokemonType } from '../PokemonType';
import { PokemonType as Types } from '../PokemonType';

// This order and every multiplier are ported from PokemonBase.cs in the Unity project.
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
  [1, 2, 0.5, 2, 0.5, 1, 1, 1, 2, 1, 1, 1, 2, 1, 0.5],
  [1, 1, 2, 0.5, 0.5, 2, 1, 1, 0, 2, 1, 1, 1, 1, 0.5],
  [1, 0.5, 2, 2, 0.5, 1, 1, 0.5, 2, 0.5, 1, 0.5, 2, 1, 0.5],
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
