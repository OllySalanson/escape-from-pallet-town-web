import type { AbilityEffectKind } from '../AbilityBase';
import type { MoveBase, NormalizedMoveEffects, NormalizedSecondaryEffect } from '../MoveBase';
import { MoveCategory, MoveCharge, MoveTarget } from '../MoveBase';
import type { Pokemon } from '../Pokemon';
import type { PokemonType } from '../PokemonType';
import {
  type AbilityCarrier,
  abilityLabel,
  absorbedHeal,
  absorbs,
  accuracyMultiplier,
  blocksBoost,
  blocksCondition,
  blocksRecoil,
  blocksSecondaries,
  contactStatus,
  curesOnSwitchOut,
  drainBackfires,
  extraPpCost,
  incomingAccuracyMultiplier,
  reflectsStatus,
  secondaryChance,
  sendOutBoosts,
  shedsStatus,
  shelteredFromWeather,
  sleepTurnsPerTurn,
  speedMultiplier,
  suppressesWeather,
} from './abilityHooks';
import { calculateDamage, type DamageAbilities, type RandomSource } from './damage';
import {
  endOfTurnHeal,
  gearLabel,
  rollsFirstStrike,
  survivesKnockout,
} from './heldItems';
import { PrimaryStatus, type PrimaryStatus as PrimaryStatusType, type StatusName } from './status';
import { getTypeEffectiveness } from './typeChart';
import { WEATHER_MOVE_TURNS, weatherChipDamage, type WeatherId } from './weather';
import {
  applyStatBoost,
  createStatStages,
  getStagedStat,
  stagedAccuracy,
  type StageStat,
  type StatBoost,
  type StatStages,
} from './statStages';

export interface BattleMove {
  readonly base: MoveBase;
  readonly pp: number;
}

export interface BattleCombatant {
  readonly pokemon: Pokemon;
  readonly currentHp: number;
  readonly moves: readonly BattleMove[];
  readonly primaryStatus: PrimaryStatusType | null;
  readonly sleepTurns: number;
  readonly confusionTurns: number;
  readonly statStages: StatStages;
  /**
   * Whether the gear this Pokemon carries has already done its one thing in this
   * battle - a Focus Band that has taken its blow.
   *
   * *Which* item is held is not copied here: it is read through to
   * `pokemon.heldItemId`, so the fight can never disagree with the party about
   * what is being carried, the way a copied move list used to disagree after a
   * level-up. What belongs to the fight is only this flag, and it resets when the
   * Pokemon is sent out, exactly as sleep turns and stat stages do.
   */
  readonly heldItemSpent: boolean;
  /**
   * Whether this Pokemon's ability has done its one thing in this battle. Flash
   * Fire is the only thing that sets it - the fire it swallowed is what powers
   * its own from then on - and, exactly as with `heldItemSpent`, *which*
   * ability is carried is never copied here but read through to the species.
   */
  readonly abilityCharged: boolean;
  /**
   * Whether this ability has already introduced itself in the log.
   *
   * An ability that changes a number every turn - a pinch boost, Compound Eyes,
   * Thick Fat, armour turning a critical aside - says so once and then stays
   * quiet, because the player has to be able to learn what their ability does
   * by playing and a line every turn is not a lesson, it is noise. Everything
   * discrete is said each time it happens.
   */
  readonly abilityAnnounced: boolean;
  /**
   * Set by whoever moved first this turn, read and spent by whoever moves
   * second. It is cleared at the top of every turn for both sides, which is
   * what makes "a flinch only works if you were faster" true by construction
   * rather than by a check.
   */
  readonly flinching: boolean;
  /**
   * A move that has taken this combatant's next action away from it: a charge
   * turn that must land, or a recharge that must be sat out. It survives into
   * the next turn, which is the one thing `applyMove` could not do - an action
   * used to be resolved entirely inside one call.
   */
  readonly pendingMove: PendingMove | null;
}

export interface PendingMove {
  readonly moveIndex: number;
  /** `charge` will fire the move next turn; `recharge` will lose the turn. */
  readonly kind: MoveCharge;
}

export interface TrainerBattle {
  readonly id: string;
  readonly name: string;
  readonly party: readonly Pokemon[];
  readonly sprite?: string;
  readonly defeatText?: string;
  readonly prize?: string;
}

/**
 * The weather over this fight: which, and how many turns it has left.
 *
 * `turnsRemaining` is null for weather that has no clock - the weather a
 * *place* has, which is the field for as long as the fight is fought there.
 * Weather a move brings on carries `WEATHER_MOVE_TURNS` and counts down.
 */
export interface ActiveWeather {
  readonly id: WeatherId;
  readonly turnsRemaining: number | null;
}

export interface BattleState {
  readonly player: BattleCombatant;
  readonly enemy: BattleCombatant;
  readonly playerStatStages: ReadonlyMap<Pokemon, StatStages>;
  readonly trainer?: TrainerBattle;
  readonly enemyPartyIndex: number;
  readonly outcome: 'active' | 'victory' | 'defeat' | 'caught';
  /** The tutorial's `BattleField`, which is one field wide so far. */
  readonly weather: ActiveWeather | null;
  /**
   * The weather this *place* has, if any. A move covers it for five turns and
   * then hands it back, because a squall does not stop a fight being outdoors
   * in a sandstorm - see `weather.ts`.
   */
  readonly ambientWeather: WeatherId | null;
}

export type BattleEvent =
  | {
      readonly type: 'used-move';
      readonly user: 'player' | 'enemy';
      readonly target?: 'player' | 'enemy';
      readonly name: string;
      readonly move: string;
      /**
       * The HP the hit actually took, which is what the battle log prints. A
       * hit that rolled 5 into a target on 2 HP cost it 2: reporting the roll
       * made the log claim more HP than the bar had ever shown.
       */
      readonly damage?: number;
      /** What kind of move it was, so the hit can sound like one. */
      readonly category?: MoveCategory;
      /** The web game's same-type bonus, reported so its 1.5x is not hidden. */
      readonly isStab?: boolean;
    }
  | { readonly type: 'missed'; readonly user: 'player' | 'enemy' }
  | { readonly type: 'critical-hit' }
  | { readonly type: 'effectiveness'; readonly multiplier: number }
  | { readonly type: 'fainted'; readonly user: 'player' | 'enemy'; readonly name: string }
  | { readonly type: 'no-pp'; readonly user: 'player' | 'enemy'; readonly move: string }
  | { readonly type: 'status-applied'; readonly user: 'player' | 'enemy'; readonly name: string; readonly status: StatusName }
  | { readonly type: 'status-already'; readonly user: 'player' | 'enemy'; readonly name: string; readonly status: StatusName }
  | { readonly type: 'status-prevented'; readonly user: 'player' | 'enemy'; readonly name: string; readonly status: PrimaryStatusType }
  | { readonly type: 'status-damage'; readonly user: 'player' | 'enemy'; readonly name: string; readonly status: PrimaryStatusType; readonly damage: number }
  | { readonly type: 'status-cured'; readonly user: 'player' | 'enemy'; readonly name: string; readonly status: 'sleep' | 'freeze' | 'confusion' }
  | { readonly type: 'confusion-self-hit'; readonly user: 'player' | 'enemy'; readonly name: string; readonly damage: number }
  | { readonly type: 'stat-stage-changed'; readonly user: 'player' | 'enemy'; readonly name: string; readonly stat: StageStat; readonly stages: number }
  // What a move does beyond its damage, each announced where it happens, so the
  // battle log explains a turn without the player having to read the HP bar.
  | { readonly type: 'flinched'; readonly user: 'player' | 'enemy'; readonly name: string }
  | { readonly type: 'multi-hit'; readonly hits: number }
  | { readonly type: 'drained'; readonly user: 'player' | 'enemy'; readonly name: string; readonly amount: number }
  | { readonly type: 'recoil'; readonly user: 'player' | 'enemy'; readonly name: string; readonly damage: number }
  | { readonly type: 'healed'; readonly user: 'player' | 'enemy'; readonly name: string; readonly amount: number }
  | { readonly type: 'heal-failed'; readonly user: 'player' | 'enemy'; readonly name: string }
  | { readonly type: 'charging'; readonly user: 'player' | 'enemy'; readonly name: string; readonly move: string }
  | { readonly type: 'recharging'; readonly user: 'player' | 'enemy'; readonly name: string }
  | { readonly type: 'ball-thrown'; readonly name: string }
  | { readonly type: 'catch-shake'; readonly count: number }
  | { readonly type: 'caught'; readonly name: string }
  | { readonly type: 'broke-free'; readonly name: string }
  | { readonly type: 'catch-disabled' }
  | { readonly type: 'enemy-sent-out'; readonly name: string }
  // Gear. Each one is announced the moment it acts, because an item whose effect
  // is only visible in the HP bar is an item the player has to be told about in
  // a menu - and the whole point of these four is that they explain themselves.
  | { readonly type: 'gear-first-strike'; readonly user: 'player' | 'enemy'; readonly name: string; readonly item: string }
  | { readonly type: 'gear-endured'; readonly user: 'player' | 'enemy'; readonly name: string; readonly item: string }
  | { readonly type: 'gear-recoil'; readonly user: 'player' | 'enemy'; readonly name: string; readonly item: string; readonly damage: number }
  | { readonly type: 'gear-heal'; readonly user: 'player' | 'enemy'; readonly name: string; readonly item: string; readonly amount: number }
  // Weather. It is the one thing in a fight that belongs to neither side, so
  // each of these names the field rather than a combatant - except the chip,
  // which is the weather taking HP off someone and says whose.
  | { readonly type: 'weather-set'; readonly weather: WeatherId; readonly byMove: boolean }
  | { readonly type: 'weather-ended'; readonly weather: WeatherId }
  | { readonly type: 'weather-damage'; readonly user: 'player' | 'enemy'; readonly name: string; readonly weather: WeatherId; readonly damage: number }
  // Abilities. A player is never shown their ability in a menu, so the only way
  // to learn what it does is to watch it happen - which is why everything an
  // ability does arrives as one of these, and `battlePresentation.ts` has a
  // line for every `AbilityEffectKind`.
  | {
      readonly type: 'ability';
      readonly user: 'player' | 'enemy';
      readonly name: string;
      /** In capitals, as the log names gear and moves. */
      readonly ability: string;
      readonly effect: AbilityEffectKind;
      readonly status?: StatusName;
      readonly stat?: StageStat;
      readonly amount?: number;
    };

