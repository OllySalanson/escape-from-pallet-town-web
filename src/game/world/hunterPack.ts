import {
  DIRECTION_DELTAS,
  STEP_DIRECTIONS,
  linkKey,
  type Direction,
  type GridLinks,
  type GridPosition,
} from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP } from './hunter';
import { HUNTER_RIVALS, type HunterRivalId } from './hunters';

/**
 * **A hunter in every district** (the captain, 29 Oct: "maybe there should be
 * a hunter in each area ... If you get out there the hunter stops chasing you
 * I guess unless it's right on your tail ... if you lose it then it goes back
 * to its own one", and the same night: "they should just chase you down and
 * you can like run at the same speed as them and like maybe just sometimes
 * they get stuck behind something for like one turn ... to give you a chance
 * to kind of like get away a bit").
 *
 * This is the whole rule, Phaser-free: `WorldScene` hands it the ground and the
 * player each frame and draws what it answers. The design and every number
 * below is in the deep dive (`docs/hunter.md`); in one breath:
 *
 * - **Every hunter has a patch** (`HunterGround`): one of the map's big
 *   districts, or the whole outdoors on a map without any, and walks a loop of
 *   it at a stroll (`HUNTER_PATROL_STEP_MS`). Where the hunters are is
 *   therefore a thing you can see before they see you.
 * - **It notices you by looking**, the way a FireRed trainer does but wider: a
 *   quarter-turn cone in the way it faces, `HUNTER_SIGHT_STEPS` deep, through
 *   nothing solid, and all round at `HUNTER_HEARING_STEPS`. Tall grass hides
 *   you past `HUNTER_GRASS_SIGHT_STEPS` - and rolls for wildlife, which is the
 *   gamble. Noticing is a "!" and a beat (`HUNTER_ALERT_MS`) before it runs.
 * - **It runs at your pace** (`HUNTER_CHASE_STEP_MS` is a walked tile), in
 *   real time, so whatever you stop for - a bump, a box, a search, a fight -
 *   is ground it takes, and nothing you do on open ground gains any.
 * - **It snags on a corner** - the one break the chase gives, and never by
 *   chance: running flat out (`HUNTER_SNAG_MOMENTUM` straight tiles) into
 *   something solid and having to turn costs it a tile's time
 *   (`HUNTER_SNAG_MS`), at most once every `HUNTER_SNAG_COOLDOWN` tiles. Open
 *   ground is its ground; a wood, a fence line or a town is yours.
 * - **It loses you for a reason you can see**: out of sight, it runs to the
 *   last tile it saw you on and looks about (`HUNTER_SEARCH_LOOK_MS`), and
 *   then walks home. Out of its patch it gives up the moment it cannot see
 *   you, and it only follows you out of the patch at all while it is right on
 *   your tail (`HUNTER_TAIL_STEPS`) - so leaving a district is a way out, and
 *   the next district's hunter is the next problem.
 * - **A fight it is not in costs you ground, never the raid**: after a wild
 *   or trainer fight every hunter that was after you knows where you are and
 *   comes on `HUNTER_FIGHT_CATCH_UP_STEPS`, but stops a step short of you, so
 *   coming out of the grass you always have one step to read and answer.
 * - **The enrage** (the clock's last fifteen seconds) is every hunter near you
 *   knowing where you are, giving up nowhere, at twice your pace.
 *
 * Everything a hunter is, is here and nowhere else: the scene keeps no second
 * copy of where one stands. The pack rides on the run session, so it is the
 * same pack after a fight.
 */

/** A walked tile: a hunter after you is exactly as fast as you on foot. */
export const HUNTER_CHASE_STEP_MS = STEP_DURATION_MS;
/** The clock's last fifteen seconds: twice your pace, as the step-locked hunter was. */
export const HUNTER_ENRAGED_STEP_MS = STEP_DURATION_MS / HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP;
/** A stroll round its patch: slow enough to read, and to slip past behind. */
export const HUNTER_PATROL_STEP_MS = 330;
/** How deep its cone of sight reaches, in tiles - inside half a screen's height, so it is on screen when it sees you. */
export const HUNTER_SIGHT_STEPS = 7;
/** How far it sees you once it is after you, all round: it is looking at you now. */
export const HUNTER_CHASE_SIGHT_STEPS = 12;
/**
 * How long it keeps track of you after you go out of sight - it saw which way
 * you went. One corner is never enough; a run of them, a door, the grass is.
 */
export const HUNTER_TRACK_MS = 750;
/** How near it hears you whichever way it faces. */
export const HUNTER_HEARING_STEPS = 2;
/** How near it sees you while you stand in tall grass. */
export const HUNTER_GRASS_SIGHT_STEPS = 2;
/** The "!" beat between being seen and being run at - three of your steps. */
export const HUNTER_ALERT_MS = 400;
/** How long it stands where it lost you, looking about, before it gives up. */
export const HUNTER_SEARCH_LOOK_MS = 1_500;
/** How long it pauses at each corner of its patrol to look round. */
export const HUNTER_PATROL_PAUSE_MS = 700;
/** Right on your tail: within this many steps it follows you out of its patch. */
export const HUNTER_TAIL_STEPS = 4;
/** How many straight tiles at full pace make a turn into something solid a snag. */
export const HUNTER_SNAG_MOMENTUM = 3;
/** The time a snag costs it: one tile. */
export const HUNTER_SNAG_MS = HUNTER_CHASE_STEP_MS;
/** How many tiles it runs after a snag before it can snag again. */
export const HUNTER_SNAG_COOLDOWN = 6;
/** How much ground a hunter after you takes while you fight something else. */
export const HUNTER_FIGHT_CATCH_UP_STEPS = 2;
/** The furthest a chase is searched, in steps: further than this and it has lost you. */
export const HUNTER_CHASE_LIMIT = 40;
/**
 * The longest walk a patrol or a walk home is searched for: a patch's loop
 * fits in it, and a hunter that has strayed further than this from home has
 * gone a long way round, out of sight, and is simply home.
 */
export const HUNTER_WALK_LIMIT = 160;
/** How far from you a hunter is still walked at all; further off it holds where it is, out of sight. */
export const HUNTER_AWAKE_RANGE = 40;
/** How far from you a hunter may come on to the map, so it never arrives in sight. */
export const HUNTER_ARRIVAL_CLEARANCE = 12;
/**
 * How long a hunter that has come for you (`comeFor`) knows where you are, round
 * corners and out of its patch: a hundred and twenty of your steps. After that it
 * hunts by eye like any other, so it can be shaken.
 */
