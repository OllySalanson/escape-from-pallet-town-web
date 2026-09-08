import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { findWatchingTrainer, isTileWatched, trainerSightTiles } from './trainerSight';

/** A 5x5 room with a wall down column 3, so sight has something to stop on. */
const WALL_COLUMN = 3;
const isBlocked = (tile: GridPosition): boolean =>
  tile.x < 0 || tile.y < 0 || tile.x > 4 || tile.y > 4 || tile.x === WALL_COLUMN;

describe('trainer sight', () => {
  it('watches the ground in front of the trainer and never the trainer itself', () => {
    expect(
      trainerSightTiles({ position: { x: 1, y: 4 }, facing: 'up', sightRange: 3 }, isBlocked),
    ).toEqual([
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
    ]);
  });

  it('stops at the first wall rather than seeing through it', () => {
    expect(
      trainerSightTiles({ position: { x: 1, y: 1 }, facing: 'right', sightRange: 4 }, isBlocked),
    ).toEqual([{ x: 2, y: 1 }]);
  });

  it('stops at the edge of the map', () => {
    expect(
      trainerSightTiles({ position: { x: 1, y: 1 }, facing: 'up', sightRange: 4 }, isBlocked),
    ).toEqual([{ x: 1, y: 0 }]);
  });

  it('watches nothing without a sight range, which is how a trainer stays spoken-to', () => {
    const spokenTo = { position: { x: 1, y: 4 }, facing: 'up' } as const;
    expect(trainerSightTiles(spokenTo, isBlocked)).toEqual([]);
    expect(isTileWatched(spokenTo, { x: 1, y: 3 }, isBlocked)).toBe(false);
    expect(
      trainerSightTiles({ ...spokenTo, sightRange: 0 }, isBlocked),
    ).toEqual([]);
  });

  it('names the trainer whose watch a tile falls in, in authored order', () => {
    const north = {
      id: 'north',
      position: { x: 1, y: 0 },
      facing: 'down',
      sightRange: 4,
    } as const;
    const south = {
      id: 'south',
      position: { x: 1, y: 4 },
      facing: 'up',
      sightRange: 4,
    } as const;
    const watches = [north, south];

    expect(findWatchingTrainer(watches, { x: 1, y: 1 }, isBlocked)?.id).toBe('north');
    expect(findWatchingTrainer(watches, { x: 1, y: 2 }, isBlocked)?.id).toBe('north');
    expect(findWatchingTrainer(watches, { x: 2, y: 2 }, isBlocked)).toBeUndefined();
    // Their own tiles are outside both watches, so standing on one is not a fight.
    expect(findWatchingTrainer(watches, { x: 1, y: 0 }, isBlocked)?.id).toBe('south');
    expect(findWatchingTrainer([south], { x: 1, y: 4 }, isBlocked)).toBeUndefined();
  });
});