export type { StatusName } from './status';

export interface TurnResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

export interface CatchAttempt {
  readonly chance: number;
  readonly caught: boolean;
  readonly shakes: number;
}

/**
 * Catch chance is a deliberately simple, visible rule for the extraction loop:
 * 20% at full HP, rising linearly by up to 60% as HP falls, plus a 25% bonus
 * for sleep/freeze or 15% for paralysis/poison/burn, then the ball modifier.
 * The result is capped at 95%, so every throw retains a small amount of risk.
 */
export const getCatchChance = (
  currentHp: number,
  maxHp: number,
  primaryStatus: PrimaryStatusType | null,
  ballModifier = 1,
): number => {
  const hpFraction = maxHp > 0 ? Math.min(1, Math.max(0, currentHp / maxHp)) : 1;
  const statusBonus =
    primaryStatus === PrimaryStatus.Sleep || primaryStatus === PrimaryStatus.Freeze
      ? 0.25
      : primaryStatus
        ? 0.15
        : 0;
  return Math.min(0.95, Math.max(0, (0.2 + (1 - hpFraction) * 0.6 + statusBonus) * ballModifier));
};

export const attemptCatch = (
  combatant: BattleCombatant,
  random: RandomSource,
  ballModifier = 1,
): CatchAttempt => {
  const chance = getCatchChance(combatant.currentHp, combatant.pokemon.maxHp, combatant.primaryStatus, ballModifier);
  const roll = clampRandom(random());
  const caught = roll < chance;
  // Failed throws can still wobble up to twice. A successful throw always
  // shows the classic three shakes before the capture message.
  const shakes = caught ? 3 : Math.min(2, Math.floor((chance / Math.max(roll, 0.000001)) * 3));
  return { chance, caught, shakes };
};

const toCombatant = (pokemon: Pokemon): BattleCombatant => ({
  pokemon,
  currentHp: pokemon.currentHp,
  moves: pokemon.moves.map((move) => ({ base: move.base, pp: move.pp })),
  primaryStatus: pokemon.primaryStatus,
  sleepTurns: 0,
  confusionTurns: 0,
  statStages: createStatStages(),
  heldItemSpent: false,
  abilityCharged: false,
  abilityAnnounced: false,
  flinching: false,
  pendingMove: null,
});

/**
 * A combatant as `abilityHooks.ts` reads one: the numbers the *fight* has left
 * it on rather than the ones its Pokemon was saved with, because a pinch
 * ability is about the HP it is standing on now.
 */
export const abilityCarrier = (combatant: BattleCombatant): AbilityCarrier => ({
  abilityId: combatant.pokemon.base.abilityId,
  currentHp: combatant.currentHp,
  maxHp: combatant.pokemon.maxHp,
  primaryStatus: combatant.primaryStatus,
  types: getCombatantTypes(combatant),
  charged: combatant.abilityCharged,
});

/**
 * The weather as far as this fight is concerned.
 *
 * Cloud Nine is asked here and nowhere else. It holds the weather off rather
 * than ending it - the clock in `applyWeather` runs underneath regardless, so a
 * move's five turns are spent whether or not anybody could feel them - and
 * every rule that reads the field reads this instead: the chip, the damage
 * weather bends, and the three abilities that are about the weather themselves.
 */
export const effectiveWeather = (state: BattleState): WeatherId | null => {
  if (state.weather === null) {
    return null;
  }
  return suppressesWeather(abilityCarrier(state.player)) ||
    suppressesWeather(abilityCarrier(state.enemy))
    ? null
    : state.weather.id;
};

/**
 * The abilities on both sides of one swing, in the order `calculateDamage`
 * wants them.
 */
const damageAbilities = (attacker: BattleCombatant, defender: BattleCombatant): DamageAbilities => ({
  attacker: abilityCarrier(attacker),
  defender: abilityCarrier(defender),
});

/**
 * What an ability says when it does something, and whether it is worth saying
 * again.
 *
 * The four continuous effects speak once per battle and mark the combatant;
 * everything else is a separate thing happening and is said every time. A
 * Pokemon with no ability says nothing, which is what makes this safe to call
 * without asking first.
 */
const CONTINUOUS_ABILITY_EFFECTS: ReadonlySet<AbilityEffectKind> = new Set([
  'powered-up',
  'sharpened',
  'shrugged-off',
  'hardened',
]);

const announceAbility = (
  state: BattleState,
  user: 'player' | 'enemy',
  effect: AbilityEffectKind,
  detail: { readonly status?: StatusName; readonly stat?: StageStat; readonly amount?: number } = {},
): { readonly state: BattleState; readonly events: readonly BattleEvent[] } => {
  const combatant = user === 'player' ? state.player : state.enemy;
  const ability = abilityLabel(abilityCarrier(combatant));
  if (!ability) {
    return { state, events: [] };
  }
  let nextState = state;
  if (CONTINUOUS_ABILITY_EFFECTS.has(effect)) {
    if (combatant.abilityAnnounced) {
      return { state, events: [] };
    }
    nextState = updateCombatant(state, user, { ...combatant, abilityAnnounced: true });
  }
  return {
    state: nextState,
    events: [
      { type: 'ability', user, name: combatant.pokemon.base.name, ability, effect, ...detail },
    ],
  };
};

/**
 * Intimidate, and anything else that happens because a Pokemon has arrived.
 *
 * The boost is applied to the *other* side, and it is applied through
 * `applyStatBoosts` like every other, so the foe's Clear Body refuses it and
 * says so. Both sides are asked, in the order they are sent out.
 */
const applySendOut = (
  state: BattleState,
  user: 'player' | 'enemy',
): { readonly state: BattleState; readonly events: readonly BattleEvent[] } => {
  const combatant = user === 'player' ? state.player : state.enemy;
  const boosts = sendOutBoosts(abilityCarrier(combatant));
  if (boosts.length === 0) {
    return { state, events: [] };
  }
  const announced = announceAbility(state, user, 'sent-out');
  const foe = user === 'player' ? ('enemy' as const) : ('player' as const);
  const boosted = applyStatBoosts(announced.state, foe, boosts, user);
  return { state: boosted.state, events: [...announced.events, ...boosted.events] };
};

/**
 * What to say when a battle opens, after both sides have been sent out.
 *
 * `createBattleState` has already applied it - a state is never handed out with
 * an arrival still owing - so this is the words for what is already true, asked
 * once by the scene that is about to narrate the opening. It reads the stage a
 * boost left behind rather than the change it made, which is the same number
 * only because nothing has moved a stage yet: it is the *opening*, and a switch
 * mid-battle gets its events from `replacePlayerPokemon` instead.
 */
