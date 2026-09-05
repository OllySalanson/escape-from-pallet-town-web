export const PokemonType = {
  Normal: 'Normal',
  Fire: 'Fire',
  Water: 'Water',
  Grass: 'Grass',
  Electric: 'Electric',
  Ice: 'Ice',
  Fighting: 'Fighting',
  Ground: 'Ground',
  Rock: 'Rock',
  Flying: 'Flying',
  Poison: 'Poison',
  Bug: 'Bug',
  Ghost: 'Ghost',
  Psychic: 'Psychic',
  Dragon: 'Dragon',
} as const;

export type PokemonType = (typeof PokemonType)[keyof typeof PokemonType];
