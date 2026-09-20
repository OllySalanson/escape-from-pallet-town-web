import type { PokemonType } from './PokemonType';
import type { StatBoost } from './battle/statStages';
import type { StatusName } from './battle/status';
import type { WeatherId } from './battle/weather';

export const MoveCategory = {
  Physical: 'Physical',
  Special: 'Special',
  Status: 'Status',
} as const;

export type MoveCategory = (typeof MoveCategory)[keyof typeof MoveCategory];

/**
 * Who an effect lands on. Ported from the tutorial's `MoveTarget`, and it is the
 * single field that unlocks the most: every stat boost in this engine used to be
 * applied to the *other* side unconditionally, so Swords Dance, Agility, Amnesia
 * and Harden - anything a Pokemon does to itself - could not be written down.
 *
 * `BothFoes` is the one value the tutorial has no equivalent of, and it is not
 * an invention: it is PokeAPI's `all-opponents`, which seventeen of the 273
 * moves the 151 learn by level carry and five of the moves this game ships do
 * (see `moves.ts`). It means nothing at all in a single battle - one foe is one
 * foe - so it is a field a move may declare today and a double battle reads.
 *
 * `all-other-pokemon` (Earthquake, Explosion, Magnitude, Self-Destruct - the
 * four that also hit your own partner) is deliberately absent: none of them is
 * shipped, and a target nothing uses is a rule nothing tests.
 */
export const MoveTarget = {
  Foe: 'foe',
  BothFoes: 'both-foes',
  Self: 'self',
} as const;

export type MoveTarget = (typeof MoveTarget)[keyof typeof MoveTarget];

/** Whether a target names the other side at all, as opposed to the user. */
export const targetsTheOtherSide = (target: MoveTarget): boolean =>
  target === MoveTarget.Foe || target === MoveTarget.BothFoes;

/**
 * What a move is, beyond its type and power. Ported from the tutorial's
 * `MoveFlag`; nothing reads one yet, and they are here because an ability, a
 * held item or a rule like Rough Skin asks exactly this question and asking it
 * of a list is cheaper than asking it of a move's name.
 */
export const MoveFlag = {
  Contact: 'contact',
  Punch: 'punch',
  Bite: 'bite',
  Sound: 'sound',
} as const;

export type MoveFlag = (typeof MoveFlag)[keyof typeof MoveFlag];

/**
 * The two-turn shapes. `charge` spends the first turn winding up and the second
 * hitting (Solar Beam, Dig, Fly, Skull Bash); `recharge` hits at once and costs
 * the turn *after* (Hyper Beam). Both are an action that does not fit inside one
 * call, which is why they need a name rather than a flag.
 */
export const MoveCharge = {
  Charge: 'charge',
  Recharge: 'recharge',
} as const;

export type MoveCharge = (typeof MoveCharge)[keyof typeof MoveCharge];

/**
 * Everything a move does that is not damage, as one bundle.
 *
 * This is the tutorial's `MoveEffects`, and the split it belongs to is the whole
 * point: a move's own `effects` are **guaranteed**, each of its `secondaries` is
 * **rolled**. Before that split existed a status could only be attached by
 * matching the move's *name* against a table of four strings, and it always
 * landed at 100% - which is why Thunderbolt and Flamethrower shipped with
 * descriptions reading "No side effect."
 *
 * One difference from the port: the tutorial's `volatileStatus` is a second
 * status id, while here confusion is already one of `StatusName`'s values and
 * flinch is the only other volatile modelled, so flinch is its own flag.
 *
 * `weather` was named here as the gap this shape wanted and is now filled:
 * `BattleState` carries the field, and a weather move is a data row like any
 * other effect. It is the one effect that lands on neither side - it is the
 * field both sides are standing in - so `target` says nothing about it.
 */
export interface MoveEffects {
  readonly boosts?: readonly StatBoost[];
  /** A primary status, or confusion. */
  readonly status?: StatusName;
  /** The target loses its action this turn, if it has not acted yet. */
  readonly flinch?: boolean;
  /**
   * Weather brought on over the whole field, for `WEATHER_MOVE_TURNS`. It
   * belongs to neither side, so `target` does not apply to it.
   */
  readonly weather?: WeatherId;
}

/**
 * A `MoveEffects` with a chance, rolled on its own. A move may carry several and
 * each is rolled independently, exactly as `RunTurnState.RunMove` does it.
 */
export interface SecondaryEffect extends MoveEffects {
  /** Per cent, 1 to 100. */
  readonly chance: number;
  /** Defaults to the move's own target. Metal Claw raises the *user's* Attack. */
  readonly target?: MoveTarget;
}

