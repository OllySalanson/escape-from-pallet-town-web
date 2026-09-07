import type { Pokemon } from '../pokemon';
import type { Stash, StashedPokemon } from '../stash';

/**
 * Recovery between raids, priced in raid time.
 *
 * Nothing but a finite Potion used to restore HP, so a Pokemon that came home
 * at 3/17 stayed there and the cheapest cure for a worn party was to wipe and
 * be re-granted a fresh level-5 starter. That inverted the whole design, which
 * is built on protecting what you bank.
 *
 * Raid time is the currency because the player always has it, always wants more
 * of it, and it is spent the moment they act on it: a treated party deploys into
 * a shorter raid, so healing trades safety in a fight for pressure on the clock
 * instead of trading away a resource the player might be hoarding. It adds no
 * money, no shop and no new stock; a heal never produces an item or a Pokemon.
 *
 * The debt is charged when the raid resolves, not when it starts, so abandoning
 * a shortened raid cannot wash it away.
 */

/** Restoring a full health bar's worth of HP costs this much of the next raid. */
export const RECOVERY_FULL_BAR_MS = 240_000;

/**
 * Reviving costs this on top of refilling the bar, so a faint stays the worst
 * outcome of a fight. Without it, letting a Pokemon drop would cost exactly the
 * same as pulling it out at 1 HP and retreating would be pointless.
 */
export const RECOVERY_REVIVE_MS = 120_000;

/** Clearing a lingering status, which also persists between raids. */
export const RECOVERY_STATUS_MS = 30_000;

/** Quoted prices are rounded up to this, so the lobby never shows odd seconds. */
export const RECOVERY_STEP_MS = 15_000;

/**
 * The most raid time recovery can ever take, half of the 18-minute raid clock
 * (RUN_DURATION_MS in HubScene; `hub keeps recovery affordable` in
 * HubScene.test.ts pins the two together).
 *
 * The cap is what stops recovery becoming the hoarding trap it replaced: a
 * whole worn-out party is always treatable in one go for a price the player can
 * still raid under. Treating extra Pokemon once the cap is reached is free,
 * which is deliberate - it makes batching a reward rather than making the sixth
 * Pokemon the one nobody dares fix.
 */
export const MAX_PENDING_RECOVERY_MS = 540_000;

export interface RecoveryOutcome {
  /** Stash IDs that were actually restored, in the order they were treated. */
  readonly recoveredIds: readonly string[];
  /** Raid time added to the debt, which the cap can hold below the quote. */
  readonly chargedMs: number;
  /** The debt after the charge. */
  readonly pendingRecoveryMs: number;
}

/**
 * What restoring one Pokemon to full HP with no status costs in raid time, or
 * zero when it is already fit.
 */
export function recoveryCostMs(pokemon: Pokemon): number {
  const missingHp = Math.max(0, pokemon.maxHp - pokemon.currentHp);
  let costMs = 0;
  if (missingHp > 0) {
    costMs += Math.max(
      RECOVERY_STEP_MS,
      roundUpToStep((missingHp / pokemon.maxHp) * RECOVERY_FULL_BAR_MS),
    );
  }
  if (pokemon.isFainted) {
    costMs += RECOVERY_REVIVE_MS;
  }
  if (pokemon.primaryStatus !== null) {
    costMs += RECOVERY_STATUS_MS;
  }
  return costMs;
}

export function needsRecovery(pokemon: Pokemon): boolean {
  return recoveryCostMs(pokemon) > 0;
}

/** Every stashed Pokemon a recovery would actually change, in stash order. */
export function pokemonNeedingRecovery(stash: Stash): readonly StashedPokemon[] {
  return stash.listPokemon().filter((stored) => needsRecovery(stored.pokemon));
}

/** The whole bill for treating everyone at base, after the cap. */
export function quoteRecovery(
  stash: Stash,
  pendingRecoveryMs: number,
  ids: readonly string[],
): number {
  let pending = pendingRecoveryMs;
  let chargedMs = 0;
  for (const stored of resolve(stash, ids)) {
    const charge = chargeRecovery(pending, recoveryCostMs(stored.pokemon));
    pending = charge.pendingRecoveryMs;
    chargedMs += charge.chargedMs;
  }
  return chargedMs;
}

/**
 * Restores the named stashed Pokemon and bills the time to the next raid.
 *
 * Only the shortfall against the cap is billed, and a Pokemon that needs
 * nothing is skipped rather than charged, so the price shown is the price paid.
 */
export function applyRecovery(
  stash: Stash,
  pendingRecoveryMs: number,
  ids: readonly string[],
): RecoveryOutcome {
  const recoveredIds: string[] = [];
  let pending = pendingRecoveryMs;
  let chargedMs = 0;
  for (const stored of resolve(stash, ids)) {
    const charge = chargeRecovery(pending, recoveryCostMs(stored.pokemon));
    if (!stash.recoverPokemon(stored.id)) {
      continue;
    }
    pending = charge.pendingRecoveryMs;
    chargedMs += charge.chargedMs;
    recoveredIds.push(stored.id);
  }
  return { recoveredIds, chargedMs, pendingRecoveryMs: pending };
}

/** Adds one treatment to the debt, never taking it past the cap. */
export function chargeRecovery(
  pendingRecoveryMs: number,
  costMs: number,
): { readonly chargedMs: number; readonly pendingRecoveryMs: number } {
  const pending = clampPendingRecoveryMs(pendingRecoveryMs);
  const chargedMs = Math.max(0, Math.min(MAX_PENDING_RECOVERY_MS - pending, Math.floor(costMs)));
  return { chargedMs, pendingRecoveryMs: pending + chargedMs };
}

/** The clock a raid starts with once recovery has been taken out of it. */
export function raidClockAfterRecovery(baseDurationMs: number, pendingRecoveryMs: number): number {
  return Math.max(0, baseDurationMs - clampPendingRecoveryMs(pendingRecoveryMs));
}

export function clampPendingRecoveryMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(MAX_PENDING_RECOVERY_MS, Math.floor(value));
}

/** Raid clocks and their costs read as M:SS everywhere in the lobby. */
export function formatRecoveryClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1_000));
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
}

function resolve(stash: Stash, ids: readonly string[]): readonly StashedPokemon[] {
  const stored = stash.listPokemon();
  return [...new Set(ids)]
    .map((id) => stored.find((entry) => entry.id === id))
    .filter((entry): entry is StashedPokemon => entry !== undefined)
    .filter((entry) => needsRecovery(entry.pokemon));
}

function roundUpToStep(ms: number): number {
  return Math.ceil(ms / RECOVERY_STEP_MS) * RECOVERY_STEP_MS;
}
