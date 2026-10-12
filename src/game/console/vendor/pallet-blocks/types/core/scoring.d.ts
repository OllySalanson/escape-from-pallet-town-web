/**
 * Points, levels and speed. Everything here is a pure function of numbers, so
 * the rules can be read and tested in one place.
 */
export type SpinKind = 'none' | 'mini' | 'full';
/** Lines needed to go up a level. */
export declare const LINES_PER_LEVEL = 10;
/** The level whose gravity is the fastest the game gets. */
export declare const MAX_GRAVITY_LEVEL = 20;
export declare const SOFT_DROP_POINTS_PER_CELL = 1;
export declare const HARD_DROP_POINTS_PER_CELL = 2;
export declare const COMBO_POINTS = 50;
/** The level a game is on after clearing `lines`, having started on `startLevel`. */
export declare function levelFor(startLevel: number, lines: number): number;
/**
 * How long a piece takes to fall one row, in milliseconds. This is the familiar
 * modern curve: one row a second at level 1, speeding up until it is effectively
 * instant by level 20.
 */
export declare function gravityMsPerRow(level: number): number;
/**
 * A "difficult" clear keeps a back-to-back chain going: four lines at once, or
 * any spin that clears lines.
 */
export declare function isDifficultClear(lines: number, spin: SpinKind): boolean;
/** Points for the clear itself, at level 1, before back-to-back. */
export declare function clearPoints(lines: number, spin: SpinKind): number;
export interface LockScoreInput {
    readonly lines: number;
    readonly spin: SpinKind;
    readonly level: number;
    /** Combo count after this lock: 0 for the first clear in a row, 1 for the second, ... */
    readonly combo: number;
    /** Whether this clear continues a back-to-back chain. */
    readonly backToBack: boolean;
    readonly perfectClear: boolean;
}
/** Every point a single lock earns: the clear, back-to-back, combo and perfect clear. */
export declare function lockPoints(input: LockScoreInput): number;