export const HUNTER_COME_FOR_MS = 18_000;
/** How far off, in your steps, a hunter comes from when it comes for you: on the way, and not yet in sight. */
const COME_FOR_LEAST_STEPS = 14;
const COME_FOR_MOST_STEPS = 22;
/** The smallest district that is a hunter's patch, in tiles across and down. */
export const HUNTER_GROUND_MIN_SIDE = 32;

export interface GroundRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A hunter's patch: where it walks and what it will not chase you out of. */
export interface HunterGround {
  readonly id: string;
  readonly name: string;
  readonly rects: readonly GroundRect[];
  /** Where it stands when it is home; the first corner of its loop. */
  readonly post: GridPosition;
  /** The loop it walks, post first. */
  readonly route: readonly GridPosition[];
}

export type HunterMode =
  /** Not on the map yet: hunters come out once the raid's grace is up. */
  | 'waiting'
  | 'patrol'
  /** Saw you: the "!" beat. */
  | 'alerted'
  | 'chase'
  /** Lost you: standing where it last saw you, looking about. */
  | 'search'
  /** Walking home. */
  | 'return'
  /** Fled from: blind and solid for the search window (`HUNTER_SEARCH_MS`). */
  | 'stunned'
  | 'beaten';

export interface PackHunter {
  readonly id: string;
  readonly rivalId: HunterRivalId;
  readonly ground: HunterGround;
  mode: HunterMode;
  /** The tile it stands on, or the tile it is stepping from. */
  position: GridPosition;
  /** The tile it is stepping into, or null at rest. */
  next: GridPosition | null;
  /** How far into the step, in ms, and how long the step takes. */
  stepMs: number;
  stepDuration: number;
  facing: Direction;
  /** What is left of a beat: the "!", a look, a snag, a pause, the stun. */
  timerMs: number;
  /** The last tile it saw you on. */
  lastSeen: GridPosition | null;
  /** Its loop: which corner it is walking to. */
  routeIndex: number;
  /**
   * The walk it is on to a corner of its loop or home, tile by tile, so a long
   * walk is searched once rather than once a tile.
   */
  path: GridPosition[];
  /** Straight tiles at full pace, and tiles since the last snag. */
  straight: number;
  sinceSnag: number;
  /** Whether the current beat is a snag (drawn as a stumble). */
  snagged: boolean;
  /** Steps it has taken, so a walk alternates its feet. */
  strides: number;
  /** Walking steps to you when it last looked for a route, or null. */
  gap: number | null;
  /** Whether it could see you (or still knew where you went) the last time it looked. */
  sees: boolean;
  /** The pack's clock when it last saw you. */
  seenAtMs: number;
  /** How many quarter-turns it has looked about since it lost you. */
  looks: number;
  /** Whether it is out for the enrage (twice your pace, never gives up). */
  enraged: boolean;
  /** The pack's clock until which it knows where you are, having come for you (`comeFor`). */
  comingUntilMs?: number;
}

export type PackEvent =
  | { readonly kind: 'noticed'; readonly hunter: PackHunter }
  | { readonly kind: 'snagged'; readonly hunter: PackHunter }
  | { readonly kind: 'gave-up'; readonly hunter: PackHunter }
  | { readonly kind: 'caught'; readonly hunter: PackHunter };

/** What the pack reads of the world on a frame. Indexes are `y * width + x`. */
export interface PackWorld {
  readonly width: number;
  readonly height: number;
  readonly links?: GridLinks;
  /** Ground and every figure except the hunters, which the pack adds itself. */
  readonly blocked: (index: number) => boolean;
  /** Whether a tile stops sight: a wall, a tree, a cliff - never water or a fence. */
  readonly opaque: (index: number) => boolean;
  /** The tile the player stands on, or is stepping from. */
  readonly player: GridPosition;
  /** Where the player is going: the tile being stepped into, else `player`. */
  readonly heading: GridPosition;
  readonly playerMoving: boolean;
  readonly playerInGrass: boolean;
  /** Under a roof that hides them, or across the water. */
  readonly playerHidden: boolean;
  /** Whether two tiles are in the same place (the outdoors, one room, one cave floor). */
  readonly samePlace: (a: GridPosition, b: GridPosition) => boolean;
  readonly enraged: boolean;
}

const UNREACHED = -1;

export const isTouching = (a: GridPosition, b: GridPosition): boolean =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;

const same = (a: GridPosition, b: GridPosition): boolean => a.x === b.x && a.y === b.y;

export const inGround = (ground: HunterGround, tile: GridPosition): boolean =>
  ground.rects.some(
    (rect) => tile.x >= rect.x && tile.y >= rect.y && tile.x < rect.x + rect.width && tile.y < rect.y + rect.height,
  );

/**
 * The patches a map's hunters keep. A patch is a district at least
 * `HUNTER_GROUND_MIN_SIDE` tiles each way that no bigger district holds -
 * Greystone Vale's nineteen 64-tile districts, not the named places inside
 * them - because a hunter needs ground bigger than a screen to have a place at
 * all. A map with none is one patch, its outdoors.
 */
export function huntingGrounds(input: {
  readonly width: number;
  readonly height: number;
  readonly collision: readonly (readonly boolean[])[];
  readonly links?: GridLinks;
  readonly outdoors: GroundRect;
  readonly districts: readonly { readonly id: string; readonly name: string; readonly areas: readonly GroundRect[] }[];
  /** Tiles a hunter should never stop on: landings and ways out. */
  readonly keepClear: readonly GridPosition[];
  /**
   * Whoever stands on the map for good, every tile of their beat: never a corner
   * of a loop, and what they stand in front of - a boulder in a lane - is not a
   * part of the one walk a loop has to be.
   */
  readonly standing?: readonly GridPosition[];
}): readonly HunterGround[] {
  const contains = (outer: GroundRect, inner: GroundRect): boolean =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
  const insideOutdoors = (rect: GroundRect): boolean => contains(input.outdoors, rect);
  const big = input.districts.filter(
    (district) =>
      district.areas.length > 0 &&
      district.areas.every(insideOutdoors) &&
      district.areas.some((rect) => rect.width >= HUNTER_GROUND_MIN_SIDE && rect.height >= HUNTER_GROUND_MIN_SIDE),
  );
  const top = big.filter(
    (district) =>
      !big.some(
        (other) => other !== district && district.areas.every((rect) => other.areas.some((outer) => contains(outer, rect))),
      ),
  );
  const patches = top.length > 0 ? top : [{ id: 'outdoors', name: 'THE OUTDOORS', areas: [input.outdoors] }];
  return patches.flatMap((patch) => {
    const ground = planGround(patch.id, patch.name, patch.areas, input);
    return ground ? [ground] : [];
  });
}

