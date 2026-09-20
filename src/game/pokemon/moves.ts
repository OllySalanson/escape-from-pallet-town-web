import { MoveBase, MoveCategory, MoveCharge, MoveFlag, MoveTarget } from './MoveBase';
import { PrimaryStatus } from './battle/status';
import { PokemonType } from './PokemonType';
import { WeatherId } from './battle/weather';

export const TACKLE = new MoveBase({
  name: 'Tackle',
  description: 'A plain body slam. No side effect.',
  type: PokemonType.Normal,
  power: 40,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Physical,
  flags: [MoveFlag.Contact],
});

/**
 * The five shipped moves that hit **both** foes.
 *
 * `MoveTarget.BothFoes` is PokeAPI's `all-opponents`, read off the committed
 * FireRed/LeafGreen snapshot in `tools/moves/` rather than chosen here: of the
 * 273 moves the 151 learn by level, seventeen carry it and five of them are
 * shipped - Growl, Tail Whip, Razor Leaf, Heat Wave and Bubble. PokeAPI has no
 * `past_values` for a move's target, so each of the five was checked by hand
 * against generation III, where all five were already all-adjacent-foes.
 *
 * In a single battle the value means nothing at all: one foe is one foe. It is
 * declared here so the double battle reads it rather than being handed a second
 * list of move names somewhere else.
 */
export const GROWL = new MoveBase({
  name: 'Growl',
  description: "Lowers the target's Attack by one stage.",
  type: PokemonType.Normal,
  power: 0,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Status,
  target: MoveTarget.BothFoes,
  effects: { boosts: [{ stat: 'attack', stages: -1 }] },
  flags: [MoveFlag.Sound],
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
  target: MoveTarget.BothFoes,
  effects: { boosts: [{ stat: 'defense', stages: -1 }] },
});

export const SCRATCH = new MoveBase({
  name: 'Scratch',
  description: 'A plain raking blow. No side effect.',
  type: PokemonType.Normal,
  power: 40,
  accuracy: 100,
  pp: 35,
  category: MoveCategory.Physical,
  flags: [MoveFlag.Contact],
});

export const EMBER = new MoveBase({
  name: 'Ember',
  description: 'A small flame. May leave a burn.',
  type: PokemonType.Fire,
  power: 40,
  accuracy: 100,
  pp: 25,
  category: MoveCategory.Special,
  secondaries: [{ chance: 10, status: PrimaryStatus.Burn }],
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
  flags: [MoveFlag.Contact],
});

export const POISON_POWDER = new MoveBase({
  name: 'Poison Powder',
  description: 'Poisons the target. It loses HP each turn.',
  type: PokemonType.Poison,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
  effects: { status: PrimaryStatus.Poison },
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
  effects: { status: PrimaryStatus.Sleep },
  flags: [MoveFlag.Sound],
});

export const SUPER_SONIC = new MoveBase({
  name: 'Super Sonic',
  description: 'Confuses the target. It may hurt itself.',
  type: PokemonType.Normal,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
  effects: { status: 'confusion' },
  flags: [MoveFlag.Sound],
});

