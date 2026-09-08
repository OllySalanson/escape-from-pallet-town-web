import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { RunManager } from '../run/RunManager';
import { createActiveRunSession } from '../run/RunSession';
import { WORLD_MAPS, type WorldMapId } from '../worldMap';
import {
  HUNTER_BREAKAWAY_DISTANCE,
  HUNTER_SEARCH_MS,
  applyHunterBreakaway,
  beginHunterDisengage,
  chooseHunterPursuitStep,
  createHunterState,
  findHunterBreakawayTile,
  findHunterPursuitPath,
  findHunterSpawnTile,
  HUNTER_MINIMUM_SPAWN_DISTANCE,
  HUNTER_SPAWN_DISTANCE,
  hunterTierFor,
  isHunterContactingPlayer,
  isHunterSearching,
  resolveHunterBattleLoss,
  tickHunterSearch,
} from './hunter';

const mapBlocker = (mapId: WorldMapId) => {
  const map = WORLD_MAPS[mapId];
  return {
    bounds: { width: map.width, height: map.height },
    isBlocked: (tile: { x: number; y: number }) => map.collision[tile.y][tile.x],
    walkableTiles: map.collision.flatMap((row, y) =>
      row.flatMap((blocked, x) => (blocked ? [] : [{ x, y }])),
    ),
  };
};

/** Independent flood fill, so the pursuit's own search is not its own oracle. */
const tilesConnectedTo = (
  origin: { x: number; y: number },
  bounds: { width: number; height: number },
  isBlocked: (tile: { x: number; y: number }) => boolean,
): Set<string> => {
  const connected = new Set([`${origin.x},${origin.y}`]);
  const frontier = [origin];
  while (frontier.length > 0) {
    const tile = frontier.pop()!;
    for (const delta of [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ]) {
      const next = { x: tile.x + delta.x, y: tile.y + delta.y };
      const key = `${next.x},${next.y}`;
      if (
        next.x < 0 || next.y < 0 || next.x >= bounds.width || next.y >= bounds.height ||
        connected.has(key) || isBlocked(next)
      ) {
        continue;
      }
      connected.add(key);
      frontier.push(next);
    }
  }
  return connected;
};

/** Walks the hunter one chosen step at a time, exactly as the world tick does. */
const runPursuit = (
  start: { x: number; y: number },
  player: { x: number; y: number },
  bounds: { width: number; height: number },
  isBlocked: (tile: { x: number; y: number }) => boolean,
  maxSteps = 400,
) => {
  const visited: { x: number; y: number }[] = [start];
  let position = start;
  for (let step = 0; step < maxSteps; step += 1) {
    if (isHunterContactingPlayer(position, player)) {
      return { contacted: true, steps: step, visited };
    }
    const next = chooseHunterPursuitStep(position, player, bounds, isBlocked);
    if (!next) {
      return { contacted: false, steps: step, visited };
    }
    position = next;
    visited.push(position);
  }
  return { contacted: false, steps: maxSteps, visited };
};

