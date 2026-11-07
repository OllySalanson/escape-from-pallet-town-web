import {
  BERRY_PICKING_BAD_MISS_DELAY,
  BERRY_PICKING_DIFFICULTIES,
  BERRY_PICKING_EAT_DELAY,
  BERRY_PICKING_EAT_FALL,
  BERRY_PICKING_FALL_DELAYS,
  BERRY_PICKING_MAX_FALL,
  BERRY_PICKING_MAX_SCORE,
  BERRY_PICKING_NEW_BERRY_DELAY,
  BERRY_PICKING_PICK_DELAY,
  BERRY_PICKING_PRIZE_SCORE,
  BERRY_PICKING_SCORES,
  BERRY_PICKING_STATUS_SQUARES,
  BERRY_PICKING_THRESHOLDS,
} from './generated/berryPicking';

/**
 * BERRY PICKING, FireRed's own Dodrio Berry Picking (pret
 * `src/dodrio_berry_picking.c`), as THE GAME CORNER's second cabinet plays
 * it: berries fall in columns, and a Dodrio reaches left, up or right to
 * catch one as it comes low enough.
 *
 * Everything that is FireRed's is read out of pret by
 * `scripts/fetch-frlg-minigames.mjs` (`generated/berryPicking.ts`) and played
 * here as FireRed plays it, frame by frame at the GBA's sixty a second: a
 * berry drops a step every so many frames (blue slowest, then green, then
 * gold, and all three faster at each of three speeds), it can be eaten only on
 * the two drops before it lands, a beak takes six frames back after a pick and
 * forty after a peck at nothing, a berry eaten is gone six frames later and a
 * new one hangs in its place twenty frames after that, the berries change as
 * the game climbs FireRed's seven stages (`GetNewBerryIdByDifficulty`), a berry
 * on the ground greys one of ten squares, and ten grey squares end the game. A
 * blue berry is 10 points, a green 30, a gold 50, and every one that lands
 * costs 50; 3,000 wins a prize berry.
 *
 * What is this game's, because FireRed's is a game for three to five link
 * players and this is one player with one bird:
 *
 * - **Three columns, all yours.** FireRed shares the columns between
 *   neighbours, each player's three heads over three of them; alone, a Dodrio
 *   has the three it reaches. FireRed delays the leader's own presses four
 *   frames to keep it in step with the link (`UpdatePickStateQueue`); with no
 *   link there is nothing to keep in step with, so that is left out.
 * - **Only the bird plays.** FireRed asks for a Dodrio, one head a column. A
 *   **Doduo** may play with its two: it reaches the middle and the side it is
 *   turned to, and reaching for the other side turns it instead, which takes
 *   `DODUO_TURN_FRAMES`. That is the whole difference, and it is the point -
 *   the vale's Doduo evolves at 31, and the cabinet is a reason to.
 *
 * Pure and Phaser-free: a game is a value, stepped by milliseconds and a key,
 * so it is played headless by the tests and the scene alike.
 */

/** FireRed's frame, which every number here is counted in. */
export const FRAME_MS = 1000 / 60;

/** The columns, as a Dodrio's heads reach them: left, middle, right. */
export const COLUMNS = 3;
export type Column = 0 | 1 | 2;
export const LEFT = 0 as const;
export const MIDDLE = 1 as const;
export const RIGHT = 2 as const;
/** The side a Doduo's two heads are turned to. */
export type Side = typeof LEFT | typeof RIGHT;

export type BerryKind = 'blue' | 'green' | 'gold';
const KINDS: readonly BerryKind[] = ['blue', 'green', 'gold'];

/** Who may play, and with how many heads (this game's: FireRed asks for a Dodrio). */
export const BERRY_PICKERS: Readonly<Record<string, 2 | 3>> = { dodrio: 3, doduo: 2 };

/** How long a Doduo takes to turn its two heads to the other side (this game's rule). */
export const DODUO_TURN_FRAMES = 20;

export function canPickBerries(species: string): boolean {
  return Object.hasOwn(BERRY_PICKERS, species);
}

export function headsOf(species: string): 2 | 3 | undefined {
  return canPickBerries(species) ? BERRY_PICKERS[species] : undefined;
}

/** Where a berry is in its life: falling (or closed on and still falling), eaten, or on the ground. */
export type BerryState = 'falling' | 'picked' | 'eaten' | 'squished';

