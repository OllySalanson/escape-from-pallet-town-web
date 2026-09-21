import type { Pokemon } from '../pokemon';
import { RAID_DURATION_MS } from '../run/raidClock';
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
 *
 * Every price here is a share of one raid, not an absolute number of minutes.
 * They were first written against an 18-minute clock; `RAID_DURATION_MS` is now
 * 5 minutes, and left absolute a single revive would have cost more than a whole
 * raid and handed the player a zero clock. The shares below are the ones that
 * schedule expressed, carried across intact.
 */

/** Quoted prices are rounded up to this, so the lobby never shows odd seconds. */
export const RECOVERY_STEP_MS = 5_000;

/**
 * One price, as a share of a raid, snapped to the quoting step - so a full bar
 * costs exactly its listed price rather than the next step up.
 */
const shareOfRaid = (share: number): number =>
  Math.round((RAID_DURATION_MS * share) / RECOVERY_STEP_MS) * RECOVERY_STEP_MS;

const FULL_BAR_SHARE = 0.22;
const REVIVE_SHARE = 0.11;
const STATUS_SHARE = 0.03;

/** Restoring a full health bar's worth of HP costs this much of the next raid. */
export const RECOVERY_FULL_BAR_MS = shareOfRaid(FULL_BAR_SHARE);

/**
 * Reviving costs this on top of refilling the bar, so a faint stays the worst
 * outcome of a fight. Without it, letting a Pokemon drop would cost exactly the
 * same as pulling it out at 1 HP and retreating would be pointless.
 */
export const RECOVERY_REVIVE_MS = shareOfRaid(REVIVE_SHARE);

/** Clearing a lingering status, which also persists between raids. */
export const RECOVERY_STATUS_MS = shareOfRaid(STATUS_SHARE);

/**
 * What this base charges, which Brock can improve.
 *
 * `priceShare` is the Pokemon Center upgrades: it multiplies the *share of a raid*
 * each price is, before that share is turned into time, so a cheaper bay is
 * still priced against `RAID_DURATION_MS` and moves with it like every other
 * price here. No price ever rounds down to nothing - a treatment that costs no
 * clock is the ward's offer, not the bay's.
 *
 * `wardTreatments` is how many of the quarantine ward's beds are still unused
 * before the next raid. A bed waives the healing and the cure for one Pokemon
 * and never the revive premium, for the reason medicine cannot revive either:
 * a faint has to stay the worst outcome of a fight.
 */
export interface RecoveryTerms {
  readonly priceShare: number;
  readonly wardTreatments: number;
}

/** The bay as every save starts with it. */
export const STANDARD_RECOVERY_TERMS: RecoveryTerms = { priceShare: 1, wardTreatments: 0 };

export interface RecoveryPrices {
  readonly fullBarMs: number;
  readonly reviveMs: number;
  readonly statusMs: number;
}

export function recoveryPrices(priceShare: number): RecoveryPrices {
  const share = Number.isFinite(priceShare) ? Math.min(1, Math.max(0, priceShare)) : 1;
  const priced = (raidShare: number): number =>
    Math.max(RECOVERY_STEP_MS, shareOfRaid(raidShare * share));
  return {
    fullBarMs: priced(FULL_BAR_SHARE),
    reviveMs: priced(REVIVE_SHARE),
    statusMs: priced(STATUS_SHARE),
  };
}

/**
 * The most raid time recovery can ever take: half the raid clock, exactly.
 *
 * This is derived rather than written down because the two must move together -
 * a cap larger than the clock leaves a treated party deploying into a raid that
 * enrages on the first frame.
 *
 * The cap is what stops recovery becoming the hoarding trap it replaced: a
 * whole worn-out party is always treatable in one go for a price the player can
 * still raid under. Treating extra Pokemon once the cap is reached is free,
 * which is deliberate - it makes batching a reward rather than making the sixth
 * Pokemon the one nobody dares fix.
 */
export const MAX_PENDING_RECOVERY_MS = Math.floor(RAID_DURATION_MS / 2);

export interface RecoveryOutcome {
  /** Stash IDs that were actually restored, in the order they were treated. */
  readonly recoveredIds: readonly string[];
  /** Ward beds this recovery used, to be recorded against the coming raid. */
  readonly wardTreatmentsUsed: number;
  /** Raid time added to the debt, which the cap can hold below the quote. */
  readonly chargedMs: number;
  /** The debt after the charge. */
  readonly pendingRecoveryMs: number;
}

