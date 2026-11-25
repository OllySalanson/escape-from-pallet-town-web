/**
 * When the raid's arrow is drawn (`WorldScene.raidWay`, `base/wayMark.ts`).
 *
 * A new save's first raid is shown the way the whole time: the arrow is its
 * guide, to the catch, the stake and out. Every raid after it is found by the
 * player, from the chip, Oak's radio and the map, and the arrow stays away -
 * the captain did not like it on after the first raid (25 Nov 2026), because
 * a raid walked behind an arrow is the arrow's, not the player's. It comes
 * back for the last thirty seconds and only to point at the nearest way out,
 * on the same frame the clock turns red and stings (`RAID_CLOCK_URGENT_MS`),
 * so a player who has found everything themselves is not lost with the pack
 * on the line.
 *
 * "First raid" is the plan's own word for it (`RunPlan.stagedChase`, read off
 * `isFirstRaid` before the raid is counted), so a save from before this, which
 * has raids behind it, is simply past it, and a first raid lost and gone on
 * again is a second raid: the walk-through is had once, like the catch.
 */

/** How long before 0:00 the arrow comes back to show the way out. Equal to the clock's red (`RAID_CLOCK_URGENT_MS`). */
export const ARROW_RETURNS_MS = 30_000;

/**
 * `guide`: the arrow as the first raid has it, after whatever the raid is for.
 * `off`: no arrow. `way-out`: the arrow, to the nearest way out and nothing else.
 */
export type RaidArrowPhase = 'guide' | 'off' | 'way-out';

export function raidArrowPhase(raid: { readonly firstRaid: boolean; readonly remainingMs: number; readonly enraged: boolean }): RaidArrowPhase {
  if (raid.firstRaid) {
    return 'guide';
  }
  return raid.enraged || raid.remainingMs <= ARROW_RETURNS_MS ? 'way-out' : 'off';
}
