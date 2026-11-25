import type { Pokemon } from '../pokemon';
import { RAID_DURATION_MS } from '../run/raidClock';
import type { Stash, StashedPokemon } from '../stash';
import { teamConditionLine } from '../ui/condition';

/**
 * Recovery between raids: free, as every Pokémon Center is, except for a faint,
 * which is priced in raid time.
 *
 * Nothing but a finite Potion used to restore HP, so a Pokemon that came home
 * at 3/17 stayed there and the cheapest cure for a worn party was to wipe and
 * be re-granted a fresh level-5 starter. That inverted the whole design, which
 * is built on protecting what you bank, and raid time became the price of every
 * treatment: a scratch, a burn, a faint.
 *
 * That charged the player who was already losing. Every raid after a bad one
 * ran short, and "a bad raid makes the next one worse" was the overnight
 * critic's problem 15 (25 Nov 2026): every raid of theirs after the second ran
 * on 4:00 or 4:35. So HP and a lingering status are mended for nothing, as
 * FireRed's Nurse Joy mends them, and **only bringing a Pokémon round from a
 * faint costs clock**: a faint stays the worst outcome of a fight, so pulling
 * a Pokémon out at 1 HP still beats letting it drop, and a player who finishes
 * a raid on their feet starts the next one on the full clock.
 *
 * Raid time is still the currency for that one charge because the player always
 * has it, always wants more of it, and spends it the moment they act on it. It
 * adds no shop and no stock; a heal never produces an item or a Pokemon.
 *
 * The debt is charged when the raid resolves, not when it starts, so abandoning
 * a shortened raid cannot wash it away.
 *
 * Every price here is a share of one raid, not an absolute number of minutes,
 * so a change to `RAID_DURATION_MS` can never price a revive past the clock.
 */
export const HEALING_IS_FREE_LINE = 'Healing and curing are free. Only bringing a Pokémon round from a faint costs time.';

/** Quoted prices are rounded up to this, so the lobby never shows odd seconds. */
export const RECOVERY_STEP_MS = 5_000;

/**
 * One price, as a share of a raid, snapped to the quoting step - so a full bar
 * costs exactly its listed price rather than the next step up.
 */
const shareOfRaid = (share: number): number =>
  Math.round((RAID_DURATION_MS * share) / RECOVERY_STEP_MS) * RECOVERY_STEP_MS;

const REVIVE_SHARE = 0.11;

/**
 * Bringing a fainted Pokémon round costs this much of the next raid: the one
 * treatment with a price, so a faint stays the worst outcome of a fight.
 * Without it, letting a Pokemon drop would cost exactly the same as pulling it
 * out at 1 HP and retreating would be pointless.
 */
export const RECOVERY_REVIVE_MS = shareOfRaid(REVIVE_SHARE);

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
 * before the next raid. A bed waives the revive for one fainted Pokémon - the
 * one treatment left with a price since healing and curing became free.
 */
export interface RecoveryTerms {
  readonly priceShare: number;
  readonly wardTreatments: number;
  /**
   * Whether today's free heal is still unused (`isFreeHealDay`): the first heal
   * on each day of the player's own clock costs no raid time at all. A lost
   * raid already takes the pack, and newcomers who then paid 1:40 to 2:30 of
   * the next raid to stand back up lost again on the shorter clock and quit
   * (AI playtest 5, 22 Nov 2026).
   */
  readonly freeToday?: boolean;
}

/** The bay as every save starts with it. */
export const STANDARD_RECOVERY_TERMS: RecoveryTerms = { priceShare: 1, wardTreatments: 0 };