export const openingAbilityEvents = (state: BattleState): readonly BattleEvent[] => [
  ...openingEventsFor(state, 'player'),
  ...openingEventsFor(state, 'enemy'),
];

const openingEventsFor = (state: BattleState, user: 'player' | 'enemy'): readonly BattleEvent[] => {
  const combatant = user === 'player' ? state.player : state.enemy;
  const foe = user === 'player' ? state.enemy : state.player;
  const boosts = sendOutBoosts(abilityCarrier(combatant));
  if (boosts.length === 0) {
    return [];
  }
  const ability = abilityLabel(abilityCarrier(combatant));
  return [
    { type: 'ability', user, name: combatant.pokemon.base.name, ability, effect: 'sent-out' },
    ...boosts.flatMap((boost): BattleEvent[] =>
      foe.statStages[boost.stat] === 0
        ? []
        : [
            {
              type: 'stat-stage-changed',
              user: user === 'player' ? 'enemy' : 'player',
              name: foe.pokemon.base.name,
              stat: boost.stat,
              stages: foe.statStages[boost.stat],
            },
          ],
    ),
  ];
};

/**
 * `weather` is the weather of the *place* the fight is happening in, which on a
 * raid is the district the player was standing in. It has no duration: it is
 * the field until a move covers it, and it comes back when that move lapses.
 */
export const createBattleState = (
  player: Pokemon,
  enemy: Pokemon,
  weather: WeatherId | null = null,
): BattleState => {
  const playerCombatant = toCombatant(player);
  const opening: BattleState = {
    player: playerCombatant,
    enemy: toCombatant(enemy),
    playerStatStages: new Map([[player, playerCombatant.statStages]]),
    enemyPartyIndex: 0,
    outcome: player.isFainted ? 'defeat' : enemy.isFainted ? 'victory' : 'active',
    weather: weather === null ? null : { id: weather, turnsRemaining: null },
    ambientWeather: weather,
  };
  // Both sides have arrived, so both sides' arrivals are already owed: a state
  // is never handed out with one outstanding, and `openingAbilityEvents` is the
  // words for what this has already made true.
  if (opening.outcome !== 'active') {
    return opening;
  }
  return applySendOut(applySendOut(opening, 'player').state, 'enemy').state;
};

export const createTrainerBattleState = (
  player: Pokemon,
  trainer: TrainerBattle,
  weather: WeatherId | null = null,
): BattleState => {
  const firstEnemy = trainer.party[0];
  if (!firstEnemy) {
    throw new Error('A trainer battle requires at least one Pokemon.');
  }
  return {
    ...createBattleState(player, firstEnemy, weather),
    trainer,
  };
};

export const canCatchEnemy = (state: BattleState): boolean => state.trainer === undefined;

export const chooseEnemyMove = (combatant: BattleCombatant, random: RandomSource): number | null => {
  const usableMoves = combatant.moves
    .map((move, index) => ({ move, index }))
    .filter(({ move }) => move.pp > 0);
  if (usableMoves.length === 0) {
    return null;
  }

  return usableMoves[Math.floor(clampRandom(random()) * usableMoves.length)]?.index ?? null;
};

/**
 * The move this side is not free to choose this turn, if any: the second half of
 * a charge, or a recharge that will be sat out. `BattleScene` asks before it
 * opens the command menu, because a turn the player did not choose still has to
 * be narrated as a turn.
 */
export const lockedMove = (state: BattleState, user: 'player' | 'enemy'): number | null => {
  const pending = (user === 'player' ? state.player : state.enemy).pendingMove;
  return pending ? pending.moveIndex : null;
};

export const resolveTurn = (
  state: BattleState,
  playerMoveIndex: number,
  random: RandomSource,
): TurnResult => {
  if (state.outcome !== 'active') {
    return { state, events: [] };
  }

  // A pending charge or recharge overrides whatever was chosen: the move is no
  // longer the player's to pick until the two-turn action has finished.
  const forcedPlayerMove = lockedMove(state, 'player');
  if (forcedPlayerMove !== null) {
    playerMoveIndex = forcedPlayerMove;
  }

  const playerMove = state.player.moves[playerMoveIndex];
  if (!playerMove || (playerMove.pp <= 0 && forcedPlayerMove === null)) {
    return {
      state,
      events: playerMove
        ? [{ type: 'no-pp', user: 'player', move: playerMove.base.name }]
        : [],
    };
  }

  const enemyMoveIndex = lockedMove(state, 'enemy') ?? chooseEnemyMove(state.enemy, random);
  // Quick Claw is rolled before the order is decided, once for each side that
  // carries one, so the claw is the reason the turn came out the way it did
  // rather than an adjustment made afterwards. A claw that fires is announced
  // before the move it let through.
  const claws: BattleEvent[] = [];
  const firstStrike = (user: 'player' | 'enemy', combatant: BattleCombatant): 1 | 0 => {
    if (!rollsFirstStrike(combatant.pokemon, random)) {
      return 0;
    }
    claws.push({
      type: 'gear-first-strike',
      user,
      name: combatant.pokemon.base.name,
      item: gearLabel(combatant.pokemon.heldItemId),
    });
    return 1;
  };
  // Two orderings, and the move's own is the outer one. A priority move goes
  // first whatever the Speed, and Quick Claw breaks the tie *inside* that
  // bracket rather than outranking it - a claw has never let a Pokemon cut in
  // front of a Quick Attack.
  const movePriority = (combatant: BattleCombatant, moveIndex: number): number =>
    combatant.moves[moveIndex]?.base.priority ?? 0;
  // Chlorophyll and Swift Swim are read here, where the order is settled, and
  // nowhere else: doubling a Speed that only matters for who goes first is the
  // whole of both abilities.
  const field = effectiveWeather(state);
  const speedOf = (combatant: BattleCombatant): number =>
    Math.floor(
      getStagedStat(combatant.pokemon.stats.speed, combatant.statStages.speed) *
        speedMultiplier(abilityCarrier(combatant), field),
    );
  const actions = [
    {
      user: 'player' as const,
      moveIndex: playerMoveIndex,
      speed: speedOf(state.player),
      priority: movePriority(state.player, playerMoveIndex),
      claw: firstStrike('player', state.player),
    },
    ...(enemyMoveIndex === null
      ? []
      : [{
        user: 'enemy' as const,
        moveIndex: enemyMoveIndex,
        speed: speedOf(state.enemy),
        priority: movePriority(state.enemy, enemyMoveIndex),
        claw: firstStrike('enemy', state.enemy),
      }]),
  ].sort(
    (left, right) =>
      right.priority - left.priority ||
      right.claw - left.claw ||
      right.speed - left.speed ||
      (left.user === 'player' ? -1 : 1),
  );

  // Flinch is cleared for both sides before anyone acts, so the only flinch a
  // combatant can be carrying when its turn comes is one the other side set
  // this turn - which is exactly the rule that a flinch needs you to be faster.
  let nextState = clearFlinching(state);
  const events: BattleEvent[] = [...claws];
  // A Speed the weather doubled is announced before the turn it decided, in the
  // same place and for the same reason Quick Claw's line is: the order came out
  // the way it did *because* of it.
  for (const side of ['player', 'enemy'] as const) {
    const combatant = side === 'player' ? nextState.player : nextState.enemy;
    if (speedMultiplier(abilityCarrier(combatant), field) === 1) {
      continue;
    }
    const raced = announceAbility(nextState, side, 'quickened');
    nextState = raced.state;
    events.push(...raced.events);
  }
  for (const action of actions) {
    if (nextState.outcome !== 'active') {
      break;
    }
    const result = applyMove(nextState, action.user, action.moveIndex, random);
    nextState = result.state;
    events.push(...result.events);
  }

  // The weather is charged once for the whole turn, after both sides have acted
  // - it is the field's turn, not either combatant's, which is why it does not
  // hang off `applyEndOfAction` the way burn and Leftovers do.
  const weathered = applyWeather(clearFlinching(nextState));
  return { state: weathered.state, events: [...events, ...weathered.events] };
};

const clearFlinching = (state: BattleState): BattleState =>
  state.player.flinching || state.enemy.flinching
    ? {
        ...state,
        player: { ...state.player, flinching: false },
        enemy: { ...state.enemy, flinching: false },
      }
    : state;

