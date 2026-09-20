import type { AbilityEffectKind } from '../AbilityBase';
import type { MoveBase } from '../MoveBase';
import { MoveCategory } from '../MoveBase';
import type { Pokemon } from '../Pokemon';
import {
  type AbilityCarrier,
  attackMultiplier as abilityAttackMultiplier,
  blocksCriticalHits,
  damageTakenMultiplier,
} from './abilityHooks';
import { attackMultiplier, attackRecoil } from './heldItems';
import { getTypeEffectiveness } from './typeChart';
import { createStatStages, getStagedStat, type StatStages } from './statStages';
import { weatherDamageMultiplier } from './weather';
import type { WeatherId } from './weather';

export type RandomSource = () => number;
export const STAB_MULTIPLIER = 1.5;

/**
 * What a move that actually hits more than one Pokemon is worth against each of
 * them: generation III's own halving, and the reason a spread move is a
 * different decision rather than a free extra hit.
 *
 * It is charged on the swing rather than on the move, because the same Razor
 * Leaf is full strength against one target and half against two - so a double
 * battle in which the partner has already fallen pays the full figure again.
 */
export const SPREAD_DAMAGE_MULTIPLIER = 0.5;

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

/**
 * The two abilities a swing reads, where the engine knows them.
 *
 * It is optional because `calculateDamage` is also the thing a test calls to
 * check the formula itself, and a formula test has no combatants. `applyMove`
 * always passes it, so nothing in a real battle is ever computed without them.
 */
export interface DamageAbilities {
  readonly attacker: AbilityCarrier;
  readonly defender: AbilityCarrier;
}

/** An ability that changed this swing, so the log can say which and whose. */
export interface AbilityNote {
  readonly side: 'attacker' | 'defender';
  readonly effect: AbilityEffectKind;
}

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
  /**
   * Which abilities changed this swing. Reported rather than announced for the
   * same reason `recoil` is: this function computes, and the engine is the only
   * thing that may write state or say anything.
   */
  readonly abilityNotes: readonly AbilityNote[];
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
   * this formula that is a property of *where* the fight is happening. It is
   * the weather the engine has already asked Cloud Nine about, so this function
   * never has to.
   */
  weather: WeatherId | null = null,
  abilities?: DamageAbilities,
  /** True when this same swing is landing on more than one Pokemon. */
  spread = false,
): DamageResult => {
  const typeEffectiveness = getTypeEffectiveness(move.type, [
    defender.base.primaryType,
    ...(defender.base.secondaryType ? [defender.base.secondaryType] : []),
  ]);
  const isStab = attacker.base.primaryType === move.type || attacker.base.secondaryType === move.type;

  if (move.category === MoveCategory.Status || move.power <= 0 || typeEffectiveness === 0) {
    return { damage: 0, isStab, isCritical: false, typeEffectiveness, recoil: 0, abilityNotes: [] };
  }

  const abilityNotes: AbilityNote[] = [];

  const attackStat = move.category === MoveCategory.Physical ? 'attack' : 'spAttack';
  const defenseStat = move.category === MoveCategory.Physical ? 'defense' : 'spDefense';
  const attack = getStagedStat(attacker.stats[attackStat], attackerStages[attackStat]);
  const defense = getStagedStat(defender.stats[defenseStat], defenderStages[defenseStat]);
  // The roll is spent whether or not the defender's armour turns it aside, so
  // Shell Armor changes what a hit costs and never what the next roll is.
  const rolledCritical = clampRandom(random) * 100 <= criticalHitChancePercent(move.critStage);
  const criticalBlocked =
    rolledCritical && abilities !== undefined && blocksCriticalHits(abilities.defender);
  if (criticalBlocked) {
    abilityNotes.push({ side: 'defender', effect: 'hardened' });
  }
  const criticalMultiplier = rolledCritical && !criticalBlocked ? CRITICAL_HIT_MULTIPLIER : 1;
  // Blaze and the three like it, Guts, and a charged Flash Fire on one side;
  // Thick Fat on the other. Both are multipliers on the one number, which is
  // where generation III puts the first and close enough for the second that
  // halving the damage and halving the power cannot be told apart.
  const abilityAttack = abilities ? abilityAttackMultiplier(abilities.attacker, move) : 1;
  const abilityDefence = abilities ? damageTakenMultiplier(abilities.defender, move) : 1;
  if (abilityAttack !== 1) {
    abilityNotes.push({ side: 'attacker', effect: 'powered-up' });
  }
  if (abilityDefence !== 1) {
    abilityNotes.push({ side: 'defender', effect: 'shrugged-off' });
  }
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
      abilityAttack *
      abilityDefence *
      (spread ? SPREAD_DAMAGE_MULTIPLIER : 1) *
      attackMultiplier(attacker),
  );

  return {
    damage,
    isStab,
    isCritical: criticalMultiplier === CRITICAL_HIT_MULTIPLIER,
    typeEffectiveness,
    recoil: attackRecoil(attacker, damage),
    abilityNotes,
  };
};