/**
 * A patch's post and loop: the walkable tile nearest the middle of the patch
 * and of each of its quarters, on the patch's biggest stretch of open ground,
 * kept off every landing and way out. Walked post, then the quarters in turn.
 */
function planGround(
  id: string,
  name: string,
  rects: readonly GroundRect[],
  input: Parameters<typeof huntingGrounds>[0],
): HunterGround | null {
  const { width } = input;
  const stoodOn = new Set((input.standing ?? []).map((tile) => tile.y * width + tile.x));
  const open = (x: number, y: number): boolean =>
    input.collision[y]?.[x] === false && !stoodOn.has(y * width + x);
  const inside = (x: number, y: number): boolean =>
    rects.some((rect) => x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height);
  const clear = new Set(input.keepClear.map((tile) => tile.y * width + tile.x));
  const nearClear = (x: number, y: number): boolean =>
    input.keepClear.some((tile) => Math.abs(tile.x - x) + Math.abs(tile.y - y) <= 3);
  // The patch's biggest piece of open ground, so its loop is one walk.
  const component = new Map<number, number>();
  let best: number[] = [];
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        const start = y * width + x;
        if (!open(x, y) || component.has(start)) {
          continue;
        }
        const piece = [start];
        component.set(start, start);
        for (let head = 0; head < piece.length; head += 1) {
          const here = piece[head];
          const hx = here % width;
          const hy = (here / width) | 0;
          for (const direction of STEP_DIRECTIONS) {
            const nx = hx + DIRECTION_DELTAS[direction].x;
            const ny = hy + DIRECTION_DELTAS[direction].y;
            const index = ny * width + nx;
            if (!inside(nx, ny) || !open(nx, ny) || component.has(index)) {
              continue;
            }
            component.set(index, start);
            piece.push(index);
          }
        }
        if (piece.length > best.length) {
          best = piece;
        }
      }
    }
  }
  if (best.length === 0) {
    return null;
  }
  const clearOfEverything = best.filter((index) => !clear.has(index) && !nearClear(index % width, (index / width) | 0));
  const pool = clearOfEverything.length > 0 ? clearOfEverything : best;
  const nearest = (tx: number, ty: number): GridPosition => {
    let found = pool[0];
    let foundDistance = Number.POSITIVE_INFINITY;
    for (const index of pool) {
      const distance = Math.abs((index % width) - tx) + Math.abs(((index / width) | 0) - ty);
      if (distance < foundDistance) {
        found = index;
        foundDistance = distance;
      }
    }
    return { x: found % width, y: (found / width) | 0 };
  };
  const frame = rects.reduce((widest, rect) => (rect.width * rect.height > widest.width * widest.height ? rect : widest));
  const at = (fx: number, fy: number): GridPosition =>
    nearest(Math.round(frame.x + frame.width * fx), Math.round(frame.y + frame.height * fy));
  const corners = [at(0.5, 0.5), at(0.25, 0.25), at(0.75, 0.25), at(0.75, 0.75), at(0.25, 0.75)];
  const route = corners.filter((tile, index) => corners.findIndex((other) => same(other, tile)) === index);
  return { id, name, rects, post: route[0], route };
}

/**
 * Which rival keeps which patch: the raid's own rival where the raid lands,
 * and the five turn about across the map so no two patches side by side share
 * a face (`(x + 2y) mod 5` over 64-tile cells is a colouring of a grid where
 * every neighbour, diagonals too, differs).
 */
export function rivalsForGrounds(
  grounds: readonly HunterGround[],
  raidRival: HunterRivalId,
  landing: GridPosition,
): readonly HunterRivalId[] {
  const colour = (tile: GridPosition): number => Math.floor(tile.x / 64) + 2 * Math.floor(tile.y / 64);
  const home = grounds.find((ground) => inGround(ground, landing));
  const base = HUNTER_RIVALS.findIndex((rival) => rival.id === raidRival);
  const offset = home ? colour(home.post) : 0;
  const count = HUNTER_RIVALS.length;
  return grounds.map((ground) => HUNTER_RIVALS[(((base + colour(ground.post) - offset) % count) + count) % count].id);
}

export function createHunterPack(grounds: readonly HunterGround[], rivals: readonly HunterRivalId[]): PackHunter[] {
  return grounds.map((ground, index) => ({
    id: `hunter:${ground.id}`,
    rivalId: rivals[index],
    ground,
    mode: 'waiting',
    position: { ...ground.post },
    next: null,
    stepMs: 0,
    stepDuration: HUNTER_PATROL_STEP_MS,
    facing: 'down',
    timerMs: 0,
    lastSeen: null,
    routeIndex: 0,
    path: [],
    straight: 0,
    sinceSnag: HUNTER_SNAG_COOLDOWN,
    snagged: false,
    strides: 0,
    gap: null,
    sees: false,
    seenAtMs: Number.NEGATIVE_INFINITY,
    looks: 0,
    enraged: false,
  }));
}

/** Whether a hunter is on the map and could be met: standing, not beaten, not still to come. */
export const isAbroad = (hunter: PackHunter): boolean => hunter.mode !== 'waiting' && hunter.mode !== 'beaten';

/** Whether a hunter is after you: the "!", the run, the enrage. */
export const isAfterYou = (hunter: PackHunter): boolean =>
  hunter.mode === 'alerted' || hunter.mode === 'chase';

/** The tiles a hunter holds: where it stands, and where it is stepping. */
export const heldTiles = (hunter: PackHunter): readonly GridPosition[] =>
  !isAbroad(hunter) ? [] : hunter.next ? [hunter.position, hunter.next] : [hunter.position];

/** Where to draw a hunter, in fractional tiles, and whether it is mid-stride. */
export function drawnAt(hunter: PackHunter): { readonly x: number; readonly y: number; readonly striding: boolean } {
  if (!hunter.next) {
    return { x: hunter.position.x, y: hunter.position.y, striding: false };
  }
  const through = Math.min(1, hunter.stepMs / hunter.stepDuration);
  // A step through a door is a jump to the far side, as the player's is.
  if (!isTouching(hunter.position, hunter.next)) {
    return { x: hunter.next.x, y: hunter.next.y, striding: false };
  }
  return {
    x: hunter.position.x + (hunter.next.x - hunter.position.x) * through,
    y: hunter.position.y + (hunter.next.y - hunter.position.y) * through,
    striding: through < 0.5,
  };
}