/**
 * The player calls one back and sends another out, with everything that hangs
 * off both halves of that.
 *
 * It returns events as well as a state because a switch is now a thing that can
 * *happen*: the one going back may shed its status to Natural Cure and the one
 * coming out may cow the other side as it lands. Natural Cure is also the one
 * place this module writes to a Pokemon outside `persistCombatantToPokemon` -
 * the status being cured belongs to the Pokemon now, not to the fight, because
 * the fight is done with it.
 */
export const replacePlayerPokemon = (state: BattleState, pokemon: Pokemon): TurnResult => {
  const outgoing = state.player;
  const events: BattleEvent[] = [];
  let withdrawn = state;
  if (outgoing.primaryStatus && curesOnSwitchOut(abilityCarrier(outgoing))) {
    const status = outgoing.primaryStatus;
    withdrawn = updateCombatant(state, 'player', {
      ...outgoing,
      primaryStatus: null,
      sleepTurns: 0,
    });
    outgoing.pokemon.primaryStatus = null;
    const said = announceAbility(withdrawn, 'player', 'cured-on-switch', { status });
    withdrawn = said.state;
    events.push(...said.events);
  }

  const statStages = withdrawn.playerStatStages.get(pokemon) ?? createStatStages();
  const player = { ...toCombatant(pokemon), statStages };
  const switched: BattleState = {
    ...withdrawn,
    player,
    playerStatStages: new Map(withdrawn.playerStatStages).set(pokemon, statStages),
    outcome: pokemon.isFainted ? 'defeat' : withdrawn.enemy.currentHp === 0 ? 'victory' : 'active',
  };
  if (switched.outcome !== 'active') {
    return { state: switched, events };
  }
  const arrived = applySendOut(switched, 'player');
  return { state: arrived.state, events: [...events, ...arrived.events] };
};

/**
 * Re-reads the two things a level-up reached mid-battle changes on the Pokemon
 * underneath a combatant, so the fight that earned the level is the fight that
 * pays it out.
 *
 * A `BattleCombatant` is a snapshot taken when its Pokemon was sent out, which
 * is what lets the battle own PP, status, its counters and stat stages without
 * writing them to the party. Level and stats are read through `pokemon` and so
 * are already live; the move *list* and the HP that a raised maximum carries
 * are not, and both arrive with a level-up. Only a trainer battle with a second
 * Pokemon keeps a battle alive long enough to see it - a wild battle ends on the
 * knockout that awarded the experience.
 *
 * `previousMaxHp` is the maximum before the level-up, so the HP a higher maximum
 * grants is added exactly as `Pokemon.gainExperience` grants it. Everything the
 * battle owns is kept: PP on a move already known is carried across by move
 * identity rather than by position, and a fainted combatant is left fainted.
 */
export const refreshCombatantAfterLevelUp = (
  combatant: BattleCombatant,
  previousMaxHp: number,
): BattleCombatant => {
  const gainedHp = Math.max(0, combatant.pokemon.maxHp - previousMaxHp);
  return {
    ...combatant,
    currentHp:
      combatant.currentHp === 0
        ? 0
        : Math.min(combatant.pokemon.maxHp, combatant.currentHp + gainedHp),
    moves: combatant.pokemon.moves.map((move) => {
      const known = combatant.moves.find((candidate) => candidate.base === move.base);
      return known ?? { base: move.base, pp: move.pp };
    }),
  };
};

/** `refreshCombatantAfterLevelUp` for the side that can gain experience. */
export const refreshPlayerAfterLevelUp = (state: BattleState, previousMaxHp: number): BattleState =>
  updateCombatant(state, 'player', refreshCombatantAfterLevelUp(state.player, previousMaxHp));

/** Writes bounded, battle-owned state back to the matching party Pokemon. */
export const persistCombatantToPokemon = (combatant: BattleCombatant): void => {
  combatant.pokemon.currentHp = combatant.currentHp;
  combatant.pokemon.primaryStatus = combatant.primaryStatus;
  combatant.pokemon.moves.forEach((move, index) => {
    const battleMove =
      combatant.moves.find((candidate) => candidate.base === move.base) ?? combatant.moves[index];
    if (battleMove) {
      move.setPp(battleMove.pp);
    }
  });
};

export const resolveEnemyTurn = (state: BattleState, random: RandomSource): TurnResult => {
  if (state.outcome !== 'active') {
    return { state, events: [] };
  }

  // A turn the player spent on an item, a switch or a ball is still a turn, so
  // the weather is charged for it here too. Every path that resolves one ends
  // in exactly one of this function or `resolveTurn`, so nothing is charged twice.
  const enemyMoveIndex = lockedMove(state, 'enemy') ?? chooseEnemyMove(state.enemy, random);
  const acted =
    enemyMoveIndex === null
      ? { state, events: [] as readonly BattleEvent[] }
      : applyMove(state, 'enemy', enemyMoveIndex, random);
  const weathered = applyWeather(acted.state);
  return { state: weathered.state, events: [...acted.events, ...weathered.events] };
};

/**
 * The end of a turn for the field itself: what the weather takes, and whether
 * it is still there next turn.
 *
 * The order is the tutorial's and generation III's - the chip lands first and
 * the clock is read afterwards, so weather set on turn one chips on turn one
 * and on each of the four after it. A place's weather has no clock and so is
 * never spent; weather a move brought on lapses back into the place's, which is
 * why the field is two fields and not one.
 */
const applyWeather = (state: BattleState): TurnResult => {
  const weather = state.weather;
  if (!weather || state.outcome !== 'active') {
    return { state, events: [] };
  }

  let nextState = state;
  const events: BattleEvent[] = [];
  // Cloud Nine flattens the chip but not the clock: the field is still weather
  // and still spending its five turns, and it is only what the weather *does*
  // that stops - which is why this is asked here and the clock below is not.
  const field = effectiveWeather(state);
  if (field === null) {
    const stilled = weatherStilledBy(state);
    if (stilled) {
      const said = announceAbility(nextState, stilled, 'weathered-out');
      nextState = said.state;
      events.push(...said.events);
    }
  }
  // Player first, then enemy, exactly as the tutorial walks its units. Speed
  // order would matter only for which of two simultaneous knockouts is printed
  // first, and a fixed order is the one that replays the same way every time.
  for (const side of ['player', 'enemy'] as const) {
    if (nextState.outcome !== 'active') {
      break;
    }
    const combatant = side === 'player' ? nextState.player : nextState.enemy;
    if (combatant.currentHp === 0) {
      continue;
    }
    if (shelteredFromWeather(abilityCarrier(combatant), weather.id)) {
      continue;
    }
    const damage = weatherChipDamage(field, getCombatantTypes(combatant), combatant.pokemon.maxHp);
    if (damage === 0) {
      continue;
    }
    const buffeted = { ...combatant, currentHp: Math.max(0, combatant.currentHp - damage) };
    nextState = updateCombatant(nextState, side, buffeted);
    events.push({
      type: 'weather-damage',
      user: side,
      name: combatant.pokemon.base.name,
      weather: weather.id,
      damage: combatant.currentHp - buffeted.currentHp,
    });
    if (buffeted.currentHp === 0) {
      nextState = resolveFaint(nextState, side);
      events.push({ type: 'fainted', user: side, name: combatant.pokemon.base.name });
      if (side === 'enemy' && nextState.outcome === 'active') {
        events.push({ type: 'enemy-sent-out', name: nextState.enemy.pokemon.base.name });
      }
    }
  }

  if (weather.turnsRemaining === null) {
    return { state: nextState, events };
  }
  const remaining = weather.turnsRemaining - 1;
  if (remaining > 0) {
    return { state: { ...nextState, weather: { ...weather, turnsRemaining: remaining } }, events };
  }
  events.push({ type: 'weather-ended', weather: weather.id });
  const ambient = nextState.ambientWeather;
  if (ambient !== null) {
    events.push({ type: 'weather-set', weather: ambient, byMove: false });
  }
  return {
    state: {
      ...nextState,
      weather: ambient === null ? null : { id: ambient, turnsRemaining: null },
    },
    events,
  };
};

