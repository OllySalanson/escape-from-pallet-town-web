import type { AbilityBase, AbilityBlockedCondition } from './AbilityBase';
import { MoveCategory, MoveFlag } from './MoveBase';
import { PokemonType } from './PokemonType';
import { PrimaryStatus } from './battle/status';
import { WeatherId } from './battle/weather';

/**
 * Every ability this engine can express, as data.
 *
 * **Where the numbers come from.** `tools/abilities/frlg-abilities.json` is a
 * committed PokeAPI snapshot of what each of the 151 carries in FireRed and
 * LeafGreen, harvested with the three generation III traps its header names
 * handled (a hidden ability is generation V; `past_abilities` reads *forwards*,
 * not backwards; an ability can postdate generation III with no row to say so).
 * `node tools/abilities/coverage.mjs` measures this file against it and names
 * every ability it does not hold, with the reason.
 *
 * **What generation III means, where it differs from the headline.** PokeAPI
 * carries the change against the version group the *old* behaviour was last
 * right in, and four of those matter here: Shed Skin sheds at 1/3 rather than
 * the 30% the modern entry gives; Guts does not fire while its holder is
 * asleep; Sturdy blocks only one-hit KO moves, which is why it is not in this
 * file; and Stench and Pickup do nothing whatever in a generation III battle,
 * which is why they are not either.
 *
 * **One ability per species.** A generation III Pokemon is born into one of its
 * species' one or two ability slots, and nothing in a save records which - so
 * `PokemonBase.abilityId` is the species' first slot and every member of a
 * species plays the same. Ability slots are a thing to give a Pokemon, not a
 * thing to give a species, and that is the change that would make the second
 * slot real.
 */
