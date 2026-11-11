import type { BoutRecord } from '../base/boutLadder';
import { HUNTER_RIVALS } from '../world/hunters';
import { runBoutNumber, type DojoRun } from './arenaRuns';
import { streakOf } from './classes';
import { cupOfTheWeek } from './cups';
import type { DojoRecord } from './dojoRecord';
import { nextRunScored } from './rentals';

/**
 * What YIELD would throw away, in the words the battle screen asks it in
 * ("Yield the bout?" over this line), or undefined when a loss costs nothing
 * and YIELD gives the bout up on one press. Phaser-free.
 *
 * A yield is a loss in every settlement, and YIELD sits one press right of
 * FIGHT: one slip at six of seven in a cup threw away the week's run without a
 * word (the arenas hunt, finding 1). So a bout that holds a run of wins, or
 * spends the day's paying rental run, asks first.
 */

/** A bout in THE BATTLE ARENA: a class bout, or a bout of a cup or rental run. */
export function dojoYieldStake(record: DojoRecord | undefined, run: DojoRun | undefined, now: Date): string | undefined {
  if (!run) {
    const held = streakOf(record).length;
    return held > 0 ? `Your run of ${held} in a row ends.` : undefined;
  }
  const held = runBoutNumber(run, record, now) - 1;
  if (run.mode === 'cup') {
    const start = run.at !== undefined ? new Date(run.at) : now;
    return held > 0 ? `Your ${cupOfTheWeek(start).name} run of ${held} ends.` : undefined;
  }
  if (held > 0) {
    return `Your rental run of ${held} ends.`;
  }
  return nextRunScored(record?.rental, run.at !== undefined ? new Date(run.at) : now) ? 'It spends today’s paying run.' : undefined;
}

/** A bout on the hall's ladder, against the rival on the far floor. */
export function hallYieldStake(bouts: BoutRecord | undefined): string | undefined {
  const held = bouts?.beaten.length ?? 0;
  return held > 0 ? `Your run of ${held} of ${HUNTER_RIVALS.length} ends.` : undefined;
}