/**
 * Whether a hunter standing at `from` facing `facing` sees the player at
 * `to`. Within hearing it sees you whichever way it faces; past it, only in
 * the quarter-turn cone ahead (as far to the side as ahead), and only
 * `HUNTER_SIGHT_STEPS` deep. A chasing hunter is looking at you, so it sees
 * all round. Nothing solid may stand on the line between, and tall grass
 * hides you past `HUNTER_GRASS_SIGHT_STEPS`.
 */
export function canSee(
  from: GridPosition,
  facing: Direction,
  to: GridPosition,
  world: Pick<PackWorld, 'width' | 'opaque' | 'playerInGrass' | 'playerHidden' | 'samePlace'>,
  allRound: boolean,
): boolean {
  if (world.playerHidden || !world.samePlace(from, to)) {
    return false;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const squared = dx * dx + dy * dy;
  const range = allRound ? HUNTER_CHASE_SIGHT_STEPS : HUNTER_SIGHT_STEPS;
  if (squared > range * range) {
    return false;
  }
  if (world.playerInGrass && squared > HUNTER_GRASS_SIGHT_STEPS * HUNTER_GRASS_SIGHT_STEPS) {
    return false;
  }
  if (!allRound && squared > HUNTER_HEARING_STEPS * HUNTER_HEARING_STEPS) {
    const ahead = DIRECTION_DELTAS[facing];
    const forward = dx * ahead.x + dy * ahead.y;
    const aside = Math.abs(dx * ahead.y - dy * ahead.x);
    if (forward <= 0 || aside > forward) {
      return false;
    }
  }
  return clearLine(from, to, world);
}

/** Every tile strictly between two tiles on a straight line is see-through. */
function clearLine(from: GridPosition, to: GridPosition, world: Pick<PackWorld, 'width' | 'opaque'>): boolean {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = -Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    if (x === to.x && y === to.y) {
      return true;
    }
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
    if ((x !== to.x || y !== to.y) && world.opaque(y * world.width + x)) {
      return false;
    }
  }
}

/**
 * The searches, with their working arrays kept between calls: a chase asks
 * one every tile, and a fresh map-sized array each time is garbage the frame
 * pays for. A stamp per tile says whether this search has reached it yet.
 */
class PackSearch {
  private stamp = new Int32Array(0);
  private distance = new Int32Array(0);
  private queue = new Int32Array(0);
  private generation = 0;

  private ready(size: number): void {
    if (this.stamp.length !== size) {
      this.stamp = new Int32Array(size);
      this.distance = new Int32Array(size);
      this.queue = new Int32Array(size);
      this.generation = 0;
    }
    this.generation += 1;
  }

  /**
   * The first step of the shortest walk from `from` to any of `goals`, within
   * `limit` steps, and the length of that walk; null when there is none.
   * Equal walks go the long way of the chase first, so it runs at you rather
   * than bobbing between the two axes.
   */
  firstStep(
    world: PackWorld,
    blocked: (index: number) => boolean,
    from: GridPosition,
    goals: readonly GridPosition[],
    towards: GridPosition,
    limit: number,
  ): { readonly step: GridPosition | null; readonly length: number } | null {
    const { width, height } = world;
    this.ready(width * height);
    const generation = this.generation;
    const start = from.y * width + from.x;
    let tail = 0;
    for (const goal of goals) {
      if (goal.x < 0 || goal.y < 0 || goal.x >= width || goal.y >= height) {
        continue;
      }
      const index = goal.y * width + goal.x;
      if (this.stamp[index] === generation || (index !== start && blocked(index))) {
        continue;
      }
      this.stamp[index] = generation;
      this.distance[index] = 0;
      this.queue[tail] = index;
      tail += 1;
    }
    for (let head = 0; head < tail && this.stamp[start] !== generation; head += 1) {
      const here = this.queue[head];
      const reached = this.distance[here] + 1;
      if (reached > limit) {
        break;
      }
      for (let direction = 0; direction < 4; direction += 1) {
        const index = this.stepFrom(world, here, direction);
        if (index === UNREACHED || this.stamp[index] === generation || (index !== start && blocked(index))) {
          continue;
        }
        this.stamp[index] = generation;
        this.distance[index] = reached;
        this.queue[tail] = index;
        tail += 1;
      }
    }
    if (this.stamp[start] !== generation) {
      return null;
    }
    const length = this.distance[start];
    if (length === 0) {
      return { step: null, length };
    }
    let chosen = UNREACHED;
    let chosenRank = Number.POSITIVE_INFINITY;
    for (let direction = 0; direction < 4; direction += 1) {
      const index = this.stepFrom(world, start, direction);
      if (index === UNREACHED || this.stamp[index] !== generation || this.distance[index] !== length - 1 || blocked(index)) {
        continue;
      }
      const rank = preference(from, { x: index % width, y: (index / width) | 0 }, towards) * 4 + direction;
      if (rank < chosenRank) {
        chosen = index;
        chosenRank = rank;
      }
    }
    return chosen === UNREACHED ? null : { step: { x: chosen % width, y: (chosen / width) | 0 }, length };
  }

  /**
   * The whole of the shortest walk from `from` to `goal`, within `limit`
   * steps, first step first; null when there is none.
   */
  route(
    world: PackWorld,
    blocked: (index: number) => boolean,
    from: GridPosition,
    goal: GridPosition,
    limit: number,
  ): GridPosition[] | null {
    const first = this.firstStep(world, blocked, from, [goal], goal, limit);
    if (!first) {
      return null;
    }
    const { width } = world;
    const walk: GridPosition[] = [];
    let here = from.y * width + from.x;
    for (let left = first.length; left > 0; left -= 1) {
      let chosen = UNREACHED;
      let chosenRank = Number.POSITIVE_INFINITY;
      const at = { x: here % width, y: (here / width) | 0 };
      for (let direction = 0; direction < 4; direction += 1) {
        const index = this.stepFrom(world, here, direction);
        if (index === UNREACHED || this.stamp[index] !== this.generation || this.distance[index] !== left - 1) {
          continue;
        }
        const rank = preference(at, { x: index % width, y: (index / width) | 0 }, goal) * 4 + direction;
        if (rank < chosenRank) {
          chosen = index;
          chosenRank = rank;
        }
      }
      if (chosen === UNREACHED) {
        return null;
      }
      walk.push({ x: chosen % width, y: (chosen / width) | 0 });
      here = chosen;
    }
    return walk;
  }

