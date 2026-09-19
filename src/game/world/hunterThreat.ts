import type { HunterTuning } from '../run/runGeneration';
import { HUNTER_TIERS, type HunterTier } from './hunter';

/**
 * The floor the arrival lead is derived from: however much hunter a party has
 * bought itself, it gets this much raid before anything is hunting it. A head
 * start, never an ambush - a player is still reading the insertion screen.
 */
export const HUNTER_EARLIEST_ARRIVAL_MS = 25_000;

/**
 * How much sooner the hunter picks up the trail for each tier it opens above
 * the first. It is the floor above divided by the rungs there are to climb, not
 * a number of its own: the seeded delay is 55-75s at its shortest, three rungs
 * stand above the first, and (55s - 25s) / 3 is ten seconds a rung. So the
 * hardest opening still arrives no earlier than 25s, exactly as it did with
 * three rungs and fifteen seconds each - adding a rung buys the ladder more
 * hunter, never an earlier ambush. `hunterThreat.test.ts` recomputes it from
 * `RUN_GENERATION_BOUNDS` and `HUNTER_TIERS`, so growing the ladder again fails
 * there rather than in a raid that opens with the hunter already on you.
 */
export const HUNTER_ARRIVAL_LEAD_PER_TIER_MS = 10_000;

/** The part of a deployed Pokemon the hunter reads. `Pokemon` satisfies it. */
export interface HunterThreatSubject {
  readonly level: number;
  readonly isFainted: boolean;
  readonly base: { readonly name: string };
}

/**
 * What the party a player deploys costs them in hunter. Derived, never stored:
 * it is a function of the loadout, so the final-check screen and the raid it
 * leads into cannot disagree about it.
 */
export interface HunterThreat {
  /** Tiers above the first that the hunter opens on. Feeds `HunterTuning.teamTierOffset`. */
  readonly tierOffset: number;
  /** The team the hunter fields at first contact. */
  readonly openingTier: HunterTier;
  readonly arrivesSoonerMs: number;
  /** The deployed Pokemon that set the tier; absent when nothing out-levels the hunter. */
  readonly matchedTo?: { readonly name: string; readonly level: number };
  /**
   * Tiers of `tierOffset` the raid's contract added on top of the party's own.
   * Zero when the party had already drawn the top of the ladder: a contract
   * takes away the discount a weak party buys, it never adds a rung the ladder
   * does not have.
   */
  readonly contractTiers: number;
}

/**
 * The hunter opens on the highest tier the strongest deployed Pokemon still
 * out-levels, so it is matched to the party and never above it: a level-5
 * starter out-levels nothing and meets the level-6 tutorial hunter, a level-10
 * lead meets the level-9 team, a level-13 veteran meets the level-12 one, and a
 * lead that has just evolved at 16 meets the four-strong team at the top.
 *
 * It reads the strongest Pokemon rather than the party's total because a total
 * would charge a recovering player for padding a weak team with weak catches,
 * and it reads only Pokemon that can fight: a fainted veteran cannot be revived
 * in the field, so carrying one buys nothing and must cost nothing. A player
 * down to one low-level Pokemon is therefore back on the first tier with no
 * special case - the thresholds are `HUNTER_TIERS`' own levels, so retuning the
 * tiers retunes this with them.
 *
 * `contractPressure` is the standing board's escalation: tiers the contract
 * carried on this raid opens the hunter above the party's own. It is added on
 * the same ladder and clamped to it, so a standing contract is priced in exactly
 * what a strong party is priced in - the safe raid on your worst Pokemon stops
 * being safe - and the arrival lead can never exceed what a veteran already pays.
 */
export function hunterThreatFor(
  party: readonly HunterThreatSubject[],
  contractPressure = 0,
): HunterThreat {
  const strongest = party
    .filter((pokemon) => !pokemon.isFainted)
    .reduce<HunterThreatSubject | undefined>(
      (best, pokemon) => (best === undefined || pokemon.level > best.level ? pokemon : best),
      undefined,
    );
  const partyOffset = HUNTER_TIERS.reduce(
    (selected, tier, index) => (strongest !== undefined && strongest.level > tier.level ? index : selected),
    0,
  );
  const tierOffset = Math.min(
    HUNTER_TIERS.length - 1,
    partyOffset + Math.max(0, Math.floor(contractPressure)),
  );
  return {
    tierOffset,
    openingTier: HUNTER_TIERS[tierOffset],
    arrivesSoonerMs: tierOffset * HUNTER_ARRIVAL_LEAD_PER_TIER_MS,
    // A tier the party raised always has a Pokemon behind it; the first tier
    // names none, because nothing the player could leave at base would lower it.
    ...(strongest !== undefined && partyOffset > 0
      ? { matchedTo: { name: strongest.base.name, level: strongest.level } }
      : {}),
    contractTiers: tierOffset - partyOffset,
  };
}

/** Folds a party's threat into the raid's seeded hunter tuning. */
export function applyHunterThreat(tuning: HunterTuning, threat: HunterThreat): HunterTuning {
  return {
    ...tuning,
    spawnDelayMs: Math.max(0, tuning.spawnDelayMs - threat.arrivesSoonerMs),
    teamTierOffset: tuning.teamTierOffset + threat.tierOffset,
  };
}

/**
 * The final-check screen's statement of the price, in two parts so the screen
 * can weight the tier and leave the reason as running text. It is worded here
 * so it is testable without the lobby, in the manner of `battlePresentation.ts`.
 *
 * It has one line of the confirm bar to say it in - a second line tips the
 * final check past the frame - so it names the Pokemon the tier was matched to
 * and leaves "bring less, face less" for the player to read out of that.
 */
export function hunterThreatLine(threat: HunterThreat): { readonly heading: string; readonly detail: string } {
  const { openingTier, matchedTo, contractTiers } = threat;
  const team = `Lv ${openingTier.level} team of ${openingTier.party.length}`;
  const sooner = `arrives ${Math.round(threat.arrivesSoonerMs / 1_000)}s sooner`;
  // Both reasons share the one row the confirm bar has, so the pair is worded
  // shorter than either alone. Measured in the bar at its worst (top tier, a
  // Lv 100 Jigglypuff): "matched to your ..., +1 for the contract" wrapped to a
  // second row, and so did "+2 for the contract, whatever you bring".
  const reason = matchedTo
    ? contractTiers > 0
      ? `your Lv ${matchedTo.level} ${matchedTo.name}, +${contractTiers} contract`
      : `matched to your Lv ${matchedTo.level} ${matchedTo.name}`
    : contractTiers > 0
      ? `+${contractTiers} for the contract`
      : undefined;
  return {
    heading: `Hunter tier ${threat.tierOffset + 1} of ${HUNTER_TIERS.length}`,
    // The other wordings say "your", which is what tells the two teams apart. This
    // one had no owner in it, and a stranger could not tell whose team of 1 it was.
    detail: reason
      ? `${team}, ${sooner} - ${reason}`
      : `It fields a ${team} - nothing you bring out-levels it`,
  };
}
