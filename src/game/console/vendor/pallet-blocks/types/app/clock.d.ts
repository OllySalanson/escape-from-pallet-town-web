import type { Game } from '../core/game';
/**
 * Turning the time between animation frames into game time.
 *
 * The game runs in real time whatever the frame rate: a busy host page or a
 * loaded machine shows fewer frames, never a slower game, so each level falls
 * at its own speed everywhere.
 */
/**
 * A gap between frames longer than this is a stall (a frozen tab, a debugger,
 * the machine swapping), not play, and counts as only this much.
 */
export declare const MAX_FRAME_MS = 250;
/** The game is moved on at most this much at a time: one frame of a 60 Hz screen. */
export declare const MAX_STEP_MS: number;
/** How much game time a frame is worth, from its time and the last frame's (null on the first). */
export declare function frameDelta(lastMs: number | null, nowMs: number): number;
/**
 * Moves a game on by a frame's worth of time, in steps no longer than a 60 Hz
 * frame, so a slow frame plays out exactly as several quick ones would.
 */
export declare function advance(game: Game, dtMs: number): void;
