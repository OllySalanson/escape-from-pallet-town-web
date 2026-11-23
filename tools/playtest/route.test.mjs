// The one-search route the drivers and the AI playtester walk a raid by.
import { describe, expect, it } from 'vitest';
import { routeTo } from './route.mjs';

/** A world of rows ('#' a wall, 'E' an open exit, 'S' where the player stands), as `routeTo` reads one. */
function world(rows) {
  const exits = [];
  let start = null;
  const collisionData = rows.map((row, y) =>
    [...row].map((cell, x) => {
      if (cell === 'E') exits.push({ position: { x, y } });
      if (cell === 'S') start = { x, y };
      return cell === '#';
    }),
  );
  return {
    collisionData,
    currentTile: start,
    currentMap: { entities: [] },
    entityHeldTiles: () => [],
    trainersForCurrentMap: () => [],
    barredExitsHere: () => [],
    extractionPointsForCurrentMap: () => exits,
    isHunterOnCurrentMap: () => false,
    hunterPackHere: () => undefined,
  };
}

/** The tiles a route walks through, from where the player stands. */
function walked(rows, goal) {
  globalThis.routeWorld = world(rows);
  const keys = eval(routeTo('globalThis.routeWorld', goal));
  if (keys === null) return null;
  const step = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  let at = { ...globalThis.routeWorld.currentTile };
  return keys.map((key) => (at = { x: at.x + step[key][0], y: at.y + step[key][1] }));
}

describe('routeTo', () => {
  it('goes round an open exit in a lane, rather than ending the raid on it', () => {
    // DEER GAP stands at the edge of the Tanglewood road: a walk down the lane
    // past it used to step onto it, and the raid was over.
    const lane = [
      '#S..#',
      '#...#',
      '#E..#',
      '#...#',
      '#...#',
    ];
    const route = walked(lane, { x: 1, y: 4 });
    expect(route).not.toBeNull();
    expect(route.some(({ x, y }) => x === 1 && y === 2)).toBe(false);
    expect(route.at(-1)).toEqual({ x: 1, y: 4 });
  });

  it('goes round a hunter or a roaming figure where it can, and plans through one in a one-tile gap', () => {
    // A beaten hunter stood beside the X in SMUGGLERS' COVE, in the only way
    // out, and the walk said "no way" without a frame passing, so it never
    // moved (scenario loop, 23 Nov 2026). The driver replans a step that does
    // not land, so a route through somebody who will move is a route.
    const gap = ['#S..', '###.', '#...'];
    globalThis.routeWorld = world(gap);
    globalThis.routeWorld.isHunterOnCurrentMap = () => true;
    globalThis.routeWorld.hunterState = { position: { x: 2, y: 0 } };
    const keys = eval(routeTo('globalThis.routeWorld', { x: 1, y: 2 }));
    expect(keys).toEqual(['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowLeft']);
    // With a way round, the figure is gone round.
    const open = ['#S..#', '#...#', '#...#'];
    globalThis.routeWorld = world(open);
    globalThis.routeWorld.currentMap = { entities: [{ id: 'roamer' }] };
    globalThis.routeWorld.entityHeldTiles = () => [{ x: 2, y: 0 }];
    const around = eval(routeTo('globalThis.routeWorld', { x: 3, y: 0 }));
    expect(around).not.toContain(undefined);
    expect(around[0]).toBe('ArrowDown');
  });

  it('crosses an exit only where nothing else gets through', () => {
    const neck = ['#S#', '#E#', '#.#'];
    expect(walked(neck, { x: 1, y: 2 })).toEqual([{ x: 1, y: 1 }, { x: 1, y: 2 }]);
  });

  it('walks onto an exit that is where it was asked to go', () => {
    const lane = ['S.E'];
    expect(walked(lane, { x: 2, y: 0 })).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  });
});