describe('chooseHunterPursuitStep', () => {
  it('chooses the best legal route around a wall', () => {
    expect(
      chooseHunterPursuitStep(
        { x: 2, y: 2 },
        { x: 5, y: 2 },
        { width: 8, height: 8 },
        (tile) => tile.x === 3 && tile.y === 2,
      ),
    ).toEqual({ x: 2, y: 1 });
  });

  it('walks around a barrier the greedy step used to stick against', () => {
    // A wall spanning the direct approach, open only at the very top.
    const isBlocked = (tile: { x: number; y: number }) => tile.x === 4 && tile.y > 0;
    const bounds = { width: 9, height: 9 };
    const pursuit = runPursuit({ x: 2, y: 6 }, { x: 6, y: 6 }, bounds, isBlocked);

    expect(pursuit.contacted).toBe(true);
    // Six up, four across the gap, five back down: the only legal route there.
    expect(pursuit.steps).toBe(15);
    expect(pursuit.visited).toContainEqual({ x: 4, y: 0 });
  });

  it('commits to the long axis of the chase when routes are the same length', () => {
    const bounds = { width: 16, height: 16 };
    const open = () => false;

    // Six tiles west and one north: the westward run is the readable step, and taking it
    // keeps the hunter closing instead of bobbing between two equally short routes.
    expect(chooseHunterPursuitStep({ x: 11, y: 2 }, { x: 5, y: 3 }, bounds, open)).toEqual({
      x: 10,
      y: 2,
    });
    expect(chooseHunterPursuitStep({ x: 5, y: 11 }, { x: 4, y: 5 }, bounds, open)).toEqual({
      x: 5,
      y: 10,
    });
  });

  it('keeps closing on a player who steps back and forth on the spot', () => {
    const { bounds, isBlocked } = mapBlocker('pallet-town');
    let hunter = { x: 10, y: 11 };
    const patrol = [
      { x: 5, y: 2 },
      { x: 6, y: 2 },
    ];

    for (let step = 0; step < 40; step += 1) {
      const player = patrol[step % patrol.length];
      if (isHunterContactingPlayer(hunter, player)) {
        expect(step).toBeLessThan(40);
        return;
      }
      hunter = chooseHunterPursuitStep(hunter, player, bounds, isBlocked)!;
      expect(hunter).not.toBeNull();
    }
    throw new Error(`hunter never reached the patrolling player, stopped at ${JSON.stringify(hunter)}`);
  });

  it('closes on the barrier when the player is unreachable, even while they shuffle', () => {
    // A full-height wall the hunter cannot cross, with the player on the far side.
    const isBlocked = (tile: { x: number; y: number }) => tile.x === 9;
    const bounds = { width: 16, height: 16 };
    const patrol = [
      { x: 5, y: 2 },
      { x: 5, y: 3 },
    ];
    let hunter = { x: 14, y: 2 };
    const visited: string[] = [];

    for (let step = 0; step < 20; step += 1) {
      const player = patrol[step % patrol.length];
      const next = chooseHunterPursuitStep(hunter, player, bounds, isBlocked);
      if (next) {
        hunter = next;
      }
      visited.push(`${hunter.x},${hunter.y}`);
    }

    // It reaches the wall rather than bobbing in place four tiles short of it,
    // and then holds the wall, only tracking the player along it.
    expect(hunter.x).toBe(10);
    expect(visited.slice(6).every((tile) => tile.startsWith('10,'))).toBe(true);
  });

  it('reaches the player from the traced Floodplain Relay failure case', () => {
    // Roadmap B1: greedy pursuit walked 200 steps from here, changed direction 187 times
    // and never arrived, ending up bouncing between two tiles pinned against a wall.
    const { bounds, isBlocked } = mapBlocker('floodplain-relay');
    const hunter = { x: 15, y: 5 };
    const player = { x: 8, y: 18 };
    const pursuit = runPursuit(hunter, player, bounds, isBlocked);

    expect(pursuit.contacted).toBe(true);
    // It walks the map's own shortest route - the doglegged road and a reed
    // crossing - rather than wandering the length of it.
    expect(pursuit.steps).toBeLessThanOrEqual(walkDistance(hunter, player, bounds, isBlocked));
  });

  it('is deterministic for the same map, hunter and player positions', () => {
    const { bounds, isBlocked } = mapBlocker('pallet-town');
    const first = findHunterPursuitPath({ x: 15, y: 5 }, { x: 8, y: 18 }, bounds, isBlocked);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(findHunterPursuitPath({ x: 15, y: 5 }, { x: 8, y: 18 }, bounds, isBlocked)).toEqual(
        first,
      );
    }
  });

  it('holds position instead of jittering when the player is walled off', () => {
    // A sealed room around the player: no legal route exists at all.
    const isBlocked = (tile: { x: number; y: number }) =>
      Math.abs(tile.x - 6) <= 2 && Math.abs(tile.y - 6) <= 2 && !(tile.x === 6 && tile.y === 6);
    const bounds = { width: 12, height: 12 };
    const pursuit = runPursuit({ x: 1, y: 6 }, { x: 6, y: 6 }, bounds, isBlocked);

    expect(pursuit.contacted).toBe(false);
    // It closes to the nearest tile it can actually stand on, then stops for good.
    expect(pursuit.visited.at(-1)).toEqual({ x: 6, y: 3 });
    expect(chooseHunterPursuitStep({ x: 6, y: 3 }, { x: 6, y: 6 }, bounds, isBlocked)).toBeNull();
    // No tile is ever revisited: it approaches once and settles.
    expect(new Set(pursuit.visited.map((tile) => `${tile.x},${tile.y}`)).size).toBe(
      pursuit.visited.length,
    );
  });

  it('either reaches the player or correctly reports no route, from every tile of every map', () => {
    const mapIds: WorldMapId[] = ['pallet-town', 'route-1', 'viridian-forest', 'floodplain-relay'];

    for (const mapId of mapIds) {
      const { bounds, isBlocked, walkableTiles } = mapBlocker(mapId);
      const player = walkableTiles[Math.floor(walkableTiles.length / 2)];
      const reachable = tilesConnectedTo(player, bounds, isBlocked);

      for (const start of walkableTiles) {
        const path = findHunterPursuitPath(start, player, bounds, isBlocked);
        const end = path.at(-1) ?? start;
        expect({ mapId, start, contacted: isHunterContactingPlayer(end, player) }).toEqual({
          mapId,
          start,
          contacted: reachable.has(`${start.x},${start.y}`),
        });
      }
    }
  });

  it('actually walks each route to its end, sampled across every map', () => {
    const mapIds: WorldMapId[] = ['pallet-town', 'route-1', 'viridian-forest', 'floodplain-relay'];

    for (const mapId of mapIds) {
      const { bounds, isBlocked, walkableTiles } = mapBlocker(mapId);
      const player = walkableTiles[Math.floor(walkableTiles.length / 2)];
      const reachable = tilesConnectedTo(player, bounds, isBlocked);

      for (let index = 0; index < walkableTiles.length; index += 37) {
        const start = walkableTiles[index];
        const pursuit = runPursuit(start, player, bounds, isBlocked, bounds.width * bounds.height);
        expect({ mapId, start, contacted: pursuit.contacted }).toEqual({
          mapId,
          start,
          contacted: reachable.has(`${start.x},${start.y}`),
        });
        // Never a tile twice: the walk closes in and stops rather than oscillating.
        expect(new Set(pursuit.visited.map((tile) => `${tile.x},${tile.y}`)).size).toBe(
          pursuit.visited.length,
        );
      }
    }
  });
});

