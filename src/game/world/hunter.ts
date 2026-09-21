import { Pokemon } from '../pokemon';
import { BULBASAUR, JIGGLYPUFF, PIDGEY, PIKACHU } from '../pokemon/species';
import type { PokemonBase } from '../pokemon/PokemonBase';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import { DIRECTION_DELTAS, type Direction, type GridBounds, type GridPosition } from '../movement/gridMovement';
import type { ActiveRunSession } from '../run/RunSession';
import type { RunResult } from '../run/RunManager';
import type { HunterTuning } from '../run/runGeneration';
import type { WorldMapId } from '../worldMap';

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
};

/**
 * When the hunter's team grows. Exported so `raidClock.test.ts` can prove every
 * tier is still reachable inside the raid duration.
 *
 * **Four rungs, and the fourth is a fourth Pokemon.** It arrived with evolution,
 * which begins at level 16 and had put an evolved party above the whole ladder.
 * The obvious answer was to evolve the rival's team with it - the same three
 * Pokemon further along their own lines - and it was written that way first and
 * measured second. The measurement threw it out, which is the entry worth
 * keeping here: **an evolved form is worth far more than the levels it costs**,
 * so a rung built from them overshoots whatever level it is pitched at.
 *
 * What a rung promises is the fight the party that *opens* it gets - a party
 * opens the highest rung it out-levels, so a rung at level N is met by a party
 * at N+1 (`hunterThreat.ts`). Measured over the real engine (300 seeded battles
 * a cell, the player taking its best move each turn, the hunter choosing as
 * `chooseEnemyMove` does, a mixed trio of the lead's own line plus another
 * starter and a Pidgey), the shipped rungs keep a steady promise:
 *
 * | rung          | wins        | HP left    |
 * | ------------- | ----------- | ---------- |
 * | 1: Lv 6 x1    | 100%        | 66-86%     |
 * | 2: Lv 9 x2    | 100%        | 47-70%     |
 * | 3: Lv 12 x3   | 97-98%      | 36-57%     |
 * | 4: Lv 15 x4   | 90-100%     | 36-63%     |
 *
 * The evolved team never came close to that band at any level: Pidgeotto,
 * Ivysaur and Raichu beat their own opener 93% of the time at Lv 13 and 90% at
 * Lv 18 - the ratio barely moves, because dropping the rung's level drops the
 * opener's with it. Raichu alone does most of it; swapping it for Pikachu at
 * one level higher than rung 3 turns a 97% rung into a 14% one.
 *
 * And **raising three levels is not a rung either**, for the same reason: Lv 15,
 * 16 and 18 trios all leave their opener 99-100% wins with 44-71% of its health,
 * which is softer than rung 3. Team size is the only lever that bites, because
 * it is the one thing that does not scale with the party opposite. So the
 * fourth rung is what the first three were doing all along - one more Pokemon.
 *
 * It is **Jigglypuff**, and its being Normal is the point rather than an
 * accident: the rival's three cover Flying, Grass/Poison and Electric, so a
 * fourth with a type would check one starter line and not the others. The
 * Bug/Flying alternative (Butterfree) did exactly that - it took the Squirtle
 * lead's win rate to 83% and its health to 22% while leaving Charmander's at
 * 100% and 60%. Jigglypuff is also already a trainer's Pokemon in this game and
 * nothing a player can own, so the rival having caught one costs nothing.
 *
 * **The schedule is even in hunted time, not in raid time.** The hunter is only
 * on the map from its arrival (55-75s seeded, earlier for a party that raised
 * it) to the end of a 300s raid, so the first rung's stretch is the one the
 * arrival eats into. Measured that way the ladder is four near-equal watches:
 *
 * | rung | from   | to   | hunted length |
 * | ---- | ------ | ---- | ------------- |
 * | 1    | 55-75s | 120s | 45-65s        |
 * | 2    | 120s   | 180s | 60s           |
 * | 3    | 180s   | 240s | 60s           |
 * | 4    | 240s   | 300s | 60s (enrages) |
 *
 * Sixty seconds is not a round number picked for the table: it is what a rung
 * has to last for an escape taken inside it to still be an escape. A first
 * breakaway costs `HUNTER_FLEE_BASE_PENALTY_MS` of clock (40s), so one taken the
 * moment a rung lands leaves 20s of that rung to walk in - the player is still
 * running from the hunter they fled. The second costs 60s, exactly one rung,
 * which is the escalation doing its job rather than an accident. `raidClock.ts`
 * holds the whole schedule and `raidClock.test.ts` the relationships.
 */