/** How many times a move hits. `{ min: 2, max: 5 }` is the classic spread. */
export interface MoveHits {
  readonly min: number;
  readonly max: number;
}

export interface MoveBaseInit {
  readonly name: string;
  /**
   * A short, player-facing summary of what the move does. Unity's MoveBase
   * carries the same field; every asset there left it blank, so the text is
   * authored here for the battle move guidance panel.
   */
  readonly description?: string;
  readonly type: PokemonType;
  readonly power: number;
  readonly accuracy: number;
  readonly pp: number;
  readonly category: MoveCategory;
  /** Acts before lower numbers whatever the Speed. Quick Attack is +1. */
  readonly priority?: number;
  /** Skips the accuracy roll outright - Swift, Aerial Ace. */
  readonly alwaysHits?: boolean;
  /** Who the guaranteed effects land on. Defaults to the foe. */
  readonly target?: MoveTarget;
  /** Absent for a single hit. */
  readonly hits?: MoveHits;
  /** Extra critical-hit stages. Slash and Razor Leaf are +1. */
  readonly critStage?: number;
  /** A share of the damage dealt, taken by the user. Double-Edge is 1/3. */
  readonly recoil?: number;
  /** A share of the damage dealt, healed onto the user. Absorb is 1/2. */
  readonly drain?: number;
  /** A share of the user's own maximum HP, healed. Recover is 1/2. */
  readonly healing?: number;
  /** Two-turn shape, if any. */
  readonly charge?: MoveCharge;
  /** Applied every time the move connects. */
  readonly effects?: MoveEffects;
  /** Each rolled on its own chance, after the hit. */
  readonly secondaries?: readonly SecondaryEffect[];
  readonly flags?: readonly MoveFlag[];
}

/** `MoveEffects` with its optional list filled in, so nothing has to guard it. */
export interface NormalizedMoveEffects {
  readonly boosts: readonly StatBoost[];
  readonly status?: StatusName;
  readonly flinch: boolean;
  readonly weather?: WeatherId;
}

export type NormalizedSecondaryEffect = NormalizedMoveEffects & {
  readonly chance: number;
  readonly target: MoveTarget;
};

const normalizeEffects = (effects: MoveEffects | undefined): NormalizedMoveEffects => ({
  boosts: effects?.boosts ?? [],
  status: effects?.status,
  flinch: effects?.flinch ?? false,
  weather: effects?.weather,
});

export class MoveBase {
  public readonly name: string;
  public readonly description: string;
  public readonly type: PokemonType;
  public readonly power: number;
  public readonly accuracy: number;
  public readonly pp: number;
  public readonly category: MoveCategory;
  public readonly priority: number;
  public readonly alwaysHits: boolean;
  public readonly target: MoveTarget;
  public readonly hits: MoveHits | null;
  public readonly critStage: number;
  public readonly recoil: number;
  public readonly drain: number;
  public readonly healing: number;
  public readonly charge: MoveCharge | null;
  public readonly effects: NormalizedMoveEffects;
  public readonly secondaries: readonly NormalizedSecondaryEffect[];
  public readonly flags: readonly MoveFlag[];

  public constructor(init: MoveBaseInit) {
    this.name = init.name;
    this.description = init.description ?? '';
    this.type = init.type;
    this.power = init.power;
    this.accuracy = init.accuracy;
    this.pp = init.pp;
    this.category = init.category;
    this.priority = init.priority ?? 0;
    this.alwaysHits = init.alwaysHits ?? false;
    this.target = init.target ?? MoveTarget.Foe;
    this.hits = init.hits ?? null;
    this.critStage = init.critStage ?? 0;
    this.recoil = init.recoil ?? 0;
    this.drain = init.drain ?? 0;
    this.healing = init.healing ?? 0;
    this.charge = init.charge ?? null;
    this.effects = normalizeEffects(init.effects);
    // A secondary with no target of its own follows the move's, which is what
    // makes "30% chance to lower the target's Speed" the default reading and
    // leaves Metal Claw free to say `target: Self` for its Attack raise.
    this.secondaries = (init.secondaries ?? []).map((secondary) => ({
      ...normalizeEffects(secondary),
      chance: secondary.chance,
      target: secondary.target ?? this.target,
    }));
    this.flags = init.flags ?? [];
  }

  /** Whether this move does anything at all beyond its damage. */
  public get hasEffects(): boolean {
    return (
      this.effects.boosts.length > 0 ||
      this.effects.status !== undefined ||
      this.effects.flinch ||
      this.effects.weather !== undefined ||
      this.secondaries.length > 0
    );
  }
}
