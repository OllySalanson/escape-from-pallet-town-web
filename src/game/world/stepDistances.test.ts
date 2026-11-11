import { describe, expect, it } from 'vitest';
import { linkTable } from '../movement/gridMovement';
import { stepDistances, type CollisionGrid } from './mapStructure';

/** `#` is a wall and anything else is ground. */
const grid = (...rows: string[]): CollisionGrid => rows.map((row) => [...row].map((cell) => cell === '#'));
const read = (field: readonly Int32Array[]): number[][] => field.map((row) => Array.from(row));

describe('stepDistances', () => {
  it('counts orthogonal steps round walls, and -1 where nothing reaches', () => {
    expect(read(stepDistances(grid('..#.', '..#.', '....'), { x: 0, y: 0 }))).toEqual([
      [0, 1, -1, 7],
      [1, 2, -1, 6],
      [2, 3, 4, 5],
    ]);
    expect(read(stepDistances(grid('.#.', '##.'), { x: 0, y: 0 }))).toEqual([
      [0, -1, -1],
      [-1, -1, -1],
    ]);
  });

  it('walls off the extra tiles it is handed, and ignores ones off the grid', () => {
    expect(read(stepDistances(grid('...', '...'), { x: 0, y: 0 }, new Set(['1,0', '1,1', '9,9', 'nonsense'])))).toEqual([
      [0, -1, -1],
      [1, -1, -1],
    ]);
  });

  it('reads nothing from a start that is a wall, an extra wall or off the grid', () => {
    const nowhere = [
      [-1, -1],
      [-1, -1],
    ];
    expect(read(stepDistances(grid('#.', '..'), { x: 0, y: 0 }))).toEqual(nowhere);
    expect(read(stepDistances(grid('..', '..'), { x: 1, y: 1 }, new Set(['1,1'])))).toEqual(nowhere);
    expect(read(stepDistances(grid('..', '..'), { x: 2, y: 0 }))).toEqual(nowhere);
    expect(read(stepDistances(grid('..', '..'), { x: 0, y: -1 }))).toEqual(nowhere);
  });

  it('reads a short row as blocked past its end', () => {
    const ragged: CollisionGrid = [[false, false, false], [false]];
    expect(read(stepDistances(ragged, { x: 0, y: 1 }))).toEqual([
      [1, 2, 3],
      [0, -1, -1],
    ]);
  });

  it('takes a doorway as one step, only the way it was laid, and never into a wall', () => {
    const rooms = grid('..#..', '..#.#');
    const links = linkTable(
      [
        { from: { x: 1, y: 0 }, toward: 'right', to: { x: 3, y: 1 } },
        // A doorway onto a wall is never walked through.
        { from: { x: 0, y: 1 }, toward: 'down', to: { x: 4, y: 1 } },
      ],
      5,
    );
    expect(read(stepDistances(rooms, { x: 0, y: 0 }, undefined, links))).toEqual([
      [0, 1, -1, 3, 4],
      [1, 2, -1, 2, -1],
    ]);
    // Laid one way only, so the far room does not lead back.
    expect(read(stepDistances(rooms, { x: 3, y: 1 }, undefined, links))).toEqual([
      [-1, -1, -1, 1, 2],
      [-1, -1, -1, 0, -1],
    ]);
  });
});
