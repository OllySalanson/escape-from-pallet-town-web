import type { MoveBase, MoveFlag } from './MoveBase';
import type { PokemonType } from './PokemonType';
import type { StageStat, StatBoost } from './battle/statStages';
import type { PrimaryStatus, StatusName } from './battle/status';
import type { WeatherId } from './battle/weather';

/**
 * What an ability is, and the whole of what one may say.
 *
 * The **hook vocabulary** is ported from the tutorial's `Ability` - a bag of
 * optional hooks, each answering one question the resolver is about to ask
 * anyway. Its plumbing is not: every hook here is a **pure function of its
 * context**, returning a number or a decision, and never a lambda that reaches
 * into a Pokemon to set a status or push a line of text the way
 * `AbilityDB.cs`'s do. That is the same line PR #130 drew through the move
 * model - the thing declares what it does, the resolver stays pure and stays
 * the only writer of state - and it is what lets `abilities.test.ts` hold every
 * one of these without a battle, let alone a Phaser.
 *
 * Which hooks exist is decided by the 151 and nothing else. The tutorial
 * defines six stat modifiers and two status gates; the 151's real generation
 * III abilities need one stat modifier and a great deal it has no field for
 * (absorbing a type, shedding a status, arriving on the field). The list below
 * is exactly what `node tools/abilities/coverage.mjs` measures the catalogue
 * against, and the abilities it cannot hold are named there with the reason.
 */
export interface AbilityBase extends AbilityHooks {
  /** PokeAPI's own identifier, so a row can be traced back to its source. */
  readonly id: string;
  /** As the battle log names it, before it is put in capitals. */
  readonly name: string;
  /** Player-facing, one sentence, in the voice the gear descriptions use. */
  readonly description: string;
}

/**
 * The holder as every hook reads one.
 *
 * It is the combatant's numbers rather than the Pokemon's, because a pinch
 * ability is about the HP the *fight* has left it on, and `Pokemon.currentHp`
 * is not written until the battle ends.
 */
export interface AbilityHolder {
  readonly currentHp: number;
  readonly maxHp: number;
  readonly primaryStatus: PrimaryStatus | null;
  readonly types: readonly PokemonType[];
  /**
   * Whether this ability's one thing has already happened in this battle.
   *
   * It is the ability's half of `BattleCombatant.heldItemSpent`, and Flash Fire
   * is the only thing that sets it: the fire it swallowed is what powers its own
   * from then on. Which ability is carried is never copied onto the combatant -
   * that is read through to the species - so this single bit is the whole of
   * what a fight owns about one.
   */
  readonly charged: boolean;
}

/** A hook asked about one particular swing. */
export interface AbilityMoveContext {
  readonly holder: AbilityHolder;
  readonly move: MoveBase;
}

/**
 * A hook asked about the field rather than about a move.
 *
 * Four of the 151's abilities are only ever about the weather, and each reads
 * `weather.ts`'s own table rather than restating its rules: Chlorophyll asks
 * whether the sun is out, not what the sun does. The weather handed over here
 * is the one the engine has already asked Cloud Nine about, so an ability never
 * has to know that another ability can turn the field off.
 */
export interface AbilityFieldContext {
  readonly holder: AbilityHolder;
  readonly weather: WeatherId | null;
}

/**
 * A hook asked whether the other side may leave.
 *
 * `foeIsGrounded` is worked out by the engine rather than by the ability,
 * because generation III excuses a Flying type *and* anything that floats, and
 * whether something floats is another ability's business. Asking it as one
 * question is what keeps Arena Trap from having to know what Levitate is.
 */
export interface AbilityEscapeContext {
  readonly foe: AbilityHolder;
  readonly foeIsGrounded: boolean;
}

/** Anything an ability may refuse. Flinch is a condition here as it is a move's. */
export type AbilityBlockedCondition = StatusName | 'flinch';

/**
 * What an incoming move of a type does instead of hitting.
 *
 * All four of the 151's absorbers share this shape: the move does nothing, and
 * then either the holder is healed (Water Absorb, Volt Absorb) or it is charged
 * (Flash Fire) or neither (Levitate).
 */
export interface AbilityAbsorption {
  /** A share of maximum HP restored. Water Absorb and Volt Absorb are 1/4. */
  readonly heal?: number;
  /** Sets `AbilityHolder.charged` for the rest of the battle. */
  readonly charges?: boolean;
}

/** What touching the holder may cost. All four of these are 30% in FireRed. */
export interface AbilityContactEffect {
  /** Per cent, 1 to 100. */
  readonly chance: number;
  /** One of these, chosen evenly. Effect Spore is three, at 10% each. */
  readonly statuses: readonly StatusName[];
}

