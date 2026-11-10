import { HUNTER_RIVALS, type HunterRivalId } from '../world/hunters';
import { readDojoRun, type DojoRun } from './arenaRuns';

/**
 * A bout on the sand - THE BATTLE ARENA's regulars, a cup or rental run, or a
 * bout for show in THE RAID ARENA's hall - that has started and not come back.
 *
 * A bout writes nothing until its result comes back to the room it was fought
 * from, so a reload in the middle of a losing one used to write nothing at all:
 * the cup's "seven in a row" and the hall's ladder carried on as though the
 * bout had never been fought (the saves hunt, finding 3). So this is written as
 * the bout starts, cleared by the result coming back in the same write that
 * records it, and anything still standing when the base next opens is settled
 * as a loss (`SaveManager.settleBoutUnderWay`) - the same shape as an abandoned
 * raid, and the same heartbeat keeps a bout being fought in another tab alive
 * (`boutHeartbeat` in `run/raidInFlight.ts`). A practice against a leader
 * writes nothing either way, so it has no marker.
 */
export type BoutUnderWay =
  | { readonly id: string; readonly kind: 'hall'; readonly rival: HunterRivalId }
  | { readonly id: string; readonly kind: 'dojo'; readonly opponent: string; readonly run?: DojoRun };

/** A marker read back out of a save, or undefined for none or one that makes no sense. */
export function readBoutUnderWay(value: unknown): BoutUnderWay | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return undefined;
  }
  if (record.kind === 'hall' && HUNTER_RIVALS.some((rival) => rival.id === record.rival)) {
    return { id: record.id, kind: 'hall', rival: record.rival as HunterRivalId };
  }
  if (record.kind === 'dojo' && typeof record.opponent === 'string') {
    const run = readDojoRun(record.run);
    return { id: record.id, kind: 'dojo', opponent: record.opponent, ...(run ? { run } : {}) };
  }
  return undefined;
}

/** A fresh id for a bout, which is what its result is matched on. */
export function newBoutId(): string {
  return `bout-${Date.now().toString(36)}-${Math.floor(Math.random() * 0x100000000).toString(36)}`;
}

/** What the base says when it opens on a bout that never came back. */
export const ABANDONED_BOUT_LINE = 'The game closed in the middle of your bout, so it counts as a loss.';
