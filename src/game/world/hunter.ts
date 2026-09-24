import { Pokemon } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import type { PokemonBase } from '../pokemon/PokemonBase';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import { DIRECTION_DELTAS, type Direction, type GridBounds, type GridPosition } from '../movement/gridMovement';
import type { ActiveRunSession } from '../run/RunSession';
import type { RunResult } from '../run/RunManager';
import type { HunterTuning } from '../run/runGeneration';
import type { WorldMapId } from '../worldMap';
import { FIRST_HUNTER_RIVAL, hunterRival } from './hunters';

export const HUNTER_ID = 'rival-hunter';
export const HUNTER_SPAWN_MS = 60_000;
export const HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP = 2;
/**
 * How far a successful escape throws the hunter back, in walkable tiles.
 *
 * Distance alone is not an escape: the hunter takes one tile per player step, so a
 * pushback only buys room while the player runs in a straight line, and an enraged
 * hunter (two tiles per player step) eats it in exactly this many steps. The gap is
 * what the player has to work with once HUNTER_SEARCH_MS runs out, not the escape.
 */
export const HUNTER_BREAKAWAY_DISTANCE = 6;
/**
 * How long a hunter that lost the trail holds position and cannot engage.
 *
 * Measured in raid time rather than player steps so standing still burns it too:
 * an escape buys a window to reposition or extract, never a safe place to idle.
 *
 * The length is not a feel: it is the walk it has to cover. An escape is bought
 * because the player cannot win the fight, so the least it can promise is the
 * walk to a way out. A tile costs about 0.23s of clock at the rate measured in
 * a headless browser, and the furthest any tile of any map sits from its
 * nearest extraction point is 82 (the Floodplain's fen, since that map grew to
 * 128 tiles square) - nineteen seconds of walking, which the old fifteen did
 * not cover. `hunterFlee.test.ts` recomputes that walk from the maps
 * themselves, so redrawing one that strands a corner fails there rather than in
 * a playtest.
 *
 * Twenty is the ceiling as well as the answer, and that is the point: what a
 * rung of the hunter ladder can spare after an escape has been paid for is
 * sixty seconds less the forty an escape costs, and `raidClock.test.ts` holds
 * the window to it. So a map cannot buy coverage by making the window longer -
 * a vast one buys it by having more doors, which is why the Floodplain has
 * twenty and the small maps have three apiece.
 */
export const HUNTER_SEARCH_MS = 20_000;
export const DEFAULT_HUNTER_TUNING: HunterTuning = {
  spawnDelayMs: HUNTER_SPAWN_MS,
  aggressionStepsPerPlayerStep: 1,
  teamTierOffset: 0,
  rivalId: FIRST_HUNTER_RIVAL,
};

const species = (id: string): PokemonBase => {
  const found = getSpeciesById(id);
  if (!found) {
    throw new Error(`${id} is not one of the 151`);
  }
  return found;
};

/**
 * **The hunter brings one Pokemon for each of yours, and it is easy to beat.**
 *
 * The captain, 2026-09-23: "when you've just got one Pokemon the Hunter should
 * also have one Pokemon ... it should be pretty easy to beat because the NPCs
 * in Escape from Tarkov are pretty easy to beat ... it's the other players
 * that are fairly difficult ... later down the line in single player mode I'll
 * introduce one who's harder to beat and keep everyone else easy."
 *
 * So the ladder is a mirror. The hunter fields as many Pokemon as the player
 * can fight with at the moment it catches them, and pairs them off: its first
 * against your highest-level Pokemon, its second against your next, and so on,
 * each a rung's `levelOffset` below the one it is paired with. A lone starter
 * meets one Pokemon; a veteran with two weak escorts meets one strong Pokemon
 * and two weak ones, never three strong ones.
 *
 * The ladder it replaced grew the team instead - one Pokemon, then two, three
 * and four as the clock ran - and read only the strongest Pokemon deployed, so
 * a lone Lv 5 starter met a Lv 6 Pidgey and won it 1-14% of the time with no
 * Potions, and a lone veteran met four. Both measured below, both gone.
 *
 * Two measured choices, over the real engine on the FireRed base stats
 * (`npx vite-node tools/hunter/measure.mts`, 150 fights a cell, no items, the
 * player throwing its best move each turn; parties of one starter at Lv 5-13,
 * each starter's second stage at 16, a starter with an escort, a trio at
 * Lv 8-10 and a Lv 18 veteran with five Lv 10 escorts):
 *
 * - **The lead is Normal.** A one-Pokemon hunter is one type against one
 *   starter, and a Flying lead is a starter lottery: Pidgey paired a level
 *   under a Lv 10 starter wins against the Charmander and the Squirtle 96-100%
 *   of the time and against the Bulbasaur never, where Rattata is 95-97%
 *   against all three. Rattata, then Jigglypuff and Meowth, cover nobody and
 *   check nobody, and Pidgey, Pikachu and Spearow only arrive in a party big
 *   enough to answer a type.
 * - **Every rung sits below you.** Measured at each offset:
 *
 * | rung            | offset | wins (mean / worst) | HP left on a win |
 * | --------------- | ------ | ------------------- | ---------------- |
 * | 1: 0-120s       | -4     | 100% / 99%          | 79%              |
 * | 2: 120-180s     | -3     | 100% / 99%          | 73%              |
 * | 3: 180-240s     | -2     | 99% / 97%           | 66%              |
 * | 4: 240s-end     | -1     | 96% / 87%           | 57%              |
 * | at your level   | 0      | 83% / 45%           | 47%              |
 * | enraged         | +3     | 31% / 4%            | 33%              |
 *
 * The clock still closes the gap, so staying late still costs - a fifth more
 * of your health by the last minute - but no ordinary rung is a wall. The
 * worst cell of rung 4 is a lone Lv 5 Charmander with an empty pack at 87%,
 * and the three Potions a fresh save deploys with do not move that worst cell
 * but raise the health it keeps. Level 2 is the floor, which is what a Lv 5
 * starter meets on rung 1.
 *
 * **The harder hunter is not built.** It is the `temperament` on a rival in
 * `hunters.ts`: every shipped rival is `ordinary` and fights on this ladder.
 * A `hard` rival would carry its own offsets - the "at your level" row is
 * already the measured start of one - and nothing else here would change.
 */
