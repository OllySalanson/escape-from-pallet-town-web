import type { LockResult } from '../core/game';
/** At most this many lines fit the side panel above the points. */
export declare const PANEL_LINES = 4;
/**
 * The words the side panel shows for a lock worth talking about, one entry per
 * line of the panel, most important first. Empty when there is nothing to say.
 * Every entry fits the panel's width.
 */
export declare function describeLock(lock: LockResult): string[];
/** A big moment, told across the middle of the well. */
export interface Banner {
    readonly kind: 'clear' | 'level';
    /** Small lines above the big ones. */
    readonly headers: readonly string[];
    /** The big lines. */
    readonly lines: readonly string[];
    /** A small line below them. */
    readonly footer: string | null;
    readonly durationMs: number;
}
export declare const CLEAR_BANNER_MS = 1100;
export declare const LEVEL_BANNER_MS = 1500;
/** The banner for a lock, if it is one of the big ones: a quad, a T-spin that clears, a perfect clear. */
export declare function bannerForLock(lock: LockResult): Banner | null;
/** The banner for reaching a new level. "LV", as the handheld creature games print it, fits large at any level. */
export declare function bannerForLevel(level: number): Banner;