describe('hunterTierFor', () => {
  it('escalates with elapsed raid time and reaches its strongest team while enraged', () => {
    expect(hunterTierFor(0, false)).toMatchObject({ level: 6, party: [{ id: 'pidgey' }] });
    expect(hunterTierFor(120_000, false)).toMatchObject({ level: 9, party: [{ id: 'pidgey' }, { id: 'bulbasaur' }] });
    expect(hunterTierFor(240_000, false)).toMatchObject({ level: 12, party: [{ id: 'pidgey' }, { id: 'bulbasaur' }, { id: 'pikachu' }] });
    expect(hunterTierFor(10_000, true)).toMatchObject({ level: 15, party: [{ id: 'pidgey' }, { id: 'bulbasaur' }, { id: 'pikachu' }] });
  });
});

describe('resolveHunterBattleLoss', () => {
  it('uses the run secure slot when a hunter battle wipes the player', () => {
    const securePokemon = new Pokemon(CHARMANDER, 5);
    const lostPokemon = new Pokemon(CHARMANDER, 6);
    const loadout = {
      party: [securePokemon, lostPokemon],
      items: [{ itemId: 'potion' as const, quantity: 2 }],
    };
    const secureSlot = { pokemon: securePokemon, items: [{ itemId: 'potion' as const, quantity: 1 }] };
    const manager = new RunManager();
    manager.startRun(loadout, { mapId: 'pallet-town', durationMs: 60_000 }, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      { pokemonId: 'charmander-1', items: secureSlot.items },
      ['charmander-1', 'charmander-2'],
      loadout.items,
    );

    expect(resolveHunterBattleLoss(session)).toMatchObject({
      outcome: 'WIPED',
      bankedPokemon: [securePokemon],
      lostPokemon: [lostPokemon],
      bankedItems: [{ itemId: 'potion', quantity: 1 }],
      lostItems: [{ itemId: 'potion', quantity: 1 }],
    });
  });
});

