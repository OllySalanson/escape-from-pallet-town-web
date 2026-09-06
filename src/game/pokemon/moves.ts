import { MoveBase, MoveCategory } from './MoveBase';
import { PokemonType } from './PokemonType';

export const TACKLE = new MoveBase({
  name: 'Tackle',
  type: PokemonType.Normal,
  power: 40,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Physical,
});

export const GROWL = new MoveBase({
  name: 'Growl',
  type: PokemonType.Normal,
  power: 0,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Status,
  boosts: [{ stat: 'attack', stages: -1 }],
});

export const SCRATCH = new MoveBase({
  name: 'Scratch',
  type: PokemonType.Normal,
  power: 40,
  accuracy: 100,
  pp: 35,
  category: MoveCategory.Physical,
});

export const EMBER = new MoveBase({
  name: 'Ember',
  type: PokemonType.Fire,
  power: 40,
  accuracy: 100,
  pp: 25,
  category: MoveCategory.Special,
});

export const WATER_GUN = new MoveBase({
  name: 'Water Gun',
  type: PokemonType.Water,
  power: 40,
  accuracy: 100,
  pp: 25,
  category: MoveCategory.Special,
});

export const VINE_WHIP = new MoveBase({
  name: 'Vine Whip',
  type: PokemonType.Grass,
  power: 45,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Special,
});

export const POISON_POWDER = new MoveBase({
  name: 'Poison Powder',
  type: PokemonType.Poison,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
});

export const SING = new MoveBase({
  name: 'Sing',
  type: PokemonType.Poison,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
});

export const SUPER_SONIC = new MoveBase({
  name: 'Super Sonic',
  type: PokemonType.Normal,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
});

export const THUNDER_WAVE = new MoveBase({
  name: 'Thunder Wave',
  type: PokemonType.Poison,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
});
