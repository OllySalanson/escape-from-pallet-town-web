import { isPlaytestRun } from '../../dev/playtestMode';
import type { AbilityEffectKind } from '../AbilityBase';
import type { MoveBase, NormalizedMoveEffects, NormalizedSecondaryEffect } from '../MoveBase';
import { MoveCategory, MoveCharge, MoveTarget, targetsTheOtherSide } from '../MoveBase';
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

/** Which team a Pokemon is fighting for. */
export type BattleSide = 'player' | 'enemy';

/**
 * How many Pokemon a side may have on the field at once.
 *
 * Two, because this game is generation III and generation III's multi battle is
 * the double battle: triples and rotations are generation V. The tutorial's
 * `TrainerController.battleUnitCount` is a bare int with no ceiling; here the
 * number has a reason, so it has a name and a cap.
 */
export const SLOTS_PER_SIDE = 2;

/**
 * One place on the field. `side` is whose it is and `slot` is which of that
 * side's two, and every rule in this engine that used to say `'player'` now
 * says `{ side: 'player', slot: 0 }` instead.
 *
 * A slot is addressed rather than held in an array because a slot is a *place*:
 * it can be full, empty, or holding somebody who has fainted and is waiting to
 * be carried off, and those are three different things. `unitAt` answers what
 * is standing there and `isEngaged` whether it can still fight.
 */
export interface SlotRef {
  readonly side: BattleSide;
  readonly slot: number;
}

export const slotRef = (side: BattleSide, slot = 0): SlotRef => ({ side, slot });

/** The slot every single battle is fought in, on either side. */
export const leadOf = (side: BattleSide): SlotRef => slotRef(side, 0);

export const sameSlot = (left: SlotRef, right: SlotRef): boolean =>
  left.side === right.side && left.slot === right.slot;

export const opposing = (side: BattleSide): BattleSide =>
  side === 'player' ? 'enemy' : 'player';

/**
 * How a slot is written into an event: by number, and not at all when it is the
 * lead.
 *
 * Every event's `slot` is optional and absent means slot 0, so a single battle
 * emits exactly the events it emitted before there were slots - which is the
 * one thing a change this wide has to be able to show rather than claim. The
 * engine's own test file was not touched to make this pass.
 */
const inSlot = (ref: SlotRef): { readonly slot?: number } =>
  ref.slot === 0 ? {} : { slot: ref.slot };

/** The same, for the target side of a hit. */
const atSlot = (ref: SlotRef): { readonly targetSlot?: number } =>
  ref.slot === 0 ? {} : { targetSlot: ref.slot };

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
  /** What they shout after a player who breaks away - only the hunter can be fled. */
  readonly getawayText?: string;
  readonly prize?: string;
  /**
   * How many Pokemon this trainer puts on the field at once - the tutorial's
   * `TrainerController.battleUnitCount`. Absent is one, which is every fight
   * this game shipped with.
   *
   * It is what the trainer *asks* for, not what they get: a double battle needs
   * two able Pokemon on each side, so a trainer who declares two still fights a
   * single battle against a player who has only one left. That is generation
   * III's own rule and it is also the only one that is fair here - a lone
   * starter facing two would be handed two actions a turn against its one, and
   * this game's authored fights are priced on the party that walks up to them.
   */
  readonly unitCount?: number;
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
  /** The player's lead - slot 0, and the whole of a single battle. */
  readonly player: BattleCombatant;
  /** The enemy's lead - slot 0. */
  readonly enemy: BattleCombatant;
  /**
   * Slot 1 on each side: the double battle, and `null` in every single one.
   *
   * Each slot is one field and one field only, so nothing here can drift out of
   * step with anything else here - which is why this is not an array with
   * `player` mirroring its first entry. `unitAt` is how the engine reads a slot
   * by reference and `withUnit` is how it writes one; only those two know the
   * shape.
   *
   * A slot holding a fainted Pokemon is not the same as an empty one: the
   * enemy's stays filled until the trainer sends the next body into it, and the
   * player's until the scene asks who is going in.
   */
  readonly playerPartner: BattleCombatant | null;
  readonly enemyPartner: BattleCombatant | null;
  readonly playerStatStages: ReadonlyMap<Pokemon, StatStages>;
  readonly trainer?: TrainerBattle;
  /** Which of the trainer's party is in the enemy's lead slot. */
  readonly enemyPartyIndex: number;
  /** Which of the trainer's party is in the enemy's second slot, if any. */
  readonly enemyPartnerPartyIndex: number | null;
  /**
   * How much of the trainer's party has been sent out, which is the next index
   * to draw from. With two slots drawing from one party, "the next one" can no
   * longer be read off either slot's own index.
   */
  readonly enemySentOut: number;
  /**
   * How many Pokemon each side is fielding: one for every fight this game shipped
   * with, two for a double. It is settled when the battle opens and never moves,
   * because it is the shape of the screen as much as the shape of the turn - a
   * double battle whose second slot has emptied is still a double battle.
   */
  readonly unitCount: number;
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
      readonly slot?: number;
      readonly target?: 'player' | 'enemy';
      /** Which of the target side's slots the hit landed in. */
      readonly targetSlot?: number;
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
      /**
       * Set when this line only *names* the move, because it hit more than one
       * Pokemon and each of them is reported in its own `spread-damage`. What
       * the hit sounded and looked like belongs to those, not to this.
       */
      readonly spread?: boolean;
    }
  | { readonly type: 'missed'; readonly user: 'player' | 'enemy'; readonly slot?: number }
  // What a move that hits more than one Pokemon took off each of them.
  //
  // `used-move` carries the damage when there is exactly one target, which is
  // every hit in a single battle. A spread move has no one number to carry: a
  // sum would explain neither hit, and the two are rarely even the same
  // effectiveness. So the move names itself once and each target is then said
  // in its own line, which is also the order a player reads the field in.
  | {
      readonly type: 'spread-damage';
      readonly user: 'player' | 'enemy';
      readonly slot?: number;
      readonly target: 'player' | 'enemy';
      readonly targetSlot?: number;
      /** The Pokemon that took it. */
      readonly name: string;
      readonly damage: number;
      readonly isStab?: boolean;
      readonly category?: MoveCategory;
    }
  // A move aimed at somebody who is no longer standing there, with nobody else
  // to aim it at. Only a double battle can reach it: in a single battle the one
  // foe is the battle, and a battle with no foe has already ended.
  | { readonly type: 'no-target'; readonly user: 'player' | 'enemy'; readonly slot?: number }
  | { readonly type: 'critical-hit' }
  | { readonly type: 'effectiveness'; readonly multiplier: number }
  | { readonly type: 'fainted'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string }
  | { readonly type: 'no-pp'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly move: string }
  | { readonly type: 'status-applied'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly status: StatusName }
  | { readonly type: 'status-already'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly status: StatusName }
  | { readonly type: 'status-prevented'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly status: PrimaryStatusType }
  | { readonly type: 'status-damage'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly status: PrimaryStatusType; readonly damage: number }
  | { readonly type: 'status-cured'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly status: 'sleep' | 'freeze' | 'confusion' }
  | { readonly type: 'confusion-self-hit'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly damage: number }
  | { readonly type: 'stat-stage-changed'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly stat: StageStat; readonly stages: number }
  // What a move does beyond its damage, each announced where it happens, so the
  // battle log explains a turn without the player having to read the HP bar.
  | { readonly type: 'flinched'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string }
  | { readonly type: 'multi-hit'; readonly hits: number }
  | { readonly type: 'drained'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly amount: number }
  | { readonly type: 'recoil'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly damage: number }
  | { readonly type: 'healed'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly amount: number }
  | { readonly type: 'heal-failed'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string }
  | { readonly type: 'charging'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly move: string }
  | { readonly type: 'recharging'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string }
  | { readonly type: 'ball-thrown'; readonly name: string }
  | { readonly type: 'catch-shake'; readonly count: number }
  | { readonly type: 'caught'; readonly name: string }
  | { readonly type: 'broke-free'; readonly name: string }
  | { readonly type: 'catch-disabled' }
  | { readonly type: 'enemy-sent-out'; readonly name: string; readonly slot?: number }
  // Gear. Each one is announced the moment it acts, because an item whose effect
  // is only visible in the HP bar is an item the player has to be told about in
  // a menu - and the whole point of these four is that they explain themselves.
  | { readonly type: 'gear-first-strike'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly item: string }
  | { readonly type: 'gear-endured'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly item: string }
  | { readonly type: 'gear-recoil'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly item: string; readonly damage: number }
  | { readonly type: 'gear-heal'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly item: string; readonly amount: number }
  // Weather. It is the one thing in a fight that belongs to neither side, so
  // each of these names the field rather than a combatant - except the chip,
  // which is the weather taking HP off someone and says whose.
  | { readonly type: 'weather-set'; readonly weather: WeatherId; readonly byMove: boolean }
  | { readonly type: 'weather-ended'; readonly weather: WeatherId }
  | { readonly type: 'weather-damage'; readonly user: 'player' | 'enemy';
      readonly slot?: number; readonly name: string; readonly weather: WeatherId; readonly damage: number }
  // Abilities. A player is never shown their ability in a menu, so the only way
  // to learn what it does is to watch it happen - which is why everything an
  // ability does arrives as one of these, and `battlePresentation.ts` has a
  // line for every `AbilityEffectKind`.
  | {
      readonly type: 'ability';
      readonly user: 'player' | 'enemy';
      readonly slot?: number;
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
 * What is standing in a slot, or `null` when nothing is.
 *
 * This and `withUnit` are the only two things in the engine that know how
 * `BattleState` stores its four places; everything else addresses a slot by
 * reference. That is what made the double battle a change to this file rather
 * than a change to every file that reads a battle.
 */
export const unitAt = (state: BattleState, ref: SlotRef): BattleCombatant | null =>
  ref.side === 'player'
    ? ref.slot === 0
      ? state.player
      : state.playerPartner
    : ref.slot === 0
      ? state.enemy
      : state.enemyPartner;

const withUnit = (state: BattleState, ref: SlotRef, combatant: BattleCombatant): BattleState => {
  if (ref.side === 'player') {
    const stages = new Map(state.playerStatStages).set(combatant.pokemon, combatant.statStages);
    return ref.slot === 0
      ? { ...state, player: combatant, playerStatStages: stages }
      : { ...state, playerPartner: combatant, playerStatStages: stages };
  }
  return ref.slot === 0 ? { ...state, enemy: combatant } : { ...state, enemyPartner: combatant };
};

/** Whether what is standing in a slot can still act and still be aimed at. */
export const isEngaged = (combatant: BattleCombatant | null): combatant is BattleCombatant =>
  combatant !== null && combatant.currentHp > 0;

/** Every slot this battle fields for a side, whether or not anyone is in it. */
export const slotsOf = (state: BattleState, side: BattleSide): readonly SlotRef[] =>
  Array.from({ length: state.unitCount }, (_, slot) => slotRef(side, slot));

/** The slots on a side with somebody in them who is still standing. */
export const engagedSlots = (state: BattleState, side: BattleSide): readonly SlotRef[] =>
  slotsOf(state, side).filter((ref) => isEngaged(unitAt(state, ref)));

/** Every slot in the battle with a body in it at all, player side first. */
const occupiedSlots = (state: BattleState): readonly SlotRef[] =>
  [...slotsOf(state, 'player'), ...slotsOf(state, 'enemy')].filter(
    (ref) => unitAt(state, ref) !== null,
  );

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
  // Every body on the field is asked, not both leads: one Cloud Nine holds the
  // weather off the whole field whichever of the four slots it is standing in.
  return weatherStilledBy(state) === null ? state.weather.id : null;
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
  ref: SlotRef,
  effect: AbilityEffectKind,
  detail: { readonly status?: StatusName; readonly stat?: StageStat; readonly amount?: number } = {},
): { readonly state: BattleState; readonly events: readonly BattleEvent[] } => {
  const combatant = unitAt(state, ref);
  if (!combatant) {
    return { state, events: [] };
  }
  const ability = abilityLabel(abilityCarrier(combatant));
  if (!ability) {
    return { state, events: [] };
  }
  let nextState = state;
  if (CONTINUOUS_ABILITY_EFFECTS.has(effect)) {
    if (combatant.abilityAnnounced) {
      return { state, events: [] };
    }
    nextState = withUnit(state, ref, { ...combatant, abilityAnnounced: true });
  }
  return {
    state: nextState,
    events: [
      {
        type: 'ability',
        user: ref.side,
        ...inSlot(ref),
        name: combatant.pokemon.base.name,
        ability,
        effect,
        ...detail,
      },
    ],
  };
};

