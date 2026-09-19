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

/**
 * Squirtle's opening move in the source material, and the one thing that turns
 * its defensive stat line into a win condition: at level 5 every starter's
 * stats sit within a point of each other, so bulk only pays off in a fight long
 * enough to spend a turn setting up. Unity has no Squirtle and no Tail Whip;
 * this is authored here, and uses nothing but the stat-stage boost Growl
 * already runs through.
 */
export const TAIL_WHIP = new MoveBase({
  name: 'Tail Whip',
  description: "Lowers the target's Defense by one stage.",
  type: PokemonType.Normal,
  power: 0,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Status,
  boosts: [{ stat: 'defense', stages: -1 }],
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

// ---------------------------------------------------------------------------
// The evolved forms' moves
//
// **Generation III - FireRed/LeafGreen - for every number below**, which is the
// generation this game is (see `species.ts`). Six of these were changed later
// and carry the Gen III value, not the modern one: Bubble's power, Scary Face's
// accuracy, and Flamethrower's, Heat Wave's, Hydro Pump's and Thunderbolt's
// power. Category follows the Gen III rule too, where a move is physical or
// special by its *type* rather than per move - which is what the shipped moves
// already do, Vine Whip and Ember both being Special here and physical in the
// modern games.
//
// The shipped moves above are Unity's, and two of them are on modern numbers
// rather than Gen III's: Tackle is 40/100 where Gen III is 35/95, and Vine Whip
// is 45 power where Gen III is 35. They are left alone - Tackle is the opening
// move of every starter and every early wild Pokemon, so changing it is an
// early-balance change, which AGENTS.md says to measure rather than port - and
// the PR raising this file lists both for the captain.
//
// A move is here only if this engine can represent it without inventing
// anything: plain damage, one of the six statuses, or a stat stage on the
// target. Moves in the same learnsets that it cannot represent are left out
// rather than approximated - see `evolution.ts` for the list and the reason.
// Where a canon move carries a secondary effect on top of something
// representable (Flamethrower's 10% burn, Thunderbolt's 10% paralysis, Slash's
// raised critical ratio), the move ships without that secondary and its
// description says only what it actually does.
// ---------------------------------------------------------------------------

export const SLEEP_POWDER = new MoveBase({
  name: 'Sleep Powder',
  description: 'Puts the target to sleep for a few turns.',
  type: PokemonType.Grass,
  power: 0,
  accuracy: 75,
  pp: 15,
  category: MoveCategory.Status,
});

export const RAZOR_LEAF = new MoveBase({
  name: 'Razor Leaf',
  description: 'A volley of sharp leaves. No side effect.',
  type: PokemonType.Grass,
  power: 55,
  accuracy: 95,
  pp: 25,
  category: MoveCategory.Special,
});

export const SCARY_FACE = new MoveBase({
  name: 'Scary Face',
  description: "Lowers the target's Speed by two stages.",
  type: PokemonType.Normal,
  power: 0,
  accuracy: 90,
  pp: 10,
  category: MoveCategory.Status,
  boosts: [{ stat: 'speed', stages: -2 }],
});

export const FLAMETHROWER = new MoveBase({
  name: 'Flamethrower',
  description: 'A hard jet of fire. No side effect.',
  type: PokemonType.Fire,
  power: 95,
  accuracy: 100,
  pp: 15,
  category: MoveCategory.Special,
});

export const HEAT_WAVE = new MoveBase({
  name: 'Heat Wave',
  description: 'A blast of searing wind. No side effect.',
  type: PokemonType.Fire,
  power: 100,
  accuracy: 90,
  pp: 10,
  category: MoveCategory.Special,
});

export const SLASH = new MoveBase({
  name: 'Slash',
  description: 'A raking cut with claws. No side effect.',
  type: PokemonType.Normal,
  power: 70,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Physical,
});

export const WING_ATTACK = new MoveBase({
  name: 'Wing Attack',
  description: 'A strike with spread wings. No side effect.',
  type: PokemonType.Flying,
  power: 60,
  accuracy: 100,
  pp: 35,
  category: MoveCategory.Physical,
});

export const GUST = new MoveBase({
  name: 'Gust',
  description: 'A whipped-up wind. No side effect.',
  type: PokemonType.Flying,
  power: 40,
  accuracy: 100,
  pp: 35,
  category: MoveCategory.Physical,
});

export const FEATHER_DANCE = new MoveBase({
  name: 'Feather Dance',
  description: "Lowers the target's Attack by two stages.",
  type: PokemonType.Flying,
  power: 0,
  accuracy: 100,
  pp: 15,
  category: MoveCategory.Status,
  boosts: [{ stat: 'attack', stages: -2 }],
});

export const BUBBLE = new MoveBase({
  name: 'Bubble',
  description: 'A spray of bubbles. No side effect.',
  type: PokemonType.Water,
  power: 20,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Special,
});

export const HYDRO_PUMP = new MoveBase({
  name: 'Hydro Pump',
  description: 'A torrent of water. Powerful, and it misses.',
  type: PokemonType.Water,
  power: 120,
  accuracy: 80,
  pp: 5,
  category: MoveCategory.Special,
});

export const THUNDER_SHOCK = new MoveBase({
  name: 'Thunder Shock',
  description: 'A weak jolt of electricity. No side effect.',
  type: PokemonType.Electric,
  power: 40,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Special,
});

export const THUNDERBOLT = new MoveBase({
  name: 'Thunderbolt',
  description: 'A strong jolt of electricity. No side effect.',
  type: PokemonType.Electric,
  power: 95,
  accuracy: 100,
  pp: 15,
  category: MoveCategory.Special,
});
