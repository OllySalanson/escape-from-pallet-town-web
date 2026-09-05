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

const randomModifier = (random: RandomSource): number => {
  const roll = Math.floor(Math.min(0.999999, Math.max(0, random())) * 39) + 217;
  return roll / 255;
};

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
  const baseDamage = Math.floor(
    Math.floor(Math.floor(((2 * attacker.level) / 5 + 2) * move.power * attack / defense) / 50) + 2,
  );
  const damage = Math.max(
    1,
    Math.floor(baseDamage * (isStab ? 1.5 : 1) * typeEffectiveness * randomModifier(random)),
  );

  return { damage, isStab, typeEffectiveness };
};
