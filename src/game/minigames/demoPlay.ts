import { FRAME_MS as BERRY_FRAME_MS, isRipe, LEFT, MIDDLE, reachable, RIGHT, stepBerryFrame, type BerryKind, type BerryPickingGame, type Column } from './berryPicking';
import { bestLines, COUNTDOWN_MS, ridesWaves, sailsOverCrates, toNextCorner, toNextHurdle, waveThreat, type DerbyInput, type DerbyRace } from './derby';
import { DIG_HEIGHT, DIG_WIDTH, digShape, isDug, isLoose, type DigGame } from './dig';
import { advanceCourse, type CourseMove, type CourseRun } from './fieldCourse';
import { FRAME_MS as JUMP_FRAME_MS, isGrounded, jumpFrames, stepFrame, VINE_UPSWING_LOWER, type PokemonJumpGame } from './pokemonJump';

/**
 * The house's own player for every game's attract screen: what a cabinet shows
 * while nobody has pressed SPACE yet, as an arcade cabinet plays itself between
 * coins. Each is the game's own rules module played by a steady hand, so the
 * demo is the rules - a vine jumped as it comes, a berry taken as it ripens, a
 * dig that follows its pings - and nothing has to be written down before play.
 *
 * Every player here is pure and Phaser-free and moves its game on by
 * milliseconds as the scene's frame hands them, a frame of the game's own at a
 * time, so a 100 ms frame plays the same demo as six 16 ms ones.
 */

// --- POKéMON JUMP -------------------------------------------------------------------

/** How many frames ahead the demo looks for the vine coming under its feet: more than a whole swing at its slowest. */
const JUMP_LOOKAHEAD_FRAMES = 240;

/** Whether nobody is hit from here to the vine's next pass under the jumpers' feet, pressing on the first frame or not. */
function clearsTheNextPass(game: PokemonJumpGame, press: boolean): boolean {
  let next = stepFrame(game, press);
  if (next.over) return !next.jumpers.some((jumper) => jumper.hit);
  let underFeet = next.vineState === VINE_UPSWING_LOWER;
  for (let frame = 1; frame < JUMP_LOOKAHEAD_FRAMES; frame += 1) {
    next = stepFrame(next, false);
    if (next.jumpers.some((jumper) => jumper.hit)) return false;
    if (next.vineState === VINE_UPSWING_LOWER) underFeet = true;
    else if (underFeet) return true;
  }
  return true;
}

/**
 * Whether the demo jumps on this frame: half an arc before the last frame a
 * jump would still clear the vine, as a player who has the rhythm does, so the
 * team is at the top of its arcs as the vine passes under it.
 */
export function jumpDemoPresses(game: PokemonJumpGame): boolean {
  const grounded = game.jumpers.filter(isGrounded);
  if (game.over || grounded.length === 0) return false;
  if (clearsTheNextPass(game, false) || !clearsTheNextPass(game, true)) return false;
  const half = Math.max(1, Math.floor(Math.min(...grounded.map((jumper) => jumpFrames(jumper.type))) / 4));
  let later = game;
  for (let frame = 0; frame < half; frame += 1) {
    later = stepFrame(later, false);
    if (later.over) return true;
  }
  return !clearsTheNextPass(later, true);
}

/**
 * The demo game moved on by `ms`, the house jumping for it - until it has
 * cleared `clears` swings, and then it stands still and lets the vine take its
 * feet, so the demo shows how a game ends as well as how it is played.
 */
export function advanceJumpDemo(game: PokemonJumpGame, ms: number, clears: number): PokemonJumpGame {
  let next: PokemonJumpGame = { ...game, events: [] };
  let carry = game.carryMs + Math.max(0, ms);
  const events: PokemonJumpGame['events'][number][] = [];
  while (carry >= JUMP_FRAME_MS && !next.over) {
    carry -= JUMP_FRAME_MS;
    next = stepFrame(next, next.jumpsInRow < clears && jumpDemoPresses(next));
    events.push(...next.events);
  }
  return { ...next, carryMs: next.over ? 0 : carry, events };
}

// --- BERRY PICKING -------------------------------------------------------------------

const BERRY_WORTH: Readonly<Record<BerryKind, number>> = { blue: 0, green: 1, gold: 2 };

/**
 * Where the demo bird reaches this frame, if anywhere: the ripest berry it can
 * reach, gold before green before blue; a Doduo turns to the far side when the
 * berry about to ripen is there. One berry, `letFall`, is left to land, so a
 * square greys and the demo shows what a miss costs.
 */
export function berryDemoReach(game: BerryPickingGame, letFall: number | null): Column | null {
  if (game.over || game.ending || game.beak !== 'free' || game.reach !== null) return null;
  const columns = ([LEFT, MIDDLE, RIGHT] as const).filter((column) => {
    const berry = game.columns[column];
    return berry.state === 'falling' && column !== letFall;
  });
  const ripe = columns.filter((column) => isRipe(game.columns[column]));
  const can = reachable(game);
  const best = ripe
    .filter((column) => can.includes(column))
    .sort((a, b) => BERRY_WORTH[game.columns[b].kind] - BERRY_WORTH[game.columns[a].kind] || game.columns[b].fall - game.columns[a].fall)[0];
  if (best !== undefined) return best;
  // A Doduo looks ahead: the lowest berry on the side it is not turned to.
  if (game.heads === 2) {
    const lowest = [...columns].sort((a, b) => game.columns[b].fall - game.columns[a].fall)[0];
    if (lowest !== undefined && !can.includes(lowest) && game.columns[lowest].fall >= 2) return lowest;
  }
  return null;
}