export const HUNTER_TIERS = [
  { startsAtMs: 0, levelOffset: -4 },
  { startsAtMs: 120_000, levelOffset: -3 },
  { startsAtMs: 180_000, levelOffset: -2 },
  { startsAtMs: 240_000, levelOffset: -1 },
] as const;

/**
 * Who the hunter sends, in order: a team of N is the first N. The first three
 * are Normal for the reason above; the rest arrive only against a party of
 * four or more, which already has the types to meet them.
 */
export const HUNTER_ROSTER: readonly PokemonBase[] = [
  'rattata',
  'jigglypuff',
  'meowth',
  'pidgey',
  'pikachu',
  'spearow',
].map(species);

/** The lowest level the hunter fields, which is what a Lv 5 starter meets on rung 1. */
export const HUNTER_MINIMUM_LEVEL = 2;

/**
 * What the hunter pairs with when it has nobody to read - a party that cannot
 * fight, which a live raid never hands it. A fresh starter's level.
 */
const UNKNOWN_OPPONENT_LEVEL = 5;

/**
 * What lands when the clock runs out, and the one rung that is not easy on
 * purpose: the enrage is the raid telling you it is over, and a reprieve would
 * be no reason to leave. Three levels *above* each of yours wins 31% of the
 * time on the parties above, with a third of the party's health left.
 */
const HUNTER_ENRAGED_TIER = { levelOffset: 3 } as const;

export interface HunterState {
  readonly spawned: boolean;
  readonly defeated: boolean;
  readonly mapId?: WorldMapId;
  readonly position?: GridPosition;
  /** Raid time left before a hunter that lost the trail picks it back up. */
  readonly searchRemainingMs?: number;
  /**
   * The last tile the hunter knew the player on.
   *
   * It exists for one thing: an interior (`interiors.ts`) is roofed, and under
   * a roof the player cannot be seen. The hunter then hunts the tile it last
   * saw them on rather than the tile they are actually standing on, which is
   * why ducking into a cave breaks the trail - and it is *only* that. It is
   * never blinded and never frozen: a frozen figure in a cave mouth would be a
   * wall, and this game's rule is that a figure you may walk into is a price
   * and a figure you may not is never allowed on a door. So it may walk in
   * after you, and it catches you if it reaches you.
   */
  readonly lastSeen?: GridPosition;
  /**
   * Set by an escape in BattleScene and cleared by WorldScene, which is the only
   * place that knows the map well enough to choose where the hunter falls back to.
   */
  readonly pendingBreakaway?: boolean;
}

/** A rung of the ladder: how far below each of yours its Pokemon stand. */
export interface HunterTier {
  readonly levelOffset: number;
}

/** The part of a player's Pokemon the hunter reads. `Pokemon` satisfies it. */
export interface HunterOpponent {
  readonly level: number;
  readonly isFainted: boolean;
}

/** One of the hunter's Pokemon, before it is built. */
export interface HunterTeamMember {
  readonly species: PokemonBase;
  readonly level: number;
}

export const createHunterState = (): HunterState => ({ spawned: false, defeated: false });

export const hunterTierFor = (
  elapsedMs: number,
  isEnraged: boolean,
  tuning: HunterTuning = DEFAULT_HUNTER_TUNING,
): HunterTier => {
  if (isEnraged) {
    return HUNTER_ENRAGED_TIER;
  }
  const baseTierIndex = HUNTER_TIERS.reduce(
    (selected, tier, index) => (elapsedMs >= tier.startsAtMs ? index : selected),
    0,
  );
  const tierIndex = Math.max(
    0,
    Math.min(HUNTER_TIERS.length - 1, baseTierIndex + tuning.teamTierOffset),
  );
  return HUNTER_TIERS[tierIndex];
};

/**
 * The hunter's team on a rung, against whoever it is facing: one Pokemon for
 * each of theirs that can still fight, paired highest level first. Only those
 * that can fight, because a fainted Pokemon cannot be revived in the field and
 * so is nobody the hunter has to answer.
 */
export function hunterTeamFor(
  tier: HunterTier,
  opponents: readonly HunterOpponent[],
): readonly HunterTeamMember[] {
  const levels = opponents
    .filter((pokemon) => !pokemon.isFainted)
    .map((pokemon) => pokemon.level)
    .sort((a, b) => b - a)
    .slice(0, HUNTER_ROSTER.length);
  const paired = levels.length > 0 ? levels : [UNKNOWN_OPPONENT_LEVEL];
  return paired.map((level, index) => ({
    species: HUNTER_ROSTER[index],
    level: Math.max(HUNTER_MINIMUM_LEVEL, level + tier.levelOffset),
  }));
}

/** What Brock's radio mast reads off the hunter, before it is worded. */
export interface HunterIntel {
  /** The level of the hunter's strongest Pokemon, which is the number that decides a fight. */
  readonly level: number;
  readonly teamSize: number;
  /** The next team to land and how much raid clock is left before it does. */
  readonly next: { readonly level: number; readonly teamSize: number; readonly inMs: number } | null;
}

/**
 * The hunter's team right now, and the next change to it, against the party
 * the player is carrying now.
 *
 * It asks `hunterTierFor` rather than reading `HUNTER_TIERS` itself, so a raid
 * whose tuning shifts the tiers is reported as it will actually be fought. The
 * enrage is the last entry on the schedule: a raid shortened by booked recovery
 * can run out before a later tier ever starts, and then the enraged team is
 * what lands next.
 */
