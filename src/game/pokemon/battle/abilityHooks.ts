import type {
  AbilityAbsorption,
  AbilityBase,
  AbilityBlockedCondition,
  AbilityHolder,
} from '../AbilityBase';
import { getAbilityById } from '../abilities';
import type { MoveBase } from '../MoveBase';
import { PokemonType } from '../PokemonType';
import type { RandomSource } from './damage';
import type { StageStat, StatBoost } from './statStages';
import type { StatusName } from './status';
import type { WeatherId } from './weather';

/**
 * What an ability does in a fight, in one place.
 *
 * This is `heldItems.ts` for abilities, and it keeps the same bargain: the
 * engine asks these questions and nothing else, never switches on an ability id
 * and never reads the catalogue directly, so adding an ability is a row in
 * `../abilities.ts` and nothing here. Every function is pure and takes the
 * holder's numbers rather than a Pokemon, which is what lets
 * `abilityHooks.test.ts` hold the rules without a battle.
 *
 * Where the ability lives is the same decision gear made. The *identity* of an
 * ability is read straight through to the species (`PokemonBase.abilityId`) and
 * never copied onto the `BattleCombatant`: a combatant is a snapshot taken when
 * its Pokemon was sent out, and a snapshot that drifts from the live Pokemon is
 * the class of bug `refreshCombatantAfterLevelUp` exists to undo. What the
 * combatant owns is the two bits that belong to the fight - whether Flash Fire
 * has swallowed its fire (`charged`) and whether the ability has already
 * introduced itself in the log.
 */

/** A holder, as every rule below reads one. */
export interface AbilityCarrier extends AbilityHolder {
  readonly abilityId: string | null;
}

export function abilityOf(carrier: AbilityCarrier): AbilityBase | undefined {
  return getAbilityById(carrier.abilityId);
}

/** The ability's name in capitals, as the battle log names everything. */
export function abilityLabel(carrier: AbilityCarrier): string {
  return (abilityOf(carrier)?.name ?? '').toUpperCase();
}

/** Blaze and the three like it, Guts, and Flash Fire once it has swallowed one. */
export function attackMultiplier(carrier: AbilityCarrier, move: MoveBase): number {
  return abilityOf(carrier)?.modifyAttack?.({ holder: carrier, move }) ?? 1;
}

/** Compound Eyes. Applied to the printed accuracy before the two stages are. */
export function accuracyMultiplier(carrier: AbilityCarrier, move: MoveBase): number {
  return abilityOf(carrier)?.modifyAccuracy?.({ holder: carrier, move }) ?? 1;
}

/**
 * Sand Veil, read off the Pokemon being aimed at. It is the accuracy of the
 * incoming move that moves rather than an evasion stage, because evasion here
 * is a stage on a ladder and a quarter is not a step on it.
 */
export function incomingAccuracyMultiplier(
  carrier: AbilityCarrier,
  weather: WeatherId | null,
): number {
  return abilityOf(carrier)?.modifyIncomingAccuracy?.({ holder: carrier, weather }) ?? 1;
}

/** Chlorophyll and Swift Swim, read when the turn order is settled. */
export function speedMultiplier(carrier: AbilityCarrier, weather: WeatherId | null): number {
  return abilityOf(carrier)?.modifySpeed?.({ holder: carrier, weather }) ?? 1;
}

/** Sand Veil again: whether the end-of-turn chip passes this holder by. */
export function shelteredFromWeather(carrier: AbilityCarrier, weather: WeatherId): boolean {
  return abilityOf(carrier)?.shelteredFromWeather?.(weather) === true;
}

/**
 * Cloud Nine, asked of **both** sides: weather is the one thing in a fight that
 * belongs to neither, so either of them can turn it off. It is asked once, by
 * `effectiveWeather` in the engine, and every other rule - the chip, the damage
 * weather bends, the three abilities above - reads the answer rather than the
 * field, so no rule has to know this ability exists.
 */
export function suppressesWeather(carrier: AbilityCarrier): boolean {
  return abilityOf(carrier)?.suppressesWeather === true;
}

/** Thick Fat, read off the Pokemon being hit. */
export function damageTakenMultiplier(carrier: AbilityCarrier, move: MoveBase): number {
  return abilityOf(carrier)?.modifyDamageTaken?.({ holder: carrier, move }) ?? 1;
}

export function blocksCriticalHits(carrier: AbilityCarrier): boolean {
  return abilityOf(carrier)?.blocksCriticalHits === true;
}

export function blocksRecoil(carrier: AbilityCarrier): boolean {
  return abilityOf(carrier)?.blocksRecoil === true;
}

/**
 * Whether this move reaches the holder at all, and what it gives it if it does
 * not: the heal of a Water Absorb, the charge of a Flash Fire, or nothing at
 * all for a Levitate or a Soundproof.
 *
 * One question rather than an immunity list and a separate heal, because every
 * one of the five is the same beat - the move does nothing, and then something
 * happens *instead*.
 */
export function absorbs(carrier: AbilityCarrier, move: MoveBase): AbilityAbsorption | null {
  const ability = abilityOf(carrier);
  if (!ability) {
    return null;
  }
  if (ability.blocksMoveFlag && move.flags.includes(ability.blocksMoveFlag)) {
    return {};
  }
  return ability.absorbsMoveType?.(move.type) ?? null;
}

