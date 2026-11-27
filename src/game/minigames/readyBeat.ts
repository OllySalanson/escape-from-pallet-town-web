import { advancePokemonJump, type PokemonJumpGame } from './pokemonJump';

/**
 * The first seconds of a harbour minigame, which are where its rules are
 * learnt (the harbour audit, 27 Nov 2026, fault 3: "shown, not told").
 *
 * **The ready beat.** SPACE at a cabinet starts the game at once with the
 * first lineup (`whoPlays.ts`). For a moment the game stands ready - the
 * player's Pokémon in place, a plate over it saying who plays - and in that
 * moment LEFT and RIGHT step to somebody else, one press each, and the
 * DERBY's UP and DOWN to another course. It ends by itself, or on SPACE.
 * Nothing in it is played or written: ESC in it leaves as if it had never
 * opened.
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
  /** Which lineup is standing ready. */
  readonly index: number;
  /** How many lineups there are to step between. */
  readonly count: number;
  /** How long until the game starts by itself. */
  readonly leftMs: number;
}

export function readyBeat(index: number, count: number): ReadyBeat {
  return { index, count, leftMs: READY_MS };
}

/** What a key does in the ready beat. */
export type ReadyAction =
  | { readonly kind: 'choose'; readonly index: number }
  | { readonly kind: 'level'; readonly step: -1 | 1 }
  | { readonly kind: 'go' }
  | { readonly kind: 'leave' };

/**
 * A key pressed while the game stands ready: LEFT or RIGHT steps along the
 * lineups (round from the last to the first), UP or DOWN asks for another
 * level where the game has them, SPACE or ENTER starts now, ESC leaves.
 * W A S D are the arrows, in either case, as everywhere.
 */
export function readyKey(beat: ReadyBeat, key: string): ReadyAction | null {
  const letter = key.length === 1 ? key.toLowerCase() : key;
  if (letter === 'Escape' || letter === 'Backspace') return { kind: 'leave' };
  if (letter === ' ' || letter === 'Enter') return { kind: 'go' };
  if (letter === 'ArrowLeft' || letter === 'a' || letter === 'ArrowRight' || letter === 'd') {
    if (beat.count < 2) return null;
    const step = letter === 'ArrowLeft' || letter === 'a' ? -1 : 1;
    return { kind: 'choose', index: (beat.index + step + beat.count) % beat.count };
  }
  if (letter === 'ArrowUp' || letter === 'w') return { kind: 'level', step: -1 };
  if (letter === 'ArrowDown' || letter === 's') return { kind: 'level', step: 1 };
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