export const resolveCatchAttempt = (
  state: BattleState,
  random: RandomSource,
  ballModifier = 1,
): TurnResult => {
  if (state.outcome !== 'active') {
    return { state, events: [] };
  }
  if (!canCatchEnemy(state)) {
    return { state, events: [{ type: 'catch-disabled' }] };
  }

  const attempt = attemptCatch(state.enemy, random, ballModifier);
  const name = state.enemy.pokemon.base.name;
  const events: BattleEvent[] = [
    { type: 'ball-thrown', name },
    ...Array.from({ length: attempt.shakes }, (_, index) => ({ type: 'catch-shake' as const, count: index + 1 })),
  ];
  if (attempt.caught) {
    return {
      state: { ...state, outcome: 'caught' },
      events: [...events, { type: 'caught', name }],
    };
  }
  return { state, events: [...events, { type: 'broke-free', name }] };
};

/**
 * One combatant's action, start to finish.
 *
 * The order is generation III's and each step is a thing a move may now declare
 * rather than a thing this function knows about a move by name:
 *
 *  1. a pending recharge, or the second half of a charge, takes the turn over;
 *  2. a flinch set by whoever moved first;
 *  3. status that forbids the action (paralysis, freeze, sleep, confusion);
 *  4. PP;
 *  5. a charge move's first turn, which ends here;
 *  6. one accuracy roll, read through accuracy and evasion stages;
 *  7. one to five hits;
 *  8. the move's own drain, recoil and healing;
 *  9. its guaranteed `effects`, then each of its `secondaries` on its own roll;
 * 10. held-item recoil, then end-of-action status and gear.
 */