export const HUNTER_TIERS = [
  { startsAtMs: 0, level: 6, party: [PIDGEY] },
  { startsAtMs: 120_000, level: 9, party: [PIDGEY, BULBASAUR] },
  { startsAtMs: 180_000, level: 12, party: [PIDGEY, BULBASAUR, PIKACHU] },
  { startsAtMs: 240_000, level: 15, party: [PIDGEY, BULBASAUR, PIKACHU, JIGGLYPUFF] },
] as const;
/**
 * What lands when the clock runs out. It has to be above the top rung or the
 * enrage would be a reprieve - the old Lv 15 trio is now *weaker* than the top
 * rung and beats its opener 99-100% of the time, which is what forced this to
 * move - and it is pitched by what the shipped enrage did to the party that
 * opened the shipped top rung: 9-39% wins with 17-26% of its health left. The
 * top rung's own team at Lv 19 gives that party 16-45% and 26-40%. Lv 18 was
 * measured first and leaves 28-61%, which is a rung rather than a reason to
 * leave; Lv 20 leaves 1-18%, which is not a fight at all.
 */
const HUNTER_ENRAGED_TIER = { level: 19, party: [PIDGEY, BULBASAUR, PIKACHU, JIGGLYPUFF] } as const;

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

/** What the Outfitter's radio mast reads off the hunter, before it is worded. */
export interface HunterIntel {
  readonly level: number;
  readonly teamSize: number;
  /** The next team to land and how much raid clock is left before it does. */
  readonly next: { readonly level: number; readonly teamSize: number; readonly inMs: number } | null;
}

