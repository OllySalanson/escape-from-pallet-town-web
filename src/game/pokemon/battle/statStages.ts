import type { CombatStats } from '../Pokemon';

export const STAT_STAGE_LIMIT = 6;

/**
 * Generation III's damage-stat ladder, `2/(2-n)` written out. It is the one the
 * five combat stats use.
 */
export const STAT_STAGE_MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 3.5, 4] as const;

/**
 * Accuracy and evasion are on a **different ladder** from the damage stats,
 * gentler at every stage - and reading the damage table for them is the easy
 * mistake. It is FireRed's `gAccuracyStageRatios` (pret/pokefirered
 * `src/battle_script_commands.c`), as whole-number ratios: the accuracy stage
 * of -6 is 33/100 and +6 is 3/1, each rounded as the cartridge rounds it rather
 * than the `3/(3-n)` the Unity tutorial's `CheckIfMoveHits` worked out.
 */
export const ACCURACY_STAGE_RATIOS: readonly (readonly [number, number])[] = [
  [33, 100],
  [36, 100],
  [43, 100],
  [50, 100],
  [60, 100],
  [75, 100],
  [1, 1],
  [133, 100],
  [166, 100],
  [2, 1],
  [233, 100],
  [133, 50],
  [3, 1],
];

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
 * move's printed accuracy: FireRed's `Cmd_accuracycheck`. The two are **one**
 * stage - the attacker's accuracy less the defender's evasion, held to -6..+6 -
 * read off `ACCURACY_STAGE_RATIOS` and floored, so a raised accuracy cancels a
 * raised evasion stage for stage. (The Unity tutorial applied each on its own
 * ladder, so +1 accuracy against -1 evasion came to 16/9 where FireRed has 5/3.)
 * The answer is the whole-number chance out of 100 that the move lands.
 */
export const stagedAccuracy = (
  accuracy: number,
  attackerAccuracyStage: number,
  defenderEvasionStage: number,
): number => {
  const stage = clampStatStage(attackerAccuracyStage - defenderEvasionStage);
  const [dividend, divisor] = ACCURACY_STAGE_RATIOS[stage + STAT_STAGE_LIMIT];
  return Math.floor((dividend * accuracy) / divisor);
};
