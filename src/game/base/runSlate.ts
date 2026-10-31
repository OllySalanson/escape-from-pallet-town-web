/**
 * A slate by the runner, on the rail, chalked with how many raids in a row have
 * got out: something to lose even with an empty pack. A lost raid has it struck
 * through in front of the crowd's groan, and then wiped. It buys nothing, as a
 * stuck landing buys nothing.
 *
 * The count is `raidProgress.outRun`, kept by the save with the rest of the record
 * of raids, because it has to survive however a raid ended, an abandoned one
 * included. What it says, and how far a strike has got, is here, Phaser-free;
 * `runSlateView.ts` draws it.
 */

/** One raid out is a raid; the second in a row is a run. */
export const RUN_WORTH_CHALKING = 2;
/** How long after coming home the strike starts: the groan goes first. */
const STRIKE_FROM_MS = 450;
/** How long the chalk takes to go across. */
const STRIKE_MS = 320;
/** How long the struck slate stays up, before it is wiped. */
const STRIKE_HOLDS_MS = 3400;

export const slateWords = (run: number): string => `${run} OUT`;

/** Whether a run is worth a slate at all. */
export const worthChalking = (run: number): boolean => run >= RUN_WORTH_CHALKING;

/** How far across the slate the strike has gone, 0 to 1, or null once the slate has been wiped. */
export function strikeAt(sinceHomeMs: number): number | null {
  if (sinceHomeMs >= STRIKE_FROM_MS + STRIKE_MS + STRIKE_HOLDS_MS) {
    return null;
  }
  return Math.max(0, Math.min(1, (sinceHomeMs - STRIKE_FROM_MS) / STRIKE_MS));
}
