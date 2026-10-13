import { Board } from './board';
import { type PieceKind, type Rotation } from './pieces';
import type { Random } from './random';
import { type SpinKind } from './scoring';
/** What the player can ask for. The keyboard layer maps keys onto these. */
export type GameAction = 'left' | 'right' | 'softDrop' | 'hardDrop' | 'rotateCW' | 'rotateCCW' | 'hold';
export interface ActivePiece {
    readonly kind: PieceKind;
    readonly rotation: Rotation;
    /** The top-left of the piece's box, in board cells. */
    readonly x: number;
    readonly y: number;
}
export interface LockResult {
    readonly kind: PieceKind;
    /** Where the piece locked, in board cells. */
    readonly cells: readonly (readonly [number, number])[];
    readonly lines: number;
    /** The board rows that were cleared, top to bottom, before they collapse. */
    readonly rows: readonly number[];
    readonly spin: SpinKind;
    /** 0 for the first clear in a row, 1 for the second, ...; -1 when nothing cleared. */
    readonly combo: number;
    readonly backToBack: boolean;
    readonly perfectClear: boolean;
    readonly points: number;
}
/** Things that happened during an update, for sound and effects to react to. */
export type GameEvent = {
    readonly type: 'spawn';
    readonly kind: PieceKind;
} | {
    readonly type: 'move';
} | {
    readonly type: 'rotate';
    readonly spin: SpinKind;
} | {
    readonly type: 'hold';
    readonly kind: PieceKind;
}
/** Hold was pressed, but this piece has already used it. */
 | {
    readonly type: 'holdRefused';
} | {
    readonly type: 'softDrop';
} | {
    readonly type: 'hardDrop';
    readonly distance: number;
} | ({
    readonly type: 'lock';
} & LockResult) | {
    readonly type: 'levelUp';
    readonly level: number;
} | {
    readonly type: 'gameOver';
};
export type GamePhase = 'falling' | 'clearing' | 'over';
export interface GameOptions {
    readonly startLevel?: number;
    readonly random?: Random;
    /** Pieces dealt before the bag takes over. For tests and scripted scenarios. */
    readonly sequence?: readonly PieceKind[];
    /** A board to start on. For tests. */
    readonly board?: Board;
    /** How long a piece may rest on the stack before it locks. */
    readonly lockDelayMs?: number;
    /** How many moves or turns on the stack may restart the lock delay. */
    readonly maxLockResets?: number;
    /** How long cleared lines flash before the stack falls. */
    readonly clearDelayMs?: number;
    /** Delayed auto-shift: how long a direction is held before it repeats. */
    readonly dasMs?: number;
    /** Auto-repeat rate: the time between repeated moves once DAS has charged. 0 is instant. */
    readonly arrMs?: number;
    /** How many times faster than gravity soft drop falls. */
    readonly softDropFactor?: number;
}
export declare const DEFAULT_LOCK_DELAY_MS = 500;
export declare const DEFAULT_MAX_LOCK_RESETS = 15;
export declare const DEFAULT_CLEAR_DELAY_MS = 320;
export declare const DEFAULT_DAS_MS = 167;
export declare const DEFAULT_ARR_MS = 33;
export declare const DEFAULT_SOFT_DROP_FACTOR = 20;
export declare const PREVIEW_COUNT = 5;
/**
 * The rules of the game, with no knowledge of keys, pixels or sound.
 *
 * Drive it with `press`/`release` and `update(dtMs)`; read its state to draw
 * it; and `drainEvents()` once a frame to hear what happened.
 */
export declare class Game {
    readonly board: Board;
    readonly startLevel: number;
    phase: GamePhase;
    piece: ActivePiece | null;
    held: PieceKind | null;
    canHold: boolean;
    score: number;
    lines: number;
    level: number;
    /** -1 when the last piece cleared nothing. */
    combo: number;
    /** Whether the last line clear was a difficult one, so the next can be back-to-back. */
    backToBackReady: boolean;
    piecesPlaced: number;
    elapsedMs: number;
    /** The most recent lock that cleared lines, for the HUD to name. */
    lastClear: LockResult | null;
    /** The rows being cleared while `phase` is `clearing`. */
    clearingRows: readonly number[];
    clearTimerMs: number;
    private readonly bag;
    private readonly sequence;
    private readonly lockDelayMs;
    private readonly maxLockResets;
    readonly clearDelayMs: number;
    private readonly dasMs;
    private readonly arrMs;
    private readonly softDropFactor;
    private gravityProgress;
    private lockTimerMs;
    private lockResets;
    private lowestY;
    private lastMoveWasRotation;
    private lastKickIndex;
    private readonly heldKeys;
    private shiftDirection;
    /** Turns and a hold pressed while lines clear (or before play starts), for when a piece can take them. */
    private bufferedTurns;
    private bufferedHold;
    private dasTimerMs;
    private arrTimerMs;
    private events;
    constructor(options?: GameOptions);
    /** The next pieces to come, nearest first. */
    get preview(): readonly PieceKind[];
    get isOver(): boolean;
    /**
     * How far a piece resting on the stack is through its lock delay, from 0 just
     * after it touched down or was moved to 1 as it locks. 0 while it falls.
     */
    get lockProgress(): number;
    /** Where the current piece would land if hard dropped. */
    ghostY(): number | null;
    drainEvents(): GameEvent[];
    press(action: GameAction): void;
    /**
     * Keeps a hold or turn for `applyPressedLater`, for presses made before the
     * game can take them (during READY, say). Other actions are ignored: a hard
     * drop kept for later would drop a piece the player has not looked at.
     */
    pressLater(action: GameAction): void;
    /** Applies what `pressLater` kept to the falling piece; during a clear it waits for the next one. */
    applyPressedLater(): void;
    release(action: GameAction): void;
    /** Lets go of everything, for when the game loses focus. */
    releaseAll(): void;
    update(dtMs: number): void;
    private startShift;
    private updateAutoShift;
    private shift;
    private rotate;
    /** A successful move or turn on the stack buys more time, up to a limit. */
    private afterManipulation;
    /** Reaching a row lower than ever before gives the piece a fresh set of resets. */
    private trackLowest;
    private isGrounded;
    private stepDown;
    private updateGravity;
    private updateLock;
    private hardDrop;
    private hold;
    /** The three-corner rule, with the two front corners deciding full or mini. */
    private detectSpin;
    private lockPiece;
    private finishClear;
    /** What was pressed early acts on the piece: a hold first, then the turns. */
    private applyBufferedInput;
    private lockedEntirelyAbove;
    private isPerfectClearAfter;
    private deal;
    private spawn;
    private endGame;
}
/** A piece's cells, in board coordinates. */
export declare function pieceCells(piece: ActivePiece): [number, number][];
