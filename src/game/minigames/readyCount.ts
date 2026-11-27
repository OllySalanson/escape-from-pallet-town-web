/**
 * The start line every harbour game opens on, as time: READY, then three
 * beats - 3, 2, 1 - then GO! over the first moments of play. FireRed's own
 * minigames count in before they start; here the count is also when who plays
 * can be changed (LEFT and RIGHT), which starts it again.
 *
 * Time is handed in as the frame's milliseconds and split exactly between
 * the parts it crosses, so a 100 ms frame (test mode's) starts play on the
 * very millisecond sixty 16 ms frames would.
 */

/** How long READY stands before the count, so the picture can be looked at. */
export const READY_MS = 1000;
/** How long GO! stays up once play has begun. */
export const GO_SHOWN_MS = 700;

export type CountWord = 'READY' | '3' | '2' | '1' | 'GO!' | '';

/** What a frame's milliseconds were spent on: standing at READY, the count, and play. */
export interface CountSplit {
  readonly ready: number;
  readonly count: number;
  readonly play: number;
}

/** `delta` ms on from `elapsed`, split between READY, the count and play. */
export function splitCount(elapsed: number, delta: number, countMs: number, readyMs = READY_MS): CountSplit {
  const step = Math.max(0, delta);
  const end = elapsed + step;
  const inReady = Math.max(0, Math.min(end, readyMs) - Math.min(elapsed, readyMs));
  const countEnd = readyMs + countMs;
  const inCount = Math.max(0, Math.min(end, countEnd) - Math.max(elapsed, readyMs));
  return { ready: inReady, count: inCount, play: Math.max(0, end - Math.max(elapsed, countEnd)) };
}

/** Whether the count is over and play has begun. */
export function counted(elapsed: number, countMs: number, readyMs = READY_MS): boolean {
  return elapsed >= readyMs + countMs;
}

/** The word over the field `elapsed` ms after the start line opened. */
export function countWord(elapsed: number, countMs: number, readyMs = READY_MS): CountWord {
  if (elapsed < readyMs) return 'READY';
  const into = elapsed - readyMs;
  if (into < countMs) return (['3', '2', '1'] as const)[Math.min(2, Math.floor((into / countMs) * 3))];
  return into - countMs < GO_SHOWN_MS ? 'GO!' : '';
}
