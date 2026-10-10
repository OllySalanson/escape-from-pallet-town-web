import { abilityCarrier, type BattleCombatant } from './battleEngine';
import { abilityLabel, escapeAlwaysSucceeds, escapePrevented } from './abilityHooks';
import type { RandomSource } from './damage';

/**
 * Escaping a wild encounter is FireRed's rule, `TryRunFromBattle` in
 * pret/pokefirered's `src/battle_main.c` (commit c75f352, the one
 * `tools/moves/frlgBattleMoves.mjs` pins):
 *
 *   if (gBattleMons[battler].speed < gBattleMons[BATTLE_OPPOSITE(battler)].speed)
 *       speedVar = (playerSpeed * 128) / enemySpeed + runTries * 30;
 *       escaped  = speedVar > (Random() & 0xFF);
 *   else // same speed or faster
 *       escaped  = TRUE;
 *
 * So a Pokemon at least as fast as the wild one always gets away, and a slower one
 * rolls a byte against `floor(128 * mine / theirs) + 30` for every attempt already
 * spent in this battle - FireRed counts `runTries` after the roll, so the first
 * attempt gets nothing. The speeds are the plain stats (`gBattleMons[].speed`):
 * stat stages and paralysis are not read, because FireRed does not read them.
 *
 * One departure, on purpose: `speedVar` is a `u8` there, so once the attempt
 * bonus carries it past 255 it wraps and the next try is *worse*. Here it is held
 * at certainty instead, which keeps the rule a player reads off FireRed - the odds
 * rise with each attempt - and the promise that a failed escape is never a trap:
 * the slowest Pokemon there is gets away by its tenth try. The Unity original
 * (`RunTurnState.TryToEscape`) keeps the wrap and also rolls on equal speed, which
 * is why it is a cross-reference here and not the source.
 */
export const WILD_ESCAPE_SPEED_SCALE = 128;
export const WILD_ESCAPE_ATTEMPT_BONUS = 30;
/** `Random() & 0xFF`: the roll is one of 256 values, 0 to 255. */
export const WILD_ESCAPE_ROLL_RANGE = 256;

/** The Speed FireRed compares: the plain stat, never staged. */
export const combatantSpeed = (combatant: BattleCombatant): number =>
  Math.max(1, combatant.pokemon.stats.speed);

export const getWildEscapeChance = (
  playerSpeed: number,
  enemySpeed: number,
  previousAttempts: number,
): number => {
  const safePlayerSpeed = Math.max(1, Math.floor(playerSpeed));
  const safeEnemySpeed = Math.max(1, Math.floor(enemySpeed));
  if (safePlayerSpeed >= safeEnemySpeed) {
    return 1;
  }
  const speedVar =
    Math.floor((safePlayerSpeed * WILD_ESCAPE_SPEED_SCALE) / safeEnemySpeed) +
    Math.max(0, Math.floor(previousAttempts)) * WILD_ESCAPE_ATTEMPT_BONUS;
  // `speedVar > roll` for a roll of 0..255 is true for exactly `speedVar` of the
  // 256 rolls.
  return Math.min(WILD_ESCAPE_ROLL_RANGE, speedVar) / WILD_ESCAPE_ROLL_RANGE;
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