export const ABILITIES: readonly AbilityBase[] = [
  // 1. The pinch abilities, and the one that reads a status instead.
  //
  // Generation III pitches all four of these at a third of maximum HP and 1.5x,
  // and each is the starter's own type - which is what makes a cornered starter
  // a different fight rather than a slower one.
  pinch('overgrow', 'Overgrow', PokemonType.Grass),
  pinch('blaze', 'Blaze', PokemonType.Fire),
  pinch('torrent', 'Torrent', PokemonType.Water),
  pinch('swarm', 'Swarm', PokemonType.Bug),
  {
    id: 'guts',
    name: 'Guts',
    description: 'Hits half again as hard while it is poisoned, burned or paralysed.',
    // Generation III and IV only: a sleeping holder gets nothing, which PokeAPI
    // records against `diamond-pearl` as the behaviour of everything up to it.
    modifyAttack: ({ holder, move }) =>
      move.category === MoveCategory.Physical &&
      holder.primaryStatus !== null &&
      holder.primaryStatus !== PrimaryStatus.Sleep
        ? 1.5
        : 1,
  },

  // 2. The numbers an ability changes without a condition attached.
  {
    id: 'compound-eyes',
    name: 'Compound Eyes',
    description: 'Its eyes pick out a target: every move it uses is a third more accurate.',
    modifyAccuracy: () => 1.3,
  },
  {
    id: 'thick-fat',
    name: 'Thick Fat',
    description: 'A layer of fat halves the damage Fire and Ice moves do to it.',
    modifyDamageTaken: ({ move }) =>
      move.type === PokemonType.Fire || move.type === PokemonType.Ice ? 0.5 : 1,
  },
  {
    id: 'shell-armor',
    name: 'Shell Armor',
    description: 'A hard shell: nothing lands a critical hit on it.',
    blocksCriticalHits: true,
  },
  {
    id: 'battle-armor',
    name: 'Battle Armor',
    description: 'Armour plating: nothing lands a critical hit on it.',
    blocksCriticalHits: true,
  },
  {
    id: 'rock-head',
    name: 'Rock Head',
    description: 'It takes no recoil from its own moves.',
    blocksRecoil: true,
  },

  // 3. Moves that do not reach it at all. Three of the four give something back
  // for the trouble, which is why one hook covers all four rather than an
  // immunity list and a separate heal.
  {
    id: 'levitate',
    name: 'Levitate',
    description: 'It floats clear of the ground, so Ground moves cannot reach it.',
    absorbsMoveType: (type) => (type === PokemonType.Ground ? {} : null),
  },
  {
    id: 'flash-fire',
    name: 'Flash Fire',
    description: 'Fire cannot touch it, and the first it swallows stokes its own by half.',
    absorbsMoveType: (type) => (type === PokemonType.Fire ? { charges: true } : null),
    modifyAttack: ({ holder, move }) =>
      holder.charged && move.type === PokemonType.Fire ? 1.5 : 1,
  },
  {
    id: 'water-absorb',
    name: 'Water Absorb',
    description: 'Water heals it for a quarter of its health instead of hurting it.',
    absorbsMoveType: (type) => (type === PokemonType.Water ? { heal: 1 / 4 } : null),
  },
  {
    id: 'volt-absorb',
    name: 'Volt Absorb',
    description: 'Electricity heals it for a quarter of its health instead of hurting it.',
    absorbsMoveType: (type) => (type === PokemonType.Electric ? { heal: 1 / 4 } : null),
  },
  {
    id: 'soundproof',
    name: 'Soundproof',
    description: 'It hears nothing: a move made of sound does not reach it.',
    blocksMoveFlag: MoveFlag.Sound,
  },

  // 4. Stats it will not let the other side take off it. A stat it lowers
  // itself is untouched, which is the whole of what `blocksBoost` is asked.
  {
    id: 'keen-eye',
    name: 'Keen Eye',
    description: 'Nothing can blind it: its accuracy cannot be lowered.',
    blocksBoost: (stat) => stat === 'accuracy',
  },
  {
    id: 'hyper-cutter',
    name: 'Hyper Cutter',
    description: 'Its pincers stay sharp: its Attack cannot be lowered.',
    blocksBoost: (stat) => stat === 'attack',
  },
  {
    id: 'clear-body',
    name: 'Clear Body',
    description: 'None of its stats can be lowered by anything else.',
    blocksBoost: () => true,
  },

  // 5. Conditions it will not take. Inner Focus is the same question asked of a
  // flinch, which is a condition here exactly as it is on a move.
  refuses('insomnia', 'Insomnia', 'It never sleeps.', PrimaryStatus.Sleep),
  refuses('vital-spirit', 'Vital Spirit', 'It is far too lively to fall asleep.', PrimaryStatus.Sleep),
  refuses('limber', 'Limber', 'It is too supple to be paralysed.', PrimaryStatus.Paralysis),
  refuses('immunity', 'Immunity', 'It cannot be poisoned.', PrimaryStatus.Poison),
  refuses('water-veil', 'Water Veil', 'A veil of water keeps it from being burned.', PrimaryStatus.Burn),
  refuses('own-tempo', 'Own Tempo', 'It marches to its own beat and cannot be confused.', 'confusion'),
  {
    id: 'inner-focus',
    name: 'Inner Focus',
    description: 'Its concentration holds: it cannot be made to flinch.',
    blocksStatus: (condition) => condition === 'flinch',
  },
  {
    id: 'shield-dust',
    name: 'Shield Dust',
    description: 'A dust that blocks the extra effect of every move that hits it.',
    blocksSecondaries: true,
  },
  {
    id: 'serene-grace',
    name: 'Serene Grace',
    description: 'The extra effect of its own moves is twice as likely to happen.',
    secondaryChanceMultiplier: 2,
  },

  // 6. What touching it costs. All four are 30% in generation III, and Effect
  // Spore spreads that 30% evenly over three conditions rather than adding to it.
  onContact('static', 'Static', 'Touching it may leave the attacker paralysed.', [PrimaryStatus.Paralysis]),
  onContact('poison-point', 'Poison Point', 'Touching its spines may poison the attacker.', [PrimaryStatus.Poison]),
  onContact('flame-body', 'Flame Body', 'Touching its body may burn the attacker.', [PrimaryStatus.Burn]),
  onContact(
    'effect-spore',
    'Effect Spore',
    'Touching its spores may paralyse, poison or put the attacker to sleep.',
    [PrimaryStatus.Paralysis, PrimaryStatus.Poison, PrimaryStatus.Sleep],
  ),
  {
    id: 'synchronize',
    name: 'Synchronize',
    description: 'A burn, poison or paralysis it is given is passed straight back.',
    reflectsStatus: (status) =>
      status === PrimaryStatus.Burn ||
      status === PrimaryStatus.Poison ||
      status === PrimaryStatus.Paralysis,
  },

  // 7. What it does with time. Both of these are the reason a status is worth
  // less against some Pokemon than others.
  {
    id: 'shed-skin',
    name: 'Shed Skin',
    description: 'It may shed its skin at the end of a turn and leave a status behind with it.',
    // 1/3 in generation III and IV. The modern 30% is the later value.
    endOfTurnCureChance: 1 / 3,
  },
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'It wakes from sleep twice as fast.',
    sleepTurnsPerTurn: 2,
  },
  {
    id: 'natural-cure',
    name: 'Natural Cure',
    description: 'Calling it back cures whatever is wrong with it.',
    curesOnSwitchOut: true,
  },

  // 8. The four that are only ever about the weather. Each asks `weather.ts`
  // what the field is and never what the field *does*: Chlorophyll wants to
  // know whether the sun is out, and the sun's own rules stay in one table.
  weatherSpeed('chlorophyll', 'Chlorophyll', 'sunlight', WeatherId.HarshSunlight),
  weatherSpeed('swift-swim', 'Swift Swim', 'rain', WeatherId.Rain),
  {
    id: 'sand-veil',
    name: 'Sand Veil',
    description: 'A sandstorm hides it and never scours it.',
    // A quarter harder to hit, written as what it does to the accuracy of a
    // move aimed at it, because evasion here is a stage and this is not one.
    modifyIncomingAccuracy: ({ weather }) => (weather === WeatherId.Sandstorm ? 1 / 1.25 : 1),
    shelteredFromWeather: (weather) => weather === WeatherId.Sandstorm,
  },
  {
    id: 'cloud-nine',
    name: 'Cloud Nine',
    description: 'While it is out, the weather does nothing to anybody.',
    suppressesWeather: true,
  },

  // 9. The rest: arriving, being drained, being aimed at, and being run from.
  {
    id: 'intimidate',
    name: 'Intimidate',
    description: 'It cows the other side as it arrives, lowering its Attack.',
    onSendOut: [{ stat: 'attack', stages: -1 }],
  },
  {
    id: 'liquid-ooze',
    name: 'Liquid Ooze',
    description: 'Anything that drains it is hurt by the taste instead of healed.',
    drainBackfires: true,
  },
  {
    id: 'pressure',
    name: 'Pressure',
    description: 'Standing against it is tiring: a move aimed at it costs an extra PP.',
    extraPpCost: 1,
  },
  {
    id: 'run-away',
    name: 'Run Away',
    description: 'It always gets away from a wild battle.',
    escapeAlwaysSucceeds: true,
  },
  {
    id: 'arena-trap',
    name: 'Arena Trap',
    description: 'Nothing on the ground can run from it.',
    // Generation III already excuses a Flying type and anything that floats,
    // and whether something floats is Levitate's business rather than this
    // one's - so the engine answers that as one question.
    preventsEscape: ({ foeIsGrounded }) => foeIsGrounded,
  },
  {
    id: 'magnet-pull',
    name: 'Magnet Pull',
    description: 'Steel cannot pull away from it.',
    preventsEscape: ({ foe }) => foe.types.includes(PokemonType.Steel),
  },
];

