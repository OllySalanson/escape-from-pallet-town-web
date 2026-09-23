import type { HunterTuning } from '../run/runGeneration';
import {
  HUNTER_TIERS,
  hunterTeamFor,
  type HunterOpponent,
  type HunterTeamMember,
  type HunterTier,
} from './hunter';
import { FIRST_HUNTER_RIVAL, hunterRival, type HunterRivalId } from './hunters';

/**
 * The floor the arrival lead is derived from: however much hunter a party has
 * bought itself, it gets this much raid before anything is hunting it. A head
 * start, never an ambush - a player is still reading the insertion screen.
 */
export const HUNTER_EARLIEST_ARRIVAL_MS = 25_000;

/**
 * How much sooner the hunter picks up the trail for each tier it opens above
 * the first - which, since the ladder became a mirror, only a contract does.
 * It is the floor above divided by the rungs there are to climb, not a number
 * of its own: the seeded delay is 55-75s at its shortest, three rungs
 * stand above the first, and (55s - 25s) / 3 is ten seconds a rung. So the
 * hardest opening still arrives no earlier than 25s, exactly as it did with
 * three rungs and fifteen seconds each - adding a rung buys the ladder more
 * hunter, never an earlier ambush. `hunterThreat.test.ts` recomputes it from
 * `RUN_GENERATION_BOUNDS` and `HUNTER_TIERS`, so growing the ladder again fails
 * there rather than in a raid that opens with the hunter already on you.
 */
export const HUNTER_ARRIVAL_LEAD_PER_TIER_MS = 10_000;

/** The part of a deployed Pokemon the hunter reads. `Pokemon` satisfies it. */
export interface HunterThreatSubject extends HunterOpponent {
  readonly base: { readonly name: string };
}

/**
 * What a raid's hunter will be, as the final check can know it before the
 * raid starts. Derived, never stored: it is a function of the loadout, the
 * contract and whose turn it is, so the screen and the raid it leads into
 * cannot disagree about it.
 */
export interface HunterThreat {
  /** Who is hunting (`hunters.ts`). */
  readonly rival: HunterRivalId;
  /** Rungs above the first that the hunter opens on. Feeds `HunterTuning.teamTierOffset`. */
  readonly tierOffset: number;
  readonly openingTier: HunterTier;
  /**
   * The team it fields at first contact against the party as deployed. The raid
   * reads the party again when it is caught (`createHunterTrainer`), so a
   * Pokemon that fainted on the way is one fewer the hunter brings.
   */
  readonly openingTeam: readonly HunterTeamMember[];
  readonly arrivesSoonerMs: number;
  /** The deployed Pokemon its lead is paired with; absent for a party that cannot fight. */
  readonly matchedTo?: { readonly name: string; readonly level: number };
  /**
   * Rungs the raid's contract added. It is the whole of `tierOffset` now: the
   * party no longer climbs the ladder, because the hunter's levels are read off
   * the party itself and a strong party already meets a strong team.
   */
  readonly contractTiers: number;
}

/**
 * The hunter a party deploys against.
 *
 * It used to open on the highest rung the strongest Pokemon out-levelled and
 * grow its *team* with the clock, so a lone veteran met four and a lone
 * starter met a Pokemon above its own level. The ladder mirrors the party now
 * (`HUNTER_TIERS` in `hunter.ts`): as many Pokemon as the player can fight
 * with, each paired below one of theirs. So the party is read for the
 * sentence the final check prints and nothing else - it has nothing left to
 * raise.
 *
 * `contractPressure` is the standing board's escalation, and it is the one
 * thing that still climbs: rungs the contract carried on this raid open the
 * hunter closer to the party's own level and bring it sooner, clamped to the
 * ladder. That is exactly how much harder the top of the board is.
 */
export function hunterThreatFor(
  party: readonly HunterThreatSubject[],
  contractPressure = 0,
  rival: HunterRivalId = FIRST_HUNTER_RIVAL,
): HunterThreat {
  const strongest = party
    .filter((pokemon) => !pokemon.isFainted)
    .reduce<HunterThreatSubject | undefined>(
      (best, pokemon) => (best === undefined || pokemon.level > best.level ? pokemon : best),
      undefined,
    );
  const tierOffset = Math.min(HUNTER_TIERS.length - 1, Math.max(0, Math.floor(contractPressure)));
  const openingTier = HUNTER_TIERS[tierOffset];
  return {
    rival,
    tierOffset,
    openingTier,
    openingTeam: hunterTeamFor(openingTier, party),
    arrivesSoonerMs: tierOffset * HUNTER_ARRIVAL_LEAD_PER_TIER_MS,
    ...(strongest === undefined
      ? {}
      : { matchedTo: { name: strongest.base.name, level: strongest.level } }),
    contractTiers: tierOffset,
  };
}

/** Folds a party's threat into the raid's seeded hunter tuning. */
export function applyHunterThreat(tuning: HunterTuning, threat: HunterThreat): HunterTuning {
  return {
    ...tuning,
    spawnDelayMs: Math.max(0, tuning.spawnDelayMs - threat.arrivesSoonerMs),
    teamTierOffset: tuning.teamTierOffset + threat.tierOffset,
    rivalId: threat.rival,
  };
}

/**
 * The final-check screen's statement of who is coming and what they bring, in
 * two parts so the screen can weight the name and leave the rest as running
 * text. Worded here so it is testable without the lobby, in the manner of
 * `battlePresentation.ts`.
 *
 * It has one line of the confirm bar to say it in - a second line tips the
 * final check past the frame - so it says the three things that decide the
 * fight and nothing else: how many, how strong, and against which of yours.
 * The count is the one the playtest asked for ("it does not say *and it will
 * field three against your one*"), which is why it leads.
 */
export function hunterThreatLine(threat: HunterThreat): { readonly heading: string; readonly detail: string } {
  const { openingTeam, matchedTo, contractTiers } = threat;
  const lead = openingTeam[0];
  const count = `${openingTeam.length} Pokémon to your ${openingTeam.length}`;
  const against = matchedTo && lead
    ? lead.level < matchedTo.level
      ? `lead Lv ${lead.level} to your Lv ${matchedTo.level} ${matchedTo.name}`
      : `lead Lv ${lead.level}, level with your ${matchedTo.name}`
    : lead
      ? `lead Lv ${lead.level}`
      : '';
  const contract = contractTiers > 0
    ? `, +${contractTiers} contract, ${Math.round(threat.arrivesSoonerMs / 1_000)}s sooner`
    : '';
  return {
    heading: `Hunter: ${hunterRival(threat.rival).name}`,
    detail: `${count} · ${against}${contract}`,
  };
}