/** Walkable path length between two tiles, independent of the hunter's own search. */
const walkDistance = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  bounds: { width: number; height: number },
  isBlocked: (tile: { x: number; y: number }) => boolean,
): number => {
  const seen = new Set([`${from.x},${from.y}`]);
  let frontier = [from];
  for (let distance = 0; frontier.length > 0; distance += 1) {
    if (frontier.some((tile) => tile.x === to.x && tile.y === to.y)) {
      return distance;
    }
    const next: { x: number; y: number }[] = [];
    for (const tile of frontier) {
      for (const delta of [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ]) {
        const neighbour = { x: tile.x + delta.x, y: tile.y + delta.y };
        const key = `${neighbour.x},${neighbour.y}`;
        if (
          neighbour.x < 0 || neighbour.y < 0 ||
          neighbour.x >= bounds.width || neighbour.y >= bounds.height ||
          seen.has(key) || isBlocked(neighbour)
        ) {
          continue;
        }
        seen.add(key);
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  return Number.POSITIVE_INFINITY;
};

describe('breaking contact with the hunter', () => {
  const open = () => false;

  it('puts the full breakaway gap between a contacting hunter and the player', () => {
    const bounds = { width: 20, height: 20 };
    const player = { x: 10, y: 10 };
    const hunter = { x: 10, y: 9 };

    const breakaway = findHunterBreakawayTile(hunter, player, bounds, open);

    expect(walkDistance(breakaway, player, bounds, open)).toBe(HUNTER_BREAKAWAY_DISTANCE);
  });

  it('falls back along the route it came by rather than teleporting across the map', () => {
    // A single corridor: every escape route is the way the hunter arrived.
    const bounds = { width: 20, height: 3 };
    const isBlocked = (tile: { x: number; y: number }) => tile.y !== 1;
    const player = { x: 10, y: 1 };

    expect(findHunterBreakawayTile({ x: 9, y: 1 }, player, bounds, isBlocked)).toEqual({
      x: 4,
      y: 1,
    });
    expect(findHunterBreakawayTile({ x: 11, y: 1 }, player, bounds, isBlocked)).toEqual({
      x: 16,
      y: 1,
    });
  });

  it('takes the best separation a cramped area allows instead of failing', () => {
    // A three-tile pocket: six tiles of separation simply do not exist here.
    const bounds = { width: 5, height: 3 };
    const isBlocked = (tile: { x: number; y: number }) => tile.y !== 1 || tile.x > 2;
    const player = { x: 0, y: 1 };

    const breakaway = findHunterBreakawayTile({ x: 1, y: 1 }, player, bounds, isBlocked);

    expect(breakaway).toEqual({ x: 2, y: 1 });
    expect(walkDistance(breakaway, player, bounds, isBlocked)).toBe(2);
  });

  it('never falls back onto the player', () => {
    const bounds = { width: 3, height: 1 };
    const player = { x: 1, y: 0 };

    expect(findHunterBreakawayTile({ x: 0, y: 0 }, player, bounds, open)).not.toEqual(player);
  });

  it('holds pursuit until the search window is spent, then resumes it', () => {
    const spawned = { ...createHunterState(), spawned: true, position: { x: 10, y: 9 } };

    const disengaged = beginHunterDisengage(spawned);
    expect(isHunterSearching(disengaged)).toBe(true);
    expect(disengaged.pendingBreakaway).toBe(true);

    const halfway = tickHunterSearch(disengaged, HUNTER_SEARCH_MS - 1);
    expect(isHunterSearching(halfway)).toBe(true);

    const resumed = tickHunterSearch(halfway, 1);
    expect(isHunterSearching(resumed)).toBe(false);
    // The threat must come back: an escape buys time, it does not end the hunt.
    expect(resumed.defeated).toBe(false);
    expect(resumed.spawned).toBe(true);
  });

  it('clears the pending marker once the world has placed the hunter', () => {
    const disengaged = beginHunterDisengage({
      ...createHunterState(),
      spawned: true,
      position: { x: 10, y: 9 },
    });

    const placed = applyHunterBreakaway(disengaged, { x: 10, y: 4 });

    expect(placed.position).toEqual({ x: 10, y: 4 });
    expect(placed.pendingBreakaway).toBe(false);
    expect(placed.searchRemainingMs).toBe(HUNTER_SEARCH_MS);
  });

  it('leaves the player far enough out that a step does not walk back into contact', () => {
    // The bug this exists to kill: fleeing used to return the player adjacent, so the
    // next step handed the same battle straight back.
    const bounds = { width: 20, height: 20 };
    const player = { x: 10, y: 10 };
    const breakaway = findHunterBreakawayTile({ x: 10, y: 9 }, player, bounds, open);

    expect(isHunterContactingPlayer(breakaway, player)).toBe(false);
    // Even a hunter taking two steps per player step needs several before contact.
    const path = findHunterPursuitPath(breakaway, player, bounds, open);
    expect(path.length).toBeGreaterThanOrEqual(HUNTER_BREAKAWAY_DISTANCE - 1);
  });

  it('measures the escape on a real map, not an empty grid', () => {
    const { bounds, isBlocked } = mapBlocker('floodplain-relay');
    const player = { x: 15, y: 20 };
    const hunter = chooseHunterPursuitStep({ x: 15, y: 25 }, player, bounds, isBlocked)!;

    const breakaway = findHunterBreakawayTile(hunter, player, bounds, isBlocked);

    expect(walkDistance(breakaway, player, bounds, isBlocked)).toBe(HUNTER_BREAKAWAY_DISTANCE);
    expect(isHunterContactingPlayer(breakaway, player)).toBe(false);
  });
});

/**
 * One overworld step, in the exact order WorldScene.advanceStep runs it: contact check,
 * pursuit, contact check. The 130ms is STEP_DURATION_MS, so the search window is spent
 * at the rate a walking player actually spends it.
 */
const WORLD_STEP_MS = 130;

const simulateWorldSteps = (
  initialState: ReturnType<typeof createHunterState>,
  start: { x: number; y: number },
  moves: readonly { x: number; y: number }[],
  bounds: { width: number; height: number },
  isBlocked: (tile: { x: number; y: number }) => boolean,
  stepsPerPlayerStep = 1,
) => {
  let state = initialState;
  let player = start;
  for (const [index, move] of moves.entries()) {
    player = { x: player.x + move.x, y: player.y + move.y };
    state = tickHunterSearch(state, WORLD_STEP_MS);
    const engages = () =>
      !isHunterSearching(state) && isHunterContactingPlayer(state.position!, player);
    if (engages()) {
      return { engagedAtStep: index, state, player };
    }
    if (!isHunterSearching(state)) {
      const path = findHunterPursuitPath(state.position!, player, bounds, isBlocked);
      let position = state.position!;
      for (let step = 0; step < stepsPerPlayerStep && step < path.length; step += 1) {
        position = path[step];
        if (isHunterContactingPlayer(position, player)) {
          break;
        }
      }
      state = { ...state, position };
    }
    if (engages()) {
      return { engagedAtStep: index, state, player };
    }
  }
  return { engagedAtStep: null, state, player };
};

describe('a raid where the player flees and then walks', () => {
  const bounds = { width: 200, height: 20 };
  const open = () => false;
  const west = { x: -1, y: 0 };
  const still = { x: 0, y: 0 };
  const player = { x: 150, y: 10 };

  const fledState = () => {
    const contacting = {
      ...createHunterState(),
      spawned: true,
      mapId: 'route-1' as const,
      position: { x: 150, y: 9 },
    };
    const disengaged = beginHunterDisengage(contacting);
    return applyHunterBreakaway(
      disengaged,
      findHunterBreakawayTile(disengaged.position!, player, bounds, open),
    );
  };

  it('is not dragged straight back into the same battle', () => {
    const walk = simulateWorldSteps(fledState(), player, [west, west, west], bounds, open);

    expect(walk.engagedAtStep).toBeNull();
  });

  it('buys the whole search window of walking, whatever direction the player takes', () => {
    const windowSteps = Math.floor(HUNTER_SEARCH_MS / WORLD_STEP_MS);
    // Standing still is the worst case: the hunter would close on a stationary player
    // at one tile per step, so nothing but the search window is protecting them.
    const held = simulateWorldSteps(
      fledState(),
      player,
      Array.from({ length: windowSteps }, () => still),
      bounds,
      open,
    );

    expect(windowSteps).toBe(115);
    expect(held.engagedAtStep).toBeNull();
  });

  it('turns a spent search window into real ground when the player runs with it', () => {
    const windowSteps = Math.floor(HUNTER_SEARCH_MS / WORLD_STEP_MS);
    const run = simulateWorldSteps(
      fledState(),
      player,
      Array.from({ length: windowSteps }, () => west),
      bounds,
      open,
      2,
    );

    // The window is worth what the player does with it: 76 steps of walking puts the
    // map between them, which even a two-steps-per-step enraged hunter has to walk back.
    expect(run.engagedAtStep).toBeNull();
    expect(walkDistance(run.state.position!, run.player, bounds, open)).toBeGreaterThan(70);
  });

  it('gives an enraged hunter that regains the trail only the breakaway gap', () => {
    const windowSteps = Math.floor(HUNTER_SEARCH_MS / WORLD_STEP_MS);
    // The worst case for the player: they spent the whole window standing still, so all
    // that is left of the escape is the ground the breakaway bought them.
    const chase = simulateWorldSteps(
      fledState(),
      player,
      Array.from({ length: windowSteps + 40 }, () => still),
      bounds,
      open,
      2,
    );

    expect(chase.engagedAtStep).toBe(windowSteps + 2);
  });

  it('does not make the hunter permanently harmless', () => {
    const windowSteps = Math.floor(HUNTER_SEARCH_MS / WORLD_STEP_MS);
    const stopped = simulateWorldSteps(
      fledState(),
      player,
      Array.from({ length: windowSteps + 40 }, () => still),
      bounds,
      open,
    );

    expect(stopped.engagedAtStep).not.toBeNull();
    expect(stopped.engagedAtStep!).toBeGreaterThanOrEqual(windowSteps);
  });
});

/** Every walkable tile's distance from an origin, so a candidate can be checked in O(1). */
const walkDistancesFrom = (
  origin: { x: number; y: number },
  bounds: { width: number; height: number },
  isBlocked: (tile: { x: number; y: number }) => boolean,
): Map<string, number> => {
  const distances = new Map([[`${origin.x},${origin.y}`, 0]]);
  const frontier = [origin];
  for (let head = 0; head < frontier.length; head += 1) {
    const tile = frontier[head];
    const distance = distances.get(`${tile.x},${tile.y}`)!;
    for (const delta of [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ]) {
      const neighbour = { x: tile.x + delta.x, y: tile.y + delta.y };
      const key = `${neighbour.x},${neighbour.y}`;
      if (
        neighbour.x < 0 || neighbour.y < 0 ||
        neighbour.x >= bounds.width || neighbour.y >= bounds.height ||
        distances.has(key) || isBlocked(neighbour)
      ) {
        continue;
      }
      distances.set(key, distance + 1);
      frontier.push(neighbour);
    }
  }
  return distances;
};

/**
 * Every tile the spawn search would consider, not just the one it happened to pick.
 * A spawn this rare proves nothing from a single lucky roll, so the tests check the
 * whole candidate set from every tile of every map.
 */
const spawnCandidates = (
  player: { x: number; y: number },
  bounds: { width: number; height: number },
  isBlocked: (tile: { x: number; y: number }) => boolean,
): { x: number; y: number }[] => {
  const offered: { x: number; y: number }[] = [];
  const chosen = findHunterSpawnTile(player, bounds, isBlocked, (candidates) => {
    offered.push(...candidates);
    return candidates[0];
  });
  // A tile returned without going through the pick is a spawn no candidate list vouched
  // for - exactly the shape the old fallback had - so it counts as an offer here.
  if (chosen && !offered.some((tile) => tile.x === chosen.x && tile.y === chosen.y)) {
    offered.push(chosen);
  }
  return offered;
};

describe('findHunterSpawnTile', () => {
  const mapIds = Object.keys(WORLD_MAPS) as WorldMapId[];

  it.each(mapIds)('never offers a tile on or beside the player anywhere on %s', (mapId) => {
    const { bounds, isBlocked, walkableTiles } = mapBlocker(mapId);
    const tooClose: string[] = [];

    for (const player of walkableTiles) {
      const distances = walkDistancesFrom(player, bounds, isBlocked);
      for (const candidate of spawnCandidates(player, bounds, isBlocked)) {
        const distance = distances.get(`${candidate.x},${candidate.y}`);
        if (distance === undefined || distance < HUNTER_MINIMUM_SPAWN_DISTANCE) {
          tooClose.push(`${player.x},${player.y} -> ${candidate.x},${candidate.y}`);
        }
      }
    }

    expect(tooClose).toEqual([]);
  });

  it.each(mapIds)('offers the authored spawn distance from every tile of %s', (mapId) => {
    const { bounds, isBlocked, walkableTiles } = mapBlocker(mapId);
    const short: string[] = [];

    for (const player of walkableTiles) {
      const distances = walkDistancesFrom(player, bounds, isBlocked);
      const candidates = spawnCandidates(player, bounds, isBlocked);
      // Every authored map is open enough to hold the full lead time from every tile,
      // so the short-area path below is dead code in shipped content, not a fallback
      // the player meets. Walled-in candidates used to send the search to the player's
      // own tile instead.
      if (
        candidates.length === 0 ||
        candidates.some(
          (tile) => distances.get(`${tile.x},${tile.y}`) !== HUNTER_SPAWN_DISTANCE,
        )
      ) {
        short.push(`${player.x},${player.y}`);
      }
    }

    expect(short).toEqual([]);
  });

  it('offers a real spawn where the four straight lines are all walled off', () => {
    // On maps built out of lanes this is the common case, not the corner case:
    // the Floodplain Relay landing jetty - where every raid starts - has nothing
    // walkable five tiles due north, south, east or west of it.
    const { bounds, isBlocked } = mapBlocker('floodplain-relay');
    const player = { x: 15, y: 3 };
    const straightLines = [
      { x: player.x - 5, y: player.y },
      { x: player.x + 5, y: player.y },
      { x: player.x, y: player.y - 5 },
      { x: player.x, y: player.y + 5 },
    ].filter(
      (tile) =>
        tile.x >= 0 && tile.y >= 0 && tile.x < bounds.width && tile.y < bounds.height &&
        !isBlocked(tile),
    );
    expect(straightLines).toEqual([]);

    const spawn = findHunterSpawnTile(player, bounds, isBlocked);
    expect(spawn).not.toBeNull();
    expect(walkDistance(spawn!, player, bounds, isBlocked)).toBe(HUNTER_SPAWN_DISTANCE);
  });

  it('lets the run seed choose between the tiles the map offers', () => {
    const bounds = { width: 12, height: 12 };
    const open = () => false;
    const candidates = spawnCandidates({ x: 6, y: 6 }, bounds, open);

    expect(candidates.length).toBeGreaterThan(4);
    expect(findHunterSpawnTile({ x: 6, y: 6 }, bounds, open, (tiles) => tiles[3])).toEqual(
      candidates[3],
    );
  });

  it('settles for the best an enclosed area can offer', () => {
    // A five-tile corridor: the far end is four steps away, all this room allows.
    const bounds = { width: 5, height: 1 };
    const spawn = findHunterSpawnTile({ x: 0, y: 0 }, bounds, () => false);

    expect(spawn).toEqual({ x: 4, y: 0 });
  });

  it('refuses to spawn rather than appear on top of the player', () => {
    // Three walkable tiles is not enough room for a hunter the player can see coming,
    // so it waits for them to move instead. WorldScene retries on the next tick.
    expect(findHunterSpawnTile({ x: 0, y: 0 }, { width: 3, height: 1 }, () => false)).toBeNull();
    expect(findHunterSpawnTile({ x: 9, y: 9 }, { width: 3, height: 3 }, () => false)).toBeNull();
  });
});