export const hunterIntelFor = (
  elapsedMs: number,
  raidDurationMs: number,
  isEnraged: boolean,
  tuning: HunterTuning = DEFAULT_HUNTER_TUNING,
  opponents: readonly HunterOpponent[] = [],
): HunterIntel => {
  const current = hunterTierFor(elapsedMs, isEnraged, tuning);
  const describe = (tier: HunterTier): { level: number; teamSize: number } => {
    const team = hunterTeamFor(tier, opponents);
    return { level: Math.max(...team.map((member) => member.level)), teamSize: team.length };
  };
  if (isEnraged) {
    return { ...describe(current), next: null };
  }
  const changes = [
    ...HUNTER_TIERS.map((tier) => tier.startsAtMs).filter(
      (startsAtMs) => startsAtMs > elapsedMs && startsAtMs < raidDurationMs,
    ),
    raidDurationMs,
  ];
  for (const atMs of changes) {
    const tier = hunterTierFor(atMs, atMs >= raidDurationMs, tuning);
    if (tier !== current) {
      return { ...describe(current), next: { ...describe(tier), inMs: Math.max(0, atMs - elapsedMs) } };
    }
  }
  return { ...describe(current), next: null };
};

/**
 * The fight the hunter brings: this raid's rival, on the rung the clock is
 * at, against the party the player can fight with right now.
 */
export const createHunterTrainer = (
  elapsedMs: number,
  isEnraged: boolean,
  tuning: HunterTuning = DEFAULT_HUNTER_TUNING,
  opponents: readonly HunterOpponent[] = [],
): TrainerBattle => {
  const rival = hunterRival(tuning.rivalId);
  return {
    id: HUNTER_ID,
    name: rival.name,
    party: hunterTeamFor(hunterTierFor(elapsedMs, isEnraged, tuning), opponents).map(
      (member) => new Pokemon(member.species, member.level),
    ),
    defeatText: rival.defeat,
    getawayText: rival.getaway,
  };
};

export const isHunterContactingPlayer = (hunter: GridPosition, player: GridPosition): boolean =>
  Math.abs(hunter.x - player.x) + Math.abs(hunter.y - player.y) <= 1;

/** Fixed N/S/W/E expansion order keeps every search result deterministic. */
const PURSUIT_STEP_DELTAS: readonly GridPosition[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];
const STEP_DX = [0, 0, -1, 1] as const;
const STEP_DY = [-1, 1, 0, 0] as const;

const UNREACHED = -1;

const isInsideBounds = (tile: GridPosition, bounds: GridBounds): boolean =>
  tile.x >= 0 && tile.y >= 0 && tile.x < bounds.width && tile.y < bounds.height;

const tileIndex = (tile: GridPosition, bounds: GridBounds): number => tile.y * bounds.width + tile.x;

const manhattanDistance = (from: GridPosition, to: GridPosition): number =>
  Math.abs(from.x - to.x) + Math.abs(from.y - to.y);

/**
 * `isBlocked` for one search, asked at most once a tile and answered by tile
 * index. Every search below walks the whole map and asks about each tile from
 * up to four sides, and the flee and pursuit rules in `mapStructure.testkit.ts` run
 * these searches from every tile of every map in every gate state - so the
 * callback, and the position object built to ask it, were most of the suite's
 * wall clock. The answers are the callback's own, so nothing a search returns
 * changes; off the map is blocked, as `walkableNeighbours` always had it.
 */
interface BlockedLookup {
  readonly width: number;
  readonly height: number;
  /** Whether the tile at this index cannot be stood on. */
  readonly at: (index: number) => boolean;
  /** The index one step in direction `step` (0-3, N/S/W/E), or UNREACHED off the map or into a wall. */
  readonly step: (index: number, step: number) => number;
}

/**
 * Every tile's answer, worked out once, for the `isBlocked` functions made by
 * `collisionBlocker`. Keyed by the function, so nothing about the searches'
 * signatures changes: a caller hands over a function as it always did, and a
 * search that recognises one skips asking it sixteen thousand times.
 */
const PRECOMPUTED_BLOCKERS = new WeakMap<
  (tile: GridPosition) => boolean,
  {
    readonly width: number;
    readonly height: number;
    readonly mask: Uint8Array;
    /** Four entries a tile, N/S/W/E: the index one step that way, or UNREACHED. */
    readonly neighbours: Int32Array;
  }
>();

/**
 * `isBlocked` for a fixed collision grid - blocked unless the grid says the
 * tile is walkable, and blocked off it - with every tile's answer read once
 * up front.
 *
 * It is for callers that ask the same map the same question from every tile
 * of it: the structure and flee suites run a whole-map search per walkable tile
 * per gate state, and asking a callback per tile per search was the largest
 * cost left in them once the searches themselves were typed arrays. The grid is
 * read when this is called, so it is only for a grid that does not change
 * afterwards - which every built map is, a gate state being a different map.
 */
export const collisionBlocker = (
  collision: readonly (readonly boolean[])[],
): ((tile: GridPosition) => boolean) => {
  const height = collision.length;
  const width = collision[0]?.length ?? 0;
  /** 1 open, 2 blocked: the same encoding `blockedLookup` fills in lazily. */
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const row = collision[y];
    for (let x = 0; x < width; x += 1) {
      mask[y * width + x] = row[x] === false ? 1 : 2;
    }
  }
  // Where every step from every tile lands, worked out once, so a search's
  // inner loop is one read rather than a division and four bounds checks.
  const neighbours = new Int32Array(width * height * 4).fill(UNREACHED);
  for (let index = 0; index < width * height; index += 1) {
    const x = index % width;
    const y = (index / width) | 0;
    for (let direction = 0; direction < 4; direction += 1) {
      const nx = x + STEP_DX[direction];
      const ny = y + STEP_DY[direction];
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx] === 1) {
        neighbours[index * 4 + direction] = ny * width + nx;
      }
    }
  }
  const isBlocked = (tile: GridPosition): boolean =>
    tile.x < 0 || tile.y < 0 || tile.x >= width || tile.y >= height
      ? true
      : mask[tile.y * width + tile.x] === 2;
  PRECOMPUTED_BLOCKERS.set(isBlocked, { width, height, mask, neighbours });
  return isBlocked;
};