/**
 * The hunter's team right now, and the next change to it.
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
): HunterIntel => {
  const current = hunterTierFor(elapsedMs, isEnraged, tuning);
  const describe = (tier: HunterTier): { level: number; teamSize: number } => ({
    level: tier.level,
    teamSize: tier.party.length,
  });
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
  const visited = new Uint8Array(bounds.width * bounds.height);
  visited[tileIndex(player, bounds)] = 1;
  // Ring N holds every tile exactly N walkable steps out, so ring 0 is the player.
  const rings: GridPosition[][] = [[player]];
  for (let distance = 0; distance < spawnDistance; distance += 1) {
    const nextRing: GridPosition[] = [];
    for (const tile of rings[distance]) {
      for (const neighbour of walkableNeighbours(tile, bounds, isBlocked)) {
        const index = tileIndex(neighbour, bounds);
        if (visited[index] === 1) {
          continue;
        }
        visited[index] = 1;
        nextRing.push(neighbour);
      }
    }
    if (nextRing.length === 0) {
      break;
    }
    rings.push(nextRing);
  }

  const furthestRing = rings.length - 1;
  if (furthestRing < HUNTER_MINIMUM_SPAWN_DISTANCE) {
    return null;
  }
  return pick(rings[furthestRing]);
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
): MapDoors => {
  const doors = new Set<number>();
  const sealsIn = new Set<number>();
  if (!isInsideBounds(from, bounds) || isBlocked(from)) {
    return { doors, sealsIn };
  }
  const size = bounds.width * bounds.height;
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

  const tiles: GridPosition[] = [from];
  const parents: number[] = [UNREACHED];
  const neighbours: GridPosition[][] = [walkableNeighbours(from, bounds, isBlocked)];
  const cursors: number[] = [0];
  discovered[root] = order;
  lowest[root] = order;
  goalsBelow[root] = isGoal[root];
  order += 1;

  while (tiles.length > 0) {
    const top = tiles.length - 1;
    const here = tileIndex(tiles[top], bounds);
    if (cursors[top] < neighbours[top].length) {
      const neighbour = neighbours[top][cursors[top]];
      cursors[top] += 1;
      const index = tileIndex(neighbour, bounds);
      if (discovered[index] === UNREACHED) {
        discovered[index] = order;
        lowest[index] = order;
        goalsBelow[index] = isGoal[index];
        order += 1;
        tiles.push(neighbour);
        parents.push(here);
        neighbours.push(walkableNeighbours(neighbour, bounds, isBlocked));
        cursors.push(0);
      } else if (index !== parents[top]) {
        lowest[here] = Math.min(lowest[here], discovered[index]);
      }
      continue;
    }
    tiles.pop();
    neighbours.pop();
    cursors.pop();
    const parent = parents.pop()!;
    if (parent === UNREACHED) {
      continue;
    }
    lowest[parent] = Math.min(lowest[parent], lowest[here]);
    goalsBelow[parent] += goalsBelow[here];
    // Everything under `here` is reached only through `parent`, so standing on
    // `parent` shuts all of it away from `from`. The root is exempt: it is the
    // tile `from` is on, and nobody else can be standing there.
    if (parent !== root && lowest[here] >= discovered[parent]) {
      doors.add(parent);
      goalsShut[parent] += goalsBelow[here];
    }
  }

  // Only goals `from` could reach in the first place are goals it can lose, and
  // a goal is lost by being stood on as surely as by being shut away.
  const within = goalsBelow[root];
  for (const door of doors) {
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

  return { doors, sealsIn };
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
   * depend on where the hunter is, so a caller asking what four headings would
   * do from one tile - which is what the structure rules ask of every tile of
   * every map - hands over one answer instead of paying for it four times.
   */
  doors: MapDoors | null = null,
): GridPosition => {
  if (!isInsideBounds(hunter, bounds)) {
    return hunter;
  }
  const fromPlayer = buildDistanceField([player], bounds, isBlocked);
  const separation = (tile: GridPosition): number => {
    const distance = fromPlayer[tileIndex(tile, bounds)];
    return distance === UNREACHED ? 0 : Math.min(distance, breakawayDistance);
  };

  const visited = new Uint8Array(bounds.width * bounds.height);
  visited[tileIndex(hunter, bounds)] = 1;
  // Breadth-first, so `reached` is ordered by how soon the hunter gets there and
  // `walk` is the number of steps it would have taken to back off that far.
  const reached = [hunter];
  const walk = [0];
  for (let head = 0; head < reached.length; head += 1) {
    for (const neighbour of walkableNeighbours(reached[head], bounds, isBlocked)) {
      const index = tileIndex(neighbour, bounds);
      if (visited[index] === 1) {
        continue;
      }
      visited[index] = 1;
      reached.push(neighbour);
      walk.push(walk[head] + 1);
    }
  }

  /**
   * How far the hunter may walk back and still look like it retreated rather than
   * vanished. Every tile at full separation is within the hunter's own distance to
   * the player plus that separation plus one, so this rules nothing out - it only
   * stops "furthest behind the player" from reaching across the whole map when a
   * dozen tiles are tied on separation.
   */
  const hunterToPlayer = fromPlayer[tileIndex(hunter, bounds)];
  const walkLimit =
    (hunterToPlayer === UNREACHED ? breakawayDistance : hunterToPlayer) + breakawayDistance + 1;
  const delta = heading === null ? null : DIRECTION_DELTAS[heading];
  /** Positive is in front of the player, negative behind: smaller is a better retreat. */
  const aheadOfPlayer = (tile: GridPosition): number =>
    delta === null ? 0 : (tile.x - player.x) * delta.x + (tile.y - player.y) * delta.y;

  const playerDistance = (tile: GridPosition): number => {
    const distance = fromPlayer[tileIndex(tile, bounds)];
    return distance === UNREACHED ? Number.POSITIVE_INFINITY : distance;
  };

  /**
   * Most separation first, because that is what the escape is for; then a tile
   * that leaves the player a way out of the raid, because an escape that seals
   * them in has sold them nothing; then the nearest tile that achieves both - so
   * the gap is `breakawayDistance` and not whatever the heading could be talked
   * into. Only then does the player's heading break the tie, which on a lane
   * running both ways is the whole question; a retreat the hunter could have
   * walked comes before it so a tie can never be settled by a tile across the
   * map, and the tile it reaches soonest settles what is left, deterministically.
   */
  const { sealsIn } = doors ?? doorsFrom(player, bounds, isBlocked, mustReach);
  const rank = (index: number): readonly number[] => [
    -separation(reached[index]),
    sealsIn.has(tileIndex(reached[index], bounds)) ? 1 : 0,
    playerDistance(reached[index]),
    walk[index] > walkLimit ? 1 : 0,
    aheadOfPlayer(reached[index]),
    walk[index],
  ];

  // Compared in place rather than sorted: `reached` is every tile the hunter
  // can walk to, so on a map 128 tiles square building a rank for each of them
  // is six thousand arrays a call, and this is called from every tile of every
  // map in every gate state by `mapStructure.test.ts`.
  let best = 0;
  let bestRank = rank(0);
  for (let index = 1; index < reached.length; index += 1) {
    const candidate = rank(index);
    for (let place = 0; place < candidate.length; place += 1) {
      if (candidate[place] === bestRank[place]) {
        continue;
      }
      if (candidate[place] < bestRank[place]) {
        best = index;
        bestRank = candidate;
      }
      break;
    }
  }

  return reached[best];
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