/** The demo bird's game moved on by `ms`. `letFall` is the column whose next berry it leaves, or null. */
export function advanceBerryDemo(game: BerryPickingGame, ms: number, letFall: number | null): BerryPickingGame {
  let next: BerryPickingGame = { ...game, events: [] };
  let carry = game.carryMs + Math.max(0, ms);
  const events: BerryPickingGame['events'][number][] = [];
  while (carry >= BERRY_FRAME_MS - 1e-6 && !next.over) {
    carry -= BERRY_FRAME_MS;
    next = stepBerryFrame(next, berryDemoReach(next, letFall));
    events.push(...next.events);
  }
  return { ...next, carryMs: next.over ? 0 : Math.max(0, carry), events };
}

// --- THE DIG --------------------------------------------------------------------------

export interface Square {
  readonly x: number;
  readonly y: number;
}

const steps = (a: Square, b: Square): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * The demo's digs on a patch: one two squares off a buried thing (WARM), one
 * a square off it (HOT), and one on it (FOUND IT!) - the Itemfinder's pings
 * followed in. Never into loose sand, so nothing caves in on the demo, and
 * never a dig that would turn the thing up early: a Ground type's plus a
 * square off it would, so a Ground type goes from WARM straight to the find.
 */
export function digDemoTargets(game: DigGame): readonly Square[] {
  const target = game.buried.find((thing) => !isLoose(game, thing.x, thing.y)) ?? game.buried[0];
  if (!target) return [];
  const open = (square: Square): boolean =>
    digShape(game.digger, square.x, square.y).every(
      (dug) => !isLoose(game, dug.x, dug.y) && !isDug(game, dug.x, dug.y) && !game.buried.some((thing) => thing.x === dug.x && thing.y === dug.y),
    );
  const squares: Square[] = [];
  for (let y = 0; y < DIG_HEIGHT; y += 1) for (let x = 0; x < DIG_WIDTH; x += 1) squares.push({ x, y });
  const nearestBuried = (square: Square): number => game.buried.reduce((best, thing) => Math.min(best, steps(thing, square)), Number.POSITIVE_INFINITY);
  const byDistance = (distance: number): Square | undefined =>
    squares.filter((square) => open(square) && steps(square, target) === distance && nearestBuried(square) === distance)[0];
  return [byDistance(2), byDistance(1), target].filter((square): square is Square => square !== undefined);
}

/** One square of the spade's walk from `from` to `to`, across then down, as the arrows move it. */
export function stepToward(from: Square, to: Square): Square {
  if (from.x !== to.x) return { x: from.x + Math.sign(to.x - from.x), y: from.y };
  if (from.y !== to.y) return { x: from.x, y: from.y + Math.sign(to.y - from.y) };
  return from;
}

// --- THE PROMENADE DERBY --------------------------------------------------------------

/**
 * What the demo rider does this frame: the quicker line at every fork, and a
 * sprint tapped into every crate and wave and down every straight while there
 * is breath for it - never into a tight corner. It is the playtest driver's
 * rider (`tools/playtest/derbyLevels.mjs`), which wins THE FRONT on a suited racer.
 */
export function derbyDemoInput(race: DerbyRace, frame: number): DerbyInput {
  const me = race.runners[0];
  const lines = bestLines(race.level, me.racer, race.wet);
  if (race.clock <= COUNTDOWN_MS || me.finishedMs !== null) return { lines };
  const crate = sailsOverCrates(me.racer) ? Number.POSITIVE_INFINITY : toNextHurdle(race.level, me);
  const wave = !ridesWaves(me.racer) && waveThreat(race.level, me, race.clock);
  const hazard = crate < 1.2 || wave;
  const tap = hazard ? me.stamina > 0 : me.stamina > 200 && toNextCorner(race.level, me) > 1.6 && frame % 6 === 0;
  return { lines, tap };
}

// --- THE FIELD-MOVE COURSE ------------------------------------------------------------

export interface CourseDemo {
  readonly run: CourseRun;
  /** The move of the line being played. */
  readonly next: number;
}

/**
 * The demo run moved on by `ms`: the fastest line round for the team
 * (`fastestRun`), a step held as each one comes due and a field move done
 * facing what it opens, as a player who knows the course runs it.
 */
export function advanceCourseDemo(demo: CourseDemo, line: readonly CourseMove[], ms: number): CourseDemo {
  // In short slices, so a long frame never carries a held step on past the move it was for.
  let next = demo;
  for (let left = Math.max(0, ms); left > 0; left -= COURSE_DEMO_SLICE_MS) {
    next = courseDemoSlice(next, line, Math.min(left, COURSE_DEMO_SLICE_MS));
  }
  return next;
}

/** The longest slice of time the course demo hands the run at once: well under a step. */
const COURSE_DEMO_SLICE_MS = 40;

function courseDemoSlice(demo: CourseDemo, line: readonly CourseMove[], ms: number): CourseDemo {
  const { run, next } = demo;
  const move = line[next];
  if (!move || run.finished) return { run: advanceCourse(run, ms, null, false), next };
  // A step or a field move under way finishes before the next is asked for.
  if (run.step || run.busyMs > 0) {
    return { run: advanceCourse(run, ms, null, false), next };
  }
  if (move.open) {
    // Face it first (walking into it turns the runner), then the interact key.
    if (run.facing !== move.way) return { run: advanceCourse(run, ms, move.way, false), next };
    const after = advanceCourse(run, ms, null, true);
    return { run: after, next: after.opened.length > run.opened.length ? next + 1 : next };
  }
  const after = advanceCourse(run, ms, move.way, false);
  const moved = after.at.x !== run.at.x || after.at.y !== run.at.y;
  return { run: after, next: moved ? next + 1 : next };
}