export interface FallingBerry {
  readonly kind: BerryKind;
  /** FireRed's `fallDist`: 0 hidden in the tree, 1 hanging, up to `BERRY_PICKING_MAX_FALL` on the ground. */
  readonly fall: number;
  readonly state: BerryState;
  readonly fallTimer: number;
  readonly eatTimer: number;
  readonly newTimer: number;
  /** The kind it was, for choosing the next one (`prevBerryIds`). */
  readonly previous: BerryKind;
}

/** What the beak is doing (FireRed's `inputState`), and how long it has been doing it. */
export type BeakState = 'free' | 'trying' | 'picked' | 'ate' | 'bad-miss' | 'turning';

export interface BerryPickingGame {
  readonly species: string;
  readonly heads: 2 | 3;
  /** Which side a Doduo's heads are turned to; a Dodrio reaches both. */
  readonly side: Side;
  readonly frame: number;
  readonly columns: readonly FallingBerry[];
  /** The column the beak is reaching for, while it is. */
  readonly reach: Column | null;
  readonly beak: BeakState;
  readonly beakTimer: number;
  readonly difficulty: number;
  readonly eaten: Readonly<Record<BerryKind, number>>;
  readonly missed: number;
  readonly greySquares: number;
  readonly inRow: number;
  readonly bestInRow: number;
  /** Ten squares grey: no more berries are picked, the ones falling land. */
  readonly ending: boolean;
  readonly over: boolean;
  /** A reach asked for between frames, read on the next one. */
  readonly pressed: Column | null;
  readonly carryMs: number;
  readonly events: readonly BerryEvent[];
}

export type BerryEvent =
  | { readonly kind: 'reach'; readonly column: Column }
  | { readonly kind: 'turn'; readonly side: Side }
  | { readonly kind: 'eaten'; readonly column: Column; readonly berry: BerryKind; readonly points: number }
  | { readonly kind: 'peck'; readonly column: Column }
  | { readonly kind: 'squished'; readonly column: Column; readonly berry: BerryKind }
  | { readonly kind: 'faster'; readonly difficulty: number };

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const SCORE_OF: Readonly<Record<BerryKind, number>> = {
  blue: BERRY_PICKING_SCORES.blue,
  green: BERRY_PICKING_SCORES.green,
  gold: BERRY_PICKING_SCORES.gold,
};

/** FireRed's `GetScore`: the berries eaten, less the ones that landed, never below nothing. */
export function berryScore(game: Pick<BerryPickingGame, 'eaten' | 'missed'>): number {
  const won = KINDS.reduce((sum, kind) => sum + game.eaten[kind] * SCORE_OF[kind], 0);
  const lost = game.missed * BERRY_PICKING_SCORES.missed;
  return Math.min(BERRY_PICKING_MAX_SCORE, Math.max(0, won - lost));
}

export function berriesEaten(game: Pick<BerryPickingGame, 'eaten'>): number {
  return game.eaten.blue + game.eaten.green + game.eaten.gold;
}

/** Whether a score wins FireRed's prize berry. */
export function winsPrizeBerry(score: number): boolean {
  return score >= BERRY_PICKING_PRIZE_SCORE;
}

/** Which speed of FireRed's three the berries fall at, by stage (`difficulty / NUM_DIFFICULTIES`). */
export function fallSpeed(difficulty: number): number {
  return Math.min(BERRY_PICKING_FALL_DELAYS.length - 1, Math.floor(difficulty / BERRY_PICKING_DIFFICULTIES));
}

/** Frames between drops for a kind of berry at a stage. */
export function fallDelay(kind: BerryKind, difficulty: number): number {
  return BERRY_PICKING_FALL_DELAYS[fallSpeed(difficulty)][KINDS.indexOf(kind)];
}

/** FireRed's `GetNewBerryIdByDifficulty`: what hangs next in a column, by stage and what hung there before. */
export function nextBerry(difficulty: number, previous: BerryKind): BerryKind {
  switch (difficulty % BERRY_PICKING_DIFFICULTIES) {
    case 1:
      return 'green';
    case 2:
      return 'gold';
    case 3:
      return previous === 'blue' ? 'green' : 'blue';
    case 4:
      return previous === 'blue' ? 'gold' : 'blue';
    case 5:
      return previous === 'gold' ? 'green' : 'gold';
    case 6:
      return previous === 'blue' ? 'green' : previous === 'green' ? 'gold' : 'blue';
    default:
      return 'blue';
  }
}

/** FireRed's `TryIncrementDifficulty`: the berries eaten that move the game on from a stage. */
export function stageThreshold(difficulty: number): number {
  return (
    BERRY_PICKING_THRESHOLDS[difficulty % BERRY_PICKING_DIFFICULTIES] +
    Math.floor(difficulty / BERRY_PICKING_DIFFICULTIES) * 100
  );
}

