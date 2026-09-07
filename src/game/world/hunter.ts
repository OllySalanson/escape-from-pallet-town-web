import { Pokemon } from '../pokemon';
import { BULBASAUR, PIDGEY, PIKACHU } from '../pokemon/species';
import type { PokemonBase } from '../pokemon/PokemonBase';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import type { GridBounds, GridPosition } from '../movement/gridMovement';
import type { ActiveRunSession } from '../run/RunSession';
import type { RunResult } from '../run/RunManager';
import type { HunterTuning } from '../run/runGeneration';
import type { WorldMapId } from '../worldMap';

export const HUNTER_ID = 'rival-hunter';
export const HUNTER_SPAWN_MS = 60_000;
export const HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP = 2;
export const DEFAULT_HUNTER_TUNING: HunterTuning = {
  spawnDelayMs: HUNTER_SPAWN_MS,
  aggressionStepsPerPlayerStep: 1,
  teamTierOffset: 0,
};

const HUNTER_TIERS = [
  { startsAtMs: 0, level: 6, party: [PIDGEY] },
  { startsAtMs: 120_000, level: 9, party: [PIDGEY, BULBASAUR] },
  { startsAtMs: 240_000, level: 12, party: [PIDGEY, BULBASAUR, PIKACHU] },
] as const;
const HUNTER_ENRAGED_TIER = { level: 15, party: [PIDGEY, BULBASAUR, PIKACHU] } as const;

export interface HunterState {
  readonly spawned: boolean;
  readonly defeated: boolean;
  readonly mapId?: WorldMapId;
  readonly position?: GridPosition;
}

export interface HunterTier {
  readonly level: number;
  readonly party: readonly PokemonBase[];
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

export const createHunterTrainer = (
  elapsedMs: number,
  isEnraged: boolean,
  tuning: HunterTuning = DEFAULT_HUNTER_TUNING,
): TrainerBattle => {
  const tier = hunterTierFor(elapsedMs, isEnraged, tuning);
  return {
    id: HUNTER_ID,
    name: 'RIVAL HUNTER',
    party: tier.party.map((species) => new Pokemon(species, tier.level)),
    defeatText: 'You slipped through my fingers... this time.',
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

const UNREACHED = -1;

const isInsideBounds = (tile: GridPosition, bounds: GridBounds): boolean =>
  tile.x >= 0 && tile.y >= 0 && tile.x < bounds.width && tile.y < bounds.height;

const tileIndex = (tile: GridPosition, bounds: GridBounds): number => tile.y * bounds.width + tile.x;

const manhattanDistance = (from: GridPosition, to: GridPosition): number =>
  Math.abs(from.x - to.x) + Math.abs(from.y - to.y);

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
  isBlocked: (tile: GridPosition) => boolean,
): Int32Array => {
  const distances = new Int32Array(bounds.width * bounds.height).fill(UNREACHED);
  const frontier = goals.filter((tile) => isInsideBounds(tile, bounds) && !isBlocked(tile));
  for (const tile of frontier) {
    distances[tileIndex(tile, bounds)] = 0;
  }

  for (let head = 0; head < frontier.length; head += 1) {
    const tile = frontier[head];
    const nextDistance = distances[tileIndex(tile, bounds)] + 1;
    for (const neighbour of walkableNeighbours(tile, bounds, isBlocked)) {
      const index = tileIndex(neighbour, bounds);
      if (distances[index] !== UNREACHED) {
        continue;
      }
      distances[index] = nextDistance;
      frontier.push(neighbour);
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
  isBlocked: (tile: GridPosition) => boolean,
): GridPosition => {
  const visited = new Uint8Array(bounds.width * bounds.height);
  visited[tileIndex(hunter, bounds)] = 1;
  const reached = [hunter];
  let best = hunter;

  for (let head = 0; head < reached.length; head += 1) {
    const tile = reached[head];
    const distance = manhattanDistance(tile, player);
    const bestDistance = manhattanDistance(best, player);
    if (
      distance < bestDistance ||
      (distance === bestDistance && (tile.y < best.y || (tile.y === best.y && tile.x < best.x)))
    ) {
      best = tile;
    }
    for (const neighbour of walkableNeighbours(tile, bounds, isBlocked)) {
      const index = tileIndex(neighbour, bounds);
      if (visited[index] === 1) {
        continue;
      }
      visited[index] = 1;
      reached.push(neighbour);
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
  const contactDistances = buildDistanceField(contactGoals(player), bounds, isBlocked);
  if (contactDistances[tileIndex(hunter, bounds)] !== UNREACHED) {
    return routeDownhill(hunter, player, contactDistances, bounds, isBlocked);
  }

  const approach = findClosestApproachTile(hunter, player, bounds, isBlocked);
  if (approach.x === hunter.x && approach.y === hunter.y) {
    return [];
  }
  return routeDownhill(
    hunter,
    approach,
    buildDistanceField([approach], bounds, isBlocked),
    bounds,
    isBlocked,
  );
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

/** First-contract players must make a navigation choice before pursuit starts. */
export const isHunterEligibleForFirstContract = (
  mapId: WorldMapId,
  hasFirstContract: boolean,
  hasVisitedFieldStation: boolean,
): boolean => !hasFirstContract || mapId === 'route-1' || hasVisitedFieldStation;

/** Keeps hunter defeats on the exact secure-slot run-resolution path. */
export const resolveHunterBattleLoss = (session: ActiveRunSession): RunResult =>
  session.manager.resolveWipe(session.secureSlot);
