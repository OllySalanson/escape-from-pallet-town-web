/** Where the game is: which screen is up, and that screen's own state. */
export type Screen = {
    readonly kind: 'title';
    readonly cursor: number;
} | {
    readonly kind: 'ready';
    readonly elapsedMs: number;
} | {
    readonly kind: 'playing';
} | {
    readonly kind: 'paused';
    readonly cursor: number;
    /** How far into READY and GO! the pause came, or null if play had begun. */
    readonly readyElapsedMs: number | null;
} | {
    readonly kind: 'toppingOut';
    readonly elapsedMs: number;
} | {
    readonly kind: 'nameEntry';
    readonly name: string;
} | {
    readonly kind: 'results';
    readonly cursor: number;
    readonly rank: number;
};
/** How long READY and then GO! are up before a game starts. */
export declare const READY_MS = 700;
export declare const GO_MS = 500;
/** The grey curtain rises one row this often, then holds before the results. */
export declare const CURTAIN_ROW_MS = 40;
export declare const CURTAIN_HOLD_MS = 600;
export type TitleItem = 'play' | 'level' | 'sound' | 'exit';
export declare const PAUSE_ITEMS: readonly ["RESUME", "RESTART", "QUIT"];
export declare const RESULT_ITEMS: readonly ["PLAY AGAIN", "TITLE"];
export declare const MAX_START_LEVEL = 15;
/** The pause menu over a live screen, remembering a countdown it interrupted. */
export declare function pauseOver(screen: Screen): Screen;
/**
 * Where RESUME goes: back into the countdown where the pause cut it short, or,
 * from play, through READY and GO! again. The pause hid the board, so the
 * player gets a moment to read the stack before the piece moves.
 */
export declare function resumeFrom(paused: Extract<Screen, {
    kind: 'paused';
}>): Screen;
/**
 * The clock that callouts, banners and drop effects keep time by: it stands
 * still while the game is paused, so a callout raised just before a pause is
 * still up, with its time left, when play resumes.
 */
export declare function stepEffectsClock(effectsMs: number, screen: Screen, dtMs: number): number;
/** Moves a menu cursor, wrapping at both ends. */
export declare function moveCursor(cursor: number, by: number, count: number): number;
/** Steps the start level, clamped to what is offered. */
export declare function stepLevel(level: number, by: number): number;
/**
 * The level the LEVEL option shows when the game opens: the host's choice if it
 * made one, else the one this browser last picked, else 1. A saved value that
 * is not a whole level in range is ignored or clamped.
 */
export declare function initialStartLevel(option: number | undefined, saved: string | null): number;
