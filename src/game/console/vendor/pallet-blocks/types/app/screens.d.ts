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
/** Moves a menu cursor, wrapping at both ends. */
export declare function moveCursor(cursor: number, by: number, count: number): number;
/** Steps the start level, clamped to what is offered. */
export declare function stepLevel(level: number, by: number): number;
