import { MoveBase, MoveCategory } from './MoveBase';
import { PokemonType } from './PokemonType';

export const TACKLE = new MoveBase({
  name: 'Tackle',
  description: 'A plain body slam. No side effect.',
  type: PokemonType.Normal,
  power: 40,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Physical,
});

export const GROWL = new MoveBase({
  name: 'Growl',
  description: "Lowers the target's Attack by one stage.",
  type: PokemonType.Normal,
  power: 0,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Status,
  boosts: [{ stat: 'attack', stages: -1 }],
});

export const SCRATCH = new MoveBase({
  name: 'Scratch',
  description: 'A plain raking blow. No side effect.',
  type: PokemonType.Normal,
  power: 40,
  accuracy: 100,
  pp: 35,
  category: MoveCategory.Physical,
});

export const EMBER = new MoveBase({
  name: 'Ember',
  description: 'A small flame. No side effect.',
  type: PokemonType.Fire,
  power: 40,
  accuracy: 100,
  pp: 25,
  category: MoveCategory.Special,
});

export const WATER_GUN = new MoveBase({
  name: 'Water Gun',
  description: 'A jet of water. No side effect.',
  type: PokemonType.Water,
  power: 40,
  accuracy: 100,
  pp: 25,
  category: MoveCategory.Special,
});

export const VINE_WHIP = new MoveBase({
  name: 'Vine Whip',
  description: 'A lash of vines. No side effect.',
  type: PokemonType.Grass,
  power: 45,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Special,
});

export const POISON_POWDER = new MoveBase({
  name: 'Poison Powder',
  description: 'Poisons the target. It loses HP each turn.',
  type: PokemonType.Poison,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
});

export const SING = new MoveBase({
  name: 'Sing',
  description: 'Puts the target to sleep for a few turns.',
  // Unity's Sing.asset and ThunderWave.asset both carry type 8 (Poison), which
  // is a data-entry slip beside PoisonPowder rather than a design choice. Typing
  // drives immunity and the move guidance panel, so both are corrected here.
  type: PokemonType.Normal,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
});

export const SUPER_SONIC = new MoveBase({
  name: 'Super Sonic',
  description: 'Confuses the target. It may hurt itself.',
  type: PokemonType.Normal,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
});

export const THUNDER_WAVE = new MoveBase({
  name: 'Thunder Wave',
  description: 'Paralyses the target. It may lose turns.',
  type: PokemonType.Electric,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
});
