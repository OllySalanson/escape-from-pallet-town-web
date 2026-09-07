/**
 * What it costs to break away from the hunter, in raid-clock time.
 *
 * The hunter threatens the raid clock - it grows a tier at 120s and 240s and the
 * clock ends the raid - so the clock is the resource an escape spends. The cost is
 * deterministic and escalates, so a player who flees every contact hands over a
 * visible, growing share of their raid instead of escaping for free.
 */
export const HUNTER_FLEE_BASE_PENALTY_MS = 40_000;
export const HUNTER_FLEE_PENALTY_STEP_MS = 20_000;
export const HUNTER_FLEE_PENALTY_CAP_MS = 120_000;

/** The clock cost of the next hunter escape, given how many were already taken. */
export const hunterFleePenaltyMs = (previousFlees: number): number =>
  Math.min(
    HUNTER_FLEE_PENALTY_CAP_MS,
    HUNTER_FLEE_BASE_PENALTY_MS + Math.max(0, previousFlees) * HUNTER_FLEE_PENALTY_STEP_MS,
  );
