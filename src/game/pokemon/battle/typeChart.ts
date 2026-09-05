import type { PokemonType } from '../PokemonType';

type TypeRow = Partial<Record<PokemonType, number>>;

const TYPE_CHART: Readonly<Record<PokemonType, TypeRow>> = {
  Normal: { Rock: 0.5, Ghost: 0 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Grass: {
    Fire: 0.5,
    Water: 2,
    Grass: 0.5,
    Poison: 0.5,
    Ground: 2,
    Flying: 0.5,
    Bug: 0.5,
    Rock: 2,
    Dragon: 0.5,
  },
  Electric: { Water: 2, Grass: 0.5, Electric: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ground: 2, Flying: 2, Ice: 0.5, Dragon: 2 },
  Fighting: {
    Normal: 2,
    Ice: 2,
    Poison: 0.5,
    Flying: 0.5,
    Psychic: 0.5,
    Bug: 0.5,
    Rock: 2,
    Ghost: 0,
  },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Bug: 2, Ghost: 0.5 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5 },
  Dragon: { Dragon: 2 },
};

export const getTypeEffectiveness = (
  attackingType: PokemonType,
  defendingTypes: readonly PokemonType[],
): number =>
  defendingTypes.reduce(
    (multiplier, defendingType) => multiplier * (TYPE_CHART[attackingType][defendingType] ?? 1),
    1,
  );
