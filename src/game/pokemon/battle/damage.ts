import type { MoveBase } from '../MoveBase';
import { MoveCategory } from '../MoveBase';
import type { Pokemon } from '../Pokemon';
import { getTypeEffectiveness } from './typeChart';

export type RandomSource = () => number;

export interface DamageResult {
  readonly damage: number;
  readonly isStab: boolean;
  readonly typeEffectiveness: number;
}

const clampRandom = (random: RandomSource): number => Math.min(1, Math.max(0, random()));

const randomModifier = (random: RandomSource): number => 0.85 + clampRandom(random) * 0.15;

export const calculateDamage = (
  attacker: Pokemon,
  defender: Pokemon,
  move: MoveBase,
  random: RandomSource,
): DamageResult => {
  const typeEffectiveness = getTypeEffectiveness(move.type, [
    defender.base.primaryType,
    ...(defender.base.secondaryType ? [defender.base.secondaryType] : []),
  ]);
  const isStab = attacker.base.primaryType === move.type || attacker.base.secondaryType === move.type;

  if (move.category === MoveCategory.Status || move.power <= 0 || typeEffectiveness === 0) {
    return { damage: 0, isStab, typeEffectiveness };
  }

  const attack = move.category === MoveCategory.Physical ? attacker.stats.attack : attacker.stats.spAttack;
  const defense = move.category === MoveCategory.Physical ? defender.stats.defense : defender.stats.spDefense;
  const criticalMultiplier = clampRandom(random) * 100 <= 6.25 ? 2 : 1;
  const baseDamage = ((2 * attacker.level + 10) / 250) * move.power * (attack / defense) + 2;
  const damage = Math.floor(baseDamage * randomModifier(random) * typeEffectiveness * criticalMultiplier);

  return { damage, isStab, typeEffectiveness };
};
