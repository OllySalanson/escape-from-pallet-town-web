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
  /**
   * Dark and Steel are generation II types, so they are part of generation III
   * and part of this game. They are not "later generations": Fairy is the only
   * one of the modern three that postdates FireRed/LeafGreen, and it alone is
   * left out - see `battle/typeChart.ts` for what the seventeen are held to.
   */
  Dark: 'Dark',
  Steel: 'Steel',
} as const;

export type PokemonType = (typeof PokemonType)[keyof typeof PokemonType];