  /**
   * The tile one step from `index`. A door is walked as the player walks it,
   * and searching outwards from the goals walks it backwards, which is the
   * same door: the searched links only ever go both ways (`searchedLinks`).
   */
  private stepFrom(world: PackWorld, index: number, direction: number): number {
    const through = world.links?.get(linkKey(index, direction));
    if (through !== undefined) {
      return through;
    }
    const x = (index % world.width) + DIRECTION_DELTAS[STEP_DIRECTIONS[direction]].x;
    const y = ((index / world.width) | 0) + DIRECTION_DELTAS[STEP_DIRECTIONS[direction]].y;
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) {
      return UNREACHED;
    }
    return y * world.width + x;
  }
}

/** Rank of a step for breaking ties between equal walks: towards first, along the long axis first. */
function preference(from: GridPosition, to: GridPosition, target: GridPosition): number {
  const towardsX = target.x - from.x;
  const towardsY = target.y - from.y;
  const alongX = to.x !== from.x;
  const towards = alongX ? Math.sign(to.x - from.x) === Math.sign(towardsX) : Math.sign(to.y - from.y) === Math.sign(towardsY);
  const longAxis = alongX === Math.abs(towardsX) >= Math.abs(towardsY);
  return (towards ? 0 : 2) + (longAxis ? 0 : 1);
}

const contactGoals = (tile: GridPosition): GridPosition[] => [
  { x: tile.x, y: tile.y - 1 },
  { x: tile.x, y: tile.y + 1 },
  { x: tile.x - 1, y: tile.y },
  { x: tile.x + 1, y: tile.y },
];

const directionOf = (from: GridPosition, to: GridPosition): Direction | null => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    return null;
  }
  return dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
};

/** Where a hunter would look next standing still: a quarter-turn clockwise. */
const LOOK_ROUND: Record<Direction, Direction> = { up: 'right', right: 'down', down: 'left', left: 'up' };

/**
 * The hunters of one raid. Mutable on purpose: it is advanced every frame,
 * and it rides the run session through every fight as one object.
 */
export class HunterPack {
  private readonly search = new PackSearch();
  readonly hunters: PackHunter[];
  /** The pack's own clock: every ms it has been advanced. */
  private clockMs = 0;
  /** The hunter whose fight is under way, so the world can settle it when the fight hands back. */
  engagedId: string | null = null;
  /** Whether the hunters have come out yet, so their arrival is announced once. */
  cameOut = false;
  /** Whether the enrage has brought a beaten keeper back yet: it does so once. */
  enrageAnswered = false;

  constructor(hunters: PackHunter[]) {
    this.hunters = hunters;
  }

  /** The hunter holding a tile, if any. */
  hunterAt(tile: GridPosition): PackHunter | undefined {
    return this.hunters.find((hunter) => heldTiles(hunter).some((held) => same(held, tile)));
  }

  /** Whether any hunter is still to come on to the map. */
  waiting(): boolean {
    return this.hunters.some((hunter) => hunter.mode === 'waiting');
  }

  /** The hunter after the player that is nearest them, if any: the one the chip and the glow are about. */
  lead(player: GridPosition): PackHunter | undefined {
    let found: PackHunter | undefined;
    let foundDistance = Number.POSITIVE_INFINITY;
    for (const hunter of this.hunters) {
      if (!isAbroad(hunter) || !(isAfterYou(hunter) || hunter.enraged)) {
        continue;
      }
      const distance = hunter.gap ?? Math.abs(hunter.position.x - player.x) + Math.abs(hunter.position.y - player.y);
      if (distance < foundDistance) {
        found = hunter;
        foundDistance = distance;
      }
    }
    return found;
  }

  /** The hunter that is after the player and standing beside them, at rest. */
  catcher(player: GridPosition): PackHunter | undefined {
    return this.hunters.find(
      (hunter) =>
        isAbroad(hunter) &&
        (hunter.mode === 'chase' || hunter.enraged) &&
        hunter.next === null &&
        isTouching(hunter.position, player),
    );
  }

  /** The hunters on the map, still to come and beaten left out. */
  abroad(): readonly PackHunter[] {
    return this.hunters.filter(isAbroad);
  }

  /**
   * Brings every hunter still to come on to its patch, at the corner of its
   * loop furthest from the player that is at least `HUNTER_ARRIVAL_CLEARANCE`
   * from them, so none ever arrives in sight. Answers whether any came.
   */
  arrive(world: PackWorld): boolean {
    let came = false;
    for (const hunter of this.hunters) {
      if (hunter.mode !== 'waiting') {
        continue;
      }
      const spot = this.clearSpot(hunter, world);
      if (!spot) {
        continue;
      }
      Object.assign(hunter, {
        mode: 'patrol',
        position: { ...spot.tile },
        next: null,
        stepMs: 0,
        timerMs: HUNTER_PATROL_PAUSE_MS,
        routeIndex: (spot.index + 1) % hunter.ground.route.length,
      });
      came = true;
    }
    return came;
  }

  /**
   * One hunter comes for the player: the staged first chase, and the noise of
   * taking a raid's stake (`raidStake.ts`). It is the keeper of the patch they
   * stand in if it is about, else the nearest on the map, and it comes on foot
   * from `COME_FOR_LEAST_STEPS` off or more, out of sight, on the far side of the
   * player from `away` (the way out they would run for), so the run is away from
   * it and never through it. Nothing happens if one is already after them or none
   * is left to come. Answers what the screen should say.
   */
  comeFor(world: PackWorld, away: GridPosition | undefined): PackEvent[] {
    if (this.hunters.some((hunter) => isAbroad(hunter) && isAfterYou(hunter))) {
      return [];
    }
    const distanceTo = (hunter: PackHunter): number =>
      Math.abs(hunter.position.x - world.player.x) + Math.abs(hunter.position.y - world.player.y);
    // One still to come counts: the arrival leaves a keeper home when its whole loop is close by.
    const free = this.hunters.filter((hunter) => hunter.mode !== 'beaten' && hunter.mode !== 'stunned');
    const hunter =
      free.find((candidate) => inGround(candidate.ground, world.player)) ??
      [...free].sort((one, other) => distanceTo(one) - distanceTo(other))[0];
    if (!hunter) {
      return [];
    }
    const tile = this.comingFrom(world, away);
    if (!tile) {
      return [];
    }
    Object.assign(hunter, {
      mode: 'alerted',
      position: tile,
      next: null,
      stepMs: 0,
      timerMs: HUNTER_ALERT_MS,
      lastSeen: { ...world.player },
      seenAtMs: this.clockMs,
      comingUntilMs: this.clockMs + HUNTER_COME_FOR_MS,
      sees: true,
      snagged: false,
      straight: 0,
      looks: 0,
      gap: null,
      path: [],
      facing: directionTowards(tile, world.player, hunter.facing),
    });
    return [{ kind: 'noticed', hunter }];
  }