/**
 * What restoring one Pokemon to full HP with no status costs in raid time, or
 * zero when it is already fit. `inWardBed` prices the same treatment in one of
 * the quarantine ward's beds, where only a revive is still charged.
 */
export function recoveryCostMs(
  pokemon: Pokemon,
  terms: RecoveryTerms = STANDARD_RECOVERY_TERMS,
  inWardBed = false,
): number {
  const prices = recoveryPrices(terms.priceShare);
  const missingHp = Math.max(0, pokemon.maxHp - pokemon.currentHp);
  let costMs = 0;
  if (missingHp > 0 && !inWardBed) {
    costMs += Math.max(
      RECOVERY_STEP_MS,
      roundUpToStep((missingHp / pokemon.maxHp) * prices.fullBarMs),
    );
  }
  if (pokemon.isFainted) {
    costMs += prices.reviveMs;
  }
  if (pokemon.primaryStatus !== null && !inWardBed) {
    costMs += prices.statusMs;
  }
  return costMs;
}

/**
 * Which of these Pokemon the ward's unused beds take: whoever a bed saves the
 * most clock on, so the offer is never wasted on a scratch while a worse case
 * is charged in full, and the player never has to work out an order to click
 * in. Ties go to stash order.
 *
 * The quote and the treatment both ask this of everyone hurt at base, not just
 * of whoever is being treated in that call, so a row's listed price is the
 * price whether it is clicked alone or as part of "recover all".
 */
export function wardBedIds(
  patients: readonly StashedPokemon[],
  terms: RecoveryTerms,
): ReadonlySet<string> {
  const saving = (stored: StashedPokemon): number =>
    recoveryCostMs(stored.pokemon, terms) - recoveryCostMs(stored.pokemon, terms, true);
  return new Set(
    patients
      .map((stored, index) => ({ stored, index, savedMs: saving(stored) }))
      .filter(({ savedMs }) => savedMs > 0)
      .sort((a, b) => b.savedMs - a.savedMs || a.index - b.index)
      .slice(0, Math.max(0, Math.floor(terms.wardTreatments)))
      .map(({ stored }) => stored.id),
  );
}

export function needsRecovery(pokemon: Pokemon): boolean {
  return recoveryCostMs(pokemon) > 0;
}

/** Every stashed Pokemon a recovery would actually change, in stash order. */
export function pokemonNeedingRecovery(stash: Stash): readonly StashedPokemon[] {
  return stash.listPokemon().filter((stored) => needsRecovery(stored.pokemon));
}

/** The whole bill for treating these Pokemon, after the ward's beds and the cap. */
export function quoteRecovery(
  stash: Stash,
  pendingRecoveryMs: number,
  ids: readonly string[],
  terms: RecoveryTerms = STANDARD_RECOVERY_TERMS,
): number {
  const patients = resolve(stash, ids);
  const beds = wardBedIds(pokemonNeedingRecovery(stash), terms);
  let pending = pendingRecoveryMs;
  let chargedMs = 0;
  for (const stored of patients) {
    const charge = chargeRecovery(
      pending,
      recoveryCostMs(stored.pokemon, terms, beds.has(stored.id)),
    );
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
  terms: RecoveryTerms = STANDARD_RECOVERY_TERMS,
): RecoveryOutcome {
  const patients = resolve(stash, ids);
  const beds = wardBedIds(pokemonNeedingRecovery(stash), terms);
  const recoveredIds: string[] = [];
  let pending = pendingRecoveryMs;
  let chargedMs = 0;
  let wardTreatmentsUsed = 0;
  for (const stored of patients) {
    const inWardBed = beds.has(stored.id);
    const charge = chargeRecovery(pending, recoveryCostMs(stored.pokemon, terms, inWardBed));
    if (!stash.recoverPokemon(stored.id)) {
      continue;
    }
    pending = charge.pendingRecoveryMs;
    chargedMs += charge.chargedMs;
    wardTreatmentsUsed += inWardBed ? 1 : 0;
    recoveredIds.push(stored.id);
  }
  return { recoveredIds, chargedMs, pendingRecoveryMs: pending, wardTreatmentsUsed };
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

/** Ward beds already used before the coming raid, as a save may have written it. */
export function clampWardTreatmentsUsed(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
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
