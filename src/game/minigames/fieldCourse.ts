import { boulderDestination, canStillReach } from '../world/boulders';
import { FIELD_MOVES, type FieldMoveId } from '../world/fieldMoves';
import { canLearnFromMachine } from '../pokemon/machines';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { nextTileFromDirection, type Direction, type GridPosition } from '../movement/gridMovement';

/**
 * THE FIELD-MOVE COURSE (the harbour arenas plan, section 3.4; this game's):
 * a timed run through a walled yard on the promenade, from the start flag to
 * the finish, past a small tree to CUT, a cracked rock to SMASH, a boulder to
 * push with STRENGTH and a pond to SURF - each with a long way round.
 *
 * It is the raid's own rules for every obstacle, so it is practice for the
 * vale's real doors: a small tree and a cracked rock are faced and the interact
 * key opens them (`world/fieldMoves.ts`, the map maker's `cut-tree` and
 * `smash-rock`), Surf turns the whole pond into water shallow enough to wade
 * (the SHOAL CROSSING's `water` to `ford`, `mapFile.ts`'s `fileDoorGates`), and
 * a boulder is pushed a tile by walking into it and is never pushed where it
 * would wall the runner off from the finish (`world/boulders.ts`).
 *
 * What is this game's:
 *
 * - **Who can do what is who could learn it.** The course keeper lends his
 *   own HMs for the run, so a Pokémon on the team that could read HM01 cuts,
 *   whether or not it has (`canLearnFromMachine`, FireRed's machine lists).
 *   That is what makes the team the question: Bulbasaur and Charmander cut and
 *   Squirtle does not; Squirtle surfs and they do not; all three push and
 *   smash; a Krabby does all four.
 * - **Time is time.** The clock runs from the first step to the finish line,
 *   on the scene's own milliseconds: a tile walked is a step
 *   (`STEP_DURATION_MS`), a field move is `FIELD_MOVE_BEAT_MS` stood still while
 *   the Pokémon does it, and standing about is standing about.
 *
 * Pure and Phaser-free: a run is a value stepped by milliseconds, a held
 * direction and the interact key, so it is played headless by the tests, by
 * the solver that proves every way round (`fastestRun`) and by the scene.
 */

/** A course as drawn, one character a tile (`COURSE_LEGEND`). */
export interface CourseLayout {
  readonly id: string;
  readonly name: string;
  readonly rows: readonly string[];
  /** What each sign (`i`) says when faced. */
  readonly signs: readonly { readonly x: number; readonly y: number; readonly lines: readonly string[] }[];
}

/**
 * What a course's characters mean. Walls: `T` trees, `#` a hedge, `F` a fence,
 * `V` water nobody crosses, and the things that stand about to make a yard a
 * place - `r` a rock and `n` a sack - and `i` a sign, which says
 * what is ahead when faced. Ground: `.` grass, `,` an earth path, `g` long
 * grass, `d` sand. The things: `S` the start, `E` the finish line, `x` a
 * small tree for CUT, `o` a cracked rock for ROCK SMASH, `O` a boulder for
 * STRENGTH, standing on grass, and `W` a pond for SURF (all of a pond's tiles
 * that touch are one pond, and SURF opens the whole of it).
 */
export const COURSE_LEGEND = {
  walls: ['T', '#', 'F', 'V', 'r', 'n', 'i'],
  ground: ['.', ',', 'g', 'd', 'S', 'E'],
  cut: 'x',
  smash: 'o',
  boulder: 'O',
  pond: 'W',
} as const;

/** How long a field move holds the runner still while the Pokémon does it (this game's). */
export const FIELD_MOVE_BEAT_MS = 800;

