export const PokemonType = {
  Normal: 'Normal',
  Fire: 'Fire',
  Water: 'Water',
  Grass: 'Grass',
  Electric: 'Electric',
  Flying: 'Flying',
  Poison: 'Poison',
} as const;

export type PokemonType = (typeof PokemonType)[keyof typeof PokemonType];