const applyMove = (
  state: BattleState,
  user: 'player' | 'enemy',
  moveIndex: number,
  random: RandomSource,
): TurnResult => {
  const attacker = user === 'player' ? state.player : state.enemy;
  const pending = attacker.pendingMove;

  // 1. A recharge is the whole action. The pending move is spent either way, so
  // a Hyper Beam can never cost two turns in a row.
  if (pending?.kind === MoveCharge.Recharge) {
    const rested = updateCombatant(state, user, { ...attacker, pendingMove: null });
    return applyEndOfAction(
      rested,
      user,
      [{ type: 'recharging', user, name: attacker.pokemon.base.name }],
      random,
    );
  }
  const releasingCharge = pending?.kind === MoveCharge.Charge;
  const chosenIndex = releasingCharge ? pending.moveIndex : moveIndex;
  const move = attacker.moves[chosenIndex];
  // PP was already spent on the winding-up turn, so a released charge never
  // checks it - otherwise a Solar Beam on its last PP would fizzle halfway.
  if (!move || (!releasingCharge && move.pp <= 0)) {
    return { state, events: move ? [{ type: 'no-pp', user, move: move.base.name }] : [] };
  }

  // 2. Flinch, before any of the ordinary status rolls: it is the other side's
  // move that took this turn away, not this side's condition.
  if (attacker.flinching) {
    const shaken = updateCombatant(state, user, { ...attacker, flinching: false, pendingMove: null });
    return applyEndOfAction(
      shaken,
      user,
      [{ type: 'flinched', user, name: attacker.pokemon.base.name }],
      random,
    );
  }

  // 3.
  const attempted = resolveStatusBeforeMove(state, user, random);
  if (!attempted.canAct) {
    return applyEndOfAction(attempted.state, user, attempted.events, random);
  }

  let nextState = attempted.state;
  const attackerAfterStatus = user === 'player' ? nextState.player : nextState.enemy;
  const defenderUser = user === 'player' ? ('enemy' as const) : ('player' as const);
  const attackerName = attackerAfterStatus.pokemon.base.name;

  // 4. PP, and the charge that is being released is now spent. Pressure is read
  // off whoever the move is aimed at, so a move a Pokemon uses on itself costs
  // its own PP and no more however heavily the other side leans on it.
  const pressure =
    move.base.target === MoveTarget.Self
      ? 0
      : extraPpCost(abilityCarrier(user === 'player' ? nextState.enemy : nextState.player));
  const spentAttacker: BattleCombatant = {
    ...attackerAfterStatus,
    pendingMove: null,
    moves: releasingCharge
      ? attackerAfterStatus.moves
      : attackerAfterStatus.moves.map((known, index) =>
          index === chosenIndex ? { ...known, pp: Math.max(0, known.pp - 1 - pressure) } : known,
        ),
  };
  nextState = updateCombatant(nextState, user, spentAttacker);
  const events: BattleEvent[] = [...attempted.events];

  // 5. A charge move's first turn announces itself and stops. The move is
  // remembered on the combatant, which is the one piece of state that has to
  // outlive this call.
  if (move.base.charge === MoveCharge.Charge && !releasingCharge) {
    nextState = updateCombatant(nextState, user, {
      ...spentAttacker,
      pendingMove: { moveIndex: chosenIndex, kind: MoveCharge.Charge },
    });
    events.push(
      { type: 'used-move', user, name: attackerName, move: move.base.name },
      { type: 'charging', user, name: attackerName, move: move.base.name },
    );
    return applyEndOfAction(nextState, user, events, random);
  }

  const defenderNow = (): BattleCombatant => (user === 'player' ? nextState.enemy : nextState.player);
  const attackerNow = (): BattleCombatant => (user === 'player' ? nextState.player : nextState.enemy);
  const defenderName = defenderNow().pokemon.base.name;

  // 6a. A move the other side's ability simply will not take. It is asked
  // before the accuracy roll because none of these five is a miss - Levitate is
  // not dodging, and a Soundproof Pokemon does not hear the move go past - and
  // before the hit loop because three of them give something back instead.
  if (move.base.target !== MoveTarget.Self) {
    const absorption = absorbs(abilityCarrier(defenderNow()), move.base);
    if (absorption) {
      events.push({ type: 'used-move', user, name: attackerName, move: move.base.name });
      const healed = absorbedHeal(abilityCarrier(defenderNow()), absorption);
      if (healed > 0) {
        const soaked = defenderNow();
        nextState = updateCombatant(nextState, defenderUser, {
          ...soaked,
          currentHp: soaked.currentHp + healed,
        });
      }
      if (absorption.charges) {
        nextState = updateCombatant(nextState, defenderUser, {
          ...defenderNow(),
          abilityCharged: true,
        });
      }
      const said = announceAbility(nextState, defenderUser, 'absorbed', { amount: healed });
      nextState = said.state;
      events.push(...said.events);
      return applyEndOfAction(nextState, user, events, random);
    }
  }

  // 6b. One accuracy roll for the whole action, read through both stages and
  // through the attacker's own ability. A move with `alwaysHits` skips it,
  // which is the only way Swift can exist.
  // Compound Eyes is read here and said after the move is named, because a line
  // about taking aim before anyone knows what is being aimed reads backwards.
  const abilityAccuracy = accuracyMultiplier(abilityCarrier(attackerNow()), move.base);
  const sayAccuracy = (): void => {
    if (abilityAccuracy === 1) {
      return;
    }
    const sharpened = announceAbility(nextState, user, 'sharpened');
    nextState = sharpened.state;
    events.push(...sharpened.events);
  };
  // Sand Veil moves the *move's* accuracy rather than an evasion stage, because
  // a quarter is not a step on generation III's evasion ladder.
  const veiled = incomingAccuracyMultiplier(abilityCarrier(defenderNow()), effectiveWeather(nextState));
  if (veiled !== 1) {
    const hidden = announceAbility(nextState, defenderUser, 'hidden');
    nextState = hidden.state;
    events.push(...hidden.events);
  }
  const accuracy = stagedAccuracy(
    move.base.accuracy * abilityAccuracy * veiled,
    attackerNow().statStages.accuracy,
    defenderNow().statStages.evasion,
  );
  if (!move.base.alwaysHits && clampRandom(random()) * 100 >= accuracy) {
    events.push({ type: 'used-move', user, name: attackerName, move: move.base.name });
    sayAccuracy();
    events.push({ type: 'missed', user });
    return applyEndOfAction(nextState, user, events, random);
  }

  // 7. Hits. A single-hit move runs this loop once, so there is one path.
  const hitCount = rollHitCount(move.base, random);
  let totalDamage = 0;
  let landedHits = 0;
  let critical = false;
  let stab = false;
  let effectiveness = 1;
  let heldItemRecoil = 0;
  let defenderFainted = false;
  let endured = false;
  let immune = false;
  const abilityNotes = new Set<string>();

  for (let hit = 0; hit < hitCount && !defenderFainted; hit += 1) {
    const defender = defenderNow();
    const result = calculateDamage(
      attackerNow().pokemon,
      defender.pokemon,
      move.base,
      random,
      attackerNow().statStages,
      defender.statStages,
      effectiveWeather(nextState),
      damageAbilities(attackerNow(), defender),
    );
    for (const note of result.abilityNotes) {
      abilityNotes.add(`${note.side}:${note.effect}`);
    }
    stab = result.isStab;
    effectiveness = result.typeEffectiveness;
    critical = critical || result.isCritical;
    heldItemRecoil += result.recoil;
    // A move the defender is immune to does nothing at all, secondaries
    // included: a Normal move cannot make a Ghost flinch on the way past.
    if (result.typeEffectiveness === 0 && move.base.category !== MoveCategory.Status) {
      immune = true;
      break;
    }
    if (result.damage <= 0 && move.base.category === MoveCategory.Status) {
      break;
    }
    const survived = survivesKnockout(
      defender.pokemon,
      defender.currentHp,
      result.damage,
      defender.heldItemSpent,
    );
    endured = endured || survived;
    const hurt: BattleCombatant = {
      ...defender,
      currentHp: survived ? 1 : Math.max(0, defender.currentHp - result.damage),
      heldItemSpent: defender.heldItemSpent || survived,
    };
    totalDamage += defender.currentHp - hurt.currentHp;
    landedHits += 1;
    nextState = updateCombatant(nextState, defenderUser, hurt);
    defenderFainted = hurt.currentHp === 0;
  }

  events.push({
    type: 'used-move',
    user,
    target: defenderUser,
    name: attackerName,
    move: move.base.name,
    damage: totalDamage,
    category: move.base.category,
    isStab: stab,
  });
  // Which ability changed the swing, said once each and after the line that
  // names the move, so the log reads "used X" and then why it landed as it did.
  sayAccuracy();
  for (const note of abilityNotes) {
    const [side, effect] = note.split(':');
    const said = announceAbility(
      nextState,
      side === 'attacker' ? user : defenderUser,
      effect as AbilityEffectKind,
    );
    nextState = said.state;
    events.push(...said.events);
  }
  if (critical) {
    events.push({ type: 'critical-hit' });
  }
  if (landedHits > 1) {
    events.push({ type: 'multi-hit', hits: landedHits });
  }
  if (isDamagingMove(move)) {
    events.push(...effectivenessEvents(effectiveness));
  }
  if (endured) {
    events.push({
      type: 'gear-endured',
      user: defenderUser,
      name: defenderName,
      item: gearLabel(defenderNow().pokemon.heldItemId),
    });
  }

  // 7b. What touching it cost. Static and the three like it need the move to
  // have made contact and the holder to still be standing: a Pokemon knocked
  // out by the blow does not answer it, which is generation III's rule and also
  // the only one that reads right.
  if (landedHits > 0 && totalDamage > 0 && !defenderFainted && !immune) {
    const shock = contactStatus(abilityCarrier(defenderNow()), move.base, random);
    if (shock) {
      const said = announceAbility(nextState, defenderUser, 'contact', { status: shock });
      nextState = said.state;
      const struck = applyStatus(nextState, user, shock, random, defenderUser);
      nextState = struck.state;
      events.push(...said.events, ...struck.events);
    }
  }

  // 8. What the swing gives back and what it costs, in that order: a drain that
  // takes the attacker to full and a recoil that then takes HP off it read as
  // two things, and netting them would explain neither.
  if (move.base.drain > 0 && totalDamage > 0) {
    const healer = attackerNow();
    const taste = Math.max(1, Math.floor(totalDamage * move.base.drain));
    if (drainBackfires(abilityCarrier(defenderNow()))) {
      // Liquid Ooze: the same figure, taken off the drainer instead of given to
      // it. It is announced by the Pokemon that was drained, because it is that
      // Pokemon's ability that did it.
      const said = announceAbility(nextState, defenderUser, 'contact', { amount: taste });
      nextState = said.state;
      events.push(...said.events);
      const sickened = attackerNow();
      const paid = Math.min(sickened.currentHp, taste);
      nextState = updateCombatant(nextState, user, {
        ...sickened,
        currentHp: sickened.currentHp - paid,
      });
      events.push({ type: 'recoil', user, name: attackerName, damage: paid });
    } else {
      const drained = Math.min(healer.pokemon.maxHp - healer.currentHp, taste);
      if (drained > 0) {
        nextState = updateCombatant(nextState, user, { ...healer, currentHp: healer.currentHp + drained });
        events.push({ type: 'drained', user, name: attackerName, amount: drained });
      }
    }
  }
  if (move.base.healing > 0) {
    const healer = attackerNow();
    const restored = Math.min(
      healer.pokemon.maxHp - healer.currentHp,
      Math.max(1, Math.floor(healer.pokemon.maxHp * move.base.healing)),
    );
    if (healer.currentHp >= healer.pokemon.maxHp) {
      events.push({ type: 'heal-failed', user, name: attackerName });
    } else {
      nextState = updateCombatant(nextState, user, { ...healer, currentHp: healer.currentHp + restored });
      events.push({ type: 'healed', user, name: attackerName, amount: restored });
    }
  }
  if (move.base.recoil > 0 && totalDamage > 0) {
    if (blocksRecoil(abilityCarrier(attackerNow()))) {
      const said = announceAbility(nextState, user, 'no-recoil');
      nextState = said.state;
      events.push(...said.events);
    } else {
      const hurt = attackerNow();
      const paid = Math.min(hurt.currentHp, Math.max(1, Math.floor(totalDamage * move.base.recoil)));
      nextState = updateCombatant(nextState, user, { ...hurt, currentHp: hurt.currentHp - paid });
      events.push({ type: 'recoil', user, name: attackerName, damage: paid });
    }
  }

  if (defenderFainted) {
    nextState = resolveFaint(nextState, defenderUser);
    events.push({ type: 'fainted', user: defenderUser, name: defenderName });
    if (defenderUser === 'enemy' && nextState.outcome === 'active') {
      events.push({ type: 'enemy-sent-out', name: nextState.enemy.pokemon.base.name });
      const arrived = applySendOut(nextState, 'enemy');
      nextState = arrived.state;
      events.push(...arrived.events);
    }
  }

  // 9. The move's own effects, then its secondaries. Both are skipped once the
  // target is down or the battle is over - a flinch on a fainted Pokemon is a
  // line of log about nothing.
  const missedEntirely = landedHits === 0 && move.base.category !== MoveCategory.Status;
  if (!immune && !missedEntirely && nextState.outcome === 'active' && !defenderFainted) {
    const guaranteed = applyMoveEffects(nextState, user, move.base.effects, move.base.target, move.base, random);
    nextState = guaranteed.state;
    events.push(...guaranteed.events);
    // Shield Dust refuses the extra effect of a move aimed at it, and nothing
    // about a move's effect on its *own* user - Metal Claw still raises its own
    // Attack through a Shield Dust.
    const dusted = blocksSecondaries(abilityCarrier(defenderNow()));
    let dustSaid = false;
    for (const secondary of move.base.secondaries) {
      if (nextState.outcome !== 'active') {
        break;
      }
      if (dusted && secondary.target !== MoveTarget.Self) {
        if (!dustSaid) {
          dustSaid = true;
          const said = announceAbility(nextState, defenderUser, 'blocked-secondaries');
          nextState = said.state;
          events.push(...said.events);
        }
        continue;
      }
      // Each secondary rolls on its own, exactly as the tutorial does it: a
      // move with two of them can land both, one, or neither. Serene Grace
      // doubles the chance and never the number of rolls, so a seeded battle
      // draws the same sequence with it or without it.
      if (
        clampRandom(random()) * 100 >=
        secondaryChance(abilityCarrier(attackerNow()), secondary.chance)
      ) {
        continue;
      }
      const rolled = applyMoveEffects(nextState, user, secondary, secondary.target, move.base, random);
      nextState = rolled.state;
      events.push(...rolled.events);
    }
  }

  // 10. A recharge is booked now, on the turn the move landed.
  if (move.base.charge === MoveCharge.Recharge && nextState.outcome === 'active') {
    const spent = attackerNow();
    if (spent.currentHp > 0) {
      nextState = updateCombatant(nextState, user, {
        ...spent,
        pendingMove: { moveIndex: chosenIndex, kind: MoveCharge.Recharge },
      });
    }
  }

  // Life Orb, after the hit has landed and after whatever it knocked out has
  // fallen: the price is paid for a hit that connected, and it is paid second, so
  // a holder that takes its last two HP paying for a knockout still wins the
  // fight it just ended.
  if (heldItemRecoil > 0) {
    const holder = attackerNow();
    const paid = Math.min(holder.currentHp, heldItemRecoil);
    if (paid > 0) {
      const hurtHolder = { ...holder, currentHp: holder.currentHp - paid };
      nextState = updateCombatant(nextState, user, hurtHolder);
      events.push({
        type: 'gear-recoil',
        user,
        name: attackerName,
        item: gearLabel(holder.pokemon.heldItemId),
        damage: paid,
      });
    }
  }

  const standing = attackerNow();
  if (standing.currentHp === 0 && nextState.outcome === 'active') {
    nextState = resolveFaint(nextState, user);
    events.push({ type: 'fainted', user, name: attackerName });
    if (user === 'enemy' && nextState.outcome === 'active') {
      events.push({ type: 'enemy-sent-out', name: nextState.enemy.pokemon.base.name });
      const arrived = applySendOut(nextState, 'enemy');
      nextState = arrived.state;
      events.push(...arrived.events);
    }
  }

  return applyEndOfAction(nextState, user, events, random);
};