/** Whether a berry is low enough to be eaten: the two drops before it lands. */
export function isRipe(berry: FallingBerry): boolean {
  return berry.fall === BERRY_PICKING_EAT_FALL - 1 || berry.fall === BERRY_PICKING_EAT_FALL;
}

/** The columns the bird can reach without turning. */
export function reachable(game: Pick<BerryPickingGame, 'heads' | 'side'>): readonly Column[] {
  return game.heads === 3 ? [LEFT, MIDDLE, RIGHT] : game.side === LEFT ? [LEFT, MIDDLE] : [MIDDLE, RIGHT];
}

/**
 * A new game for this bird, the first wave hanging as FireRed hangs it
 * (`InitFirstWaveOfBerries`): blue in every column, the outer two a drop lower
 * than the middle, so they do not all come down together.
 */
export function startBerryPicking(species: string): BerryPickingGame {
  const heads = headsOf(species) ?? 3;
  const columns = Array.from({ length: COLUMNS }, (_, index): FallingBerry => ({
    kind: 'blue',
    fall: index % 2 === 0 ? 1 : 0,
    state: 'falling',
    fallTimer: 0,
    eatTimer: 0,
    newTimer: 0,
    previous: 'blue',
  }));
  return {
    species,
    heads,
    side: RIGHT,
    frame: 0,
    columns,
    reach: null,
    beak: 'free',
    beakTimer: 0,
    difficulty: 0,
    eaten: { blue: 0, green: 0, gold: 0 },
    missed: 0,
    greySquares: 0,
    inRow: 0,
    bestInRow: 0,
    ending: false,
    over: !canPickBerries(species),
    pressed: null,
    carryMs: 0,
    events: [],
  };
}

/** One of FireRed's frames: the beak's timers, the key, the berries falling, and every beak judged against them. */
export function stepBerryFrame(previous: BerryPickingGame, press: Column | null): BerryPickingGame {
  if (previous.over) {
    return { ...previous, pressed: null, events: [] };
  }
  const game: Mutable<BerryPickingGame> = { ...previous, frame: previous.frame + 1, events: [] };
  const events: BerryEvent[] = [];
  const columns = game.columns.map((berry) => ({ ...berry })) as Mutable<FallingBerry>[];

  // The beak (`RecvLinkData_Gameplay`): a reach asked for becomes an attempt,
  // and every state but a free beak runs out after its own delay.
  if (game.reach !== null && game.beak === 'free') {
    game.beak = 'trying';
  }
  if (game.beak !== 'free') {
    game.beakTimer += 1;
    const delay =
      game.beak === 'bad-miss' ? BERRY_PICKING_BAD_MISS_DELAY : game.beak === 'turning' ? DODUO_TURN_FRAMES : BERRY_PICKING_PICK_DELAY;
    if (game.beakTimer >= delay) {
      game.beakTimer = 0;
      game.beak = 'free';
      game.reach = null;
    }
  }

  // The key (`PlayGame_Leader`): only while the beak is free and the game is on.
  const wanted = press ?? game.pressed;
  game.pressed = null;
  if (!game.ending && wanted !== null && game.beak === 'free' && game.reach === null) {
    if (game.heads === 2 && wanted !== MIDDLE && wanted !== game.side) {
      // This game's Doduo: the far side turns it rather than picks.
      game.side = wanted === LEFT ? LEFT : RIGHT;
      game.beak = 'turning';
      game.beakTimer = 0;
      events.push({ kind: 'turn', side: game.side });
    } else {
      game.reach = wanted;
      events.push({ kind: 'reach', column: wanted });
    }
  }

  // The berries (`UpdateFallingBerries`), and the beak judged each time one moves (`HandlePickBerries`).
  let otherBerryMissed = false;
  columns.forEach((berry, index) => {
    const column = index as Column;
    if (berry.state === 'falling' || berry.state === 'picked') {
      if (berry.fall >= BERRY_PICKING_MAX_FALL) {
        berry.fall = BERRY_PICKING_MAX_FALL;
        berry.state = 'squished';
        events.push({ kind: 'squished', column, berry: berry.kind });
        if (game.greySquares < BERRY_PICKING_STATUS_SQUARES || otherBerryMissed) {
          otherBerryMissed = true;
          if (game.greySquares < BERRY_PICKING_STATUS_SQUARES) game.greySquares += 1;
          game.missed += 1;
          game.inRow = 0;
        }
      } else {
        berry.fallTimer += 1;
        if (berry.fallTimer >= fallDelay(berry.kind, game.difficulty)) {
          berry.fall += 1;
          berry.fallTimer = 0;
        }
        handlePick(game, columns, events);
      }
    } else if (berry.state === 'eaten') {
      berry.newTimer += 1;
      if (berry.newTimer >= BERRY_PICKING_NEW_BERRY_DELAY) {
        berry.newTimer = 0;
        berry.fallTimer = 0;
        berry.state = 'falling';
        berry.fall = 1;
        berry.kind = nextBerry(game.difficulty, berry.previous);
      }
    } else if (berry.state === 'squished') {
      berry.newTimer += 1;
      if (berry.newTimer >= BERRY_PICKING_NEW_BERRY_DELAY && game.greySquares < BERRY_PICKING_STATUS_SQUARES) {
        berry.newTimer = 0;
        berry.fallTimer = 0;
        berry.state = 'falling';
        berry.fall = 1;
        berry.previous = berry.kind;
        berry.kind = nextBerry(game.difficulty, berry.previous);
      }
    }
  });
  game.columns = columns;
  if (game.greySquares >= BERRY_PICKING_STATUS_SQUARES) {
    game.ending = true;
    // FireRed ends once nothing is left falling (`ReadyToEndGame_Leader`).
    if (!columns.some((berry) => berry.state === 'falling' || berry.state === 'picked')) {
      game.over = true;
      game.reach = null;
    }
  }
  game.events = events;
  return game;
}