const blockedLookup = (
  bounds: GridBounds,
  isBlocked: (tile: GridPosition) => boolean,
): BlockedLookup => {
  const { width, height } = bounds;
  const found = PRECOMPUTED_BLOCKERS.get(isBlocked);
  const precomputed = found && found.width === width && found.height === height ? found : null;
  if (precomputed) {
    const { mask, neighbours } = precomputed;
    return {
      width,
      height,
      at: (index) => mask[index] === 2,
      step: (index, direction) => neighbours[index * 4 + direction],
    };
  }
  /** 0 not yet asked, 1 open, 2 blocked. */
  const known = new Uint8Array(width * height);
  const at = (index: number): boolean => {
    let answer = known[index];
    if (answer === 0) {
      answer = isBlocked({ x: index % width, y: (index / width) | 0 }) ? 2 : 1;
      known[index] = answer;
    }
    return answer === 2;
  };
  const step = (index: number, direction: number): number => {
    const x = (index % width) + STEP_DX[direction];
    const y = ((index / width) | 0) + STEP_DY[direction];
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return UNREACHED;
    }
    const next = y * width + x;
    return at(next) ? UNREACHED : next;
  };
  return { width, height, at, step };
};

const positionOf = (index: number, width: number): GridPosition => ({
  x: index % width,
  y: (index / width) | 0,
});

const walkableNeighbours = (
  tile: GridPosition,
  bounds: GridBounds,
  isBlocked: (tile: GridPosition) => boolean,
): GridPosition[] =>
  PURSUIT_STEP_DELTAS.map((delta) => ({ x: tile.x + delta.x, y: tile.y + delta.y })).filter(
    (neighbour) => isInsideBounds(neighbour, bounds) && !isBlocked(neighbour),
  );

/**
 * Steps from every tile to the nearest goal tile, or UNREACHED where no route exists.
 * Flooding outwards from the goal answers the whole map in one pass, so a pursuit tick
 * that moves the hunter several tiles still only searches once.
 */
const buildDistanceField = (
  goals: readonly GridPosition[],
  bounds: GridBounds,
  blocked: BlockedLookup,
): Int32Array => {
  const size = bounds.width * bounds.height;
  const distances = new Int32Array(size).fill(UNREACHED);
  const queue = new Int32Array(size);
  let tail = 0;
  for (const tile of goals) {
    if (!isInsideBounds(tile, bounds)) {
      continue;
    }
    const index = tileIndex(tile, bounds);
    if (distances[index] !== UNREACHED || blocked.at(index)) {
      continue;
    }
    distances[index] = 0;
    queue[tail] = index;
    tail += 1;
  }

  for (let head = 0; head < tail; head += 1) {
    const here = queue[head];
    const nextDistance = distances[here] + 1;
    for (let direction = 0; direction < 4; direction += 1) {
      const index = blocked.step(here, direction);
      if (index === UNREACHED || distances[index] !== UNREACHED) {
        continue;
      }
      distances[index] = nextDistance;
      queue[tail] = index;
      tail += 1;
    }
  }

  return distances;
};

/** Reaching any tile that touches the player is contact, so all of them are goals. */
const contactGoals = (player: GridPosition): GridPosition[] => [
  player,
  ...PURSUIT_STEP_DELTAS.map((delta) => ({ x: player.x + delta.x, y: player.y + delta.y })),
];

/**
 * Ranks equally short routes so the hunter commits to the long axis of the chase first.
 * Closing the wide gap before the narrow one reads as a run at the player; alternating
 * between them reads as bobbing on the spot, even though both are shortest paths.
 */
const routePreference = (from: GridPosition, to: GridPosition, target: GridPosition): number => {
  const towardsX = target.x - from.x;
  const towardsY = target.y - from.y;
  const movesAlongX = to.x !== from.x;
  const stepsTowardsTarget = movesAlongX
    ? Math.sign(to.x - from.x) === Math.sign(towardsX)
    : Math.sign(to.y - from.y) === Math.sign(towardsY);
  const followsLongAxis = movesAlongX === (Math.abs(towardsX) >= Math.abs(towardsY));
  return (stepsTowardsTarget ? 0 : 2) + (followsLongAxis ? 0 : 1);
};

/** Walks the distance field down to zero, so every tile of the route is a shortest step. */
const routeDownhill = (
  hunter: GridPosition,
  target: GridPosition,
  distances: Int32Array,
  bounds: GridBounds,
  isBlocked: (tile: GridPosition) => boolean,
): GridPosition[] => {
  const route: GridPosition[] = [];
  let position = hunter;
  for (;;) {
    const current = distances[tileIndex(position, bounds)];
    const step = walkableNeighbours(position, bounds, isBlocked)
      .map((tile, order) => ({ tile, order, distance: distances[tileIndex(tile, bounds)] }))
      .filter((candidate) => candidate.distance !== UNREACHED && candidate.distance < current)
      .sort(
        (left, right) =>
          left.distance - right.distance ||
          routePreference(position, left.tile, target) -
            routePreference(position, right.tile, target) ||
          left.order - right.order,
      )[0];
    if (!step) {
      return route;
    }
    route.push(step.tile);
    position = step.tile;
  }
};