/**
 * Overgrow, Blaze, Torrent and Swarm are one ability with the type swapped, and
 * writing them out four times over would be four places for the third to drift.
 */
function pinch(id: string, name: string, type: PokemonType): AbilityBase {
  return {
    id,
    name,
    description: `Down to a third of its health, its ${type.toLowerCase()} moves hit half again as hard.`,
    modifyAttack: ({ holder, move }) =>
      move.type === type && holder.currentHp <= Math.floor(holder.maxHp / 3) ? 1.5 : 1,
  };
}

/** Chlorophyll and Swift Swim are one ability with the weather swapped. */
function weatherSpeed(id: string, name: string, what: string, weather: WeatherId): AbilityBase {
  return {
    id,
    name,
    description: `It moves twice as fast in ${what}.`,
    modifySpeed: (context) => (context.weather === weather ? 2 : 1),
  };
}

/** The six abilities that are one condition each, refused. */
function refuses(
  id: string,
  name: string,
  description: string,
  condition: AbilityBlockedCondition,
): AbilityBase {
  return { id, name, description, blocksStatus: (asked) => asked === condition };
}

/** The four that answer a touch with a condition, at generation III's 30%. */
function onContact(
  id: string,
  name: string,
  description: string,
  statuses: readonly PrimaryStatus[],
): AbilityBase {
  return { id, name, description, onDamagingHit: { chance: 30, statuses } };
}

export const ABILITIES_BY_ID: Readonly<Record<string, AbilityBase>> = Object.freeze(
  Object.fromEntries(ABILITIES.map((ability) => [ability.id, ability])),
);

export const getAbilityById = (abilityId: string | null | undefined): AbilityBase | undefined =>
  abilityId ? ABILITIES_BY_ID[abilityId] : undefined;
