import { advancePokemonJump, type PokemonJumpGame } from './pokemonJump';

/**
 * The first seconds of a harbour minigame, which are where its rules are
 * learnt (the harbour audit, 27 Nov 2026, fault 3: "shown, not told").
 *
 * **The ready beat.** SPACE at a cabinet starts the game at once with the
 * first lineup (`whoPlays.ts`). For a moment the game stands ready - the
 * player's Pokémon in place, a plate over it saying who plays - and it ends
 * by itself, or on SPACE. P in it opens the game's own list of who plays
 * (the screens `minigames/gameCornerView.ts` and `outdoorView.ts` draw),
 * which is where somebody else, or THE DERBY's other courses, are chosen:
 * the list is the menu screens' own, and an arrow in the beat would only be
 * a second way to choose (the menu redesign takes precedence, 28 Nov 2026).
 * Nothing in the beat is played or written: ESC in it leaves as if it had
 * never opened.
 *
 * **The first move, slowed.** A game played against the clock (POKéMON
 * JUMP's vine, BERRY PICKING's berries, THE DERBY's start) runs slowed until
 * the player has done the thing once, then eases to full speed. Every one of
 * those games is a FireRed frame count stepped by milliseconds, so a slowed
 * game is the very same game, frame for frame and point for point, given
 * more of the player's time to see it in: no rule, score or payout moves
 * (`readyBeat.test.ts` plays one both ways).
 *
 * Phaser-free and pure.
 */

/** How long a game stands ready before it starts by itself. */
export const READY_MS = 2400;

export interface ReadyBeat {
  /** How long until the game starts by itself. */
  readonly leftMs: number;
}

export function readyBeat(): ReadyBeat {
  return { leftMs: READY_MS };
}

/** What a key does in the ready beat, and on a game's result card. */
export type ReadyAction = { readonly kind: 'pick' } | { readonly kind: 'go' } | { readonly kind: 'leave' };

/** The key that opens a game's list of who plays, from its ready beat or its result card. */
export const PICK_KEY = 'p';

/**
 * A key pressed while the game stands ready, or on its result card: SPACE or
 * ENTER starts now (or again), P opens the list of who plays, ESC leaves.
 * Every other key does nothing here: the arrows are the game's own.
 */
export function readyKey(key: string): ReadyAction | null {
  const letter = key.length === 1 ? key.toLowerCase() : key;
  if (letter === 'Escape' || letter === 'Backspace') return { kind: 'leave' };
  if (letter === ' ' || letter === 'Enter') return { kind: 'go' };
  if (letter === PICK_KEY) return { kind: 'pick' };
  return null;
}

/** The beat `ms` on, and whether it has run out: a 100 ms frame spends 100 ms of it. */
export function tickReady(beat: ReadyBeat, ms: number): { readonly beat: ReadyBeat; readonly go: boolean } {
  const leftMs = Math.max(0, beat.leftMs - Math.max(0, ms));
  return { beat: { ...beat, leftMs }, go: leftMs <= 0 };
}

// --- the first move, slowed ---------------------------------------------------------

/** How fast a game runs until its first move is made: a little under half speed. */
export const FIRST_MOVE_PACE = 0.45;
/** How long it takes to come up to full speed once it is. */
export const PACE_EASE_MS = 700;

export interface Pace {
  /** Whether the first move has been made. */
  readonly learnt: boolean;
  /** How long since, while it is still coming up to speed. */
  readonly sinceMs: number;
}

export const FIRST_PACE: Pace = { learnt: false, sinceMs: 0 };
/** A game that is not slowed at all. */
export const FULL_PACE: Pace = { learnt: true, sinceMs: PACE_EASE_MS };

/** How much of the player's time the game is given this frame: 0.45 at first, 1 once learnt and eased. */
export function paceScale(pace: Pace): number {
  if (!pace.learnt) return FIRST_MOVE_PACE;
  const t = Math.min(1, pace.sinceMs / PACE_EASE_MS);
  return FIRST_MOVE_PACE + (1 - FIRST_MOVE_PACE) * t * t * (3 - 2 * t);
}

/** The pace once the first move is made. */
export function learnt(pace: Pace): Pace {
  return pace.learnt ? pace : { learnt: true, sinceMs: 0 };
}

/** The pace `ms` of the player's time on. */
export function paceAfter(pace: Pace, ms: number): Pace {
  return pace.learnt ? { learnt: true, sinceMs: Math.min(PACE_EASE_MS, pace.sinceMs + Math.max(0, ms)) } : pace;
}

/** Whether the game is still being slowed, or coming up to speed. */
export function slowed(pace: Pace): boolean {
  return paceScale(pace) < 1;
}

// --- POKéMON JUMP's ghost -------------------------------------------------------------

/**
 * Whether a jump made now clears the vine's next pass: the game played on, a
 * FireRed frame at a time, with the key pressed this frame and never again,
 * until the vine is either cleared or under somebody's feet. It is what the
 * ghost over the jumpers answers while the first jump is slowed - drawn only
 * while a press now is a press in time.
 */
export function jumpNowClears(game: PokemonJumpGame): boolean {
  if (game.over || game.jumpers.some((jumper) => jumper.jumpStart !== null)) return false;
  let next = advancePokemonJump(game, 0, true);
  for (let frame = 0; frame < 400 && !next.over; frame += 1) {
    next = advancePokemonJump(next, 1000 / 60, false);
    if (next.events.some((event) => event.kind === 'hit')) return false;
    if (next.events.some((event) => event.kind === 'cleared')) return true;
  }
  return false;
}
