/**
 * Somebody calling out as a raid goes past.
 *
 * The harbour is full of people because other players' phrases go by over their
 * heads (`harbour/harbourPhrases.ts`). A raid map has no other players, so a
 * village says its own: a person may have a few short `calls`, and now and then
 * the nearest of them with something to say says it, in the same bubble, without
 * asking anything of the player. It stops the street being a row of statues
 * until spoken to, and it is how a village lets slip where things are.
 *
 * One at a time, never the same person twice running while somebody else is in
 * earshot, and nothing while anything is on screen to read. Like a beat it runs
 * off the frame and `Math.random`, so it costs the raid no clock and a seed
 * plays the same raid whatever the street happens to be saying.
 */

/** How far off a person can be heard, in tiles: about half a screen. */
export const CALL_REACH_TILES = 9;
/** How long a call stays up. */
export const CALL_SHOWN_MS = 2600;
/** The least time between two calls; the most is twice it. */
export const CALL_EVERY_MS = 2800;
/** The longest a call may be, which is what keeps a bubble inside a screen. */
export const MAX_CALL_LENGTH = 30;

export interface Caller {
  readonly id: string;
  /** Tiles from the player, as the crow flies. */
  readonly distance: number;
  readonly calls: readonly string[];
}

export interface CallState {
  readonly saying: { readonly id: string; readonly words: string; readonly leftMs: number } | null;
  readonly untilNextMs: number;
  readonly lastId: string | null;
}

export const NO_CALL: CallState = { saying: null, untilNextMs: CALL_EVERY_MS / 2, lastId: null };

export interface AdvanceCallOptions {
  readonly deltaMs: number;
  /** True while anything is on screen to read: a bubble under a dialogue box is noise. */
  readonly frozen: boolean;
  readonly callers: readonly Caller[];
  readonly random: () => number;
}

export function advanceCalls(state: CallState, options: AdvanceCallOptions): CallState {
  const { deltaMs, frozen, callers, random } = options;
  if (frozen) {
    return { ...state, saying: null };
  }
  if (state.saying) {
    const leftMs = state.saying.leftMs - deltaMs;
    // Somebody who has gone out of earshot has stopped talking to you.
    const stillThere = callers.some((caller) => caller.id === state.saying?.id && caller.distance <= CALL_REACH_TILES);
    return leftMs > 0 && stillThere
      ? { ...state, saying: { ...state.saying, leftMs } }
      : { ...state, saying: null, untilNextMs: CALL_EVERY_MS + random() * CALL_EVERY_MS };
  }
  const untilNextMs = state.untilNextMs - deltaMs;
  if (untilNextMs > 0) {
    return { ...state, untilNextMs };
  }
  const inEarshot = callers.filter((caller) => caller.calls.length > 0 && caller.distance <= CALL_REACH_TILES);
  const others = inEarshot.filter((caller) => caller.id !== state.lastId);
  const speaker = [...(others.length > 0 ? others : inEarshot)].sort((a, b) => a.distance - b.distance)[0];
  if (!speaker) {
    // Nobody about: listen again shortly rather than saving one up for the next street.
    return { ...state, untilNextMs: CALL_EVERY_MS / 2 };
  }
  const words = speaker.calls[Math.min(speaker.calls.length - 1, Math.floor(random() * speaker.calls.length))];
  return { saying: { id: speaker.id, words, leftMs: CALL_SHOWN_MS }, untilNextMs: 0, lastId: speaker.id };
}
