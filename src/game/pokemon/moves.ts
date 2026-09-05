import { MoveBase, MoveCategory } from './MoveBase';
import { PokemonType } from './PokemonType';

export const TACKLE = new MoveBase({
  name: 'Tackle',
  type: PokemonType.Normal,
  power: 40,
  accuracy: 100,
  pp: 35,
  category: MoveCategory.Physical,
});

export const GROWL = new MoveBase({
  name: 'Growl',
  type: PokemonType.Normal,
  power: 0,
  accuracy: 100,
  pp: 40,
  category: MoveCategory.Status,
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
  pp: 25,
  category: MoveCategory.Physical,
});

export const THUNDER_SHOCK = new MoveBase({
  name: 'Thunder Shock',
  type: PokemonType.Electric,
  power: 40,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Special,
});
