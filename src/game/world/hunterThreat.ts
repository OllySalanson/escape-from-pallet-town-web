import type { HunterTuning } from '../run/runGeneration';
import { HUNTER_TIERS, type HunterTier } from './hunter';

/**
 * How much sooner the hunter picks up the trail for each tier it opens above
 * the first. The seeded delay is 55-75s, so the hardest opening still leaves
 * 25s of raid before anything is hunting - a head start, never an ambush.
 */
export const HUNTER_ARRIVAL_LEAD_PER_TIER_MS = 15_000;

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
}

/**
 * The hunter opens on the highest tier the strongest deployed Pokemon still
 * out-levels, so it is matched to the party and never above it: a level-5
 * starter out-levels nothing and meets the level-6 tutorial hunter, a level-10
 * lead meets the level-9 team, and a level-13 veteran meets the level-12 one.
 *
 * It reads the strongest Pokemon rather than the party's total because a total
 * would charge a recovering player for padding a weak team with weak catches,
 * and it reads only Pokemon that can fight: a fainted veteran cannot be revived
 * in the field, so carrying one buys nothing and must cost nothing. A player
 * down to one low-level Pokemon is therefore back on the first tier with no
 * special case - the thresholds are `HUNTER_TIERS`' own levels, so retuning the
 * tiers retunes this with them.
 */
export function hunterThreatFor(party: readonly HunterThreatSubject[]): HunterThreat {
  const strongest = party
    .filter((pokemon) => !pokemon.isFainted)
    .reduce<HunterThreatSubject | undefined>(
      (best, pokemon) => (best === undefined || pokemon.level > best.level ? pokemon : best),
      undefined,
    );
  const tierOffset = HUNTER_TIERS.reduce(
    (selected, tier, index) => (strongest !== undefined && strongest.level > tier.level ? index : selected),
    0,
  );
  return {
    tierOffset,
    openingTier: HUNTER_TIERS[tierOffset],
    arrivesSoonerMs: tierOffset * HUNTER_ARRIVAL_LEAD_PER_TIER_MS,
    // A raised tier always has a Pokemon behind it; the first tier names none,
    // because nothing the player could leave at base would lower it.
    ...(strongest !== undefined && tierOffset > 0
      ? { matchedTo: { name: strongest.base.name, level: strongest.level } }
      : {}),
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
  const { openingTier, matchedTo } = threat;
  const team = `Lv ${openingTier.level} team of ${openingTier.party.length}`;
  return {
    heading: `Hunter tier ${threat.tierOffset + 1} of ${HUNTER_TIERS.length}`,
    detail: matchedTo
      ? `${team}, arrives ${Math.round(threat.arrivesSoonerMs / 1_000)}s sooner - matched to your Lv ${matchedTo.level} ${matchedTo.name}`
      : `${team} - nothing you are bringing out-levels it`,
  };
}
