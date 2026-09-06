import type { CombatStats } from '../Pokemon';

export const STAT_STAGE_LIMIT = 6;
export const STAT_STAGE_MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 3.5, 4] as const;

export type BattleStat = Exclude<keyof CombatStats, 'hp'>;
export type StatStages = Readonly<Record<BattleStat, number>>;

export interface StatBoost {
  readonly stat: BattleStat;
  readonly stages: number;
}

export const createStatStages = (): StatStages => ({
  attack: 0,
  defense: 0,
  spAttack: 0,
  spDefense: 0,
  speed: 0,
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