  /**
   * The tile it comes from: the walk out from the player to the ring, keeping to
   * their own place and off every figure, and of what is out of sight the furthest
   * from `away`. Null where the player is too hemmed in to have one yet.
   */
  private comingFrom(world: PackWorld, away: GridPosition | undefined): GridPosition | null {
    const start = world.player.y * world.width + world.player.x;
    const seen = new Set<number>([start]);
    let frontier = [start];
    let found: GridPosition | null = null;
    let foundFar = Number.NEGATIVE_INFINITY;
    for (let steps = 1; steps <= COME_FOR_MOST_STEPS && frontier.length > 0; steps += 1) {
      const next: number[] = [];
      for (const index of frontier) {
        const x = index % world.width;
        const y = (index / world.width) | 0;
        for (const { x: dx, y: dy } of Object.values(DIRECTION_DELTAS)) {
          const tile = { x: x + dx, y: y + dy };
          if (tile.x < 0 || tile.y < 0 || tile.x >= world.width || tile.y >= world.height) {
            continue;
          }
          const neighbour = tile.y * world.width + tile.x;
          if (seen.has(neighbour) || world.blocked(neighbour) || this.hunterAt(tile) || !world.samePlace(world.player, tile)) {
            continue;
          }
          seen.add(neighbour);
          next.push(neighbour);
          if (steps < COME_FOR_LEAST_STEPS || Math.hypot(tile.x - world.player.x, tile.y - world.player.y) < HUNTER_ARRIVAL_CLEARANCE) {
            continue;
          }
          const far = away ? Math.hypot(tile.x - away.x, tile.y - away.y) : steps;
          if (far > foundFar) {
            found = tile;
            foundFar = far;
          }
        }
      }
      frontier = next;
    }
    return found;
  }

  private clearSpot(hunter: PackHunter, world: PackWorld): { readonly tile: GridPosition; readonly index: number } | null {
    let found: { tile: GridPosition; index: number; far: number } | null = null;
    hunter.ground.route.forEach((tile, index) => {
      const far = Math.hypot(tile.x - world.player.x, tile.y - world.player.y);
      if (far < HUNTER_ARRIVAL_CLEARANCE || this.hunterAt(tile) || world.blocked(tile.y * world.width + tile.x)) {
        return;
      }
      if (!found || far > found.far) {
        found = { tile, index, far };
      }
    });
    return found;
  }

  /**
   * The enrage: every hunter near the player knows where they are, never gives
   * up, and runs at twice their pace. Hunters too far off to matter stay as
   * they are. A hunter beaten before the enrage is not brought back here - the
   * scene brings the one keeper of the patch the player is in back, once.
   */
  enrage(world: PackWorld): void {
    for (const hunter of this.hunters) {
      if (!isAbroad(hunter) || hunter.enraged || hunter.mode === 'stunned') {
        continue;
      }
      if (this.awake(hunter, world)) {
        hunter.enraged = true;
        hunter.mode = 'chase';
        hunter.lastSeen = { ...world.player };
        hunter.timerMs = 0;
      }
    }
  }

  private awake(hunter: PackHunter, world: PackWorld): boolean {
    return (
      Math.max(Math.abs(hunter.position.x - world.player.x), Math.abs(hunter.position.y - world.player.y)) <=
      HUNTER_AWAKE_RANGE
    );
  }

  /**
   * One frame of every hunter. Hunters far from the player hold still - they
   * are off every screen - so the pack costs what the few near it cost.
   */
  advance(world: PackWorld, deltaMs: number): PackEvent[] {
    this.clockMs += deltaMs;
    const events: PackEvent[] = [];
    for (const hunter of this.hunters) {
      if (!isAbroad(hunter) || (!hunter.enraged && !isAfterYou(hunter) && !this.awake(hunter, world))) {
        continue;
      }
      this.advanceHunter(hunter, world, deltaMs, events);
    }
    return events;
  }

  /** Blocked for this hunter: the ground and figures, and every other hunter. */
  private blockerFor(hunter: PackHunter, world: PackWorld): (index: number) => boolean {
    const others = new Set<number>([
      world.player.y * world.width + world.player.x,
      world.heading.y * world.width + world.heading.x,
    ]);
    for (const other of this.hunters) {
      if (other !== hunter) {
        for (const tile of heldTiles(other)) {
          others.add(tile.y * world.width + tile.x);
        }
      }
    }
    return (index) => others.has(index) || world.blocked(index);
  }

  private advanceHunter(hunter: PackHunter, world: PackWorld, deltaMs: number, events: PackEvent[]): void {
    let budget = deltaMs;
    // A frame can hold more than one step (a slow frame, the enrage), but never
    // an unbounded number: a stuck search gives up the frame.
    for (let guard = 0; guard < 8; guard += 1) {
      if (hunter.next) {
        const need = hunter.stepDuration - hunter.stepMs;
        if (budget < need) {
          hunter.stepMs += budget;
          return;
        }
        budget -= need;
        this.arriveAt(hunter, hunter.next);
        if (this.caughtYou(hunter, world)) {
          events.push({ kind: 'caught', hunter });
          return;
        }
      }
      this.look(hunter, world, events);
      if (hunter.timerMs > 0) {
        const spent = Math.min(budget, hunter.timerMs);
        hunter.timerMs -= spent;
        budget -= spent;
        if (hunter.timerMs > 0) {
          return;
        }
        this.endBeat(hunter, world);
        if (this.caughtYou(hunter, world)) {
          events.push({ kind: 'caught', hunter });
          return;
        }
        continue;
      }
      if (!this.chooseStep(hunter, world, events) || budget <= 0) {
        return;
      }
    }
  }

  private arriveAt(hunter: PackHunter, tile: GridPosition): void {
    hunter.position = { ...tile };
    hunter.next = null;
    hunter.stepMs = 0;
    hunter.strides += 1;
  }

  /** A hunter after you, standing beside you while you stand still, has you. */
  private caughtYou(hunter: PackHunter, world: PackWorld): boolean {
    return (hunter.mode === 'chase' || hunter.enraged) && !world.playerMoving && isTouching(hunter.position, world.player);
  }

