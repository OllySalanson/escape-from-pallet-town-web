/**
 * How long one extraction raid lasts, and the schedule everything else hangs off.
 *
 * The clock only advances inside WorldScene: battles, the bag, the party screen
 * and the field guide all stop or pause it. So a raid's clock cost is walking
 * plus dialogue plus deliberation, not combat, and that is what the duration has
 * to be measured against.
 *
 * Measured on the Floodplain Relay, the area every new save deploys into:
 *
 * - A step is `STEP_DURATION_MS` of animation plus a frame to finish it and a
 *   frame to plan the next one, so a tile costs about 0.17s at 60fps, and
 *   measured about 0.23s in a headless browser.
 * - Insertion (15,3) to the contract (11,23) is 41 tiles, and the contract to the
 *   South Gate is 12. The whole beeline is 53 tiles: about 12 seconds of walking.
 *   (It was 33 tiles before the map was redrawn; the contract now sits three
 *   reed shelves deep instead of one step off the road.)
 * - The greediest sensible route - ranger radio, flooded vault, both loot drops,
 *   the contract, then the Ferry Dock - is 108 tiles: about 25 seconds.
 * - Authored dialogue types at 40 characters a second. Both signs, the radio, the
 *   vault cache, two loot pickups, the kit and the hunter warning come to about
 *   25 seconds of reading.
 *
 * So a raid that takes everything costs roughly a minute of clock played
 * fluently, and two to three minutes for a first-timer who still has to find the
 * kit. Eighteen minutes could not be spent; five can.
 *
 * Five minutes also lands the existing escalation on a clean curve, which is why
 * no hunter tier is retuned alongside it:
 *
 * | at      | share  | what happens                               |
 * | ------- | ------ | ------------------------------------------ |
 * | 45s     | 15%    | Ferry Dock opens                           |
 * | 55-75s  | 18-25% | the hunter spawns (tier 1, level 6)        |
 * | 120s    | 40%    | hunter tier 2 (level 9, two Pokemon)       |
 * | 240s    | 80%    | hunter tier 3 (level 12, three Pokemon)    |
 * | 300s    | 100%   | enrage, then `ENRAGE_GRACE_MS` to get out  |
 *
 * And it prices the escapes from PR #66 properly: a first flee costs 40s, an
 * eighth of the raid, and the 120s cap is nearly half of it.
 *
 * `raidClock.test.ts` holds those relationships against the real hunter tiers,
 * extraction points and flee schedule, so shortening the raid again cannot
 * silently strand a tier or an exit.
 */
export const RAID_DURATION_MS = 5 * 60 * 1000;

/**
 * The clock read as a share of the raid, so a result screen can say "80% in"
 * without repeating the duration.
 */
export const raidClockProgress = (elapsedMs: number, durationMs = RAID_DURATION_MS): number =>
  durationMs <= 0 ? 1 : Math.max(0, Math.min(1, elapsedMs / durationMs));

/** mm:ss for any raid-clock reading. */
export const formatRaidClock = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};
