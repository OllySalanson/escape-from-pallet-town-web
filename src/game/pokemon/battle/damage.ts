import type { MoveBase } from '../MoveBase';
import { MoveCategory } from '../MoveBase';
import type { Pokemon } from '../Pokemon';
import { getTypeEffectiveness } from './typeChart';
import { createStatStages, getStagedStat, type StatStages } from './statStages';

export type RandomSource = () => number;

export interface DamageResult {
  readonly damage: number;
  readonly isStab: boolean;
  readonly isCritical: boolean;
  readonly typeEffectiveness: number;
}

const clampRandom = (random: RandomSource): number => Math.min(1, Math.max(0, random()));

const randomModifier = (random: RandomSource): number => 0.85 + clampRandom(random) * 0.15;

export const calculateDamage = (
  attacker: Pokemon,
  defender: Pokemon,
  move: MoveBase,
  random: RandomSource,
  attackerStages: StatStages = createStatStages(),
  defenderStages: StatStages = createStatStages(),
): DamageResult => {
  const typeEffectiveness = getTypeEffectiveness(move.type, [
    defender.base.primaryType,
    ...(defender.base.secondaryType ? [defender.base.secondaryType] : []),
  ]);
  const isStab = attacker.base.primaryType === move.type || attacker.base.secondaryType === move.type;

  if (move.category === MoveCategory.Status || move.power <= 0 || typeEffectiveness === 0) {
    return { damage: 0, isStab, isCritical: false, typeEffectiveness };
  }

  const attackStat = move.category === MoveCategory.Physical ? 'attack' : 'spAttack';
  const defenseStat = move.category === MoveCategory.Physical ? 'defense' : 'spDefense';
  const attack = getStagedStat(attacker.stats[attackStat], attackerStages[attackStat]);
  const defense = getStagedStat(defender.stats[defenseStat], defenderStages[defenseStat]);
  const criticalMultiplier = clampRandom(random) * 100 <= 6.25 ? 2 : 1;
  const baseDamage = ((2 * attacker.level + 10) / 250) * move.power * (attack / defense) + 2;
  const damage = Math.floor(baseDamage * randomModifier(random) * typeEffectiveness * criticalMultiplier);

  return { damage, isStab, isCritical: criticalMultiplier === 2, typeEffectiveness };
};