/** What an absorption is worth in HP, capped at what the holder is missing. */
export function absorbedHeal(carrier: AbilityCarrier, absorption: AbilityAbsorption): number {
  if (!absorption.heal) {
    return 0;
  }
  return Math.min(
    Math.max(0, carrier.maxHp - carrier.currentHp),
    Math.max(1, Math.floor(carrier.maxHp * absorption.heal)),
  );
}

/** Keen Eye, Hyper Cutter, Clear Body. Only ever asked of a drop from the foe. */
export function blocksBoost(carrier: AbilityCarrier, stat: StageStat): boolean {
  return abilityOf(carrier)?.blocksBoost?.(stat) === true;
}

/** The six status refusals and Inner Focus. Only ever asked of the foe's doing. */
export function blocksCondition(
  carrier: AbilityCarrier,
  condition: AbilityBlockedCondition,
): boolean {
  return abilityOf(carrier)?.blocksStatus?.(condition) === true;
}

/** Shield Dust, read off the Pokemon the secondary would land on. */
export function blocksSecondaries(carrier: AbilityCarrier): boolean {
  return abilityOf(carrier)?.blocksSecondaries === true;
}

/** Serene Grace, read off the Pokemon using the move. Capped so a roll stays a roll. */
export function secondaryChance(carrier: AbilityCarrier, chance: number): number {
  return Math.min(100, chance * (abilityOf(carrier)?.secondaryChanceMultiplier ?? 1));
}

/**
 * Static and the three like it: what touching the holder cost, if anything.
 *
 * Two rolls, and both are spent whenever the ability is one that could fire, so
 * the sequence a seeded battle draws does not depend on how the first roll came
 * out. The second chooses between Effect Spore's three evenly.
 */
export function contactStatus(
  carrier: AbilityCarrier,
  move: MoveBase,
  random: RandomSource,
): StatusName | null {
  const effect = abilityOf(carrier)?.onDamagingHit;
  if (!effect || !move.flags.includes('contact') || effect.statuses.length === 0) {
    return null;
  }
  const fires = clamp(random()) * 100 < effect.chance;
  const chosen = effect.statuses[Math.floor(clamp(random()) * effect.statuses.length)];
  return fires ? (chosen ?? null) : null;
}

/** Synchronize, read off the Pokemon the status just landed on. */
export function reflectsStatus(carrier: AbilityCarrier, status: StatusName): boolean {
  return abilityOf(carrier)?.reflectsStatus?.(status) === true;
}

/** Shed Skin, rolled at the end of each of the holder's own turns. */
export function shedsStatus(carrier: AbilityCarrier, random: RandomSource): boolean {
  const chance = abilityOf(carrier)?.endOfTurnCureChance ?? 0;
  return chance > 0 && clamp(random()) < chance;
}

/** Early Bird. How many turns of sleep one turn burns through; one for everything else. */
export function sleepTurnsPerTurn(carrier: AbilityCarrier): number {
  return Math.max(1, Math.trunc(abilityOf(carrier)?.sleepTurnsPerTurn ?? 1));
}

/** Intimidate. What arriving does to the *other* side. */
export function sendOutBoosts(carrier: AbilityCarrier): readonly StatBoost[] {
  return abilityOf(carrier)?.onSendOut ?? [];
}

/** Natural Cure. */
export function curesOnSwitchOut(carrier: AbilityCarrier): boolean {
  return abilityOf(carrier)?.curesOnSwitchOut === true;
}

/** Liquid Ooze, read off the Pokemon being drained. */
export function drainBackfires(carrier: AbilityCarrier): boolean {
  return abilityOf(carrier)?.drainBackfires === true;
}

/** Pressure, read off the Pokemon the move is aimed at. */
export function extraPpCost(carrier: AbilityCarrier): number {
  return Math.max(0, Math.trunc(abilityOf(carrier)?.extraPpCost ?? 0));
}

/** Run Away, read off the Pokemon trying to leave. */
export function escapeAlwaysSucceeds(carrier: AbilityCarrier): boolean {
  return abilityOf(carrier)?.escapeAlwaysSucceeds === true;
}

/**
 * Arena Trap and Magnet Pull, read off the Pokemon being run *from*.
 *
 * Whether the runner is on the ground is settled here rather than in the
 * ability, because generation III excuses a Flying type and anything that
 * floats - and floating is Levitate's business. Asking it once is what keeps
 * Arena Trap from having to know another ability exists.
 */
export function escapePrevented(blocker: AbilityCarrier, runner: AbilityCarrier): boolean {
  return (
    abilityOf(blocker)?.preventsEscape?.({ foe: runner, foeIsGrounded: isGrounded(runner) }) === true
  );
}

/** Not a Flying type, and nothing about it keeps Ground moves off it. */
export function isGrounded(carrier: AbilityCarrier): boolean {
  if (carrier.types.includes(PokemonType.Flying)) {
    return false;
  }
  return abilityOf(carrier)?.absorbsMoveType?.(PokemonType.Ground) == null;
}

const clamp = (value: number): number => Math.min(0.999999, Math.max(0, value));
