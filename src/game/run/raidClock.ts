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
 * - A tile costs `STEP_DURATION_MS` (0.15s) of held walking at any frame rate -
 *   `src/game/movement/stepClock.ts`. When this was measured a step could only
 *   end on a frame, so it was 0.15s at 60fps and about 0.23s in a headless
 *   browser; the walking figures below were taken at the slower of those.
 * - The front door (13,9) to the ranger station (12,16) is 12 tiles, the station
 *   to the contract (11,20) is 5, and the contract to the Radio Exit the
 *   station opens is 15. The contract's own route is 32 tiles: about 5 seconds
 *   of walking. The always-open South Gate is the long way home, 85 tiles by
 *   way of the contract - about 13 seconds. (These were 53 tiles to a South
 *   Gate 12 from the contract, before the map was redrawn as a vast one played
 *   a district at a time.) The contract stands three tiles of reeds from dry
 *   ground on purpose: it was first drawn south of the flooded cut, where the
 *   cheapest approach from anywhere crossed nine, and one playtest raid in ten
 *   lost its level-5 starter to the reeds before it ever reached the kit.
 * - The greediest sensible first raid - ranger station, the yard's potion, the
 *   contract, the marsh's antidote, out by the Radio Exit - is 70 tiles: about
 *   10 seconds. The flooded vault is no longer on it: it is behind two bosses.
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
