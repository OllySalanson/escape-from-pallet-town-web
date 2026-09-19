import type { MoveBase } from '../MoveBase';
import { MoveCategory } from '../MoveBase';
import type { Pokemon } from '../Pokemon';
import { attackMultiplier, attackRecoil } from './heldItems';
import { getTypeEffectiveness } from './typeChart';
import { createStatStages, getStagedStat, type StatStages } from './statStages';
import { weatherDamageMultiplier } from './weather';
import type { WeatherId } from './weather';

export type RandomSource = () => number;
export const STAB_MULTIPLIER = 1.5;

/**
 * Generation III's critical-hit ladder, per cent, indexed by the move's own
 * critical stage: 1/16, 1/8, 1/4, 1/3, then 1/2 for anything higher. Slash and
 * Razor Leaf are stage 1, and there are seven such moves among the 273 that
 * this engine used to round down to the flat 6.25% every move had.
 */
export const CRITICAL_HIT_CHANCE_PERCENT = [6.25, 12.5, 25, 100 / 3, 50] as const;
export const CRITICAL_HIT_MULTIPLIER = 2;

export const criticalHitChancePercent = (critStage: number): number =>
  CRITICAL_HIT_CHANCE_PERCENT[
    Math.max(0, Math.min(CRITICAL_HIT_CHANCE_PERCENT.length - 1, Math.trunc(critStage)))
  ];

export interface DamageResult {
  readonly damage: number;
  readonly isStab: boolean;
  readonly isCritical: boolean;
  readonly typeEffectiveness: number;
  /**
   * What landing this hit costs the attacker's own gear - Life Orb, and nothing
   * else so far. It is reported rather than applied because HP belongs to the
   * combatant while a battle is running, and the engine is the only thing that
   * may write it.
   */
  readonly recoil: number;
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
  /**
   * The field this swing is taken in. It is passed rather than read off the
   * attacker because weather belongs to neither side - it is the one term in
   * this formula that is a property of *where* the fight is happening.
   */
  weather: WeatherId | null = null,
): DamageResult => {
  const typeEffectiveness = getTypeEffectiveness(move.type, [
    defender.base.primaryType,
    ...(defender.base.secondaryType ? [defender.base.secondaryType] : []),
  ]);
  const isStab = attacker.base.primaryType === move.type || attacker.base.secondaryType === move.type;

  if (move.category === MoveCategory.Status || move.power <= 0 || typeEffectiveness === 0) {
    return { damage: 0, isStab, isCritical: false, typeEffectiveness, recoil: 0 };
  }

  const attackStat = move.category === MoveCategory.Physical ? 'attack' : 'spAttack';
  const defenseStat = move.category === MoveCategory.Physical ? 'defense' : 'spDefense';
  const attack = getStagedStat(attacker.stats[attackStat], attackerStages[attackStat]);
  const defense = getStagedStat(defender.stats[defenseStat], defenderStages[defenseStat]);
  const criticalMultiplier =
    clampRandom(random) * 100 <= criticalHitChancePercent(move.critStage)
      ? CRITICAL_HIT_MULTIPLIER
      : 1;
  const stabMultiplier = isStab ? STAB_MULTIPLIER : 1;
  const baseDamage = ((2 * attacker.level + 10) / 250) * move.power * (attack / defense) + 2;
  // The attacker's own gear is read straight off the Pokemon rather than passed
  // in: an item is not a property of the swing, and a copy of it here would be
  // one more thing to keep in step with the party.
  const damage = Math.floor(
    baseDamage *
      randomModifier(random) *
      typeEffectiveness *
      stabMultiplier *
      criticalMultiplier *
      weatherDamageMultiplier(weather, move.type) *
      attackMultiplier(attacker),
  );

  return {
    damage,
    isStab,
    isCritical: criticalMultiplier === 2,
    typeEffectiveness,
    recoil: attackRecoil(attacker, damage),
  };
};
