import type { CombatStats } from '../Pokemon';

export const STAT_STAGE_LIMIT = 6;

/**
 * Generation III's damage-stat ladder, `2/(2-n)` written out. It is the one the
 * five combat stats use.
 */
export const STAT_STAGE_MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 3.5, 4] as const;

/**
 * Accuracy and evasion are on a **different ladder** - `3/(3-n)`, which is
 * gentler at every stage - and reading the damage table for them is the easy
 * mistake. It is the same list the tutorial's `CheckIfMoveHits` uses
 * (`{1, 4/3, 5/3, 2, 7/3, 8/3, 3}`), because it is generation III's.
 */
export const ACCURACY_STAGE_MULTIPLIERS = [1, 4 / 3, 5 / 3, 2, 7 / 3, 8 / 3, 3] as const;

/** The five stats a Pokemon actually has, which are what damage is computed from. */
export type BattleStat = Exclude<keyof CombatStats, 'hp'>;

/**
 * The two that exist only as stages: nothing on a Pokemon is an accuracy or an
 * evasion number, so these live here and nowhere else. Sand Attack, Smokescreen,
 * Double Team and Flash are the moves that move them, and there were seven such
 * moves among the 273 with nowhere to put the change.
 */
export type AccuracyStat = 'accuracy' | 'evasion';

/** Anything a stat stage can be held against. */
export type StageStat = BattleStat | AccuracyStat;

export type StatStages = Readonly<Record<StageStat, number>>;

export interface StatBoost {
  readonly stat: StageStat;
  readonly stages: number;
}

export const isAccuracyStat = (stat: StageStat): stat is AccuracyStat =>
  stat === 'accuracy' || stat === 'evasion';

export const createStatStages = (): StatStages => ({
  attack: 0,
  defense: 0,
  spAttack: 0,
  spDefense: 0,
  speed: 0,
  accuracy: 0,
  evasion: 0,
});

export const clampStatStage = (stage: number): number =>
  Math.max(-STAT_STAGE_LIMIT, Math.min(STAT_STAGE_LIMIT, Math.trunc(stage)));

export const applyStatBoost = (stages: StatStages, boost: StatBoost): StatStages => ({
  ...stages,
  [boost.stat]: clampStatStage(stages[boost.stat] + boost.stages),
});

export const getStagedStat = (stat: number, stage: number): number => {
  const multiplier = STAT_STAGE_MULTIPLIERS[Math.abs(clampStatStage(stage))];
  return Math.floor(stage >= 0 ? stat * multiplier : stat / multiplier);
};

/**
 * What the attacker's accuracy stage and the defender's evasion stage do to a
 * move's printed accuracy. Both are applied to the one number, as generation III
 * does it: the attacker's stage multiplies, the defender's divides.
 */
export const stagedAccuracy = (
  accuracy: number,
  attackerAccuracyStage: number,
  defenderEvasionStage: number,
): number => {
  const step = (value: number, stage: number): number => {
    const multiplier = ACCURACY_STAGE_MULTIPLIERS[Math.abs(clampStatStage(stage))];
    return stage >= 0 ? value * multiplier : value / multiplier;
  };
  return step(step(accuracy, attackerAccuracyStage), -defenderEvasionStage);
};