export interface AbilityHooks {
  /**
   * Multiplies the holder's own offensive stat for this move. Blaze and the
   * three like it are 1.5x in the pinch; Guts is 1.5x with a status on it.
   */
  readonly modifyAttack?: (context: AbilityMoveContext) => number;
  /** Multiplies the printed accuracy of a move the holder is using. */
  readonly modifyAccuracy?: (context: AbilityMoveContext) => number;
  /** Multiplies the accuracy of a move aimed *at* the holder. Sand Veil is 1/1.25. */
  readonly modifyIncomingAccuracy?: (context: AbilityFieldContext) => number;
  /** Multiplies the holder's Speed when the turn order is settled. */
  readonly modifySpeed?: (context: AbilityFieldContext) => number;
  /** Whether this weather's end-of-turn chip passes the holder by. */
  readonly shelteredFromWeather?: (weather: WeatherId) => boolean;
  /**
   * While the holder is on the field there is no weather at all - the chip, the
   * damage it bends and every other ability that reads it. The clock still runs
   * underneath, because Cloud Nine holds the weather off rather than ending it.
   */
  readonly suppressesWeather?: true;
  /** Multiplies the damage the holder is about to take. Thick Fat halves two types. */
  readonly modifyDamageTaken?: (context: AbilityMoveContext) => number;
  /** No critical hit may land on the holder. */
  readonly blocksCriticalHits?: true;
  /** The holder pays no recoil for its own move. */
  readonly blocksRecoil?: true;
  /** What a move of this type does to the holder instead of its damage. */
  readonly absorbsMoveType?: (type: PokemonType) => AbilityAbsorption | null;
  /**
   * A move carrying this flag does not touch the holder at all. Soundproof is
   * the first thing in the game to read a `MoveFlag`, which is what those flags
   * were put on `MoveBase` for.
   */
  readonly blocksMoveFlag?: MoveFlag;
  /** Whether a stat the *other side* is lowering is refused. */
  readonly blocksBoost?: (stat: StageStat) => boolean;
  /** Whether a condition the *other side* is inflicting is refused. */
  readonly blocksStatus?: (condition: AbilityBlockedCondition) => boolean;
  /** Incoming secondary effects do not roll at all. Shield Dust. */
  readonly blocksSecondaries?: true;
  /** Multiplies the chance of the holder's own secondaries. Serene Grace is 2. */
  readonly secondaryChanceMultiplier?: number;
  /** What touching the holder may cost the one who touched it. */
  readonly onDamagingHit?: AbilityContactEffect;
  /** A status landing on the holder is passed back to whoever caused it. */
  readonly reflectsStatus?: (status: StatusName) => boolean;
  /** The chance, at the end of each of the holder's turns, of shedding a status. */
  readonly endOfTurnCureChance?: number;
  /** How many turns of sleep one turn burns through. Early Bird is 2. */
  readonly sleepTurnsPerTurn?: number;
  /** What arriving on the field does to the foe. Intimidate is one Attack stage. */
  readonly onSendOut?: readonly StatBoost[];
  /** Any status is cleared when the holder is withdrawn. Natural Cure. */
  readonly curesOnSwitchOut?: true;
  /** A drain taken off the holder hurts the drainer instead. Liquid Ooze. */
  readonly drainBackfires?: true;
  /** What a move aimed at the holder costs in PP beyond its own. Pressure is 1. */
  readonly extraPpCost?: number;
  /** The holder always gets away from a wild battle. Run Away. */
  readonly escapeAlwaysSucceeds?: true;
  /** Whether the foe may not run from the holder. Arena Trap, Magnet Pull. */
  readonly preventsEscape?: (context: AbilityEscapeContext) => boolean;
}

/**
 * What an ability did, as the battle log is told about it.
 *
 * A player is never shown an ability in a menu, so the only way to learn what
 * one does is to watch it happen - which is why every one of these exists and
 * why `battlePresentation.ts` has a line for each. The continuous ones
 * (`powered-up`, `sharpened`, `shrugged-off`, `hardened`) introduce themselves
 * once per battle and then stay quiet; the rest are each a separate thing
 * happening and are said each time.
 */
export type AbilityEffectKind =
  | 'powered-up'
  | 'sharpened'
  | 'shrugged-off'
  | 'hardened'
  | 'absorbed'
  | 'blocked-status'
  | 'blocked-boost'
  | 'blocked-secondaries'
  | 'no-recoil'
  | 'shed'
  | 'cured-on-switch'
  | 'reflected'
  | 'contact'
  | 'sent-out'
  | 'quickened'
  | 'hidden'
  | 'weathered-out';
