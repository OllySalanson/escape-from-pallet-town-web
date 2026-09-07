import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { RunManager } from '../run/RunManager';
import { createActiveRunSession } from '../run/RunSession';
import { WORLD_MAPS, type WorldMapId } from '../worldMap';
import {
  chooseHunterPursuitStep,
  findHunterPursuitPath,
  hunterTierFor,
  isHunterContactingPlayer,
  resolveHunterBattleLoss,
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
    let hunter = { x: 20, y: 5 };
    const patrol = [
      { x: 5, y: 2 },
      { x: 5, y: 3 },
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
    const pursuit = runPursuit({ x: 15, y: 5 }, { x: 8, y: 18 }, bounds, isBlocked);

    expect(pursuit.contacted).toBe(true);
    expect(pursuit.steps).toBeLessThanOrEqual(20);
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