/** A day on the player's own clock, as the save remembers the free heal by: `2026-11-22`. */
export function healDayOf(now: Date): string {
  const two = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/** Whether a save that last took its free heal on `freeHealDay` has today's still to take. */
export function isFreeHealDay(freeHealDay: string | undefined, now: Date): boolean {
  return freeHealDay !== healDayOf(now);
}

export interface RecoveryPrices {
  readonly reviveMs: number;
}

export function recoveryPrices(priceShare: number): RecoveryPrices {
  const share = Number.isFinite(priceShare) ? Math.min(1, Math.max(0, priceShare)) : 1;
  const priced = (raidShare: number): number =>
    Math.max(RECOVERY_STEP_MS, shareOfRaid(raidShare * share));
  return { reviveMs: priced(REVIVE_SHARE) };
}

/**
 * The most raid time recovery can ever take: a fifth of the raid clock, which
 * is 1:00 of the five minutes. It was half (2:30), and a fainted lone starter
 * cost 1:40 of a five-minute raid: losing made the next raid shorter and so
 * likelier to be lost too, and newcomers quit on that spiral (AI playtest 5,
 * 22 Nov 2026).
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
 *
 * Free within the one visit that reached the cap, never across visits: a raid
 * out again too soon to settle the debt (`DAY_CARE_LEAST_RAID_MS`) leaves it at
 * the cap, and a looper at the cap was healed free for as long as they kept
 * their raids under a minute (the six-character playtest of 1 Nov). So a debt
 * that is already at the cap when somebody walks up holds every treatment that
 * would cost clock back until a raid has paid it (`isRecoveryHeldBack`) - unless
 * nobody at base can raid at all, because a player must always be able to
 * attempt a run.
 */
export const MAX_PENDING_RECOVERY_MS = Math.floor(RAID_DURATION_MS / 5);

export interface RecoveryOutcome {
  /** Stash IDs that were actually restored, in the order they were treated. */
  readonly recoveredIds: readonly string[];
  /** Ward beds this recovery used, to be recorded against the coming raid. */
  readonly wardTreatmentsUsed: number;
  /** Raid time added to the debt, which the cap can hold below the quote. */
  readonly chargedMs: number;
  /** The debt after the charge. */
  readonly pendingRecoveryMs: number;
  /** Stash IDs she would not treat, because the debt was at the cap before she began. */
  readonly heldBackIds: readonly string[];
  /** Whether this was today's free heal, which the save then remembers (`healDayOf`). */
  readonly usedFreeHeal: boolean;
}

/**
 * Whether a debt at the cap holds back every treatment that costs clock: it was
 * at the cap before this visit, and somebody at base can still raid on it.
 */
export function isRecoveryHeldBack(stash: Stash, pendingRecoveryMs: number): boolean {
  return clampPendingRecoveryMs(pendingRecoveryMs) >= MAX_PENDING_RECOVERY_MS && anyoneFitToRaid(stash) === true;
}

/**
 * What restoring one Pokemon to full HP with no status costs in raid time: the
 * revive, for a Pokémon that has fainted, and nothing for anybody else.
 * `inWardBed` prices it in one of the quarantine ward's beds, which waive the
 * revive.
 */
export function recoveryCostMs(
  pokemon: Pokemon,
  terms: RecoveryTerms = STANDARD_RECOVERY_TERMS,
  inWardBed = false,
): number {
  return pokemon.isFainted && !inWardBed ? recoveryPrices(terms.priceShare).reviveMs : 0;
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

/** Whether Nurse Joy has anything to do for this Pokémon: HP to mend, a status to cure, or a faint. */
export function needsRecovery(pokemon: Pokemon): boolean {
  return pokemon.isFainted || pokemon.currentHp < pokemon.maxHp || pokemon.primaryStatus !== null;
}

/** Every stashed Pokemon a recovery would actually change, in stash order. */
export function pokemonNeedingRecovery(stash: Stash): readonly StashedPokemon[] {
  return stash.listPokemon().filter((stored) => needsRecovery(stored.pokemon));
}

/**
 * Whether anyone in the vault can be deployed, or undefined when there is no
 * vault to read. A wipe restocks the kit but revives nobody, so the result
 * screen asks this of the stash the wipe just wrote.
 */
export function anyoneFitToRaid(stash: Stash | undefined): boolean | undefined {
  return stash?.listPokemon().some((stored) => !stored.pokemon.isFainted);
}

/** What the base says of the whole team (`teamConditionLine`), or null when everyone is fit. */
export function teamCondition(stash: Stash, except: ReadonlySet<string> = new Set()): string | null {
  return teamConditionLine(
    stash.listPokemon().filter((stored) => !except.has(stored.id)).map((stored) => ({
      name: stored.pokemon.name,
      isFainted: stored.pokemon.isFainted,
      needsTreatment: needsRecovery(stored.pokemon),
    })),
  );
}

/** One treatment as it would go: who, whether in a ward bed, and what it adds to the debt. */
interface PlannedTreatment {
  readonly stored: StashedPokemon;
  readonly inWardBed: boolean;
  readonly chargedMs: number;
}

/** The treatments a visit would give these Pokemon, in order, and whom it holds back. */
function planRecovery(
  stash: Stash,
  pendingRecoveryMs: number,
  ids: readonly string[],
  terms: RecoveryTerms,
): { readonly treatments: readonly PlannedTreatment[]; readonly heldBackIds: readonly string[]; readonly pendingRecoveryMs: number } {
  const patients = resolve(stash, ids);
  // Today's free heal takes everybody for nothing, so it neither fills a ward
  // bed nor waits on a debt at the cap.
  const free = freeHealApplies(stash, ids, terms);
  const beds = free ? new Set<string>() : wardBedIds(pokemonNeedingRecovery(stash), terms);
  const heldBack = !free && isRecoveryHeldBack(stash, pendingRecoveryMs);
  const treatments: PlannedTreatment[] = [];
  const heldBackIds: string[] = [];
  let pending = pendingRecoveryMs;
  for (const stored of patients) {
    const inWardBed = beds.has(stored.id);
    const costMs = free ? 0 : recoveryCostMs(stored.pokemon, terms, inWardBed);
    if (heldBack && costMs > 0) {
      heldBackIds.push(stored.id);
      continue;
    }
    const charge = chargeRecovery(pending, costMs);
    pending = charge.pendingRecoveryMs;
    treatments.push({ stored, inWardBed, chargedMs: charge.chargedMs });
  }
  return { treatments, heldBackIds, pendingRecoveryMs: pending };
}

/**
 * Whether today's free heal is what this visit would spend. Mending HP and a
 * status is free on any day, so only bringing somebody round from a faint
 * uses it up: a first visit to mend a scratch spent it on nothing, and Nurse
 * Joy said "your first heal today is free" over a heal that always was (the
 * fresh critic, 25 Nov 2026). `patients` is who is treated, if already known.
 */
export function freeHealApplies(
  stash: Stash,
  ids: readonly string[],
  terms: RecoveryTerms,
  patients: readonly StashedPokemon[] = resolve(stash, ids),
): boolean {
  return terms.freeToday === true && patients.some((stored) => stored.pokemon.isFainted);
}

/** The whole bill for treating these Pokemon, after the ward's beds and the cap. */
export function quoteRecovery(
  stash: Stash,
  pendingRecoveryMs: number,
  ids: readonly string[],
  terms: RecoveryTerms = STANDARD_RECOVERY_TERMS,
): number {
  return planRecovery(stash, pendingRecoveryMs, ids, terms).treatments.reduce((total, treatment) => total + treatment.chargedMs, 0);
}

/** Which of these Pokemon a visit now would put in the ward's beds, by stash id. */
export function wardBedIdsFor(
  stash: Stash,
  pendingRecoveryMs: number,
  ids: readonly string[],
  terms: RecoveryTerms = STANDARD_RECOVERY_TERMS,
): readonly string[] {
  return planRecovery(stash, pendingRecoveryMs, ids, terms)
    .treatments.filter((treatment) => treatment.inWardBed)
    .map((treatment) => treatment.stored.id);
}

/** Which of these Pokemon a visit now would hold back (`isRecoveryHeldBack`). */
export function recoveryHeldBackIds(
  stash: Stash,
  pendingRecoveryMs: number,
  ids: readonly string[],
  terms: RecoveryTerms = STANDARD_RECOVERY_TERMS,
): readonly string[] {
  return planRecovery(stash, pendingRecoveryMs, ids, terms).heldBackIds;
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
  const plan = planRecovery(stash, pendingRecoveryMs, ids, terms);
  // Asked before anybody is treated: once brought round, nobody has fainted.
  const spendsFreeHeal = freeHealApplies(stash, ids, terms);
  const recoveredIds: string[] = [];
  let pending = clampPendingRecoveryMs(pendingRecoveryMs);
  let chargedMs = 0;
  let wardTreatmentsUsed = 0;
  for (const { stored, inWardBed, chargedMs: charged } of plan.treatments) {
    if (!stash.recoverPokemon(stored.id)) {
      continue;
    }
    pending += charged;
    chargedMs += charged;
    wardTreatmentsUsed += inWardBed ? 1 : 0;
    recoveredIds.push(stored.id);
  }
  return {
    recoveredIds,
    chargedMs,
    pendingRecoveryMs: pending,
    wardTreatmentsUsed,
    heldBackIds: plan.heldBackIds,
    usedFreeHeal: spendsFreeHeal && recoveredIds.length > 0,
  };
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

/**
 * Said when a raid came home too soon to pay for the healing it owed
 * (`DAY_CARE_LEAST_RAID_MS`): the debt stands for the next raid, and a player
 * who is not told reads the next short clock as the heal charged twice (the
 * overnight playtest of 20 Nov 2026, twice).
 */
export function recoveryStillOwedLine(pendingRecoveryMs: number, leastRaidMs?: number): string {
  const pending = clampPendingRecoveryMs(pendingRecoveryMs);
  const least = leastRaidMs === undefined ? '' : ` (a raid has to last ${formatRecoveryClock(leastRaidMs)})`;
  return `Out too soon to pay for Nurse Joy's healing${least}: your next raid still runs ${formatRecoveryClock(
    raidClockAfterRecovery(RAID_DURATION_MS, pending),
  )}.`;
}

/**
 * Oak's line, back at base, about healing a raid was too short to pay for. It
 * is the same debt as before, not a fresh charge, and said as one it was taken
 * for healing 'charged twice' (eight playtest reports, 22 Nov 2026).
 */
export function carriedRecoveryLine(pendingRecoveryMs: number, leastRaidMs: number): string {
  const pending = clampPendingRecoveryMs(pendingRecoveryMs);
  return `Your last raid was too short to pay for NURSE JOY's healing - a raid has to last ${formatRecoveryClock(leastRaidMs)}. So your next raid still runs ${formatRecoveryClock(
    raidClockAfterRecovery(RAID_DURATION_MS, pending),
  )}.`;
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

