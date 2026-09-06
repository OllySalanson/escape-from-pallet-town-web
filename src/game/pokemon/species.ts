import { PokemonBase } from './PokemonBase';
import { PokemonType } from './PokemonType';
import {
  EMBER,
  GROWL,
  POISON_POWDER,
  SCRATCH,
  SING,
  SUPER_SONIC,
  TACKLE,
  THUNDER_WAVE,
  VINE_WHIP,
} from './moves';

export const BULBASAUR = new PokemonBase({
  id: 'bulbasaur',
  dexId: 1,
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
    { level: 1, move: SUPER_SONIC },
    { level: 4, move: GROWL },
    { level: 7, move: VINE_WHIP },
  ],
  frontSprite: 'sprites/pokemon/bulbasaur_front.png',
  backSprite: 'sprites/pokemon/bulbasaur_back.png',
});

export const CHARMANDER = new PokemonBase({
  id: 'charmander',
  dexId: 4,
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
    { level: 1, move: SCRATCH },
    { level: 4, move: GROWL },
    { level: 7, move: EMBER },
  ],
  frontSprite: 'sprites/pokemon/charmander_front.png',
  backSprite: 'sprites/pokemon/charmander_back.png',
});

export const BUTTERFREE = new PokemonBase({
  id: 'butterfree',
  dexId: 12,
  name: 'Butterfree',
  primaryType: PokemonType.Bug,
  secondaryType: PokemonType.Flying,
  baseStats: {
    hp: 60,
    attack: 45,
    defense: 50,
    spAttack: 90,
    spDefense: 80,
    speed: 70,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 10, move: POISON_POWDER },
  ],
  frontSprite: 'sprites/pokemon/butterfree_front.png',
  backSprite: 'sprites/pokemon/butterfree_back.png',
});

export const PIKACHU = new PokemonBase({
  id: 'pikachu',
  dexId: 25,
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
    { level: 10, move: THUNDER_WAVE },
  ],
  frontSprite: 'sprites/pokemon/pikachu_front.png',
  backSprite: 'sprites/pokemon/pikachu_back.png',
});

export const JIGGLYPUFF = new PokemonBase({
  id: 'jigglypuff',
  dexId: 39,
  name: 'Jigglypuff',
  primaryType: PokemonType.Normal,
  baseStats: {
    hp: 115,
    attack: 45,
    defense: 20,
    spAttack: 45,
    spDefense: 20,
    speed: 20,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: GROWL },
    { level: 10, move: SING },
  ],
  frontSprite: 'sprites/pokemon/jigglypuff_front.png',
  backSprite: 'sprites/pokemon/jigglypuff_back.png',
});

export const PIDGEY = new PokemonBase({
  id: 'pidgey',
  dexId: 16,
  name: 'Pidgey',
  primaryType: PokemonType.Normal,
  secondaryType: PokemonType.Flying,
  baseStats: {
    hp: 40,
    attack: 45,
    defense: 40,
    spAttack: 35,
    spDefense: 35,
    speed: 56,
  },
  learnset: [{ level: 1, move: TACKLE }],
  frontSprite: 'sprites/pokemon/pidgey_front.png',
  backSprite: 'sprites/pokemon/pidgey_back.png',
});

export const SPECIES_BY_ID: Readonly<Record<string, PokemonBase>> = {
  [BULBASAUR.id]: BULBASAUR,
  [BUTTERFREE.id]: BUTTERFREE,
  [CHARMANDER.id]: CHARMANDER,
  [JIGGLYPUFF.id]: JIGGLYPUFF,
  [PIDGEY.id]: PIDGEY,
  [PIKACHU.id]: PIKACHU,
};

export const getSpeciesById = (speciesId: string): PokemonBase | undefined =>
  SPECIES_BY_ID[speciesId];