/**
 * The tile the hunter can actually stand on that sits closest to an unreachable player.
 * Ordering candidates by (distance, y, x) does not depend on where the hunter currently is,
 * so the target holds still while it walks there and the hunter settles against the obstacle
 * in its way instead of twitching in front of it.
 */
const findClosestApproachTile = (
  hunter: GridPosition,
  player: GridPosition,
  bounds: GridBounds,
  blocked: BlockedLookup,
): GridPosition => {
  const size = bounds.width * bounds.height;
  const visited = new Uint8Array(size);
  const reached = new Int32Array(size);
  const start = tileIndex(hunter, bounds);
  visited[start] = 1;
  reached[0] = start;
  let tail = 1;
  let best = hunter;

  for (let head = 0; head < tail; head += 1) {
    const here = reached[head];
    const tile = positionOf(here, bounds.width);
    const distance = manhattanDistance(tile, player);
    const bestDistance = manhattanDistance(best, player);
    if (
      distance < bestDistance ||
      (distance === bestDistance && (tile.y < best.y || (tile.y === best.y && tile.x < best.x)))
    ) {
      best = tile;
    }
    for (let direction = 0; direction < 4; direction += 1) {
      const index = blocked.step(here, direction);
      if (index === UNREACHED || visited[index] === 1) {
        continue;
      }
      visited[index] = 1;
      reached[tail] = index;
      tail += 1;
    }
  }

  return best;
};

/**
 * Shortest walkable route from the hunter to contact with the player, tile by tile.
 * When no route exists it heads for the closest tile it can reach instead, so it closes in
 * and holds position rather than jittering against whatever is in its way.
 * Returns an empty route when the hunter is already where it wants to be.
 */
export const findHunterPursuitPath = (
  hunter: GridPosition,
  player: GridPosition,
  bounds: GridBounds,
  isBlocked: (tile: GridPosition) => boolean,
): GridPosition[] => {
  if (!isInsideBounds(hunter, bounds) || isHunterContactingPlayer(hunter, player)) {
    return [];
  }
  const blocked = blockedLookup(bounds, isBlocked);
  const isBlockedTile = (tile: GridPosition): boolean => blocked.at(tileIndex(tile, bounds));
  const contactDistances = buildDistanceField(contactGoals(player), bounds, blocked);
  if (contactDistances[tileIndex(hunter, bounds)] !== UNREACHED) {
    return routeDownhill(hunter, player, contactDistances, bounds, isBlockedTile);
  }

  const approach = findClosestApproachTile(hunter, player, bounds, blocked);
  if (approach.x === hunter.x && approach.y === hunter.y) {
    return [];
  }
  return routeDownhill(
    hunter,
    approach,
    buildDistanceField([approach], bounds, blocked),
    bounds,
    isBlockedTile,
  );
};

/**
 * How far from the player the hunter arrives, in walkable tiles.
 *
 * A fixed walking distance is the whole point of the hunter: the same lead time
 * every raid, so the appearance is a warning the player can act on rather than an
 * ambush. Walking distance, not straight-line distance, because that is the number
 * of steps the player actually has before contact.
 */
export const HUNTER_SPAWN_DISTANCE = 5;

/**
 * The closest the hunter may ever appear, in walkable tiles.
 *
 * Only an area too small to hold the full spawn distance can drop below it, and
 * below this floor there is no read and no counterplay - contact is one tile away
 * and an enraged hunter covers two tiles per player step - so the hunter waits for
 * the player to move somewhere it can arrive fairly instead of appearing on top of
 * them. No authored map reaches this case; `hunter.test.ts` pins that.
 */
export const HUNTER_MINIMUM_SPAWN_DISTANCE = 3;

const firstCandidate = (candidates: readonly GridPosition[]): GridPosition => candidates[0];

/**
 * Where the hunter appears when it joins the raid, or null when nowhere is fair.
 *
 * Every walkable tile exactly HUNTER_SPAWN_DISTANCE steps from the player is a
 * candidate, so the hunter arrives at the authored lead time from whichever side the
 * map allows, and always somewhere it can actually walk in from. An area too small
 * for that yields the furthest tile it does hold; an area smaller than
 * HUNTER_MINIMUM_SPAWN_DISTANCE yields nothing at all, because the only tiles left
 * are on top of the player.
 */
export const findHunterSpawnTile = (
  player: GridPosition,
  bounds: GridBounds,
  isBlocked: (tile: GridPosition) => boolean,
  pick: (candidates: readonly GridPosition[]) => GridPosition = firstCandidate,
  spawnDistance: number = HUNTER_SPAWN_DISTANCE,
): GridPosition | null => {
  if (!isInsideBounds(player, bounds)) {
    return null;
  }
  const blocked = blockedLookup(bounds, isBlocked);
  const visited = new Uint8Array(bounds.width * bounds.height);
  const start = tileIndex(player, bounds);
  visited[start] = 1;
  // Ring N holds every tile exactly N walkable steps out, so ring 0 is the player.
  let ring: number[] = [start];
  let furthestRing = 0;
  for (let distance = 0; distance < spawnDistance; distance += 1) {
    const nextRing: number[] = [];
    for (const here of ring) {
      for (let direction = 0; direction < 4; direction += 1) {
        const index = blocked.step(here, direction);
        if (index === UNREACHED || visited[index] === 1) {
          continue;
        }
        visited[index] = 1;
        nextRing.push(index);
      }
    }
    if (nextRing.length === 0) {
      break;
    }
    ring = nextRing;
    furthestRing = distance + 1;
  }

  if (furthestRing < HUNTER_MINIMUM_SPAWN_DISTANCE) {
    return null;
  }
  return pick(ring.map((index) => positionOf(index, bounds.width)));
};