/** The course on the promenade: four yards in a row, each a field move or the long way round. */
export const PROMENADE_COURSE: CourseLayout = {
  id: 'promenade',
  name: 'THE PROMENADE COURSE',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T..i.#...TTT,,,,,,,,TTT.i..#...TTTddddddddT',
    'TS,,,x,,,,,T,,,,F,,,T,,,,,,O,,,,,TdddWWdddT',
    'T....#...T,Tn,,,F,,nT,T....#...T,TdddWWdddT',
    'T....#.g.T,T,r,,F,,,T,T....#...T,TdrdWWdddT',
    'T.gg.#...T,T,,,,F,r,T,T.gg.#.r.T,TdddWWdddT',
    'T.gg.#...T,T,,,,F,,,T,T.gg.#...T,TdddWWdrdT',
    'T....#.ggT,T,,r,F,,,T,T....#...T,TdddWWdddT',
    'T....#.ggT,T,r,,F,,rT,T....#.ggT,TdrdWWdddT',
    'T.gg.#...T,T,,,,F,r,T,T.gg.#.ggT,TdddWWdddT',
    'T.gg.#gggT,T,i,,F,,,T,T....#...T,TdidWWddET',
    'T..g.#...T,,ddddoddd,,Tr...#...T,,,,,WW,,ET',
    'T........TTT,,,,F,,,TTT........TTTdddWWddET',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  signs: [
    { x: 3, y: 2, lines: ['THE COPSE. A small tree grows across the path: CUT it, or go round the foot of the hedge.'] },
    { x: 13, y: 11, lines: ['THE QUARRY. A cracked rock stops the gap in the fence: ROCK SMASH, or round by the top.'] },
    { x: 24, y: 2, lines: ['THE BOULDER. STRENGTH shoves it through the gap in the hedge, or it is the long way round.'] },
    { x: 35, y: 11, lines: ['THE POND. SURF it shallow enough to wade, or walk round the top. The finish is on the far bank.'] },
  ],
};

export const COURSES: readonly CourseLayout[] = [PROMENADE_COURSE];

// --- reading a course -----------------------------------------------------------

export type ObstacleKind = 'cut' | 'smash' | 'pond';

/** Something in the way that a field move opens for good, for the run. */
export interface CourseObstacle {
  readonly id: string;
  readonly kind: ObstacleKind;
  readonly tiles: readonly GridPosition[];
}

export interface ReadCourse {
  readonly layout: CourseLayout;
  readonly width: number;
  readonly height: number;
  readonly start: GridPosition;
  readonly finish: readonly GridPosition[];
  readonly obstacles: readonly CourseObstacle[];
  readonly boulders: readonly GridPosition[];
  /** Solid whatever anybody does. */
  readonly walls: readonly (readonly boolean[])[];
}

const key = ({ x, y }: GridPosition): string => `${x},${y}`;

const readCache = new Map<string, ReadCourse>();

/** A course's tiles read into what is where. */
export function readCourse(layout: CourseLayout): ReadCourse {
  const cached = readCache.get(layout.id);
  if (cached && cached.layout === layout) return cached;
  const height = layout.rows.length;
  const width = layout.rows[0]?.length ?? 0;
  if (layout.rows.some((row) => row.length !== width)) throw new Error(`course '${layout.id}' is not a rectangle`);
  let start: GridPosition | null = null;
  const finish: GridPosition[] = [];
  const obstacles: CourseObstacle[] = [];
  const boulders: GridPosition[] = [];
  const pondTiles = new Map<string, GridPosition>();
  const walls = layout.rows.map((row, y) =>
    [...row].map((char, x) => {
      const tile = { x, y };
      if (char === 'S') start = tile;
      if (char === 'E') finish.push(tile);
      if (char === COURSE_LEGEND.cut) obstacles.push({ id: `cut-${key(tile)}`, kind: 'cut', tiles: [tile] });
      if (char === COURSE_LEGEND.smash) obstacles.push({ id: `smash-${key(tile)}`, kind: 'smash', tiles: [tile] });
      if (char === COURSE_LEGEND.boulder) boulders.push(tile);
      if (char === COURSE_LEGEND.pond) pondTiles.set(key(tile), tile);
      if (!(COURSE_LEGEND.walls as readonly string[]).includes(char) && !(COURSE_LEGEND.ground as readonly string[]).includes(char) && !'xoOW'.includes(char)) {
        throw new Error(`course '${layout.id}' has '${char}' at ${key(tile)}, which means nothing`);
      }
      return (COURSE_LEGEND.walls as readonly string[]).includes(char);
    }),
  );
  // A pond is every pond tile that touches another.
  const seen = new Set<string>();
  for (const [first, tile] of pondTiles) {
    if (seen.has(first)) continue;
    const pond: GridPosition[] = [];
    const queue = [tile];
    seen.add(first);
    while (queue.length > 0) {
      const at = queue.shift()!;
      pond.push(at);
      for (const way of ['up', 'down', 'left', 'right'] as const) {
        const next = nextTileFromDirection(at, way);
        const id = key(next);
        if (pondTiles.has(id) && !seen.has(id)) {
          seen.add(id);
          queue.push(pondTiles.get(id)!);
        }
      }
    }
    obstacles.push({ id: `pond-${first}`, kind: 'pond', tiles: pond });
  }
  if (!start || finish.length === 0) throw new Error(`course '${layout.id}' needs a start and a finish`);
  const read: ReadCourse = { layout, width, height, start, finish, obstacles, boulders, walls };
  readCache.set(layout.id, read);
  return read;
}

