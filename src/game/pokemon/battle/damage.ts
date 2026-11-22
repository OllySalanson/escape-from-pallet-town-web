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
import { attackRecoil, gearTypeBoost, lifeOrbMultiplier } from './heldItems';
import { getTypeEffectiveness } from './typeChart';
import { createStatStages, getStagedStat, type StatStages } from './statStages';
import { weatherDamageMultiplier } from './weather';
import { PrimaryStatus } from './status';
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

/** FireRed's damage roll, 85 to 100 per cent in sixteen steps; a roll of 1 is the top one. */
const randomPercent = (random: RandomSource): number =>
  100 - DAMAGE_ROLL_STEPS + 1 + Math.min(DAMAGE_ROLL_STEPS - 1, Math.floor(clampRandom(random) * DAMAGE_ROLL_STEPS));
const DAMAGE_ROLL_STEPS = 16;

/** Whether this attacker's burn halves its physical damage: burned, and not Guts. */
const burnHalves = (attacker: AbilityCarrier | undefined): boolean =>
  attacker !== undefined && attacker.primaryStatus === PrimaryStatus.Burn && attacker.abilityId !== 'guts';

/**
 * What a confused Pokemon does to itself: FireRed's `CANCELLER_CONFUSED` calls
 * `CalculateBaseDamage` with a 40-power hit of the Pokemon's own Attack on its
 * own Defence, both through their stages - integer arithmetic as FireRed does
 * it, typeless, with no random roll, no critical hit and no same-type bonus. A
 * burn halves it and Guts lifts it, because both live in that same function.
 */
export const confusionSelfHitDamage = (
  pokemon: Pokemon,
  stages: StatStages,
  holder: AbilityCarrier,
): number => {
  const gutsy = holder.abilityId === 'guts' && holder.primaryStatus !== null;
  const attack = Math.floor(getStagedStat(pokemon.stats.attack, stages.attack) * (gutsy ? 1.5 : 1));
  const defense = Math.max(1, getStagedStat(pokemon.stats.defense, stages.defense));
  const levelTerm = Math.floor((2 * pokemon.level) / 5) + 2;
  let damage = Math.floor(Math.floor(attack * CONFUSION_SELF_HIT_POWER * levelTerm) / defense / 50);
  if (burnHalves(holder)) {
    damage = Math.floor(damage / 2);
  }
  return damage + 2;
};

