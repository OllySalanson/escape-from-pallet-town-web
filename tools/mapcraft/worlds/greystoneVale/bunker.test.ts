import { describe, expect, it } from 'vitest';
import { mapFileGrid } from '../../../../src/game/world/mapFileChecks';
import { slideReach, slideTrail } from '../../../../src/game/world/slidingFloor';
import {
  STEP_DIRECTIONS,
  type Direction,
  type GridPosition,
} from '../../../../src/game/movement/gridMovement';
import { isBlockedAt } from '../../../../src/game/world/mapStructure';
import { BUNKER_FLOORS, BUNKER_LIFT, marksOf } from './bunker';
import { powerStation } from './powerStation';

/**
 * The Bunker is fair the way a spinner floor has to be: whatever the arrows do
 * to you, you can still get back. Walked as the player walks it - every press
 * a spin where the floor says so (`slidingFloor.ts`) - on the Power Station's
 * own grid, with everybody standing where they stand.
 */

const file = powerStation().file;
const { composed, collision } = mapFileGrid(file);
const key = ({ x, y }: GridPosition) => `${x},${y}`;
const origin = (area: string) => composed.areas.find((placed) => placed.id === area)!.rect;
const onGrid = (area: string, [x, y]: readonly [number, number]): GridPosition => {
  const at = origin(area);
  return { x: at.x + x, y: at.y + y };
};

/** Signs and trainers stand on their tiles, as they do in a raid. */
const standing = new Set(
  [...(file.signs ?? []), ...(file.trainers ?? []), ...(file.people ?? [])].map((spot) =>
    key(spot.area === undefined ? spot : onGrid(spot.area, [spot.x, spot.y])),
  ),
);
const isBlocked = (tile: GridPosition) =>
  isBlockedAt(collision, tile.x, tile.y) || standing.has(key(tile));
const reachFrom = (from: GridPosition) =>
  slideReach(composed.terrain, isBlocked, from, composed.width);

const floor = (id: string) => BUNKER_FLOORS.find((candidate) => candidate.id === id)!;
const mark = (id: string, letter: string) =>
  marksOf(floor(id).rows, letter).map((at) => onGrid(id, at));
const lift = (id: string) =>
  onGrid(id, [
    file.areas!.find((area) => area.id === id)!.lift!.x,
    file.areas!.find((area) => area.id === id)!.lift!.y,
  ]);

/** The fewest presses from one tile to another, and how many of them were spins. */
function solve(
  from: GridPosition,
  to: GridPosition,
): { presses: number; spins: number } | undefined {
  const seen = new Map<string, { presses: number; spins: number }>([
    [key(from), { presses: 0, spins: 0 }],
  ]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head];
    const here = seen.get(key(at))!;
    for (const direction of STEP_DIRECTIONS as readonly Direction[]) {
      const trail = slideTrail(composed.terrain, isBlocked, at, direction);
      const rest = trail.at(-1);
      if (!rest || seen.has(key(rest))) continue;
      seen.set(key(rest), {
        presses: here.presses + 1,
        spins: here.spins + (trail.length > 1 ? 1 : 0),
      });
      queue.push(rest);
    }
  }
  return seen.get(key(to));
}

describe('B2F: the generator across the spinner floor', () => {
  const [stairs] = mark('bunker-b2f', 'S');
  const generator = file
    .areas!.find((area) => area.id === 'bunker-b2f')!
    .switches!.find((spot) => spot.opens === BUNKER_LIFT)!;
  // The generator's switch is its foot; the spin along the top stops against
  // it, on the tile beside it, facing it.
  const besideGenerator = onGrid('bunker-b2f', [generator.x + 1, generator.y]);

  it('takes a player from the stairs to the generator, and only by spinning', () => {
    const route = solve(stairs, besideGenerator);
    expect(route).toBeDefined();
    expect(route!.spins).toBeGreaterThanOrEqual(6);
  });

  it('takes a player from the generator to the lift', () => {
    expect(reachFrom(besideGenerator).has(key(lift('bunker-b2f')))).toBe(true);
  });

  it('never leaves a player anywhere the stairs and the lift are both out of reach', () => {
    const traps = [...reachFrom(stairs).keys()].filter((tile) => {
      const [x, y] = tile.split(',').map(Number);
      const onward = reachFrom({ x, y });
      return !onward.has(key(stairs)) && !onward.has(key(lift('bunker-b2f')));
    });
    expect(traps).toEqual([]);
  });

  it('never spins a player round for ever', () => {
    for (const tile of reachFrom(stairs).keys()) {
      const [x, y] = tile.split(',').map(Number);
      for (const direction of STEP_DIRECTIONS) {
        expect(slideTrail(composed.terrain, isBlocked, { x, y }, direction).length).toBeLessThan(
          64,
        );
      }
    }
  });
});

describe('B3F: the stores behind the arrows', () => {
  const from = lift('bunker-b3f');
  const reached = reachFrom(from);
  const crossed = new Set(
    [...reached.keys()].flatMap((tile) => {
      const [x, y] = tile.split(',').map(Number);
      return [
        tile,
        ...STEP_DIRECTIONS.flatMap((direction) =>
          slideTrail(composed.terrain, isBlocked, { x, y }, direction).map(key),
        ),
      ];
    }),
  );

  it('reaches every find on the floor, the one on the plate only by spinning to it', () => {
    for (const spot of file.itemSpots.filter((candidate) => candidate.area === 'bunker-b3f')) {
      expect(crossed.has(key(onGrid('bunker-b3f', [spot.x, spot.y]))), `${spot.x},${spot.y}`).toBe(
        true,
      );
    }
    const [plate] = mark('bunker-b3f', 'q');
    expect(solve(from, plate)!.spins).toBeGreaterThanOrEqual(4);
  });

  it('brings a player back to the lift from anywhere the arrows leave them', () => {
    const traps = [...reached.keys()].filter((tile) => {
      const [x, y] = tile.split(',').map(Number);
      return !reachFrom({ x, y }).has(key(from));
    });
    expect(traps).toEqual([]);
  });
});

describe('the way down', () => {
  it('has stairs only as far as B2F: below it is the lift', () => {
    const floorsWithStairs = new Set(
      (file.links ?? []).flatMap((link) =>
        link.ends.flatMap((end) => (end.area ? [end.area] : [])),
      ),
    );
    expect(floorsWithStairs.has('bunker-b2f')).toBe(true);
    expect(floorsWithStairs.has('bunker-b3f')).toBe(false);
    expect(floorsWithStairs.has('bunker-b4f')).toBe(false);
    const stops = file
      .areas!.filter((area) => area.lift?.lift === BUNKER_LIFT)
      .map((area) => area.id);
    expect(stops).toEqual(['bunker-b1f', 'bunker-b2f', 'bunker-b3f', 'bunker-b4f']);
  });

  it('is shut at B1F by a shutter only the Card Key opens', () => {
    const b1f = file.areas!.find((area) => area.id === 'bunker-b1f')!;
    expect(b1f.barriers).toEqual([expect.objectContaining({ look: 'shutter' })]);
    expect(b1f.switches).toEqual([
      expect.objectContaining({ kind: 'key', opens: b1f.barriers![0].id }),
    ]);
  });

  it("leaves by its own way out, the escape hatch on B4F, and keeps the vale's locked crate there", () => {
    expect(file.exits).toContainEqual(
      expect.objectContaining({ area: 'bunker-b4f', name: 'Escape Hatch' }),
    );
    expect(file.landmarks).toContainEqual(
      expect.objectContaining({ area: 'bunker-b4f', locked: true }),
    );
  });
});