/** The field move each obstacle wants. */
export const OBSTACLE_MOVES: Readonly<Record<ObstacleKind, FieldMoveId>> = { cut: 'cut', smash: 'rock-smash', pond: 'surf' };

// --- the team -------------------------------------------------------------------

/** One of the team as the course sees it: what it is, and so what it could do. */
export interface CourseRunner {
  readonly species: string;
  readonly name: string;
}

/** The most Pokémon that go round, as with POKéMON JUMP. */
export const COURSE_TEAM_SIZE = 3;

/** Which field moves a kind could do on the course: whatever FireRed's HMs could teach it. */
export function courseMovesOf(species: string): readonly FieldMoveId[] {
  return (['cut', 'surf', 'strength', 'rock-smash'] as const).filter((id) => canLearnFromMachine(species, FIELD_MOVES[id].move));
}

/** Who on the team does a move, if anybody: the first that could. */
export function doerOf(team: readonly CourseRunner[], move: FieldMoveId): CourseRunner | undefined {
  return team.find((runner) => courseMovesOf(runner.species).includes(move));
}

// --- a run ----------------------------------------------------------------------

export interface CourseRun {
  readonly course: ReadCourse;
  readonly moves: readonly FieldMoveId[];
  readonly at: GridPosition;
  readonly facing: Direction;
  /** The step under way: where from, and how far through it. */
  readonly step: { readonly from: GridPosition; readonly progress: number } | null;
  /** Milliseconds left of a field move being done. */
  readonly busyMs: number;
  readonly opened: readonly string[];
  readonly boulders: readonly GridPosition[];
  /** Milliseconds since the first step. Null until then: the clock starts on the first step. */
  readonly elapsedMs: number | null;
  readonly finished: boolean;
  readonly events: readonly CourseEvent[];
}

export type CourseEvent =
  | { readonly kind: 'step' }
  | { readonly kind: 'bump'; readonly at: GridPosition; readonly needs?: FieldMoveId }
  | { readonly kind: 'opened'; readonly obstacle: CourseObstacle; readonly move: FieldMoveId }
  | { readonly kind: 'pushed'; readonly from: GridPosition; readonly to: GridPosition }
  | { readonly kind: 'read'; readonly lines: readonly string[] }
  | { readonly kind: 'finished'; readonly ms: number };

export function startCourse(layout: CourseLayout, moves: readonly FieldMoveId[]): CourseRun {
  const course = readCourse(layout);
  return {
    course,
    moves: [...new Set(moves)],
    at: course.start,
    facing: 'right',
    step: null,
    busyMs: 0,
    opened: [],
    boulders: course.boulders,
    elapsedMs: null,
    finished: false,
    events: [],
  };
}

/** The obstacle standing on a tile, if it is still shut. */
export function obstacleAt(run: Pick<CourseRun, 'course' | 'opened'>, tile: GridPosition): CourseObstacle | undefined {
  return run.course.obstacles.find(
    (obstacle) => !run.opened.includes(obstacle.id) && obstacle.tiles.some((each) => each.x === tile.x && each.y === tile.y),
  );
}

/** Whether nobody can stand on a tile right now: a wall, a shut obstacle, a boulder, or off the course. */
function blockedFor(
  course: ReadCourse,
  opened: readonly string[],
  boulders: readonly GridPosition[],
  tile: GridPosition,
): boolean {
  if (tile.x < 0 || tile.y < 0 || tile.x >= course.width || tile.y >= course.height) return true;
  if (course.walls[tile.y][tile.x]) return true;
  if (boulders.some((each) => each.x === tile.x && each.y === tile.y)) return true;
  return obstacleAt({ course, opened }, tile) !== undefined;
}

export function isBlocked(run: Pick<CourseRun, 'course' | 'opened' | 'boulders'>, tile: GridPosition): boolean {
  return blockedFor(run.course, run.opened, run.boulders, tile);
}

function isFinish(course: ReadCourse, tile: GridPosition): boolean {
  return course.finish.some((each) => each.x === tile.x && each.y === tile.y);
}

/**
 * Where a boulder may come to rest, by the raid's rule (`WorldScene.boulderMayRest`
 * and `canStillReach`): open ground, never the start or the finish, never a
 * pond even waded, and never where it walls the runner off from the finish.
 */