export const THUNDER_WAVE = new MoveBase({
  name: 'Thunder Wave',
  description: 'Paralyses the target. It may lose turns.',
  type: PokemonType.Electric,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
  // Electric, so a Ground type is immune. That used to be true of the damage
  // and false of the paralysis, because the status branch never asked.
  effects: { status: PrimaryStatus.Paralysis },
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
// Every one of these now carries the secondary effect it has in canon. They
// shipped without one because the engine had nowhere to put it - Flamethrower's
// 10% burn, Thunderbolt's 10% paralysis, Bubble's Speed drop and Slash's raised
// critical ratio were all simply dropped, and two of them shipped a
// player-facing description reading "No side effect." That was the engine's
// limit being written into the fiction as though it were canon.
// ---------------------------------------------------------------------------

export const SLEEP_POWDER = new MoveBase({
  name: 'Sleep Powder',
  description: 'Puts the target to sleep for a few turns.',
  type: PokemonType.Grass,
  power: 0,
  accuracy: 75,
  pp: 15,
  category: MoveCategory.Status,
  effects: { status: PrimaryStatus.Sleep },
});

export const RAZOR_LEAF = new MoveBase({
  name: 'Razor Leaf',
  description: 'A volley of sharp leaves. Crits often.',
  type: PokemonType.Grass,
  power: 55,
  accuracy: 95,
  pp: 25,
  category: MoveCategory.Special,
  target: MoveTarget.BothFoes,
  critStage: 1,
});

export const SCARY_FACE = new MoveBase({
  name: 'Scary Face',
  description: "Lowers the target's Speed by two stages.",
  type: PokemonType.Normal,
  power: 0,
  accuracy: 90,
  pp: 10,
  category: MoveCategory.Status,
  effects: { boosts: [{ stat: 'speed', stages: -2 }] },
});

export const FLAMETHROWER = new MoveBase({
  name: 'Flamethrower',
  description: 'A hard jet of fire. May leave a burn.',
  type: PokemonType.Fire,
  power: 95,
  accuracy: 100,
  pp: 15,
  category: MoveCategory.Special,
  secondaries: [{ chance: 10, status: PrimaryStatus.Burn }],
});

export const HEAT_WAVE = new MoveBase({
  name: 'Heat Wave',
  description: 'A blast of searing wind. May burn.',
  type: PokemonType.Fire,
  power: 100,
  accuracy: 90,
  pp: 10,
  category: MoveCategory.Special,
  target: MoveTarget.BothFoes,
  secondaries: [{ chance: 10, status: PrimaryStatus.Burn }],
});

export const SLASH = new MoveBase({
  name: 'Slash',
  description: 'A raking cut with claws. Crits often.',
  type: PokemonType.Normal,
  power: 70,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Physical,
  critStage: 1,
  flags: [MoveFlag.Contact],
});

export const WING_ATTACK = new MoveBase({
  name: 'Wing Attack',
  description: 'A strike with spread wings. No side effect.',
  type: PokemonType.Flying,
  power: 60,
  accuracy: 100,
  pp: 35,
  category: MoveCategory.Physical,
  flags: [MoveFlag.Contact],
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
  effects: { boosts: [{ stat: 'attack', stages: -2 }] },
});

export const BUBBLE = new MoveBase({
  name: 'Bubble',
  description: "A spray of bubbles. May cut the target's Speed.",
  type: PokemonType.Water,
  power: 20,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Special,
  target: MoveTarget.BothFoes,
  secondaries: [{ chance: 10, boosts: [{ stat: 'speed', stages: -1 }] }],
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
  description: 'A weak jolt. May paralyse the target.',
  type: PokemonType.Electric,
  power: 40,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Special,
  secondaries: [{ chance: 10, status: PrimaryStatus.Paralysis }],
});

export const THUNDERBOLT = new MoveBase({
  name: 'Thunderbolt',
  description: 'A strong jolt. May paralyse the target.',
  type: PokemonType.Electric,
  power: 95,
  accuracy: 100,
  pp: 15,
  category: MoveCategory.Special,
  secondaries: [{ chance: 10, status: PrimaryStatus.Paralysis }],
});

// ---------------------------------------------------------------------------
// Dark and Steel
//
// These two are the reason the type chart grew from fifteen to seventeen. They
// are not exotic late-game moves: **Charmander learns Metal Claw at level 13
// and Squirtle learns Bite at 18** in FireRed/LeafGreen, so two of the three
// starters carry one within the first hours. Until the chart had Dark and Steel
// in it they could not be authored at all, and `evolution.ts` listed both as
// moves left out for that reason.
//
// Category follows the generation III rule - by *type*, not per move - which
// makes **Bite Special** (Dark is a special type in generation III) and **Metal
// Claw Physical**. A modern dex disagrees on Bite: the per-move physical/special
// split arrived in generation IV.
//
// Both carry a secondary effect this engine cannot yet express - Bite flinches
// on 30%, Metal Claw raises the user's own Attack on 10% - so they ship with
// the numbers right and the secondary absent, and their descriptions say what
// they actually do rather than claiming there is nothing more to them.
// ---------------------------------------------------------------------------

export const BITE = new MoveBase({
  name: 'Bite',
  description: 'A savage bite. May make the target flinch.',
  type: PokemonType.Dark,
  power: 60,
  accuracy: 100,
  pp: 25,
  category: MoveCategory.Special,
  flags: [MoveFlag.Contact, MoveFlag.Bite],
  secondaries: [{ chance: 30, flinch: true }],
});

export const METAL_CLAW = new MoveBase({
  name: 'Metal Claw',
  description: "A rake with steel claws. May raise the user's Attack.",
  type: PokemonType.Steel,
  power: 50,
  accuracy: 95,
  pp: 35,
  category: MoveCategory.Physical,
  flags: [MoveFlag.Contact],
  // The one secondary in the shipped set that lands on the **user**, which is
  // why `MoveTarget` had to be ported before this move could be written down.
  secondaries: [{ chance: 10, target: MoveTarget.Self, boosts: [{ stat: 'attack', stages: 1 }] }],
});

// ---------------------------------------------------------------------------
// The moves the old shape could not hold
//
// Each one is a category `evolution.ts` used to list as "left out rather than
// approximated", and each is now a data row and nothing else - no branch in the
// engine knows any of their names.
//
// **Generation III numbers, and canon learnset levels.** They are placed only
// where they cannot quietly change the balance of the shipped game: every level
// below is **above the highest level anything is fielded at today** (a trainer's
// twelve, the hunter's enraged fifteen), so nothing the player meets gains a
// move it did not have. Where canon's only slot is lower - Pidgey's Sand Attack
// at 5, Pikachu's Quick Attack at 11, Butterfree's Confusion at 1, Squirtle's
// Withdraw at 10 - the move waits for the import, because AGENTS.md is explicit
// that a learnset change to the early game is measured rather than assumed.
//
// Two categories the model expresses with no shipped move to show them: **drain**
// (Absorb, Mega Drain, Leech Life - nothing in this seventeen-strong roster
// learns one by level in FRLG) and **recharge** (Hyper Beam is a machine, not a
// level-up move here). Both are held by `battleEngine.test.ts` instead.
// ---------------------------------------------------------------------------

/** Priority. Goes first whatever the Speed, which nothing could express before. */
export const QUICK_ATTACK = new MoveBase({
  name: 'Quick Attack',
  description: 'A blindingly fast strike. Always goes first.',
  type: PokemonType.Normal,
  power: 40,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Physical,
  priority: 1,
  flags: [MoveFlag.Contact],
});

/** Multi-hit. Two to five times, on generation III's own weighting. */
export const DOUBLE_SLAP = new MoveBase({
  name: 'Double Slap',
  description: 'Slaps two to five times in one turn.',
  type: PokemonType.Normal,
  power: 15,
  accuracy: 85,
  pp: 10,
  category: MoveCategory.Physical,
  hits: { min: 2, max: 5 },
  flags: [MoveFlag.Contact],
});

/** Recoil: a third of the damage dealt, back onto the user. */
export const DOUBLE_EDGE = new MoveBase({
  name: 'Double-Edge',
  description: 'A reckless tackle. The user takes a third of it back.',
  type: PokemonType.Normal,
  power: 120,
  accuracy: 100,
  pp: 15,
  category: MoveCategory.Physical,
  recoil: 1 / 3,
  flags: [MoveFlag.Contact],
});

/** A stat stage on the **user**, and a move that cannot miss. */
export const AGILITY = new MoveBase({
  name: 'Agility',
  description: "Raises the user's own Speed by two stages.",
  type: PokemonType.Psychic,
  power: 0,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Status,
  target: MoveTarget.Self,
  alwaysHits: true,
  effects: { boosts: [{ stat: 'speed', stages: 2 }] },
});

/** An accuracy stage, which `StatStages` had no room for until now. */
export const SMOKESCREEN = new MoveBase({
  name: 'Smokescreen',
  description: "Lowers the target's accuracy by one stage.",
  type: PokemonType.Normal,
  power: 0,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Status,
  effects: { boosts: [{ stat: 'accuracy', stages: -1 }] },
});

/** The other half of that pair: an evasion stage, on the user. */
export const DOUBLE_TEAM = new MoveBase({
  name: 'Double Team',
  description: "Raises the user's own evasion by one stage.",
  type: PokemonType.Normal,
  power: 0,
  accuracy: 100,
  pp: 15,
  category: MoveCategory.Status,
  target: MoveTarget.Self,
  alwaysHits: true,
  effects: { boosts: [{ stat: 'evasion', stages: 1 }] },
});

/** Healing. Nothing but damage and the status tick used to write HP. */
export const SYNTHESIS = new MoveBase({
  name: 'Synthesis',
  description: 'Restores half of the user’s maximum HP.',
  type: PokemonType.Grass,
  power: 0,
  accuracy: 100,
  pp: 5,
  category: MoveCategory.Status,
  target: MoveTarget.Self,
  alwaysHits: true,
  healing: 0.5,
});

/** Two-turn: one turn absorbing light, the next firing. */
export const SOLAR_BEAM = new MoveBase({
  name: 'Solar Beam',
  description: 'Absorbs light for a turn, then fires on the next.',
  type: PokemonType.Grass,
  power: 120,
  accuracy: 100,
  pp: 10,
  category: MoveCategory.Special,
  charge: MoveCharge.Charge,
});

/** Effect chance at its most common weight, on a primary status. */
export const BODY_SLAM = new MoveBase({
  name: 'Body Slam',
  description: 'A full-body drop. May paralyse the target.',
  type: PokemonType.Normal,
  power: 85,
  accuracy: 100,
  pp: 15,
  category: MoveCategory.Physical,
  flags: [MoveFlag.Contact],
  secondaries: [{ chance: 30, status: PrimaryStatus.Paralysis }],
});

/** Confusion as a rolled secondary rather than a guaranteed one. */
export const PSYBEAM = new MoveBase({
  name: 'Psybeam',
  description: 'A peculiar ray. May confuse the target.',
  type: PokemonType.Psychic,
  power: 65,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Special,
  secondaries: [{ chance: 10, status: 'confusion' }],
});

// ---------------------------------------------------------------------------
// Taught from a machine
//
// The six moves no Pokemon in this game learns by levelling. They are reached
// only through a TM or an HM (`./machines.ts` is which species may be taught
// which, and `../items/items.ts` carries the discs themselves), and each one is
// a different thing the move model of PR #130 made writable - multi-hit, a
// rolled status, a rolled stat stage, a two-turn charge, an accuracy roll
// skipped outright, and a guaranteed-odds stat drop on a move too weak to be
// worth a slot without it.
//
// Every number is FireRed/LeafGreen's, out of the committed PokeAPI snapshot at
// `tools/moves/frlg-machines.json`; `machines.test.ts` reads that file back and
// fails any of these that drifts from it. Category follows the generation III
// rule - by **type**, not per move - which is why Bullet Seed is Special here
// and physical in a modern dex.
// ---------------------------------------------------------------------------

/** TM09. Grass, and Special: the per-move split is generation IV's. */
export const BULLET_SEED = new MoveBase({
  name: 'Bullet Seed',
  description: 'Fires two to five seeds in one turn.',
  type: PokemonType.Grass,
  power: 10,
  accuracy: 100,
  pp: 30,
  category: MoveCategory.Special,
  hits: { min: 2, max: 5 },
});

/** TM13. The only Ice move in the game, and the only way to freeze anything. */
export const ICE_BEAM = new MoveBase({
  name: 'Ice Beam',
  description: 'A beam of cold. May freeze the target.',
  type: PokemonType.Ice,
  power: 95,
  accuracy: 100,
  pp: 10,
  category: MoveCategory.Special,
  secondaries: [{ chance: 10, status: PrimaryStatus.Freeze }],
});

/** TM23. Hard and inaccurate, and it softens what it does connect with. */
export const IRON_TAIL = new MoveBase({
  name: 'Iron Tail',
  description: "A heavy steel tail. May lower the target's Defense.",
  type: PokemonType.Steel,
  power: 100,
  accuracy: 75,
  pp: 15,
  category: MoveCategory.Physical,
  flags: [MoveFlag.Contact],
  secondaries: [{ chance: 30, boosts: [{ stat: 'defense', stages: -1 }] }],
});

/** TM28. Two-turn, like Solar Beam - a turn underground, then the hit. */
export const DIG = new MoveBase({
  name: 'Dig',
  description: 'Burrows on the first turn and strikes on the second.',
  type: PokemonType.Ground,
  power: 60,
  accuracy: 100,
  pp: 10,
  category: MoveCategory.Physical,
  charge: MoveCharge.Charge,
  flags: [MoveFlag.Contact],
});

/** TM40. No accuracy roll at all: the one move here that cannot miss. */
export const AERIAL_ACE = new MoveBase({
  name: 'Aerial Ace',
  description: 'A sweep too fast to dodge. It never misses.',
  type: PokemonType.Flying,
  power: 60,
  accuracy: 100,
  pp: 20,
  category: MoveCategory.Physical,
  alwaysHits: true,
  flags: [MoveFlag.Contact],
});

/**
 * HM06, and the one machine that is never used up. Twenty power is the whole
 * reason that is safe: it is a lever rather than a weapon, and what earns it a
 * slot is the coin-flip Defense drop in front of whatever hits next.
 */
export const ROCK_SMASH = new MoveBase({
  name: 'Rock Smash',
  description: "A blow that often lowers the target's Defense.",
  type: PokemonType.Fighting,
  power: 20,
  accuracy: 100,
  pp: 15,
  category: MoveCategory.Physical,
  flags: [MoveFlag.Contact],
  secondaries: [{ chance: 50, boosts: [{ stat: 'defense', stages: -1 }] }],
});

/**
 * Weather, as a move. It changes neither side: it changes the field both sides
 * are standing on, for five turns.
 *
 * Rain Dance is the only one of generation III's four weather moves that any of
 * the shipped roster learns by level - the Squirtle line, at 33/37/42 in
 * FireRed/LeafGreen. Of the whole 151, `tools/moves/frlg-level-up-moves.json`
 * counts seven level-up learners for Rain Dance, three for Sandstorm and one
 * for Sunny Day, and **none at all for Hail**: it exists in generation III, but
 * no Kanto species is taught it by levelling. Sandstorm and Sunny Day are left
 * unauthored for the same reason every other move is - nothing in the roster
 * reaches them - and the engine expresses all four, which is what
 * `tools/moves/coverage.mjs` now counts. All four are also discs in FireRed
 * (TM18, TM11, TM37, TM07); `./machines.ts` carries none of them yet, and a
 * disc is the obvious way to put weather in a player's hands on purpose.
 */
export const RAIN_DANCE = new MoveBase({
  name: 'Rain Dance',
  description: 'Calls down rain for five turns: Water hits harder, Fire softer.',
  type: PokemonType.Water,
  power: 0,
  accuracy: 100,
  pp: 5,
  category: MoveCategory.Status,
  target: MoveTarget.Self,
  alwaysHits: true,
  effects: { weather: WeatherId.Rain },
});
