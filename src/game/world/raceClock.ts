import type { GridPosition } from '../movement/gridMovement';

/**
 * A race against a townsperson, as time: the race clock, the racer's place on
 * their line at any moment of it, and who crossed first. Phaser-free.
 *
 * **The racer is a schedule, not a walker.** Where they are is worked out from
 * the race clock and their line every frame, never stepped: so a fight, which
 * shuts the world down and builds it again, cannot lose or double a step of
 * theirs, a frame of 100ms moves them exactly as far as ten of 10ms, and a test
 * can ask where they will be at any second without running anything.
 *
 * **The race clock is charged as the raid clock is** - walking, standing,
 * reading - and never for the countdown or a menu (the world is paused under
 * one, so nothing moves at all). A fight is charged too, in its own game time
 * (`chargeFight`, asked by `BattleScene`): the racer does not stop for it. A
 * flat price was tried on paper and read as nonsense - a forty-second fight
 * "costing three seconds" - and made a medal a dice roll; game time makes a
 * quick flee a skill and a Repel a clever thing to have packed.
 *
 * **On foot.** The Bicycle is put away for the race and cannot come out until
 * it is over (`WorldScene.toggleBike`): a race is what you know, not what you
 * packed.
 */

/** How long the racer waits at the line for the player once they are over it. */
export const FINISH_WAIT_MS = 30_000;

/** The countdown before GO: the world waits, and nobody's clock runs. */
export const COUNTDOWN_MS = 1800;

/** The words of the countdown, in order, each up for an equal share of it. */
export const COUNTDOWN_WORDS: readonly string[] = ['3', '2', '1'];

/** How long GO! stays up once the race has begun: it is said running. */
export const GO_SHOWN_MS = 700;

/** Which word of the countdown is up `elapsedMs` into it, or null once it is over. */
export function countdownWord(elapsedMs: number): string | null {
  if (elapsedMs < 0 || elapsedMs >= COUNTDOWN_MS) {
    return null;
  }
  const each = COUNTDOWN_MS / COUNTDOWN_WORDS.length;
  return COUNTDOWN_WORDS[Math.min(COUNTDOWN_WORDS.length - 1, Math.floor(elapsedMs / each))];
}

/** Where the racer is: the tile they are on, the one they are stepping to, and how far between. */
export interface RacerPlace {
  readonly tile: GridPosition;
  readonly next: GridPosition;
  /** 0 on `tile`, rising to 1 on `next`. */
  readonly between: number;
  readonly facing: 'up' | 'down' | 'left' | 'right';
  /** Whether they have reached the end of their line. */
  readonly home: boolean;
}

/**
 * The racer `clockMs` into the race, `stepMs` a tile along `line` (the line's
 * first tile is where they stand at GO, its last where they stop).
 */
export function racerPlace(line: readonly GridPosition[], stepMs: number, clockMs: number): RacerPlace {
  const last = line.length - 1;
  const travelled = Math.max(0, clockMs) / stepMs;
  const index = Math.min(last, Math.floor(travelled));
  const tile = line[index];
  const next = line[Math.min(last, index + 1)];
  const toward = index < last ? next : tile;
  const from = index < last ? tile : line[Math.max(0, last - 1)];
  return {
    tile,
    next,
    between: index < last ? travelled - index : 0,
    facing: facingAlong(from, toward),
    home: index >= last,
  };
}

/** The clock reading at which the racer reaches tile `index` of their line. */
export function racerReachesMs(index: number, stepMs: number): number {
  return index * stepMs;
}

function facingAlong(from: GridPosition, to: GridPosition): RacerPlace['facing'] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy < 0 ? 'up' : 'down';
}

/** A race clock reading as the chip and the line say it: `0:07.4`. */
export function formatRaceTime(ms: number): string {
  const tenths = Math.max(0, Math.floor(ms / 100));
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

/** A gap between two times as a line says it: `2.4s`. */
export function formatGap(ms: number): string {
  return `${(Math.max(0, Math.round(ms / 100)) / 10).toFixed(1)}s`;
}