/**
 * How many times a multi-hit move hits.
 *
 * Generation III does not roll this evenly: two and three hits are 3/8 each,
 * four and five are 1/8 each, which is why Double Slap averages a shade under
 * three. A move with `min === max` (Double Kick) is that number; anything else
 * is uniform, which is the honest fallback rather than a second invented curve.
 */
export const rollHitCount = (move: MoveBase, random: RandomSource): number => {
  if (!move.hits) {
    return 1;
  }
  const { min, max } = move.hits;
  if (min >= max) {
    return min;
  }
  if (min === 2 && max === 5) {
    const roll = clampRandom(random());
    return roll < 0.375 ? 2 : roll < 0.75 ? 3 : roll < 0.875 ? 4 : 5;
  }
  return min + Math.floor(clampRandom(random()) * (max - min + 1));
};

/**
 * One bundle of effects, landed on whichever side the bundle names.
 *
 * `target` is the whole reason this is a function rather than three lines in
 * `applyMove`: every stat boost in this engine used to go to the *other* side
 * unconditionally, so a move could lower a Defence but never raise its own
 * Attack. Metal Claw's 10% Attack raise is a secondary with `target: Self`, and
 * nothing else about it is special.
 */
const applyMoveEffects = (
  state: BattleState,
  user: 'player' | 'enemy',
  effects: NormalizedMoveEffects | NormalizedSecondaryEffect,
  target: MoveTarget,
  move: MoveBase,
  random: RandomSource,
): { readonly state: BattleState; readonly events: readonly BattleEvent[] } => {
  const side = target === MoveTarget.Self ? user : user === 'player' ? ('enemy' as const) : ('player' as const);
  let nextState = state;
  const events: BattleEvent[] = [];

  if (effects.boosts.length > 0) {
    const boosted = applyStatBoosts(nextState, side, effects.boosts, user);
    nextState = boosted.state;
    events.push(...boosted.events);
  }
  if (effects.status) {
    // A move that cannot touch the target at all cannot poison it either:
    // Thunder Wave used to paralyse a Ground type, because the status branch
    // never asked the type chart the damage branch was already asking.
    const receiver = side === 'player' ? nextState.player : nextState.enemy;
    const immune =
      side !== user && getTypeEffectiveness(move.type, getCombatantTypes(receiver)) === 0;
    if (!immune) {
      const applied = applyStatus(nextState, side, effects.status, random, user);
      nextState = applied.state;
      events.push(...applied.events);
    } else {
      events.push({ type: 'effectiveness', multiplier: 0 });
    }
  }
  if (effects.flinch) {
    const victim = side === 'player' ? nextState.player : nextState.enemy;
    if (victim.currentHp > 0) {
      // Inner Focus is the same refusal as Insomnia's, asked of a flinch - which
      // is why flinch is one of `AbilityBlockedCondition`'s values rather than a
      // second gate of its own.
      if (side !== user && blocksCondition(abilityCarrier(victim), 'flinch')) {
        const held = announceAbility(nextState, side, 'blocked-status');
        nextState = held.state;
        events.push(...held.events);
      } else {
        nextState = updateCombatant(nextState, side, { ...victim, flinching: true });
      }
    }
  }
  if (effects.weather) {
    // The one effect that lands on neither side: `side` is not consulted. It
    // replaces whatever was over the field, its own weather included - a second
    // Rain Dance is five fresh turns of rain, as it is in the source material.
    nextState = {
      ...nextState,
      weather: { id: effects.weather, turnsRemaining: WEATHER_MOVE_TURNS },
    };
    events.push({ type: 'weather-set', weather: effects.weather, byMove: true });
  }

  return { state: nextState, events };
};

const resolveStatusBeforeMove = (
  state: BattleState,
  user: 'player' | 'enemy',
  random: RandomSource,
): { readonly state: BattleState; readonly events: readonly BattleEvent[]; readonly canAct: boolean } => {
  const combatant = user === 'player' ? state.player : state.enemy;
  const name = combatant.pokemon.base.name;
  const primary = combatant.primaryStatus;

  if (primary === PrimaryStatus.Paralysis && clampRandom(random()) < 0.25) {
    return { state, events: [{ type: 'status-prevented', user, name, status: primary }], canAct: false };
  }
  if (primary === PrimaryStatus.Freeze) {
    if (clampRandom(random()) >= 0.25) {
      return { state, events: [{ type: 'status-prevented', user, name, status: primary }], canAct: false };
    }
    state = updateCombatant(state, user, { ...combatant, primaryStatus: null });
    return { state, events: [{ type: 'status-cured', user, name, status: 'freeze' }], canAct: true };
  }
  if (primary === PrimaryStatus.Sleep) {
    if (combatant.sleepTurns > 0) {
      // Early Bird burns two turns of it for every one that passes, which is
      // the whole of the ability: a Pokemon that sleeps is not a Pokemon that
      // cannot be put to sleep.
      const asleep = {
        ...combatant,
        sleepTurns: Math.max(0, combatant.sleepTurns - sleepTurnsPerTurn(abilityCarrier(combatant))),
      };
      return {
        state: updateCombatant(state, user, asleep),
        events: [{ type: 'status-prevented', user, name, status: primary }],
        canAct: false,
      };
    }
    state = updateCombatant(state, user, { ...combatant, primaryStatus: null });
    return { state, events: [{ type: 'status-cured', user, name, status: 'sleep' }], canAct: true };
  }
  if (combatant.confusionTurns > 0) {
    const confused = { ...combatant, confusionTurns: combatant.confusionTurns - 1 };
    state = updateCombatant(state, user, confused);
    const events: BattleEvent[] = [];
    if (clampRandom(random()) >= 0.5) {
      const damage = Math.floor(combatant.pokemon.maxHp / 8);
      const hurt = { ...confused, currentHp: Math.max(0, confused.currentHp - damage) };
      state = updateCombatant(state, user, hurt);
      events.push({ type: 'confusion-self-hit', user, name, damage });
      if (hurt.currentHp === 0) {
        state = resolveFaint(state, user);
        events.push({ type: 'fainted', user, name });
        if (user === 'enemy' && state.outcome === 'active') {
          events.push({ type: 'enemy-sent-out', name: state.enemy.pokemon.base.name });
          const arrived = applySendOut(state, 'enemy');
          state = arrived.state;
          events.push(...arrived.events);
        }
      }
      if (confused.confusionTurns === 0) {
        state = updateCombatant(state, user, { ...hurt, confusionTurns: 0 });
        events.push({ type: 'status-cured', user, name, status: 'confusion' });
      }
      return { state, events, canAct: false };
    }
    if (confused.confusionTurns === 0) {
      events.push({ type: 'status-cured', user, name, status: 'confusion' });
    }
    return { state, events, canAct: true };
  }
  return { state, events: [], canAct: true };
};

/**
 * The end of one combatant's turn: what its status costs it, then what its gear
 * gives back.
 *
 * Leftovers is charged at exactly the point burn and poison are charged, which is
 * what makes it read as their mirror - and it is charged after them, so a burned
 * holder sees the burn take four and the food give one back rather than a single
 * net number that explains neither.
 */