/**
 * Intimidate, and anything else that happens because a Pokemon has arrived.
 *
 * The boost is applied to the *other side*, and it is applied through
 * `applyStatBoosts` like every other, so each foe's own Clear Body refuses it
 * and says so. In a double battle it lands on **both** foes, which is canon and
 * also the only reading that makes sense: the Pokemon is glaring across the
 * field, not at one of the two things on it.
 */
const applySendOut = (
  state: BattleState,
  ref: SlotRef,
): { readonly state: BattleState; readonly events: readonly BattleEvent[] } => {
  const combatant = unitAt(state, ref);
  if (!combatant) {
    return { state, events: [] };
  }
  const boosts = sendOutBoosts(abilityCarrier(combatant));
  if (boosts.length === 0) {
    return { state, events: [] };
  }
  const announced = announceAbility(state, ref, 'sent-out');
  let nextState = announced.state;
  const events: BattleEvent[] = [...announced.events];
  for (const foe of engagedSlots(nextState, opposing(ref.side))) {
    const boosted = applyStatBoosts(nextState, foe, boosts, ref);
    nextState = boosted.state;
    events.push(...boosted.events);
  }
  return { state: nextState, events };
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
export const openingAbilityEvents = (state: BattleState): readonly BattleEvent[] =>
  occupiedSlots(state).flatMap((ref) => openingEventsFor(state, ref));

const openingEventsFor = (state: BattleState, ref: SlotRef): readonly BattleEvent[] => {
  const combatant = unitAt(state, ref);
  if (!combatant) {
    return [];
  }
  const boosts = sendOutBoosts(abilityCarrier(combatant));
  if (boosts.length === 0) {
    return [];
  }
  const ability = abilityLabel(abilityCarrier(combatant));
  return [
    {
      type: 'ability',
      user: ref.side,
      ...inSlot(ref),
      name: combatant.pokemon.base.name,
      ability,
      effect: 'sent-out',
    },
    ...engagedSlots(state, opposing(ref.side)).flatMap((foeRef): BattleEvent[] => {
      const foe = unitAt(state, foeRef);
      if (!foe) {
        return [];
      }
      return boosts.flatMap((boost): BattleEvent[] =>
        foe.statStages[boost.stat] === 0
          ? []
          : [
              {
                type: 'stat-stage-changed',
                user: foeRef.side,
                ...inSlot(foeRef),
                name: foe.pokemon.base.name,
                stat: boost.stat,
                stages: foe.statStages[boost.stat],
              },
            ],
      );
    }),
  ];
};

/**
 * `weather` is the weather of the *place* the fight is happening in, which on a
 * raid is the district the player was standing in. It has no duration: it is
 * the field until a move covers it, and it comes back when that move lapses.
 */
/** The second Pokemon each side puts on the field, where a battle has one. */
export interface BattlePartners {
  readonly player?: Pokemon | null;
  readonly enemy?: Pokemon | null;
}

export const createBattleState = (
  player: Pokemon,
  enemy: Pokemon,
  weather: WeatherId | null = null,
  partners: BattlePartners = {},
): BattleState => {
  const playerCombatant = toCombatant(player);
  // Two a side or one a side, never one and two: a double battle wants a second
  // body on each side, and half of one is the handicap match this game has no
  // fight for. Whichever side is short decides it for both.
  const playerPartner = partners.player && !partners.player.isFainted ? partners.player : null;
  const enemyPartner = partners.enemy && !partners.enemy.isFainted ? partners.enemy : null;
  const double = playerPartner !== null && enemyPartner !== null;
  const playerPartnerCombatant = double && playerPartner ? toCombatant(playerPartner) : null;
  const stages = new Map<Pokemon, StatStages>([[player, playerCombatant.statStages]]);
  if (playerPartnerCombatant) {
    stages.set(playerPartnerCombatant.pokemon, playerPartnerCombatant.statStages);
  }
  const opening: BattleState = {
    player: playerCombatant,
    enemy: toCombatant(enemy),
    playerPartner: playerPartnerCombatant,
    enemyPartner: double && enemyPartner ? toCombatant(enemyPartner) : null,
    playerStatStages: stages,
    enemyPartyIndex: 0,
    enemyPartnerPartyIndex: double ? 1 : null,
    enemySentOut: double ? 2 : 1,
    unitCount: double ? 2 : 1,
    outcome: player.isFainted ? 'defeat' : enemy.isFainted ? 'victory' : 'active',
    weather: weather === null ? null : { id: weather, turnsRemaining: null },
    ambientWeather: weather,
  };
  // Everyone has arrived, so everyone's arrival is already owed: a state is
  // never handed out with one outstanding, and `openingAbilityEvents` is the
  // words for what this has already made true.
  if (opening.outcome !== 'active') {
    return opening;
  }
  return occupiedSlots(opening).reduce(
    (state, ref) => applySendOut(state, ref).state,
    opening,
  );
};

/**
 * `playerPartner` is the second Pokemon the player is fielding, and it is what
 * decides whether a double-battle trainer actually gets one: see
 * `TrainerBattle.unitCount`.
 */
export const createTrainerBattleState = (
  player: Pokemon,
  trainer: TrainerBattle,
  weather: WeatherId | null = null,
  playerPartner: Pokemon | null = null,
): BattleState => {
  const firstEnemy = trainer.party[0];
  if (!firstEnemy) {
    throw new Error('A trainer battle requires at least one Pokemon.');
  }
  const wantsTwo = (trainer.unitCount ?? 1) > 1 && trainer.party.length > 1;
  return {
    ...createBattleState(player, firstEnemy, weather, {
      player: wantsTwo ? playerPartner : null,
      enemy: wantsTwo ? trainer.party[1] : null,
    }),
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
export const lockedMove = (state: BattleState, side: BattleSide, slot = 0): number | null => {
  const pending = unitAt(state, slotRef(side, slot))?.pendingMove;
  return pending ? pending.moveIndex : null;
};

/**
 * One of the player's slots and what it is doing this turn.
 *
 * `target` is which foe the move is aimed at, and it is only ever read by a
 * move that aims at one foe: a move that hits both foes hits both of them, and
 * a move a Pokemon uses on itself has nowhere else to go. Left out, the aim
 * falls on the first foe still standing, which is what a single battle has
 * always meant and what `resolveTurn(state, 0, rng)` still means.
 */
export interface PlayerMoveChoice {
  readonly slot?: number;
  readonly moveIndex: number;
  readonly target?: SlotRef;
}

/**
 * What the player chose this turn: a move index for a single battle, or one
 * choice per slot for a double. The number is not a shorthand kept for the old
 * call sites - it is what "the player's move" means when there is one Pokemon
 * out, and a fight with one Pokemon out is still most of this game.
 */
export type PlayerTurnChoice = number | readonly PlayerMoveChoice[];

/** One action waiting to be taken, before the turn is put in order. */
interface QueuedAction {
  readonly ref: SlotRef;
  readonly moveIndex: number;
  readonly target?: SlotRef;
  readonly speed: number;
  readonly priority: number;
  readonly claw: 0 | 1;
}

/**
 * Everything that happens between the player choosing and the player being
 * asked again.
 *
 * **How a turn is put in order, over however many units are on the field.**
 * Every action is sorted on four keys, in this order, and the first three are
 * exactly the two a single battle already used:
 *
 *  1. the **move's own priority** - a Quick Attack goes before everything with
 *     a lower number whatever the Speed;
 *  2. **Quick Claw**, rolled per holder before the order is settled, which
 *     breaks the tie *inside* a priority bracket rather than outranking it;
 *  3. **Speed**, read through the stat stages and through Chlorophyll and Swift
 *     Swim; then
 *  4. a **fixed** tie-break: the player's side first, and within a side the
 *     lead before the partner.
 *
 * Generation III breaks a true Speed tie with a coin. This does not, and the
 * reason is that a seed here has to replay: `trainerMeasure.ts`,
 * `encounterMeasure.ts` and the whole boss ladder are numbers measured over
 * this engine, and a coin in the ordering would move them without anything
 * changing. A tie is decided the same way every time instead, and the direction
 * it falls is stated rather than incidental.
 */
export const resolveTurn = (
  state: BattleState,
  playerChoice: PlayerTurnChoice,
  random: RandomSource,
): TurnResult => {
  if (state.outcome !== 'active') {
    return { state, events: [] };
  }

  const playerSlots = engagedSlots(state, 'player');
  const choices: readonly PlayerMoveChoice[] =
    typeof playerChoice === 'number' ? [{ slot: 0, moveIndex: playerChoice }] : playerChoice;

  // Every chosen move is checked before any of them is taken. A turn half of
  // which cannot be played is not a turn: the scene asks again, and the one
  // thing it must never do is spend the other slot's action on the question.
  const playerActions: { readonly ref: SlotRef; readonly moveIndex: number; readonly target?: SlotRef }[] = [];
  for (const ref of playerSlots) {
    const choice = choices.find((candidate) => (candidate.slot ?? 0) === ref.slot);
    if (!choice) {
      continue;
    }
    const forced = lockedMove(state, 'player', ref.slot);
    const moveIndex = forced ?? choice.moveIndex;
    const move = unitAt(state, ref)?.moves[moveIndex];
    if (!move) {
      return { state, events: [] };
    }
    if (move.pp <= 0 && forced === null) {
      return {
        state,
        events: [{ type: 'no-pp', user: 'player', ...inSlot(ref), move: move.base.name }],
      };
    }
    playerActions.push({ ref, moveIndex, target: choice.target });
  }
  if (playerActions.length === 0) {
    return { state, events: [] };
  }

  // The enemy chooses next, exactly as it did when there was one of it: a move,
  // and - only where there is more than one thing to aim at - who to aim it at.
  // A single battle draws no target roll at all, so a seeded fight plays the
  // same sequence it always did.
  const enemyActions: { readonly ref: SlotRef; readonly moveIndex: number; readonly target?: SlotRef }[] = [];
  for (const ref of engagedSlots(state, 'enemy')) {
    const combatant = unitAt(state, ref);
    if (!combatant) {
      continue;
    }
    const moveIndex = lockedMove(state, 'enemy', ref.slot) ?? chooseEnemyMove(combatant, random);
    if (moveIndex === null) {
      continue;
    }
    enemyActions.push({ ref, moveIndex, target: chooseTarget(state, 'player', random) });
  }

  // Quick Claw is rolled before the order is decided, once for each holder, so
  // the claw is the reason the turn came out the way it did rather than an
  // adjustment made afterwards. A claw that fires is announced before the move
  // it let through.
  const claws: BattleEvent[] = [];
  const firstStrike = (ref: SlotRef, combatant: BattleCombatant): 1 | 0 => {
    if (!rollsFirstStrike(combatant.pokemon, random)) {
      return 0;
    }
    claws.push({
      type: 'gear-first-strike',
      user: ref.side,
      ...inSlot(ref),
      name: combatant.pokemon.base.name,
      item: gearLabel(combatant.pokemon.heldItemId),
    });
    return 1;
  };
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
  const actions: QueuedAction[] = [...playerActions, ...enemyActions].flatMap((action) => {
    const combatant = unitAt(state, action.ref);
    return combatant
      ? [
          {
            ...action,
            speed: speedOf(combatant),
            priority: movePriority(combatant, action.moveIndex),
            claw: firstStrike(action.ref, combatant),
          },
        ]
      : [];
  });
  actions.sort(
    (left, right) =>
      right.priority - left.priority ||
      right.claw - left.claw ||
      right.speed - left.speed ||
      (left.ref.side === right.ref.side
        ? left.ref.slot - right.ref.slot
        : left.ref.side === 'player'
          ? -1
          : 1),
  );

  // Flinch is cleared for everybody before anyone acts, so the only flinch a
  // combatant can be carrying when its turn comes is one somebody set this
  // turn - which is exactly the rule that a flinch needs you to be faster.
  let nextState = clearFlinching(state);
  const events: BattleEvent[] = [...claws];
  // A Speed the weather doubled is announced before the turn it decided, in the
  // same place and for the same reason Quick Claw's line is: the order came out
  // the way it did *because* of it.
  for (const ref of occupiedSlots(nextState)) {
    const combatant = unitAt(nextState, ref);
    if (!combatant || speedMultiplier(abilityCarrier(combatant), field) === 1) {
      continue;
    }
    const raced = announceAbility(nextState, ref, 'quickened');
    nextState = raced.state;
    events.push(...raced.events);
  }
  for (const action of actions) {
    if (nextState.outcome !== 'active') {
      break;
    }
    // A Pokemon that has already fallen this turn does not take the action it
    // had queued - the tutorial's `action.IsInvalid`, and the reason a double
    // battle rewards going first with more than the first hit.
    if (!isEngaged(unitAt(nextState, action.ref))) {
      continue;
    }
    const result = applyMove(nextState, action.ref, action.moveIndex, random, action.target);
    nextState = result.state;
    events.push(...result.events);
  }

  // The weather is charged once for the whole turn, after everybody has acted -
  // it is the field's turn, not any combatant's, which is why it does not hang
  // off `applyEndOfAction` the way burn and Leftovers do, and why four units on
  // the field are still one weather.
  const weathered = applyWeather(clearFlinching(nextState));
  return { state: weathered.state, events: [...events, ...weathered.events] };
};

/**
 * Who a side's move lands on when the side did not say, and who the enemy aims
 * at. Uniform among whoever is still standing, as the tutorial picks, and it
 * spends no randomness at all where there is only one of them - which is every
 * single battle in the game.
 */
const chooseTarget = (
  state: BattleState,
  side: BattleSide,
  random: RandomSource,
): SlotRef | undefined => {
  const candidates = engagedSlots(state, side);
  if (candidates.length <= 1) {
    return candidates[0];
  }
  return candidates[Math.floor(clampRandom(random()) * candidates.length)];
};

const clearFlinching = (state: BattleState): BattleState =>
  occupiedSlots(state).reduce((carried, ref) => {
    const combatant = unitAt(carried, ref);
    return combatant?.flinching ? withUnit(carried, ref, { ...combatant, flinching: false }) : carried;
  }, state);

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
export const replacePlayerPokemon = (
  state: BattleState,
  pokemon: Pokemon,
  slot = 0,
): TurnResult => {
  const ref = slotRef('player', slot);
  const outgoing = unitAt(state, ref);
  const events: BattleEvent[] = [];
  let withdrawn = state;
  if (outgoing && outgoing.primaryStatus && curesOnSwitchOut(abilityCarrier(outgoing))) {
    const status = outgoing.primaryStatus;
    withdrawn = withUnit(state, ref, { ...outgoing, primaryStatus: null, sleepTurns: 0 });
    outgoing.pokemon.primaryStatus = null;
    const said = announceAbility(withdrawn, ref, 'cured-on-switch', { status });
    withdrawn = said.state;
    events.push(...said.events);
  }

  const statStages = withdrawn.playerStatStages.get(pokemon) ?? createStatStages();
  const arriving = { ...toCombatant(pokemon), statStages };
  const switched: BattleState = {
    ...withUnit(withdrawn, ref, arriving),
    outcome: pokemon.isFainted
      ? engagedSlots(withdrawn, 'player').some((other) => !sameSlot(other, ref))
        ? 'active'
        : 'defeat'
      : engagedSlots(withdrawn, 'enemy').length === 0
        ? 'victory'
        : 'active',
  };
  if (switched.outcome !== 'active') {
    return { state: switched, events };
  }
  const arrived = applySendOut(switched, ref);
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
export const refreshPlayerAfterLevelUp = (
  state: BattleState,
  previousMaxHp: number,
  slot = 0,
): BattleState => {
  const ref = slotRef('player', slot);
  const combatant = unitAt(state, ref);
  return combatant
    ? withUnit(state, ref, refreshCombatantAfterLevelUp(combatant, previousMaxHp))
    : state;
};

/** Which of the player's slots, if any, this Pokemon is standing in. */
export const playerSlotOf = (state: BattleState, pokemon: Pokemon): SlotRef | null =>
  slotsOf(state, 'player').find((ref) => unitAt(state, ref)?.pokemon === pokemon) ?? null;

/** Everything the player has on the field, in slot order. */
export const playerCombatants = (state: BattleState): readonly BattleCombatant[] =>
  slotsOf(state, 'player').flatMap((ref) => {
    const combatant = unitAt(state, ref);
    return combatant ? [combatant] : [];
  });

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
  // Both of the other side's slots take theirs: a turn the player spent on the
  // bag is a turn each of them got for nothing, which is what the bag costs.
  let nextState = state;
  const events: BattleEvent[] = [];
  for (const ref of engagedSlots(state, 'enemy')) {
    if (nextState.outcome !== 'active' || !isEngaged(unitAt(nextState, ref))) {
      break;
    }
    const combatant = unitAt(nextState, ref);
    if (!combatant) {
      continue;
    }
    const moveIndex = lockedMove(nextState, 'enemy', ref.slot) ?? chooseEnemyMove(combatant, random);
    if (moveIndex === null) {
      continue;
    }
    const target = chooseTarget(nextState, 'player', random);
    const acted = applyMove(nextState, ref, moveIndex, random, target);
    nextState = acted.state;
    events.push(...acted.events);
  }
  const weathered = applyWeather(nextState);
  return { state: weathered.state, events: [...events, ...weathered.events] };
};

/**
 * What a combatant's HP becomes after taking damage.
 *
 * Nothing but the explorer run makes this anything other than the subtraction
 * it has always been: in a playtest run (`dev/playtestMode.ts`) the player's
 * side is floored at one hit point, so no move, status, weather, recoil or
 * confusion can knock it out and the run cannot be lost. It is asked here, in
 * the one function every path that takes HP goes through, rather than by a
 * scene - HP reaches nothing inside the engine, and a faint is emitted the
 * instant it does. The flag is false everywhere else, which is why the measured
 * ladders (`trainerMeasure.ts`, `encounterMeasure.ts`) read exactly what they
 * always read.
 */
function hpAfterDamage(side: 'player' | 'enemy', currentHp: number, damage: number): number {
  const floor = side === 'player' && isPlaytestRun() ? Math.min(1, currentHp) : 0;
  return Math.max(floor, currentHp - damage);
}

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
  // Every slot in turn, player side first, exactly as the tutorial walks its
  // units. It is charged **once per unit per turn**, not once per attacker:
  // this is the field's own turn, taken after everybody has acted, so four
  // Pokemon on the field are four chips and never eight. Speed order would
  // matter only for which of two simultaneous knockouts is printed first, and a
  // fixed order is the one that replays the same way every time.
  for (const ref of occupiedSlots(nextState)) {
    if (nextState.outcome !== 'active') {
      break;
    }
    const combatant = unitAt(nextState, ref);
    if (!isEngaged(combatant)) {
      continue;
    }
    if (shelteredFromWeather(abilityCarrier(combatant), weather.id)) {
      continue;
    }
    const damage = weatherChipDamage(field, getCombatantTypes(combatant), combatant.pokemon.maxHp);
    if (damage === 0) {
      continue;
    }
    const buffeted = { ...combatant, currentHp: hpAfterDamage(ref.side, combatant.currentHp, damage) };
    nextState = withUnit(nextState, ref, buffeted);
    events.push({
      type: 'weather-damage',
      user: ref.side,
      ...inSlot(ref),
      name: combatant.pokemon.base.name,
      weather: weather.id,
      damage: combatant.currentHp - buffeted.currentHp,
    });
    if (buffeted.currentHp === 0) {
      const fallen = resolveFaint(nextState, ref);
      nextState = fallen.state;
      events.push(
        { type: 'fainted', user: ref.side, ...inSlot(ref), name: combatant.pokemon.base.name },
        ...fallen.events,
      );
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
 *  6. who the move is actually landing on;
 *  7. then, **per target**: one accuracy roll, one to five hits, and what
 *     touching it cost;
 *  8. the move's own drain, recoil and healing, off the total it dealt;
 *  9. its guaranteed `effects`, then each of its `secondaries` on its own roll;
 * 10. held-item recoil, then end-of-action status and gear.
 *
 * **Who a move lands on.** A move that names one foe lands on the one it was
 * aimed at; if that foe fell earlier in this same turn it is re-aimed at
 * whoever else is standing, which is generation III's redirection and the thing
 * that stops a double battle punishing you for choosing first. A move that
 * names `BothFoes` lands on everything still standing opposite, each with its
 * own accuracy roll, its own damage roll and its own effectiveness - and each at
 * `SPREAD_DAMAGE_MULTIPLIER` while there is more than one of them. The
 * same-type bonus is the one term that cannot vary between targets: it is a
 * fact about the attacker and the move, so it is the same 1.5 against both.
 */
const applyMove = (
  state: BattleState,
  ref: SlotRef,
  moveIndex: number,
  random: RandomSource,
  chosenTarget?: SlotRef,
): TurnResult => {
  const user = ref.side;
  const attacker = unitAt(state, ref);
  if (!attacker) {
    return { state, events: [] };
  }
  const pending = attacker.pendingMove;

  // 1. A recharge is the whole action. The pending move is spent either way, so
  // a Hyper Beam can never cost two turns in a row.
  if (pending?.kind === MoveCharge.Recharge) {
    const rested = withUnit(state, ref, { ...attacker, pendingMove: null });
    return applyEndOfAction(
      rested,
      ref,
      [{ type: 'recharging', user, ...inSlot(ref), name: attacker.pokemon.base.name }],
      random,
    );
  }
  const releasingCharge = pending?.kind === MoveCharge.Charge;
  const chosenIndex = releasingCharge ? pending.moveIndex : moveIndex;
  const move = attacker.moves[chosenIndex];
  // PP was already spent on the winding-up turn, so a released charge never
  // checks it - otherwise a Solar Beam on its last PP would fizzle halfway.
  if (!move || (!releasingCharge && move.pp <= 0)) {
    return {
      state,
      events: move ? [{ type: 'no-pp', user, ...inSlot(ref), move: move.base.name }] : [],
    };
  }

  // 2. Flinch, before any of the ordinary status rolls: it is the other side's
  // move that took this turn away, not this side's condition.
  if (attacker.flinching) {
    const shaken = withUnit(state, ref, { ...attacker, flinching: false, pendingMove: null });
    return applyEndOfAction(
      shaken,
      ref,
      [{ type: 'flinched', user, ...inSlot(ref), name: attacker.pokemon.base.name }],
      random,
    );
  }

  // 3.
  const attempted = resolveStatusBeforeMove(state, ref, random);
  if (!attempted.canAct) {
    return applyEndOfAction(attempted.state, ref, attempted.events, random);
  }

  let nextState = attempted.state;
  const attackerAfterStatus = unitAt(nextState, ref)!;
  const attackerName = attackerAfterStatus.pokemon.base.name;

  // 6. Who this lands on, settled before the PP is spent because Pressure is
  // read off whoever it is aimed at. A move a Pokemon uses on itself costs its
  // own PP and no more however heavily the other side leans on it; a move aimed
  // at two Pressure holders is leaned on by both, which is generation III's rule.
  const targets = resolveTargets(nextState, ref, move.base, chosenTarget);
  const pressure = targetsTheOtherSide(move.base.target)
    ? targets.reduce((total, targetRef) => {
        const target = unitAt(nextState, targetRef);
        return total + (target ? extraPpCost(abilityCarrier(target)) : 0);
      }, 0)
    : 0;

  // 4. PP, and the charge that is being released is now spent.
  const spentAttacker: BattleCombatant = {
    ...attackerAfterStatus,
    pendingMove: null,
    moves: releasingCharge
      ? attackerAfterStatus.moves
      : attackerAfterStatus.moves.map((known, index) =>
          index === chosenIndex ? { ...known, pp: Math.max(0, known.pp - 1 - pressure) } : known,
        ),
  };
  nextState = withUnit(nextState, ref, spentAttacker);
  const events: BattleEvent[] = [...attempted.events];

  // 5. A charge move's first turn announces itself and stops. The move is
  // remembered on the combatant, which is the one piece of state that has to
  // outlive this call.
  if (move.base.charge === MoveCharge.Charge && !releasingCharge) {
    nextState = withUnit(nextState, ref, {
      ...spentAttacker,
      pendingMove: { moveIndex: chosenIndex, kind: MoveCharge.Charge },
    });
    events.push(
      { type: 'used-move', user, ...inSlot(ref), name: attackerName, move: move.base.name },
      { type: 'charging', user, ...inSlot(ref), name: attackerName, move: move.base.name },
    );
    return applyEndOfAction(nextState, ref, events, random);
  }

  // A move aimed at a side with nobody left standing on it. Only a double
  // battle can reach this: it is the co-target falling to the faster ally's
  // swing between the choice and the action.
  if (targets.length === 0) {
    events.push(
      { type: 'used-move', user, ...inSlot(ref), name: attackerName, move: move.base.name },
      { type: 'no-target', user, ...inSlot(ref) },
    );
    return applyEndOfAction(nextState, ref, events, random);
  }

  const attackerNow = (): BattleCombatant => unitAt(nextState, ref)!;
  const spread = targets.length > 1;
  // The same-type bonus is the attacker's business and the move's, so it is the
  // same figure against every target and is known before a single roll.
  const isStab =
    move.base.type === attackerNow().pokemon.base.primaryType ||
    move.base.type === attackerNow().pokemon.base.secondaryType;
  if (spread) {
    // A spread move names itself once and then says what it took off each
    // target in that target's own line - see the `spread-damage` event.
    events.push({
      type: 'used-move',
      user,
      ...inSlot(ref),
      name: attackerName,
      move: move.base.name,
      category: move.base.category,
      isStab,
      spread: true,
    });
  }

  /** What one target took, and whether it is still standing afterwards. */
  interface Struck {
    readonly ref: SlotRef;
    readonly damage: number;
    readonly landedHits: number;
    readonly immune: boolean;
    readonly missed: boolean;
    readonly fainted: boolean;
    readonly absorbed: boolean;
    readonly recoil: number;
  }
  const struck: Struck[] = [];
  let totalDamage = 0;

  for (const targetRef of targets) {
    const defenderNow = (): BattleCombatant => unitAt(nextState, targetRef)!;
    if (!isEngaged(unitAt(nextState, targetRef))) {
      continue;
    }
    const defenderName = defenderNow().pokemon.base.name;

    // 6a. A move the other side's ability simply will not take. It is asked
    // before the accuracy roll because none of these five is a miss - Levitate
    // is not dodging, and a Soundproof Pokemon does not hear the move go past -
    // and before the hit loop because three of them give something back instead.
    if (targetsTheOtherSide(move.base.target)) {
      const absorption = absorbs(abilityCarrier(defenderNow()), move.base);
      if (absorption) {
        if (!spread) {
          events.push({ type: 'used-move', user, ...inSlot(ref), name: attackerName, move: move.base.name });
        }
        const healed = absorbedHeal(abilityCarrier(defenderNow()), absorption);
        if (healed > 0) {
          const soaked = defenderNow();
          nextState = withUnit(nextState, targetRef, {
            ...soaked,
            currentHp: soaked.currentHp + healed,
          });
        }
        if (absorption.charges) {
          nextState = withUnit(nextState, targetRef, {
            ...defenderNow(),
            abilityCharged: true,
          });
        }
        const said = announceAbility(nextState, targetRef, 'absorbed', { amount: healed });
        nextState = said.state;
        events.push(...said.events);
        struck.push({
          ref: targetRef,
          damage: 0,
          landedHits: 0,
          immune: false,
          missed: false,
          fainted: false,
          absorbed: true,
          recoil: 0,
        });
        continue;
      }
    }

    // 6b. One accuracy roll per target, read through both stages and through
    // the attacker's own ability. A move with `alwaysHits` skips it, which is
    // the only way Swift can exist. Compound Eyes is read here and said after
    // the move is named, because a line about taking aim before anyone knows
    // what is being aimed reads backwards.
    const abilityAccuracy = accuracyMultiplier(abilityCarrier(attackerNow()), move.base);
    const sayAccuracy = (): void => {
      if (abilityAccuracy === 1) {
        return;
      }
      const sharpened = announceAbility(nextState, ref, 'sharpened');
      nextState = sharpened.state;
      events.push(...sharpened.events);
    };
    // Sand Veil moves the *move's* accuracy rather than an evasion stage,
    // because a quarter is not a step on generation III's evasion ladder.
    const veiled = incomingAccuracyMultiplier(
      abilityCarrier(defenderNow()),
      effectiveWeather(nextState),
    );
    if (veiled !== 1) {
      const hidden = announceAbility(nextState, targetRef, 'hidden');
      nextState = hidden.state;
      events.push(...hidden.events);
    }
    const accuracy = stagedAccuracy(
      move.base.accuracy * abilityAccuracy * veiled,
      attackerNow().statStages.accuracy,
      defenderNow().statStages.evasion,
    );
    if (!move.base.alwaysHits && clampRandom(random()) * 100 >= accuracy) {
      if (!spread) {
        events.push({ type: 'used-move', user, ...inSlot(ref), name: attackerName, move: move.base.name });
      }
      sayAccuracy();
      events.push({ type: 'missed', user, ...inSlot(ref) });
      struck.push({
        ref: targetRef,
        damage: 0,
        landedHits: 0,
        immune: false,
        missed: true,
        fainted: false,
        absorbed: false,
        recoil: 0,
      });
      continue;
    }

    // 7. Hits. A single-hit move runs this loop once, so there is one path.
    const hitCount = rollHitCount(move.base, random);
    let damageHere = 0;
    let landedHits = 0;
    let critical = false;
    let effectiveness = 1;
    let recoilHere = 0;
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
        spread,
      );
      for (const note of result.abilityNotes) {
        abilityNotes.add(`${note.side}:${note.effect}`);
      }
      effectiveness = result.typeEffectiveness;
      critical = critical || result.isCritical;
      recoilHere += result.recoil;
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
        currentHp: survived ? 1 : hpAfterDamage(targetRef.side, defender.currentHp, result.damage),
        heldItemSpent: defender.heldItemSpent || survived,
      };
      damageHere += defender.currentHp - hurt.currentHp;
      landedHits += 1;
      nextState = withUnit(nextState, targetRef, hurt);
      defenderFainted = hurt.currentHp === 0;
    }

    totalDamage += damageHere;
    // Only a hit that actually took HP is reported per target. A spread
    // *status* move takes none from anybody, and a line saying so for each of
    // them is two presses that tell the player nothing - what a Growl did is
    // the Attack that fell, and that line follows on its own.
    if (spread && damageHere > 0) {
      events.push({
        type: 'spread-damage',
        user,
        ...inSlot(ref),
        target: targetRef.side,
        ...atSlot(targetRef),
        name: defenderName,
        damage: damageHere,
        isStab,
        category: move.base.category,
      });
    } else if (!spread) {
      events.push({
        type: 'used-move',
        user,
        ...inSlot(ref),
        target: targetRef.side,
        ...atSlot(targetRef),
        name: attackerName,
        move: move.base.name,
        damage: damageHere,
        category: move.base.category,
        isStab,
      });
    }
    // Which ability changed the swing, said once each and after the line that
    // names the move, so the log reads "used X" and then why it landed as it did.
    sayAccuracy();
    for (const note of abilityNotes) {
      const [side, effect] = note.split(':');
      const said = announceAbility(
        nextState,
        side === 'attacker' ? ref : targetRef,
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
        user: targetRef.side,
        ...inSlot(targetRef),
        name: defenderName,
        item: gearLabel(defenderNow().pokemon.heldItemId),
      });
    }

    // 7b. What touching it cost. Static and the three like it need the move to
    // have made contact and the holder to still be standing: a Pokemon knocked
    // out by the blow does not answer it, which is generation III's rule and
    // also the only one that reads right. It is asked once per target, so two
    // Pokemon that both answer a spread move both answer it - and a Pokemon hit
    // twice in one turn by two different attackers answers each of them, because
    // each is its own action.
    if (landedHits > 0 && damageHere > 0 && !defenderFainted && !immune) {
      const shock = contactStatus(abilityCarrier(defenderNow()), move.base, random);
      if (shock) {
        const said = announceAbility(nextState, targetRef, 'contact', { status: shock });
        nextState = said.state;
        const strike = applyStatus(nextState, ref, shock, random, targetRef);
        nextState = strike.state;
        events.push(...said.events, ...strike.events);
      }
    }

    struck.push({
      ref: targetRef,
      damage: damageHere,
      landedHits,
      immune,
      missed: false,
      fainted: defenderFainted,
      absorbed: false,
      recoil: recoilHere,
    });
  }

  // 8. What the swing gives back and what it costs, in that order: a drain that
  // takes the attacker to full and a recoil that then takes HP off it read as
  // two things, and netting them would explain neither. Both are figured off
  // everything the move dealt, across every target, which is what a share of
  // the damage means.
  if (move.base.drain > 0 && totalDamage > 0) {
    const healer = attackerNow();
    const taste = Math.max(1, Math.floor(totalDamage * move.base.drain));
    const oozing = struck.find((hit) => hit.damage > 0 && drainBackfires(abilityCarrier(unitAt(nextState, hit.ref)!)));
    if (oozing) {
      // Liquid Ooze: the same figure, taken off the drainer instead of given to
      // it. It is announced by the Pokemon that was drained, because it is that
      // Pokemon's ability that did it.
      const said = announceAbility(nextState, oozing.ref, 'contact', { amount: taste });
      nextState = said.state;
      events.push(...said.events);
      const sickened = attackerNow();
      const paid = Math.min(sickened.currentHp, taste);
      nextState = withUnit(nextState, ref, { ...sickened, currentHp: sickened.currentHp - paid });
      events.push({ type: 'recoil', user, ...inSlot(ref), name: attackerName, damage: paid });
    } else {
      const drained = Math.min(healer.pokemon.maxHp - healer.currentHp, taste);
      if (drained > 0) {
        nextState = withUnit(nextState, ref, { ...healer, currentHp: healer.currentHp + drained });
        events.push({ type: 'drained', user, ...inSlot(ref), name: attackerName, amount: drained });
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
      events.push({ type: 'heal-failed', user, ...inSlot(ref), name: attackerName });
    } else {
      nextState = withUnit(nextState, ref, { ...healer, currentHp: healer.currentHp + restored });
      events.push({ type: 'healed', user, ...inSlot(ref), name: attackerName, amount: restored });
    }
  }
  if (move.base.recoil > 0 && totalDamage > 0) {
    if (blocksRecoil(abilityCarrier(attackerNow()))) {
      const said = announceAbility(nextState, ref, 'no-recoil');
      nextState = said.state;
      events.push(...said.events);
    } else {
      const hurt = attackerNow();
      const owed = Math.min(hurt.currentHp, Math.max(1, Math.floor(totalDamage * move.base.recoil)));
      const left = hpAfterDamage(ref.side, hurt.currentHp, owed);
      const paid = hurt.currentHp - left;
      nextState = withUnit(nextState, ref, { ...hurt, currentHp: left });
      events.push({ type: 'recoil', user, ...inSlot(ref), name: attackerName, damage: paid });
    }
  }

  for (const hit of struck) {
    if (!hit.fainted) {
      continue;
    }
    const fallen = unitAt(nextState, hit.ref);
    const resolved = resolveFaint(nextState, hit.ref);
    nextState = resolved.state;
    events.push(
      {
        type: 'fainted',
        user: hit.ref.side,
        ...inSlot(hit.ref),
        name: fallen?.pokemon.base.name ?? '',
      },
      ...resolved.events,
    );
  }

  // 9. The move's own effects, then its secondaries, on each target that took
  // the move and is still standing. Both are skipped once a target is down or
  // the battle is over - a flinch on a fainted Pokemon is a line of log about
  // nothing - and a move a Pokemon uses on itself runs them once whatever it hit.
  // Whoever the move actually reached and is still standing - and that is read
  // off what happened rather than off the move's target, so a move a Pokemon
  // uses on *itself* and misses with does not land its own boost either. The
  // single-target path used to get that right by returning early on a miss.
  const effectTargets: readonly SlotRef[] = struck
    .filter((hit) => !hit.fainted && !hit.immune && !hit.absorbed && !hit.missed)
    .map((hit) => hit.ref);
  const landedSomewhere = struck.some(
    (hit) => hit.landedHits > 0 || move.base.category === MoveCategory.Status,
  );
  if (landedSomewhere && nextState.outcome === 'active') {
    for (const targetRef of effectTargets) {
      if (nextState.outcome !== 'active' || !isEngaged(unitAt(nextState, targetRef))) {
        continue;
      }
      const guaranteed = applyMoveEffects(
        nextState,
        ref,
        move.base.effects,
        move.base.target,
        targetRef,
        move.base,
        random,
      );
      nextState = guaranteed.state;
      events.push(...guaranteed.events);
      // Shield Dust refuses the extra effect of a move aimed at it, and nothing
      // about a move's effect on its *own* user - Metal Claw still raises its
      // own Attack through a Shield Dust.
      const defender = unitAt(nextState, targetRef);
      const dusted = defender !== null && blocksSecondaries(abilityCarrier(defender));
      let dustSaid = false;
      for (const secondary of move.base.secondaries) {
        if (nextState.outcome !== 'active') {
          break;
        }
        if (dusted && secondary.target !== MoveTarget.Self) {
          if (!dustSaid) {
            dustSaid = true;
            const said = announceAbility(nextState, targetRef, 'blocked-secondaries');
            nextState = said.state;
            events.push(...said.events);
          }
          continue;
        }
        // Each secondary rolls on its own, exactly as the tutorial does it: a
        // move with two of them can land both, one, or neither, and a move that
        // hit two Pokemon rolls for each of them. Serene Grace doubles the
        // chance and never the number of rolls, so a seeded battle draws the
        // same sequence with it or without it.
        if (
          clampRandom(random()) * 100 >=
          secondaryChance(abilityCarrier(attackerNow()), secondary.chance)
        ) {
          continue;
        }
        const rolled = applyMoveEffects(
          nextState,
          ref,
          secondary,
          secondary.target,
          targetRef,
          move.base,
          random,
        );
        nextState = rolled.state;
        events.push(...rolled.events);
      }
    }
  }

  // 10. A recharge is booked now, on the turn the move landed.
  if (move.base.charge === MoveCharge.Recharge && nextState.outcome === 'active') {
    const spent = unitAt(nextState, ref);
    if (spent && spent.currentHp > 0) {
      nextState = withUnit(nextState, ref, {
        ...spent,
        pendingMove: { moveIndex: chosenIndex, kind: MoveCharge.Recharge },
      });
    }
  }

  // Life Orb, after the hit has landed and after whatever it knocked out has
  // fallen: the price is paid for a hit that connected, and it is paid second,
  // so a holder that takes its last two HP paying for a knockout still wins the
  // fight it just ended. It is the **largest** of what the targets cost rather
  // than their sum, because the price is what the swing cost the holder and a
  // holder swings once however many Pokemon are standing in front of it.
  const heldItemRecoil = struck.reduce((worst, hit) => Math.max(worst, hit.recoil), 0);
  if (heldItemRecoil > 0) {
    const holder = unitAt(nextState, ref);
    const paid = holder ? Math.min(holder.currentHp, heldItemRecoil) : 0;
    if (holder && paid > 0) {
      nextState = withUnit(nextState, ref, { ...holder, currentHp: holder.currentHp - paid });
      events.push({
        type: 'gear-recoil',
        user,
        ...inSlot(ref),
        name: attackerName,
        item: gearLabel(holder.pokemon.heldItemId),
        damage: paid,
      });
    }
  }

  const standing = unitAt(nextState, ref);
  if (standing && standing.currentHp === 0 && nextState.outcome === 'active') {
    const fallen = resolveFaint(nextState, ref);
    nextState = fallen.state;
    events.push(
      { type: 'fainted', user, ...inSlot(ref), name: attackerName },
      ...fallen.events,
    );
  }

  return applyEndOfAction(nextState, ref, events, random);
};

/**
 * Who this move is actually landing on.
 *
 * A move aimed at one foe keeps its aim while that foe is standing and is
 * re-aimed at whoever else is if it is not - the choice was made before the
 * turn was ordered, and a faster ally clearing the slot must not cost the
 * slower one its action. `BothFoes` takes everything still standing opposite,
 * and a move a Pokemon uses on itself takes itself.
 */
const resolveTargets = (
  state: BattleState,
  ref: SlotRef,
  move: MoveBase,
  chosen?: SlotRef,
): readonly SlotRef[] => {
  if (!targetsTheOtherSide(move.target)) {
    return [ref];
  }
  const foes = engagedSlots(state, opposing(ref.side));
  if (move.target === MoveTarget.BothFoes) {
    return foes;
  }
  const aimed = chosen && foes.find((foe) => sameSlot(foe, chosen));
  return aimed ? [aimed] : foes.slice(0, 1);
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
 *
 * `against` is which foe this bundle is landing on. It is passed in rather than
 * worked out here because `applyMove` has already decided who the move hit, and
 * a bundle landing on somebody the move missed would be a second answer to the
 * same question.
 */
const applyMoveEffects = (
  state: BattleState,
  ref: SlotRef,
  effects: NormalizedMoveEffects | NormalizedSecondaryEffect,
  target: MoveTarget,
  against: SlotRef,
  move: MoveBase,
  random: RandomSource,
): { readonly state: BattleState; readonly events: readonly BattleEvent[] } => {
  const side = target === MoveTarget.Self ? ref : against;
  let nextState = state;
  const events: BattleEvent[] = [];

  if (effects.boosts.length > 0) {
    const boosted = applyStatBoosts(nextState, side, effects.boosts, ref);
    nextState = boosted.state;
    events.push(...boosted.events);
  }
  if (effects.status) {
    // A move that cannot touch the target at all cannot poison it either:
    // Thunder Wave used to paralyse a Ground type, because the status branch
    // never asked the type chart the damage branch was already asking.
    const receiver = unitAt(nextState, side);
    const immune =
      !sameSlot(side, ref) &&
      receiver !== null &&
      getTypeEffectiveness(move.type, getCombatantTypes(receiver)) === 0;
    if (!immune) {
      const applied = applyStatus(nextState, side, effects.status, random, ref);
      nextState = applied.state;
      events.push(...applied.events);
    } else {
      events.push({ type: 'effectiveness', multiplier: 0 });
    }
  }
  if (effects.flinch) {
    const victim = unitAt(nextState, side);
    if (victim && victim.currentHp > 0) {
      // Inner Focus is the same refusal as Insomnia's, asked of a flinch - which
      // is why flinch is one of `AbilityBlockedCondition`'s values rather than a
      // second gate of its own.
      if (!sameSlot(side, ref) && blocksCondition(abilityCarrier(victim), 'flinch')) {
        const held = announceAbility(nextState, side, 'blocked-status');
        nextState = held.state;
        events.push(...held.events);
      } else {
        nextState = withUnit(nextState, side, { ...victim, flinching: true });
      }
    }
  }
  if (effects.weather) {
    // The one effect that lands on nobody: `side` is not consulted. It replaces
    // whatever was over the field, its own weather included - a second Rain
    // Dance is five fresh turns of rain, as it is in the source material. A
    // spread move that brought weather on would set it once per target, so this
    // is written as a replacement rather than an addition and setting it twice
    // is setting it.
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
  ref: SlotRef,
  random: RandomSource,
): { readonly state: BattleState; readonly events: readonly BattleEvent[]; readonly canAct: boolean } => {
  const combatant = unitAt(state, ref)!;
  const user = ref.side;
  const slot = inSlot(ref);
  const name = combatant.pokemon.base.name;
  const primary = combatant.primaryStatus;

  if (primary === PrimaryStatus.Paralysis && clampRandom(random()) < 0.25) {
    return {
      state,
      events: [{ type: 'status-prevented', user, ...slot, name, status: primary }],
      canAct: false,
    };
  }
  if (primary === PrimaryStatus.Freeze) {
    if (clampRandom(random()) >= 0.25) {
      return {
        state,
        events: [{ type: 'status-prevented', user, ...slot, name, status: primary }],
        canAct: false,
      };
    }
    state = withUnit(state, ref, { ...combatant, primaryStatus: null });
    return {
      state,
      events: [{ type: 'status-cured', user, ...slot, name, status: 'freeze' }],
      canAct: true,
    };
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
        state: withUnit(state, ref, asleep),
        events: [{ type: 'status-prevented', user, ...slot, name, status: primary }],
        canAct: false,
      };
    }
    state = withUnit(state, ref, { ...combatant, primaryStatus: null });
    return {
      state,
      events: [{ type: 'status-cured', user, ...slot, name, status: 'sleep' }],
      canAct: true,
    };
  }
  if (combatant.confusionTurns > 0) {
    const confused = { ...combatant, confusionTurns: combatant.confusionTurns - 1 };
    state = withUnit(state, ref, confused);
    const events: BattleEvent[] = [];
    if (clampRandom(random()) >= 0.5) {
      const damage = Math.floor(combatant.pokemon.maxHp / 8);
      const hurt = { ...confused, currentHp: hpAfterDamage(ref.side, confused.currentHp, damage) };
      state = withUnit(state, ref, hurt);
      events.push({
        type: 'confusion-self-hit',
        user,
        ...slot,
        name,
        damage: confused.currentHp - hurt.currentHp,
      });
      if (hurt.currentHp === 0) {
        const fallen = resolveFaint(state, ref);
        state = fallen.state;
        events.push({ type: 'fainted', user, ...slot, name }, ...fallen.events);
      }
      if (confused.confusionTurns === 0) {
        const still = unitAt(state, ref);
        if (still && still.pokemon === hurt.pokemon) {
          state = withUnit(state, ref, { ...still, confusionTurns: 0 });
        }
        events.push({ type: 'status-cured', user, ...slot, name, status: 'confusion' });
      }
      return { state, events, canAct: false };
    }
    if (confused.confusionTurns === 0) {
      events.push({ type: 'status-cured', user, ...slot, name, status: 'confusion' });
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
 *
 * It hangs off an **action** rather than off the turn, which is what keeps it
 * from double-applying when there are four Pokemon on the field: each unit takes
 * exactly one action a turn, so each is charged its burn and paid its Leftovers
 * exactly once. The weather is the other way round - it is the field's, so it is
 * charged once for the whole turn in `applyWeather`.
 */
const applyEndOfAction = (
  state: BattleState,
  ref: SlotRef,
  events: readonly BattleEvent[],
  random: RandomSource,
): TurnResult => {
  let nextState = state;
  const nextEvents: BattleEvent[] = [...events];
  const combatant = unitAt(state, ref);
  const user = ref.side;
  const slot = inSlot(ref);
  if (state.outcome !== 'active' || !isEngaged(combatant)) {
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
    const updated = { ...combatant, currentHp: hpAfterDamage(ref.side, combatant.currentHp, damage) };
    nextState = withUnit(nextState, ref, updated);
    nextEvents.push({
      type: 'status-damage',
      user,
      ...slot,
      name: combatant.pokemon.base.name,
      status: combatant.primaryStatus!,
      damage: combatant.currentHp - updated.currentHp,
    });
    if (updated.currentHp === 0) {
      const fallen = resolveFaint(nextState, ref);
      nextState = fallen.state;
      nextEvents.push(
        { type: 'fainted', user, ...slot, name: combatant.pokemon.base.name },
        ...fallen.events,
      );
      return { state: nextState, events: nextEvents };
    }
  }

  // Shed Skin, after what the status cost and before what the food gives back:
  // the turn's damage is paid first, and only then does the skin come off - so
  // a poisoned holder is never healed of a poison that had not yet hurt it.
  const shedding = unitAt(nextState, ref);
  if (shedding && shedding.primaryStatus && shedsStatus(abilityCarrier(shedding), random)) {
    nextState = withUnit(nextState, ref, {
      ...shedding,
      primaryStatus: null,
      sleepTurns: 0,
    });
    const said = announceAbility(nextState, ref, 'shed', { status: shedding.primaryStatus });
    nextState = said.state;
    nextEvents.push(...said.events);
  }

  const standing = unitAt(nextState, ref);
  const healed = standing ? endOfTurnHeal(standing.pokemon, standing.currentHp) : 0;
  if (standing && healed > 0) {
    nextState = withUnit(nextState, ref, {
      ...standing,
      currentHp: standing.currentHp + healed,
    });
    nextEvents.push({
      type: 'gear-heal',
      user,
      ...slot,
      name: standing.pokemon.base.name,
      item: gearLabel(standing.pokemon.heldItemId),
      amount: healed,
    });
  }
  return { state: nextState, events: nextEvents };
};

/** Which slot, if any, is holding the weather off the field. */
const weatherStilledBy = (state: BattleState): SlotRef | null =>
  occupiedSlots(state).find((ref) => {
    const combatant = unitAt(state, ref);
    return combatant !== null && suppressesWeather(abilityCarrier(combatant));
  }) ?? null;

/**
 * One status landing on one slot.
 *
 * `source` is who caused it, and it does two things: an ability only refuses a
 * condition the *other side* is inflicting, and Synchronize only has somebody
 * to pass one back to when there is somebody. A status a Pokemon gives itself -
 * Rest, a confusion off its own move - passes straight through both.
 */
const applyStatus = (
  state: BattleState,
  ref: SlotRef,
  status: StatusName,
  random: RandomSource,
  source: SlotRef = ref,
): TurnResult => {
  const combatant = unitAt(state, ref);
  if (!combatant) {
    return { state, events: [] };
  }
  const user = ref.side;
  const slot = inSlot(ref);
  const name = combatant.pokemon.base.name;
  const fromElsewhere = !sameSlot(source, ref);
  if (fromElsewhere && blocksCondition(abilityCarrier(combatant), status)) {
    const refused = announceAbility(state, ref, 'blocked-status', { status });
    return { state: refused.state, events: [...refused.events] };
  }
  if (status === 'confusion') {
    if (combatant.confusionTurns > 0) {
      return { state, events: [{ type: 'status-already', user, ...slot, name, status }] };
    }
    const updated = { ...combatant, confusionTurns: randomTurnCount(random, 4) };
    return {
      state: withUnit(state, ref, updated),
      events: [{ type: 'status-applied', user, ...slot, name, status }],
    };
  }
  if (combatant.primaryStatus) {
    return { state, events: [{ type: 'status-already', user, ...slot, name, status }] };
  }
  const updated = {
    ...combatant,
    primaryStatus: status,
    sleepTurns: status === PrimaryStatus.Sleep ? randomTurnCount(random, 3) : 0,
  };
  let nextState = withUnit(state, ref, updated);
  const events: BattleEvent[] = [{ type: 'status-applied', user, ...slot, name, status }];
  // Synchronize hands it straight back, and the return trip goes through this
  // same function - so the other side's own Limber can refuse it and say so.
  // Two Synchronizes cannot rally: the second pass finds the first holder
  // already carrying the status and stops on `status-already`.
  if (fromElsewhere && reflectsStatus(abilityCarrier(updated), status)) {
    const announced = announceAbility(nextState, ref, 'reflected', { status });
    nextState = announced.state;
    const passed = applyStatus(nextState, source, status, random, ref);
    return { state: passed.state, events: [...events, ...announced.events, ...passed.events] };
  }
  return { state: nextState, events };
};

/**
 * Somebody has gone down. Whoever is waiting takes their place, and the side has
 * lost only when nobody is left standing on it.
 *
 * In a single battle the trainer's next Pokemon walks into the one slot there
 * is, which is exactly what this did before. In a double it walks into the slot
 * that emptied, and the *other* slot goes on fighting meanwhile - which is why
 * the next body is drawn from `enemySentOut` rather than from either slot's own
 * party index. A player's empty slot is left empty: who goes into it is a
 * decision, and `BattleScene` is where decisions are asked for.
 */
const resolveFaint = (
  state: BattleState,
  ref: SlotRef,
): { readonly state: BattleState; readonly events: readonly BattleEvent[] } => {
  if (ref.side === 'enemy' && state.trainer) {
    const party = state.trainer.party;
    let index = state.enemySentOut;
    while (index < party.length && party[index].isFainted) {
      index += 1;
    }
    const next = party[index];
    if (next) {
      const filled: BattleState = {
        ...withUnit(state, ref, toCombatant(next)),
        enemySentOut: index + 1,
        ...(ref.slot === 0
          ? { enemyPartyIndex: index }
          : { enemyPartnerPartyIndex: index }),
        outcome: 'active',
      };
      const arrived = applySendOut(filled, ref);
      return {
        state: arrived.state,
        events: [
          { type: 'enemy-sent-out', name: next.base.name, ...inSlot(ref) },
          ...arrived.events,
        ],
      };
    }
  }

  if (engagedSlots(state, ref.side).length > 0) {
    return { state, events: [] };
  }
  return {
    state: { ...state, outcome: ref.side === 'enemy' ? 'victory' : 'defeat' },
    events: [],
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
  ref: SlotRef,
  boosts: readonly StatBoost[],
  source: SlotRef = ref,
): { readonly state: BattleState; readonly events: readonly BattleEvent[] } => {
  let nextState = state;
  const events: BattleEvent[] = [];
  const fromElsewhere = !sameSlot(source, ref);
  for (const boost of boosts) {
    const combatant = unitAt(nextState, ref);
    if (!combatant) {
      break;
    }
    if (boost.stages < 0 && fromElsewhere && blocksBoost(abilityCarrier(combatant), boost.stat)) {
      const refused = announceAbility(nextState, ref, 'blocked-boost', { stat: boost.stat });
      nextState = refused.state;
      events.push(...refused.events);
      continue;
    }
    const updatedStages = applyStatBoost(combatant.statStages, boost);
    const change = updatedStages[boost.stat] - combatant.statStages[boost.stat];
    if (change === 0) {
      continue;
    }
    nextState = withUnit(nextState, ref, { ...combatant, statStages: updatedStages });
    events.push({
      type: 'stat-stage-changed',
      user: ref.side,
      ...inSlot(ref),
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