  /** What it sees from where it stands, and what it does about it. */
  private look(hunter: PackHunter, world: PackWorld, events: PackEvent[]): void {
    if (hunter.mode === 'stunned') {
      hunter.sees = false;
      return;
    }
    if (hunter.enraged) {
      hunter.sees = true;
      hunter.lastSeen = { ...world.player };
      return;
    }
    // On its way home through somebody else's patch it is not looking.
    if (hunter.mode === 'return' && !inGround(hunter.ground, hunter.position)) {
      hunter.sees = false;
      return;
    }
    const chasing = hunter.mode === 'chase' || hunter.mode === 'alerted';
    // It came for you: it knows where you are for a while yet, unless you are under a roof.
    if (chasing && this.isComing(hunter) && !world.playerHidden) {
      hunter.sees = true;
      hunter.seenAtMs = this.clockMs;
      hunter.lastSeen = { ...world.player };
      return;
    }
    // Where it lost you it is looking hard, all round.
    const seen = canSee(hunter.position, hunter.facing, world.player, world, chasing || hunter.mode === 'search');
    if (seen) {
      hunter.seenAtMs = this.clockMs;
    }
    // Just out of sight it still knows which way you went.
    hunter.sees = seen || (chasing && !world.playerHidden && this.clockMs - hunter.seenAtMs <= HUNTER_TRACK_MS);
    if (!hunter.sees) {
      return;
    }
    hunter.lastSeen = { ...world.player };
    if (!chasing) {
      hunter.mode = 'alerted';
      hunter.timerMs = HUNTER_ALERT_MS;
      hunter.snagged = false;
      hunter.facing = directionTowards(hunter.position, world.player, hunter.facing);
      events.push({ kind: 'noticed', hunter });
    }
  }

  /** A beat is over: the "!" turns into the run, a look into the walk home. */
  private endBeat(hunter: PackHunter, world: PackWorld): void {
    hunter.snagged = false;
    switch (hunter.mode) {
      case 'alerted':
        hunter.mode = 'chase';
        hunter.straight = 0;
        return;
      case 'search':
        // The next quarter-turn is chosen with the next step.
        return;
      case 'stunned':
        hunter.mode = 'return';
        hunter.lastSeen = null;
        return;
      default:
        void world;
    }
  }

  /** Picks the next tile and starts the step; false when it is standing still this frame. */
  private chooseStep(hunter: PackHunter, world: PackWorld, events: PackEvent[]): boolean {
    switch (hunter.mode) {
      case 'chase':
        return this.chaseStep(hunter, world, events);
      case 'patrol':
        return this.patrolStep(hunter, world);
      case 'return':
        return this.returnStep(hunter, world);
      case 'search':
        // Looking about where it lost you, a quarter-turn at a time, and then home.
        if (hunter.looks >= 3) {
          hunter.mode = 'return';
          hunter.lastSeen = null;
          events.push({ kind: 'gave-up', hunter });
          return true;
        }
        hunter.facing = LOOK_ROUND[hunter.facing];
        hunter.looks += 1;
        hunter.timerMs = HUNTER_SEARCH_LOOK_MS / 3;
        return true;
      default:
        return false;
    }
  }

  private isComing(hunter: PackHunter): boolean {
    return this.clockMs < (hunter.comingUntilMs ?? 0);
  }

  private chaseStep(hunter: PackHunter, world: PackWorld, events: PackEvent[]): boolean {
    // Where you are, never where you are stepping: a hunter behind you in a
    // lane can only ever reach the tile you are leaving.
    const target = hunter.lastSeen ?? world.player;
    const blocked = this.blockerFor(hunter, world);
    const route = this.search.firstStep(world, blocked, hunter.position, contactGoals(target), target, HUNTER_CHASE_LIMIT);
    const seesYou = hunter.enraged || hunter.sees;
    hunter.gap = route && seesYou ? route.length : null;
    if (!hunter.enraged) {
      const outOfPatch = !inGround(hunter.ground, world.player);
      const hunterOut = !inGround(hunter.ground, hunter.position);
      // Out of its patch, and you are not right on its nose: it lets you go.
      if (
        !route ||
        (seesYou && outOfPatch && route.length > HUNTER_TAIL_STEPS && !this.isComing(hunter)) ||
        (!seesYou && hunterOut)
      ) {
        this.giveUp(hunter, events, !seesYou && !hunterOut && route !== null);
        return true;
      }
    } else if (!route) {
      return false;
    }
    if (!route.step) {
      // Beside the tile it last saw you on and you are not there: it looks about.
      if (!seesYou) {
        this.giveUp(hunter, events, true);
        return true;
      }
      return false;
    }
    const direction = directionOf(hunter.position, route.step);
    // The snag: running flat out into something solid and having to turn.
    if (
      direction &&
      !hunter.enraged &&
      direction !== hunter.facing &&
      hunter.straight >= HUNTER_SNAG_MOMENTUM &&
      hunter.sinceSnag >= HUNTER_SNAG_COOLDOWN &&
      this.solidAhead(hunter, world)
    ) {
      hunter.facing = direction;
      hunter.straight = 0;
      hunter.sinceSnag = 0;
      hunter.snagged = true;
      hunter.timerMs = HUNTER_SNAG_MS;
      events.push({ kind: 'snagged', hunter });
      return true;
    }
    hunter.straight = direction && direction === hunter.facing ? hunter.straight + 1 : 1;
    hunter.sinceSnag += 1;
    this.beginStep(hunter, route.step, hunter.enraged ? HUNTER_ENRAGED_STEP_MS : HUNTER_CHASE_STEP_MS, direction);
    return true;
  }

  /** Whether the tile straight ahead of a hunter is something it would run into. */
  private solidAhead(hunter: PackHunter, world: PackWorld): boolean {
    const ahead = DIRECTION_DELTAS[hunter.facing];
    const x = hunter.position.x + ahead.x;
    const y = hunter.position.y + ahead.y;
    return x < 0 || y < 0 || x >= world.width || y >= world.height || world.blocked(y * world.width + x);
  }

  /** It has lost you: where it last saw you it looks about first, otherwise it goes straight home. */
  private giveUp(hunter: PackHunter, events: PackEvent[], lookFirst: boolean): void {
    hunter.straight = 0;
    hunter.gap = null;
    if (lookFirst) {
      hunter.mode = 'search';
      hunter.looks = 0;
      hunter.timerMs = HUNTER_SEARCH_LOOK_MS / 3;
      return;
    }
    hunter.mode = 'return';
    hunter.lastSeen = null;
    events.push({ kind: 'gave-up', hunter });
  }