const applyEndOfAction = (
  state: BattleState,
  user: 'player' | 'enemy',
  events: readonly BattleEvent[],
  random: RandomSource,
): TurnResult => {
  let nextState = state;
  const nextEvents: BattleEvent[] = [...events];
  const combatant = user === 'player' ? state.player : state.enemy;
  if (state.outcome !== 'active' || combatant.currentHp === 0) {
    return { state, events };
  }
  const divisor =
    combatant.primaryStatus === PrimaryStatus.Poison
      ? 8
      : combatant.primaryStatus === PrimaryStatus.Burn
        ? 16
        : 0;
  if (divisor > 0) {
    const damage = Math.floor(combatant.pokemon.maxHp / divisor);
    const updated = { ...combatant, currentHp: Math.max(0, combatant.currentHp - damage) };
    nextState = updateCombatant(nextState, user, updated);
    nextEvents.push({
      type: 'status-damage',
      user,
      name: combatant.pokemon.base.name,
      status: combatant.primaryStatus!,
      damage,
    });
    if (updated.currentHp === 0) {
      nextState = resolveFaint(nextState, user);
      nextEvents.push({ type: 'fainted', user, name: combatant.pokemon.base.name });
      if (user === 'enemy' && nextState.outcome === 'active') {
        nextEvents.push({ type: 'enemy-sent-out', name: nextState.enemy.pokemon.base.name });
        const arrived = applySendOut(nextState, 'enemy');
        nextState = arrived.state;
        nextEvents.push(...arrived.events);
      }
      return { state: nextState, events: nextEvents };
    }
  }

  // Shed Skin, after what the status cost and before what the food gives back:
  // the turn's damage is paid first, and only then does the skin come off - so
  // a poisoned holder is never healed of a poison that had not yet hurt it.
  const shedding = user === 'player' ? nextState.player : nextState.enemy;
  if (shedding.primaryStatus && shedsStatus(abilityCarrier(shedding), random)) {
    nextState = updateCombatant(nextState, user, {
      ...shedding,
      primaryStatus: null,
      sleepTurns: 0,
    });
    const said = announceAbility(nextState, user, 'shed', { status: shedding.primaryStatus });
    nextState = said.state;
    nextEvents.push(...said.events);
  }

  const standing = user === 'player' ? nextState.player : nextState.enemy;
  const healed = endOfTurnHeal(standing.pokemon, standing.currentHp);
  if (healed > 0) {
    nextState = updateCombatant(nextState, user, {
      ...standing,
      currentHp: standing.currentHp + healed,
    });
    nextEvents.push({
      type: 'gear-heal',
      user,
      name: standing.pokemon.base.name,
      item: gearLabel(standing.pokemon.heldItemId),
      amount: healed,
    });
  }
  return { state: nextState, events: nextEvents };
};

/**
 * One status landing on one side.
 *
 * `source` is who caused it, and it does two things: an ability only refuses a
 * condition the *other side* is inflicting, and Synchronize only has somebody
 * to pass one back to when there is somebody. A status a Pokemon gives itself -
 * Rest, a confusion off its own move - passes straight through both.
 */
/** Which side, if either, is holding the weather off. */
const weatherStilledBy = (state: BattleState): 'player' | 'enemy' | null =>
  suppressesWeather(abilityCarrier(state.player))
    ? 'player'
    : suppressesWeather(abilityCarrier(state.enemy))
      ? 'enemy'
      : null;

const applyStatus = (
  state: BattleState,
  user: 'player' | 'enemy',
  status: StatusName,
  random: RandomSource,
  source: 'player' | 'enemy' = user,
): TurnResult => {
  const combatant = user === 'player' ? state.player : state.enemy;
  const name = combatant.pokemon.base.name;
  if (source !== user && blocksCondition(abilityCarrier(combatant), status)) {
    const refused = announceAbility(state, user, 'blocked-status', { status });
    return { state: refused.state, events: [...refused.events] };
  }
  if (status === 'confusion') {
    if (combatant.confusionTurns > 0) {
      return { state, events: [{ type: 'status-already', user, name, status }] };
    }
    const updated = { ...combatant, confusionTurns: randomTurnCount(random, 4) };
    return { state: updateCombatant(state, user, updated), events: [{ type: 'status-applied', user, name, status }] };
  }
  if (combatant.primaryStatus) {
    return { state, events: [{ type: 'status-already', user, name, status }] };
  }
  const updated = {
    ...combatant,
    primaryStatus: status,
    sleepTurns: status === PrimaryStatus.Sleep ? randomTurnCount(random, 3) : 0,
  };
  let nextState = updateCombatant(state, user, updated);
  const events: BattleEvent[] = [{ type: 'status-applied', user, name, status }];
  // Synchronize hands it straight back, and the return trip goes through this
  // same function - so the other side's own Limber can refuse it and say so.
  // Two Synchronizes cannot rally: the second pass finds the first holder
  // already carrying the status and stops on `status-already`.
  if (source !== user && reflectsStatus(abilityCarrier(updated), status)) {
    const announced = announceAbility(nextState, user, 'reflected', { status });
    nextState = announced.state;
    const passed = applyStatus(nextState, source, status, random, user);
    return { state: passed.state, events: [...events, ...announced.events, ...passed.events] };
  }
  return { state: nextState, events };
};

const updateCombatant = (state: BattleState, user: 'player' | 'enemy', combatant: BattleCombatant): BattleState =>
  user === 'player'
    ? { ...state, player: combatant, playerStatStages: new Map(state.playerStatStages).set(combatant.pokemon, combatant.statStages) }
    : { ...state, enemy: combatant };

const resolveFaint = (state: BattleState, faintedUser: 'player' | 'enemy'): BattleState => {
  if (faintedUser !== 'enemy' || !state.trainer) {
    return { ...state, outcome: faintedUser === 'enemy' ? 'victory' : 'defeat' };
  }

  const nextPartyIndex = state.enemyPartyIndex + 1;
  const nextPokemon = state.trainer.party[nextPartyIndex];
  if (!nextPokemon) {
    return { ...state, outcome: 'victory' };
  }

  return {
    ...state,
    enemy: toCombatant(nextPokemon),
    enemyPartyIndex: nextPartyIndex,
    outcome: 'active',
  };
};

const randomTurnCount = (random: RandomSource, maximum: number): number =>
  Math.floor(clampRandom(random()) * maximum) + 1;

// The name-matching status table that used to live here is gone. A move now
// declares what it inflicts on itself (`MoveEffects.status`), so a new status
// move is a data row rather than an edit to this file, and a renamed move can
// no longer lose its effect silently.

/**
 * `source` is who is doing it, because Keen Eye, Hyper Cutter and Clear Body
 * refuse a drop from the *other side* and say nothing about one a Pokemon takes
 * on itself - Swords Dance's own cost is nobody else's doing.
 */
const applyStatBoosts = (
  state: BattleState,
  user: 'player' | 'enemy',
  boosts: readonly StatBoost[],
  source: 'player' | 'enemy' = user,
): { readonly state: BattleState; readonly events: readonly BattleEvent[] } => {
  let nextState = state;
  const events: BattleEvent[] = [];
  for (const boost of boosts) {
    const combatant = user === 'player' ? nextState.player : nextState.enemy;
    if (boost.stages < 0 && source !== user && blocksBoost(abilityCarrier(combatant), boost.stat)) {
      const refused = announceAbility(nextState, user, 'blocked-boost', { stat: boost.stat });
      nextState = refused.state;
      events.push(...refused.events);
      continue;
    }
    const updatedStages = applyStatBoost(combatant.statStages, boost);
    const change = updatedStages[boost.stat] - combatant.statStages[boost.stat];
    if (change === 0) {
      continue;
    }
    nextState = updateCombatant(nextState, user, { ...combatant, statStages: updatedStages });
    events.push({
      type: 'stat-stage-changed',
      user,
      name: combatant.pokemon.base.name,
      stat: boost.stat,
      stages: change,
    });
  }
  return { state: nextState, events };
};

const effectivenessEvents = (multiplier: number): BattleEvent[] => {
  if (multiplier === 0) {
    return [{ type: 'effectiveness', multiplier }];
  }
  if (multiplier > 1 || multiplier < 1) {
    return [{ type: 'effectiveness', multiplier }];
  }
  return [];
};

const clampRandom = (value: number): number => Math.min(0.999999, Math.max(0, value));

export const getCombatantTypes = (combatant: BattleCombatant): readonly PokemonType[] => [
  combatant.pokemon.base.primaryType,
  ...(combatant.pokemon.base.secondaryType ? [combatant.pokemon.base.secondaryType] : []),
];

export const isDamagingMove = (move: BattleMove): boolean =>
  move.base.category !== MoveCategory.Status && move.base.power > 0;