function boulderMayRest(run: CourseRun, index: number, to: GridPosition): boolean {
  const { course } = run;
  if (blockedFor(course, run.opened, run.boulders, to)) return false;
  if (isFinish(course, to) || (to.x === course.start.x && to.y === course.start.y)) return false;
  if (course.obstacles.some((obstacle) => obstacle.kind === 'pond' && obstacle.tiles.some((tile) => tile.x === to.x && tile.y === to.y))) {
    return false;
  }
  const boulders = run.boulders.map((each, at) => (at === index ? to : each));
  // The runner ends the push where the boulder stood.
  return canStillReach(run.boulders[index], course.finish, course, (tile) => blockedFor(course, run.opened, boulders, tile));
}

/** What the interact key would do here: the obstacle faced, and whether the team can open it. */
export function facedObstacle(run: CourseRun): { readonly obstacle: CourseObstacle; readonly move: FieldMoveId; readonly can: boolean } | undefined {
  const obstacle = obstacleAt(run, nextTileFromDirection(run.at, run.facing));
  if (!obstacle) return undefined;
  const move = OBSTACLE_MOVES[obstacle.kind];
  return { obstacle, move, can: run.moves.includes(move) };
}

/** The sign the runner is facing, if any. */
export function signFaced(run: Pick<CourseRun, 'course' | 'at' | 'facing'>): CourseLayout['signs'][number] | undefined {
  const tile = nextTileFromDirection(run.at, run.facing);
  return run.course.layout.signs.find((sign) => sign.x === tile.x && sign.y === tile.y);
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * The run moved on by `ms`, with a direction held or not and the interact key
 * pressed at the start of it or not. A step under way is finished first and
 * the time left over carries into the next, as `movement/stepClock.ts` does,
 * so a 100 ms frame walks the same as six 16 ms ones.
 */
export function advanceCourse(previous: CourseRun, ms: number, held: Direction | null, press: boolean): CourseRun {
  if (previous.finished) return { ...previous, events: [] };
  const run: Mutable<CourseRun> = { ...previous, events: [] };
  const events: CourseEvent[] = [];
  let left = Math.max(0, ms);
  let pressed = press;
  if (run.elapsedMs !== null) run.elapsedMs += left;
  for (let guard = 0; guard < 64; guard += 1) {
    if (run.busyMs > 0) {
      const spent = Math.min(run.busyMs, left);
      run.busyMs -= spent;
      left -= spent;
      if (run.busyMs > 0) break;
    }
    if (run.step) {
      const need = (1 - run.step.progress) * STEP_DURATION_MS;
      if (left < need) {
        run.step = { ...run.step, progress: run.step.progress + left / STEP_DURATION_MS };
        break;
      }
      left -= need;
      run.step = null;
      if (isFinish(run.course, run.at)) {
        // The clock stops on the line, less what this frame had left over.
        run.elapsedMs = (run.elapsedMs ?? 0) - left;
        run.finished = true;
        events.push({ kind: 'finished', ms: run.elapsedMs });
        break;
      }
    }
    if (pressed) {
      pressed = false;
      const faced = facedObstacle(run);
      if (faced?.can) {
        run.opened = [...run.opened, faced.obstacle.id];
        run.busyMs = FIELD_MOVE_BEAT_MS;
        run.elapsedMs ??= left;
        events.push({ kind: 'opened', obstacle: faced.obstacle, move: faced.move });
        continue;
      }
      if (faced) events.push({ kind: 'bump', at: faced.obstacle.tiles[0], needs: faced.move });
      const sign = signFaced(run);
      if (sign) events.push({ kind: 'read', lines: sign.lines });
    }
    if (!held || left <= 0) break;
    run.facing = held;
    const to = nextTileFromDirection(run.at, held);
    const boulder = run.boulders.findIndex((each) => each.x === to.x && each.y === to.y);
    if (boulder >= 0) {
      const beyond = boulderDestination(to, held);
      if (run.moves.includes('strength') && boulderMayRest(run, boulder, beyond)) {
        run.boulders = run.boulders.map((each, index) => (index === boulder ? beyond : each));
        events.push({ kind: 'pushed', from: to, to: beyond });
      } else {
        events.push({ kind: 'bump', at: to, needs: 'strength' });
        break;
      }
    } else if (isBlocked(run, to)) {
      const obstacle = obstacleAt(run, to);
      if (!events.some((event) => event.kind === 'bump')) {
        events.push({ kind: 'bump', at: to, ...(obstacle ? { needs: OBSTACLE_MOVES[obstacle.kind] } : {}) });
      }
      break;
    }
    // The clock starts with the rest of this frame, so any frame length times alike.
    run.elapsedMs ??= left;
    run.step = { from: run.at, progress: 0 };
    run.at = to;
    events.push({ kind: 'step' });
  }
  run.events = events;
  return run;
}

/** The runner's place on the screen this instant, in fractional tiles: for drawing them mid-step. */
export function runnerAt(run: CourseRun): { readonly x: number; readonly y: number } {
  if (!run.step) return run.at;
  const t = run.step.progress;
  return { x: run.step.from.x + (run.at.x - run.step.from.x) * t, y: run.step.from.y + (run.at.y - run.step.from.y) * t };
}

// --- the fastest way round ------------------------------------------------------

/** A move in a run: a step (or a push) one way, or a field move done facing that way. */
export interface CourseMove {
  readonly way: Direction;
  readonly open?: true;
}

/**
 * The fastest a team with these moves can get round, in milliseconds, and the
 * way it goes: every step is a step, every field move its beat, every push a
 * step. A search over where the runner is, which obstacles are open and where
 * every boulder stands, so it sees the long way round as well as the short
 * cut. Null for a course this team cannot finish at all, which no course may
 * be for any team (`fieldCourse.test.ts`). `line` is the run itself, which
 * the playtest driver plays.
 */
export function fastestRun(
  layout: CourseLayout,
  moves: readonly FieldMoveId[],
): { readonly ms: number; readonly opened: readonly string[]; readonly line: readonly CourseMove[] } | null {
  const course = readCourse(layout);
  interface Node {
    readonly at: GridPosition;
    readonly opened: readonly string[];
    readonly boulders: readonly GridPosition[];
    readonly ms: number;
    readonly line: readonly CourseMove[];
  }
  const id = (node: Omit<Node, 'ms' | 'line'>): string =>
    `${key(node.at)}|${[...node.opened].sort().join(';')}|${node.boulders.map(key).join(';')}`;
  const best = new Map<string, number>();
  const first: Node = { at: course.start, opened: [], boulders: course.boulders, ms: 0, line: [] };
  // A binary heap on the time so far: the search is asked of every team the tests try.
  const heap: Node[] = [first];
  const push = (node: Node): void => {
    heap.push(node);
    for (let at = heap.length - 1; at > 0; ) {
      const parent = (at - 1) >> 1;
      if (heap[parent].ms <= heap[at].ms) break;
      [heap[parent], heap[at]] = [heap[at], heap[parent]];
      at = parent;
    }
  };
  const pop = (): Node => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let at = 0; ; ) {
        const left = at * 2 + 1;
        const right = left + 1;
        let least = at;
        if (left < heap.length && heap[left].ms < heap[least].ms) least = left;
        if (right < heap.length && heap[right].ms < heap[least].ms) least = right;
        if (least === at) break;
        [heap[least], heap[at]] = [heap[at], heap[least]];
        at = least;
      }
    }
    return top;
  };
  best.set(id(first), 0);
  while (heap.length > 0) {
    const node = pop();
    if (node.ms > (best.get(id(node)) ?? Infinity)) continue;
    if (isFinish(course, node.at)) return { ms: node.ms, opened: node.opened, line: node.line };
    const visit = (next: Node): void => {
      const name = id(next);
      if (next.ms < (best.get(name) ?? Infinity)) {
        best.set(name, next.ms);
        push(next);
      }
    };
    for (const way of ['up', 'down', 'left', 'right'] as const) {
      const to = nextTileFromDirection(node.at, way);
      const shut = obstacleAt({ course, opened: node.opened }, to);
      if (shut && moves.includes(OBSTACLE_MOVES[shut.kind])) {
        visit({ ...node, opened: [...node.opened, shut.id], ms: node.ms + FIELD_MOVE_BEAT_MS, line: [...node.line, { way, open: true }] });
      }
      const boulder = node.boulders.findIndex((each) => each.x === to.x && each.y === to.y);
      if (boulder >= 0) {
        if (!moves.includes('strength')) continue;
        const run: CourseRun = { ...startCourse(layout, moves), at: node.at, opened: node.opened, boulders: node.boulders };
        const beyond = boulderDestination(to, way);
        if (!boulderMayRest(run, boulder, beyond)) continue;
        visit({ at: to, opened: node.opened, boulders: node.boulders.map((each, index) => (index === boulder ? beyond : each)), ms: node.ms + STEP_DURATION_MS, line: [...node.line, { way }] });
        continue;
      }
      if (blockedFor(course, node.opened, node.boulders, to)) continue;
      visit({ ...node, at: to, ms: node.ms + STEP_DURATION_MS, line: [...node.line, { way }] });
    }
  }
  return null;
}
