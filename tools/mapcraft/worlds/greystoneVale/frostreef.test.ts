import { describe, expect, it } from 'vitest';
import { mapFileGrid } from '../../../../src/game/world/mapFileChecks';
import { slideReach, slideTrail } from '../../../../src/game/world/slidingFloor';
import { STEP_DIRECTIONS } from '../../../../src/game/movement/gridMovement';
import { isBlockedAt } from '../../../../src/game/world/mapStructure';
import type { GridPosition } from '../../../../src/game/movement/gridMovement';
import { BERG_FLOORS, markOf } from './bergCave';
import { frostreef, LAGOON_MOUTH, LAPRAS, SHORE_MOUTH } from './frostreef';

/**
 * Frostreef is fair the way a sliding puzzle has to be: whatever the ice does
 * to you, you can still get off the island. Walked as the player walks it -
 * every press a slide (`slidingFloor.ts`), through the cave's ways through -
 * on the district's own grid, with Lapras on the lagoon and, once it has been
 * fought, without.
 */

const file = frostreef().file;
const { composed, collision, links } = mapFileGrid(file);
const key = ({ x, y }: GridPosition) => `${x},${y}`;
const JETTY = { x: 30, y: 10 };
const WHALER = file.exits.find((exit) => exit.name === "Whaler's Boat")!;

function walkedFrom(from: GridPosition, laprasStands: boolean) {
  const isBlocked = (tile: GridPosition) =>
    isBlockedAt(collision, tile.x, tile.y) || (laprasStands && tile.x === LAPRAS[0] && tile.y === LAPRAS[1]);
  return slideReach(composed.terrain, isBlocked, from, composed.width, links);
}

describe.each([true, false])('Frostreef, Lapras on the ice: %s', (laprasStands) => {
  const fromJetty = walkedFrom(JETTY, laprasStands);

  it('takes a player from the jetty under the berg to the lagoon and the whalers\' boat', () => {
    expect(fromJetty.has(`${SHORE_MOUTH[0]},${SHORE_MOUTH[1] + 1}`)).toBe(true);
    expect(fromJetty.has(`${LAGOON_MOUTH[0]},${LAGOON_MOUTH[1] + 1}`)).toBe(true);
    expect(fromJetty.has(key(WHALER))).toBe(true);
  });

  it('reaches every find, hidden or not, and Lapras', () => {
    // A find is picked up by any slide that crosses it, as well as by stopping on it.
    const isBlocked = (tile: GridPosition) =>
      isBlockedAt(collision, tile.x, tile.y) || (laprasStands && tile.x === LAPRAS[0] && tile.y === LAPRAS[1]);
    const crossed = new Set(
      [...fromJetty.keys()].flatMap((tile) => {
        const [x, y] = tile.split(',').map(Number);
        return [tile, ...STEP_DIRECTIONS.flatMap((direction) => slideTrail(composed.terrain, isBlocked, { x, y }, direction).map(key))];
      }),
    );
    const origin = (area?: string) => composed.areas.find((placed) => placed.id === area)!.rect;
    for (const spot of file.itemSpots) {
      const at = origin(spot.area);
      expect(crossed.has(key({ x: at.x + spot.x, y: at.y + spot.y })), `${spot.area ?? 'outdoors'} ${spot.x},${spot.y}`).toBe(true);
    }
    const beside = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => fromJetty.has(`${LAPRAS[0] + dx},${LAPRAS[1] + dy}`));
    expect(beside).toBe(true);
  });

  it('never leaves a player anywhere the jetty and the whalers\' boat are both out of reach', () => {
    const traps = [...fromJetty.keys()].filter((tile) => {
      const [x, y] = tile.split(',').map(Number);
      const onward = walkedFrom({ x, y }, laprasStands);
      return !onward.has(key(JETTY)) && !onward.has(key(WHALER));
    });
    expect(traps).toEqual([]);
  });
});

describe('Berg Cave', () => {
  it('is a puzzle on both floors, not a walk: no straight run from the way in to the way on', () => {
    for (const floor of BERG_FLOORS) {
      const [enter] = markOf(floor, 'S');
      const [leave] = markOf(floor, 'E');
      expect(enter[0] === leave[0] || enter[1] === leave[1], floor.id).toBe(false);
    }
  });
});