/**
 * Selects the first step of the hunter's shortest walkable route to the player.
 * Fixed tie ordering keeps the hunter predictable and unit-testable.
 */
export const chooseHunterPursuitStep = (
  hunter: GridPosition,
  player: GridPosition,
  bounds: GridBounds,
  isBlocked: (tile: GridPosition) => boolean,
): GridPosition | null => findHunterPursuitPath(hunter, player, bounds, isBlocked)[0] ?? null;

/**
 * What the hunter is actually walking towards.
 *
 * Out in the open that is the player, and the sighting is recorded as it goes.
 * Under a roof the player is out of sight, so it keeps hunting the last tile it
 * knew - which is the ground outside the mouth they went in by, and which is
 * therefore exactly where a player who doubles back walks into it. A hunter
 * under the *same* roof can see them perfectly well: a cave you are both
 * standing in is not a hiding place.
 */
export const hunterQuarry = (
  state: HunterState,
  player: GridPosition,
  playerIsHidden: boolean,
): { readonly target: GridPosition; readonly state: HunterState } => {
  if (!playerIsHidden) {
    return { target: player, state: { ...state, lastSeen: player } };
  }
  return { target: state.lastSeen ?? player, state };
};

/** Whether the hunter is walking towards a sighting that is no longer true. */
export const isHunterOffTheScent = (state: HunterState, player: GridPosition): boolean =>
  state.lastSeen !== undefined &&
  (state.lastSeen.x !== player.x || state.lastSeen.y !== player.y);

/** A hunter that lost the trail holds position and cannot start a battle. */
export const isHunterSearching = (state: HunterState): boolean =>
  (state.searchRemainingMs ?? 0) > 0;

/**
 * Marks a hunter the player just escaped from. The search window starts immediately,
 * so the escape covers the return to the overworld; the fallback tile is chosen there.
 */
export const beginHunterDisengage = (
  state: HunterState,
  searchMs: number = HUNTER_SEARCH_MS,
): HunterState => ({
  ...state,
  searchRemainingMs: Math.max(0, searchMs),
  pendingBreakaway: true,
});

/** Burns raid time off the search window; at zero the hunter resumes pursuit. */
export const tickHunterSearch = (state: HunterState, deltaMs: number): HunterState => {
  if (!isHunterSearching(state)) {
    return state;
  }
  const remaining = Math.max(0, (state.searchRemainingMs ?? 0) - Math.max(0, deltaMs));
  return { ...state, searchRemainingMs: remaining };
};

/** What `doorsFrom` answers about a map, keyed by `doorIndex`. */
export interface MapDoors {
  /** Tiles that take ground away from `from` when somebody stands on them. */
  readonly doors: ReadonlySet<number>;
  /** Tiles that leave `from` unable to reach a single one of the goals. */
  readonly sealsIn: ReadonlySet<number>;
}

/**
 * The map read as doors, from where one person is standing.
 *
 * This is the question behind every figure that stops on walkable ground: a
 * person is collision, so wherever one stands is a door, and a door in the neck
 * of a pocket is a wall round whoever is inside it. It answers both halves of
 * that in one depth-first pass - which tiles are doors at all, and which of them
 * shut away every one of a named set of goals - because a flood fill per
 * candidate tile is a whole map walked thousands of times over.
 *
 * Rooted at `from`, a tile is a door exactly when it has a search-tree child
 * whose subtree reaches nothing above it (Tarjan's articulation rule, with the
 * root left out because that is the tile `from` is standing on). Counting the
 * goals inside each severed subtree as the walk unwinds gives the second half
 * for free. The walk is kept on an explicit stack: a 64x64 map is four thousand
 * tiles deep in the worst case.
 */
export const doorsFrom = (
  from: GridPosition,
  bounds: GridBounds,
  isBlocked: (tile: GridPosition) => boolean,
  goals: readonly GridPosition[] = [],
): MapDoors => doorsFromLookup(from, bounds, blockedLookup(bounds, isBlocked), goals);

