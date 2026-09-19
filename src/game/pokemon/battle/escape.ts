import { abilityCarrier, type BattleCombatant } from './battleEngine';
import { abilityLabel, escapeAlwaysSucceeds, escapePrevented } from './abilityHooks';
import type { RandomSource } from './damage';
import { getStagedStat } from './statStages';

/**
 * Escaping a wild encounter is a deliberately simple, visible rule, in the same
 * spirit as getCatchChance: the speed share of the two Pokemon, plus a fixed bonus
 * for every attempt already spent in this battle.
 *
 * The per-attempt bonus is what stops a failed escape becoming a trap. Even the
 * slowest Pokemon reaches certainty by its fifth attempt, so a wild fight can
 * always be left; what a failure costs is the enemy's turn, never the exit.
 */
export const WILD_ESCAPE_ATTEMPT_BONUS = 0.2;
export const WILD_ESCAPE_MINIMUM_CHANCE = 0.25;

export const combatantSpeed = (combatant: BattleCombatant): number =>
  Math.max(1, getStagedStat(combatant.pokemon.stats.speed, combatant.statStages.speed));

export const getWildEscapeChance = (
  playerSpeed: number,
  enemySpeed: number,
  previousAttempts: number,
): number => {
  const safePlayerSpeed = Math.max(1, playerSpeed);
  const safeEnemySpeed = Math.max(1, enemySpeed);
  // The floor applies to the speed matchup, not to the total, so every further
  // attempt is strictly better than the last however outclassed the runner is.
  const speedShare = Math.max(
    WILD_ESCAPE_MINIMUM_CHANCE,
    safePlayerSpeed / (safePlayerSpeed + safeEnemySpeed),
  );
  const attemptBonus = Math.max(0, previousAttempts) * WILD_ESCAPE_ATTEMPT_BONUS;
  return Math.min(1, speedShare + attemptBonus);
};

export interface WildEscapeAttempt {
  readonly chance: number;
  readonly escaped: boolean;
  /**
   * The ability that decided it, if one did, so the line the player reads names
   * the reason rather than reporting a roll that was never made.
   */
  readonly ability: { readonly holder: 'player' | 'enemy'; readonly label: string } | null;
}

/**
 * Two abilities settle this before the speeds are asked, and both of them are
 * certainties rather than adjustments - which is why they are read here as well
 * as in `attemptWildEscape`: the command label shows the odds before the player
 * commits, and a Run Away that shows 64% and then always works would be lying
 * on the one screen that exists to tell the truth about a price.
 */
export const wildEscapeChanceFor = (
  player: BattleCombatant,
  enemy: BattleCombatant,
  previousAttempts: number,
): number => {
  if (escapeAlwaysSucceeds(abilityCarrier(player))) {
    return 1;
  }
  if (escapePrevented(abilityCarrier(enemy), abilityCarrier(player))) {
    return 0;
  }
  return getWildEscapeChance(combatantSpeed(player), combatantSpeed(enemy), previousAttempts);
};

export const attemptWildEscape = (
  player: BattleCombatant,
  enemy: BattleCombatant,
  previousAttempts: number,
  random: RandomSource,
): WildEscapeAttempt => {
  if (escapeAlwaysSucceeds(abilityCarrier(player))) {
    return { chance: 1, escaped: true, ability: { holder: 'player', label: abilityLabel(abilityCarrier(player)) } };
  }
  if (escapePrevented(abilityCarrier(enemy), abilityCarrier(player))) {
    return { chance: 0, escaped: false, ability: { holder: 'enemy', label: abilityLabel(abilityCarrier(enemy)) } };
  }
  const chance = wildEscapeChanceFor(player, enemy, previousAttempts);
  const roll = random();
  return {
    chance,
    escaped: (Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 0) < chance,
    ability: null,
  };
};
