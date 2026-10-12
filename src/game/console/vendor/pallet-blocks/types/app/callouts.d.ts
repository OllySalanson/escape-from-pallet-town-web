import type { LockResult } from '../core/game';
/**
 * The words the side panel shows for a lock worth talking about, one entry per
 * line of the panel. Empty when there is nothing to say.
 */
export declare function describeLock(lock: LockResult): string[];