const doorsFromLookup = (
  from: GridPosition,
  bounds: GridBounds,
  blocked: BlockedLookup,
  goals: readonly GridPosition[],
): MapDoors => {
  const sealsIn = new Set<number>();
  if (!isInsideBounds(from, bounds) || blocked.at(tileIndex(from, bounds))) {
    return { doors: new Set<number>(), sealsIn };
  }
  const size = bounds.width * bounds.height;
  // The doors as flags and a list in the order they are found, not a set: on a
  // map of one-tile lanes nearly every tile is one, and most callers only want
  // `sealsIn`. The set is built from the list, in the same order, if asked for.
  const isDoor = new Uint8Array(size);
  const doorList = new Int32Array(size);
  let doorCount = 0;
  const discovered = new Int32Array(size).fill(UNREACHED);
  const lowest = new Int32Array(size);
  /** Goals inside a tile's search subtree, and goals its doors shut away. */
  const goalsBelow = new Int32Array(size);
  const goalsShut = new Int32Array(size);
  const isGoal = new Uint8Array(size);
  for (const goal of goals) {
    if (isInsideBounds(goal, bounds)) {
      isGoal[tileIndex(goal, bounds)] = 1;
    }
  }
  const root = tileIndex(from, bounds);
  let order = 0;

  // The explicit stack, one frame a tile: the tile, its parent, and which of
  // its four sides the walk has looked at so far.
  const tiles = new Int32Array(size);
  const parents = new Int32Array(size);
  const cursors = new Uint8Array(size);
  let depth = 1;
  tiles[0] = root;
  parents[0] = UNREACHED;
  cursors[0] = 0;
  discovered[root] = order;
  lowest[root] = order;
  goalsBelow[root] = isGoal[root];
  order += 1;

  while (depth > 0) {
    const top = depth - 1;
    const here = tiles[top];
    if (cursors[top] < 4) {
      const index = blocked.step(here, cursors[top]);
      cursors[top] += 1;
      if (index === UNREACHED) {
        continue;
      }
      if (discovered[index] === UNREACHED) {
        discovered[index] = order;
        lowest[index] = order;
        goalsBelow[index] = isGoal[index];
        order += 1;
        tiles[depth] = index;
        parents[depth] = here;
        cursors[depth] = 0;
        depth += 1;
      } else if (index !== parents[top]) {
        lowest[here] = Math.min(lowest[here], discovered[index]);
      }
      continue;
    }
    depth -= 1;
    const parent = parents[top];
    if (parent === UNREACHED) {
      continue;
    }
    lowest[parent] = Math.min(lowest[parent], lowest[here]);
    goalsBelow[parent] += goalsBelow[here];
    // Everything under `here` is reached only through `parent`, so standing on
    // `parent` shuts all of it away from `from`. The root is exempt: it is the
    // tile `from` is on, and nobody else can be standing there.
    if (parent !== root && lowest[here] >= discovered[parent]) {
      if (isDoor[parent] === 0) {
        isDoor[parent] = 1;
        doorList[doorCount] = parent;
        doorCount += 1;
      }
      goalsShut[parent] += goalsBelow[here];
    }
  }

  // Only goals `from` could reach in the first place are goals it can lose, and
  // a goal is lost by being stood on as surely as by being shut away.
  const within = goalsBelow[root];
  for (let place = 0; place < doorCount; place += 1) {
    const door = doorList[place];
    if (within > 0 && within - goalsShut[door] - isGoal[door] <= 0) {
      sealsIn.add(door);
    }
  }
  // The last way out is shut by standing on it as well as by shutting the way
  // to it: one exit and somebody on it is the same jar with a different lid.
  if (within === 1) {
    for (const goal of goals) {
      const index = isInsideBounds(goal, bounds) ? tileIndex(goal, bounds) : UNREACHED;
      if (index !== UNREACHED && discovered[index] !== UNREACHED) {
        sealsIn.add(index);
      }
    }
  }

  let doors: ReadonlySet<number> | undefined;
  return {
    get doors() {
      doors ??= new Set(doorList.subarray(0, doorCount));
      return doors;
    },
    sealsIn,
  };
};

/** The index `doorsFrom` keys a tile by, so a caller can ask about one. */
export const doorIndex = (tile: GridPosition, bounds: GridBounds): number =>
  tileIndex(tile, bounds);

/**
 * Where a hunter falls back to when the player breaks contact.
 *
 * Distance alone was never the thing an escape buys. Measured across every walkable
 * tile of all four rebuilt maps, a heading-blind fallback parked the hunter on the
 * player's own shortest route to an exit, landmark or contract stop about a third of
 * the time, and lengthened that route about a quarter of the time - so a quarter of
 * all escapes were paid for in raid time and then made the player's position worse.
 * That is why this takes the direction the player was walking: the hunter falls back
 * *behind* them, off the ground they are about to cross, and the window is spent
 * going somewhere instead of going round.
 *
 * It picks the tile that puts `breakawayDistance` walkable tiles between hunter and
 * player; among the tiles that manage that it prefers one that does not shut the
 * player away from every way out of the raid, then the one furthest behind the
 * player's heading, and among those the one the hunter can reach soonest - so it
 * backs off along ground it could have walked instead of teleporting across the map.
 * A cramped or enclosed area yields the best separation available rather than
 * failing, and the player's own tile is never chosen.
 *
 * `mustReach` is the second of those, and it is the raid's own exits: a hunter
 * that falls back across the only neck out of where the player is standing has
 * sold them a jar for `HUNTER_FLEE_BASE_PENALTY_MS` of clock. Measured over all
 * four maps in every gate state, that used to happen on 379 of the Floodplain's
 * tile-and-heading pairs alone, and preferring an unsealing tile costs nothing at
 * all: the full six tiles of separation are still available on every one of them.
 * It is only a preference, because a pocket whose one way out is a one-tile lane
 * has no unsealing tile at any distance - every tile of that lane is the lid. The
 * floor under it is that the player may always walk into the hunter and be caught
 * by it (`WorldScene.tryWalkIntoHunter`), so no arrangement of the two of them is
 * a wall. Pass no exits and the rule is simply inert, which is what keeps this
 * answerable about a bare grid.
 */
export const findHunterBreakawayTile = (
  hunter: GridPosition,
  player: GridPosition,
  bounds: GridBounds,
  isBlocked: (tile: GridPosition) => boolean,
  breakawayDistance: number = HUNTER_BREAKAWAY_DISTANCE,
  heading: Direction | null = null,
  mustReach: readonly GridPosition[] = [],
  /**
   * The doors of the map as seen from the player, where the caller already has
   * them. This is the only whole-map search in the function that does not
   * depend on where the hunter is, so a caller asking about many hunters from
   * one tile hands over one answer instead of paying for it each time.
   */
  doors: MapDoors | null = null,
): GridPosition =>
  planHunterBreakaway(hunter, player, bounds, isBlocked, breakawayDistance, mustReach, doors)(
    heading,
  );

/**
 * `findHunterBreakawayTile` for every heading at once.
 *
 * The heading is the last thing the choice reads - it only breaks a tie between
 * tiles that are equal on everything else - so the two searches and the doors
 * behind it are the same whichever way the player was walking. The structure
 * rules ask what all four headings would do from every tile of every map, and
 * this is what lets them pay for the searches once rather than four times. The
 * answer for a heading is exactly `findHunterBreakawayTile`'s, which is this.
 */