/** The power of the hit a confused Pokemon gives itself. */
export const CONFUSION_SELF_HIT_POWER = 40;

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
  const typeEffectiveness = move.typeless
    ? 1
    : getTypeEffectiveness(move.type, [
        defender.base.primaryType,
        ...(defender.base.secondaryType ? [defender.base.secondaryType] : []),
      ]);
  const isStab =
    !move.typeless &&
    (attacker.base.primaryType === move.type || attacker.base.secondaryType === move.type);

  if (move.category === MoveCategory.Status || move.power <= 0 || typeEffectiveness === 0) {
    return { damage: 0, isStab, isCritical: false, typeEffectiveness, recoil: 0, abilityNotes: [] };
  }

  const abilityNotes: AbilityNote[] = [];

  const attackStat = move.category === MoveCategory.Physical ? 'attack' : 'spAttack';
  const defenseStat = move.category === MoveCategory.Physical ? 'defense' : 'spDefense';
  // The roll is spent whether or not the defender's armour turns it aside, so
  // Shell Armor changes what a hit costs and never what the next roll is.
  const rolledCritical = clampRandom(random) * 100 <= criticalHitChancePercent(move.critStage);
  const criticalBlocked =
    rolledCritical && abilities !== undefined && blocksCriticalHits(abilities.defender);
  if (criticalBlocked) {
    abilityNotes.push({ side: 'defender', effect: 'hardened' });
  }
  const criticalMultiplier = rolledCritical && !criticalBlocked ? CRITICAL_HIT_MULTIPLIER : 1;
  // A critical hit looks past every stage that would weaken it: the attacker's
  // own lowered Attack and the defender's raised Defense, as FireRed's
  // `CalculateBaseDamage` reads the stat unstaged on `gCritMultiplier == 2`
  // unless the stage helps. Staged both ways, a crit into a Grimer that had
  // Hardened twice did less than the plain Tackles before it (playtest, 20 Nov).
  const critical = criticalMultiplier === CRITICAL_HIT_MULTIPLIER;
  const attackStage = critical ? Math.max(0, attackerStages[attackStat]) : attackerStages[attackStat];
  const defenseStage = critical ? Math.min(0, defenderStages[defenseStat]) : defenderStages[defenseStat];
  const attack = getStagedStat(attacker.stats[attackStat], attackStage);
  // Self-Destruct and Explosion halve the defense they meet before its stages
  // are applied, as FireRed's `CalculateBaseDamage` does for `EFFECT_EXPLOSION`.
  const unstagedDefense = move.userFaints
    ? Math.max(1, Math.floor(defender.stats[defenseStat] / 2))
    : defender.stats[defenseStat];
  const defense = getStagedStat(unstagedDefense, defenseStage);
  // Blaze and the three like it, Guts, and a charged Flash Fire on one side;
  // Thick Fat on the other.
  const abilityAttack = abilities ? abilityAttackMultiplier(abilities.attacker, move) : 1;
  const abilityDefence = abilities ? damageTakenMultiplier(abilities.defender, move) : 1;
  if (abilityAttack !== 1) {
    abilityNotes.push({ side: 'attacker', effect: 'powered-up' });
  }
  if (abilityDefence !== 1) {
    abilityNotes.push({ side: 'defender', effect: 'shrugged-off' });
  }
  // FireRed's own integer pipeline, step for step: `CalculateBaseDamage`
  // (pret/pokefirered `src/pokemon.c`), then `Cmd_damagecalc`, `Cmd_typecalc`
  // and `Cmd_adjustnormaldamage` (`src/battle_script_commands.c`). Every step
  // floors, in FireRed's order, because the rounding is part of the rule: the
  // level term alone is `2 * level / 5 + 2` in whole numbers, which at level 7
  // is 4 where the continuous form the Unity original used gives 4.8.
  //
  // The attacking stat carries what FireRed puts on it - a type-boosting held
  // item, Guts, and the halving of Thick Fat on the other side - and the pinch
  // abilities and Flash Fire with it, which FireRed puts on the power and on
  // the damage: the same one-and-a-half, a step or two earlier.
  const boostedAttack = Math.floor(
    Math.floor(attack * abilityAttack * gearTypeBoost(attacker, move.type)) * abilityDefence,
  );
  const levelTerm = Math.floor((2 * attacker.level) / 5) + 2;
  let damage = Math.floor(Math.floor(boostedAttack * move.power * levelTerm) / Math.max(1, defense) / 50);
  if (move.category === MoveCategory.Physical && burnHalves(abilities?.attacker)) {
    damage = Math.floor(damage / 2);
  }
  if (spread) {
    damage = Math.floor(damage * SPREAD_DAMAGE_MULTIPLIER);
  }
  if (move.category === MoveCategory.Physical && damage === 0) {
    // "Moves always do at least 1 damage", FireRed says of a physical hit.
    damage = 1;
  }
  const weatherMultiplier = weatherDamageMultiplier(weather, move.type);
  if (weatherMultiplier !== 1) {
    damage = Math.floor((damage * Math.round(weatherMultiplier * 10)) / 10);
  }
  damage += 2;
  damage *= criticalMultiplier;
  if (isStab) {
    damage = Math.floor((damage * Math.round(STAB_MULTIPLIER * 10)) / 10);
  }
  // Each of the defender's types is a step of its own, as `ModulateDmgByType`
  // takes them, and a hit that lands is never rounded to nothing.
  if (!move.typeless) {
    for (const type of [defender.base.primaryType, ...(defender.base.secondaryType ? [defender.base.secondaryType] : [])]) {
      const multiplier = getTypeEffectiveness(move.type, [type]);
      if (multiplier !== 1) {
        damage = Math.max(1, Math.floor((damage * Math.round(multiplier * 10)) / 10));
      }
    }
  }
  // The roll is one of sixteen, 85 to 100 per cent (`100 - Random() % 16`).
  damage = Math.max(1, Math.floor((damage * randomPercent(random)) / 100));
  // A Life Orb is not FireRed's, and is the one multiplier left on the end.
  damage = Math.floor(damage * lifeOrbMultiplier(attacker));

  return {
    damage,
    isStab,
    isCritical: criticalMultiplier === CRITICAL_HIT_MULTIPLIER,
    typeEffectiveness,
    recoil: attackRecoil(attacker, damage),
    abilityNotes,
  };
};