/** `HandlePickBerries` and `TryPickBerry`, for one bird. */
function handlePick(game: Mutable<BerryPickingGame>, columns: Mutable<FallingBerry>[], events: BerryEvent[]): void {
  if (game.greySquares >= BERRY_PICKING_STATUS_SQUARES) return;
  if (game.reach !== null && game.beak === 'trying') {
    const berry = columns[game.reach];
    if (isRipe(berry)) {
      if (berry.state === 'picked' || berry.state === 'eaten') {
        // Already closed on: a miss, with only the short delay.
      } else {
        berry.state = 'picked';
        game.beak = 'picked';
      }
    } else {
      game.beak = 'bad-miss';
      events.push({ kind: 'peck', column: game.reach });
    }
  }
  columns.forEach((berry, index) => {
    if (berry.state !== 'picked') return;
    const remaining = fallDelay(berry.kind, game.difficulty) - berry.fallTimer;
    if (remaining < BERRY_PICKING_EAT_DELAY) berry.eatTimer += remaining;
    berry.eatTimer += 1;
    if (berry.eatTimer < BERRY_PICKING_EAT_DELAY) return;
    berry.eatTimer = 0;
    // Eaten.
    const kind = berry.kind;
    berry.fall = BERRY_PICKING_EAT_FALL;
    berry.state = 'eaten';
    game.beak = 'ate';
    game.eaten = { ...game.eaten, [kind]: game.eaten[kind] + 1 };
    game.inRow += 1;
    game.bestInRow = Math.max(game.bestInRow, game.inRow);
    events.push({ kind: 'eaten', column: index as Column, berry: kind, points: SCORE_OF[kind] });
    if (berriesEaten(game) >= stageThreshold(game.difficulty)) {
      game.difficulty += 1;
      events.push({ kind: 'faster', difficulty: game.difficulty });
    }
    berry.previous = kind;
  });
}

/**
 * The game moved on by `ms` of real time, a reach asked for at the start of
 * it or not. Time is spent a FireRed frame at a time and what is left over is
 * kept, so a 100 ms frame plays the same six frames sixty 16 ms ones do; a
 * reach asked for between two frames is read on the next one, never dropped.
 */
export function advanceBerryPicking(game: BerryPickingGame, ms: number, press: Column | null): BerryPickingGame {
  let next: BerryPickingGame = { ...game, pressed: press ?? game.pressed, events: [] };
  let carry = game.carryMs + Math.max(0, ms);
  const events: BerryEvent[] = [];
  while (carry >= FRAME_MS - 1e-6 && !next.over) {
    carry -= FRAME_MS;
    next = stepBerryFrame(next, null);
    events.push(...next.events);
  }
  return { ...next, carryMs: next.over ? 0 : Math.max(0, carry), events };
}

export { BERRY_PICKING_STATUS_SQUARES, BERRY_PICKING_PRIZE_SCORE, BERRY_PICKING_MAX_FALL, BERRY_PICKING_EAT_FALL };
