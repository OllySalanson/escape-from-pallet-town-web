import { PokemonBase } from './PokemonBase';
import { PokemonType } from './PokemonType';
import { EMBER, GROWL, TACKLE, THUNDER_SHOCK, VINE_WHIP, WATER_GUN } from './moves';

export const BULBASAUR = new PokemonBase({
  name: 'Bulbasaur',
  primaryType: PokemonType.Grass,
  secondaryType: PokemonType.Poison,
  baseStats: {
    hp: 45,
    attack: 49,
    defense: 49,
    spAttack: 65,
    spDefense: 65,
    speed: 45,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 3, move: GROWL },
    { level: 7, move: VINE_WHIP },
  ],
  frontSprite: 'sprites/pokemon/bulbasaur_front.png',
  backSprite: 'sprites/pokemon/bulbasaur_back.png',
});

export const CHARMANDER = new PokemonBase({
  name: 'Charmander',
  primaryType: PokemonType.Fire,
  baseStats: {
    hp: 39,
    attack: 52,
    defense: 43,
    spAttack: 60,
    spDefense: 50,
    speed: 65,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: GROWL },
    { level: 7, move: EMBER },
  ],
  frontSprite: 'sprites/pokemon/charmander_front.png',
  backSprite: 'sprites/pokemon/charmander_back.png',
});

export const SQUIRTLE = new PokemonBase({
  name: 'Squirtle',
  primaryType: PokemonType.Water,
  baseStats: {
    hp: 44,
    attack: 48,
    defense: 65,
    spAttack: 50,
    spDefense: 64,
    speed: 43,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: GROWL },
    { level: 7, move: WATER_GUN },
  ],
  frontSprite: 'sprites/pokemon/squirtle_front.png',
  backSprite: 'sprites/pokemon/squirtle_back.png',
});

export const PIKACHU = new PokemonBase({
  name: 'Pikachu',
  primaryType: PokemonType.Electric,
  baseStats: {
    hp: 35,
    attack: 55,
    defense: 40,
    spAttack: 50,
    spDefense: 50,
    speed: 90,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: GROWL },
    { level: 6, move: THUNDER_SHOCK },
  ],
  frontSprite: 'sprites/pokemon/pikachu_front.png',
  backSprite: 'sprites/pokemon/pikachu_back.png',
});