export const planHunterBreakaway = (
  hunter: GridPosition,
  player: GridPosition,
  bounds: GridBounds,
  isBlocked: (tile: GridPosition) => boolean,
  breakawayDistance: number = HUNTER_BREAKAWAY_DISTANCE,
  mustReach: readonly GridPosition[] = [],
  doors: MapDoors | null = null,
): ((heading: Direction | null) => GridPosition) => {
  if (!isInsideBounds(hunter, bounds)) {
    return () => hunter;
  }
  const { width } = bounds;
  const blocked = blockedLookup(bounds, isBlocked);
  const fromPlayer = buildDistanceField([player], bounds, blocked);

  const size = width * bounds.height;
  const visited = new Uint8Array(size);
  const start = tileIndex(hunter, bounds);
  visited[start] = 1;
  // Breadth-first, so `reached` is ordered by how soon the hunter gets there and
  // `walk` is the number of steps it would have taken to back off that far.
  const reached = new Int32Array(size);
  const walk = new Int32Array(size);
  reached[0] = start;
  walk[0] = 0;
  let count = 1;
  for (let head = 0; head < count; head += 1) {
    for (let direction = 0; direction < 4; direction += 1) {
      const index = blocked.step(reached[head], direction);
      if (index === UNREACHED || visited[index] === 1) {
        continue;
      }
      visited[index] = 1;
      reached[count] = index;
      walk[count] = walk[head] + 1;
      count += 1;
    }
  }

  /**
   * How far the hunter may walk back and still look like it retreated rather than
   * vanished. Every tile at full separation is within the hunter's own distance to
   * the player plus that separation plus one, so this rules nothing out - it only
   * stops "furthest behind the player" from reaching across the whole map when a
   * dozen tiles are tied on separation.
   */
  const hunterToPlayer = fromPlayer[start];
  const walkLimit =
    (hunterToPlayer === UNREACHED ? breakawayDistance : hunterToPlayer) + breakawayDistance + 1;

  /**
   * Most separation first, because that is what the escape is for; then a tile
   * that leaves the player a way out of the raid, because an escape that seals
   * them in has sold them nothing; then the nearest tile that achieves both - so
   * the gap is `breakawayDistance` and not whatever the heading could be talked
   * into. Only then does the player's heading break the tie, which on a lane
   * running both ways is the whole question; a retreat the hunter could have
   * walked comes before it so a tie can never be settled by a tile across the
   * map, and the tile it reaches soonest settles what is left, deterministically.
   *
   * The first four of those do not depend on the heading, so they are settled
   * here, once: `tied` is every tile that is best on all four, in the order the
   * hunter reaches them.
   */
  // With nothing to reach nothing can be sealed in, so the whole-map door walk
  // is only paid for when there are exits to protect.
  const { sealsIn } =
    doors ??
    (mustReach.length === 0
      ? { sealsIn: new Set<number>() }
      : doorsFromLookup(player, bounds, blocked, mustReach));
  // One pass, keeping every tile that is best so far on all four: first
  // `tied` holds whatever beat everything before it, and a tile that beats
  // the tied ones clears the list.
  let bestSeparation = -1;
  let bestSeals = 2;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestFar = 2;
  const tied: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const tile = reached[index];
    const distance = fromPlayer[tile];
    const separation = distance === UNREACHED ? 0 : Math.min(distance, breakawayDistance);
    if (separation < bestSeparation) {
      continue;
    }
    const seals = sealsIn.size > 0 && sealsIn.has(tile) ? 1 : 0;
    const playerDistance = distance === UNREACHED ? Number.POSITIVE_INFINITY : distance;
    const far = walk[index] > walkLimit ? 1 : 0;
    const order =
      bestSeparation - separation ||
      seals - bestSeals ||
      (playerDistance === bestDistance ? 0 : playerDistance < bestDistance ? -1 : 1) ||
      far - bestFar;
    if (order < 0) {
      tied.length = 0;
      bestSeparation = separation;
      bestSeals = seals;
      bestDistance = playerDistance;
      bestFar = far;
    }
    if (order <= 0) {
      tied.push(index);
    }
  }

  return (heading) => {
    const delta = heading === null ? null : DIRECTION_DELTAS[heading];
    /** Positive is in front of the player, negative behind: smaller is a better retreat. */
    const aheadOfPlayer = (index: number): number => {
      if (delta === null) {
        return 0;
      }
      const tile = reached[index];
      return ((tile % width) - player.x) * delta.x + (((tile / width) | 0) - player.y) * delta.y;
    };
    // Compared in place, and the first of equals kept: `tied` is in the order
    // the hunter reaches its tiles, so that is the soonest.
    let best = tied[0];
    let bestAhead = aheadOfPlayer(best);
    for (let place = 1; place < tied.length; place += 1) {
      const index = tied[place];
      const ahead = aheadOfPlayer(index);
      if (ahead < bestAhead || (ahead === bestAhead && walk[index] < walk[best])) {
        best = index;
        bestAhead = ahead;
      }
    }
    return positionOf(reached[best], width);
  };
};

/** Places a disengaged hunter on its fallback tile and clears the pending marker. */
export const applyHunterBreakaway = (
  state: HunterState,
  position: GridPosition,
): HunterState => ({ ...state, position: { ...position }, pendingBreakaway: false });

/**
 * First-contract players must reach the contract's own area, or commit to a
 * landmark, before pursuit starts. Staging areas the contract does not use stay
 * quiet; on the Floodplain the raid begins on the contract map, so the hunter's
 * seeded spawn delay is the grace period.
 */
export const isHunterEligibleForFirstContract = (
  mapId: WorldMapId,
  contractMapId: WorldMapId | undefined,
  hasVisitedFieldStation: boolean,
): boolean => contractMapId === undefined || mapId === contractMapId || hasVisitedFieldStation;

/** Keeps hunter defeats on the exact secure-slot run-resolution path. */
export const resolveHunterBattleLoss = (session: ActiveRunSession): RunResult =>
  session.manager.resolveWipe(session.secureSlot);