  private patrolStep(hunter: PackHunter, world: PackWorld): boolean {
    const route = hunter.ground.route;
    const corner = route[hunter.routeIndex % route.length];
    if (same(corner, hunter.position)) {
      hunter.routeIndex = (hunter.routeIndex + 1) % route.length;
      hunter.facing = LOOK_ROUND[hunter.facing];
      hunter.timerMs = HUNTER_PATROL_PAUSE_MS;
      hunter.path = [];
      return true;
    }
    const blocked = this.blockerFor(hunter, world);
    const step = this.walkOn(hunter, world, blocked, corner, (index) =>
      inGround(hunter.ground, { x: index % world.width, y: (index / world.width) | 0 }),
    );
    if (!step) {
      // Something stands in its way (another hunter, a boulder): the next corner.
      hunter.routeIndex = (hunter.routeIndex + 1) % route.length;
      hunter.timerMs = HUNTER_PATROL_PAUSE_MS;
      hunter.path = [];
      return true;
    }
    this.beginStep(hunter, step, HUNTER_PATROL_STEP_MS, directionOf(hunter.position, step));
    return true;
  }

  private returnStep(hunter: PackHunter, world: PackWorld): boolean {
    if (inGround(hunter.ground, hunter.position)) {
      hunter.mode = 'patrol';
      hunter.lastSeen = null;
      hunter.path = [];
      // Back on its loop from the corner nearest where it got back to.
      const route = hunter.ground.route;
      let nearest = 0;
      route.forEach((tile, index) => {
        const best = route[nearest];
        if (
          Math.abs(tile.x - hunter.position.x) + Math.abs(tile.y - hunter.position.y) <
          Math.abs(best.x - hunter.position.x) + Math.abs(best.y - hunter.position.y)
        ) {
          nearest = index;
        }
      });
      hunter.routeIndex = nearest;
      return this.patrolStep(hunter, world);
    }
    const step = this.walkOn(hunter, world, this.blockerFor(hunter, world), hunter.ground.post, () => true);
    if (!step) {
      // No walk home from here (a one-way ledge, a shut gate): it goes the
      // long way, out of sight, which is to say it is simply home.
      hunter.position = { ...hunter.ground.post };
      hunter.mode = 'patrol';
      hunter.path = [];
      hunter.timerMs = HUNTER_PATROL_PAUSE_MS;
      return true;
    }
    this.beginStep(hunter, step, HUNTER_PATROL_STEP_MS, directionOf(hunter.position, step));
    return true;
  }

  /**
   * The next tile of a walk to `goal` over ground `allowed` says it may use:
   * the walk already planned while its next tile is clear, else a new one.
   */
  private walkOn(
    hunter: PackHunter,
    world: PackWorld,
    blocked: (index: number) => boolean,
    goal: GridPosition,
    allowed: (index: number) => boolean,
  ): GridPosition | null {
    const planned = hunter.path[0];
    const last = hunter.path[hunter.path.length - 1];
    if (
      planned &&
      last &&
      same(last, goal) &&
      isTouching(planned, hunter.position) &&
      !blocked(planned.y * world.width + planned.x)
    ) {
      return hunter.path.shift() ?? null;
    }
    const walk = this.search.route(world, (index) => blocked(index) || !allowed(index), hunter.position, goal, HUNTER_WALK_LIMIT);
    if (!walk || walk.length === 0) {
      hunter.path = [];
      return null;
    }
    hunter.path = walk;
    return hunter.path.shift() ?? null;
  }

  private beginStep(hunter: PackHunter, tile: GridPosition, duration: number, direction: Direction | null): void {
    hunter.next = { ...tile };
    hunter.stepMs = 0;
    hunter.stepDuration = duration;
    if (direction) {
      hunter.facing = direction;
    }
  }

  /**
   * A fight the hunters were not in, over: every hunter that was after the
   * player heard it and knows where they are, and comes on up to
   * `HUNTER_FIGHT_CATCH_UP_STEPS` - but never into touching distance, so the
   * player always comes out of the grass with a step to read the board.
   */
  afterFight(world: PackWorld, except?: PackHunter): void {
    for (const hunter of this.hunters) {
      if (hunter === except || !isAbroad(hunter) || !(isAfterYou(hunter) || hunter.mode === 'search' || hunter.enraged)) {
        continue;
      }
      if (hunter.next) {
        this.arriveAt(hunter, hunter.next);
      }
      hunter.mode = 'chase';
      hunter.timerMs = 0;
      hunter.snagged = false;
      hunter.lastSeen = { ...world.player };
      const blocked = this.blockerFor(hunter, world);
      for (let step = 0; step < HUNTER_FIGHT_CATCH_UP_STEPS; step += 1) {
        const route = this.search.firstStep(world, blocked, hunter.position, contactGoals(world.player), world.player, HUNTER_CHASE_LIMIT);
        if (!route || !route.step || route.length <= 1) {
          break;
        }
        hunter.facing = directionOf(hunter.position, route.step) ?? hunter.facing;
        hunter.position = { ...route.step };
      }
      hunter.facing = directionTowards(hunter.position, world.player, hunter.facing);
      hunter.straight = 0;
    }
  }

  /**
   * The hunter the player fled from: thrown back to `fallback` (chosen by the
   * scene, which knows the exits) and blind and solid for `searchMs`, after
   * which it walks home - it has to see you again to come back for you.
   */
  fledFrom(hunter: PackHunter, fallback: GridPosition, searchMs: number): void {
    Object.assign(hunter, {
      mode: 'stunned',
      position: { ...fallback },
      next: null,
      stepMs: 0,
      timerMs: searchMs,
      lastSeen: null,
      snagged: false,
      straight: 0,
      gap: null,
      sees: false,
      enraged: false,
    });
  }

  beaten(hunter: PackHunter): void {
    hunter.mode = 'beaten';
    hunter.next = null;
    hunter.gap = null;
  }

  /** A beaten keeper brought back for the enrage, standing at `tile`, after you. */
  returnForEnrage(hunter: PackHunter, tile: GridPosition, world: PackWorld): void {
    Object.assign(hunter, {
      mode: 'chase',
      position: { ...tile },
      next: null,
      stepMs: 0,
      timerMs: 0,
      lastSeen: { ...world.player },
      enraged: true,
      straight: 0,
    });
  }
}

/** The way from one tile to another, along the longer axis; `fallback` when they are the same tile. */
export function directionTowards(from: GridPosition, to: GridPosition, fallback: Direction): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) {
    return fallback;
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}
