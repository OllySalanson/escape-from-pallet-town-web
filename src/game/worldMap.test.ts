import { describe, expect, it } from 'vitest';
import {
  buildCollisionData,
  buildDetailLayerData,
  buildGroundLayerData,
  CLASSIC_TILE,
  MAP_HEIGHT,
  MAP_WIDTH,
} from './worldMap';

describe('worldMap', () => {
  it('builds complete ground and detail layers', () => {
    for (const layer of [buildGroundLayerData(), buildDetailLayerData()]) {
      expect(layer).toHaveLength(MAP_HEIGHT);
      expect(layer.every((row) => row.length === MAP_WIDTH)).toBe(true);
    }
  });

  it('builds a continuous bank around the pond', () => {
    const ground = buildGroundLayerData();

    expect(ground.slice(2, 8).map((row) => row.slice(12, 19))).toEqual([
      [
        CLASSIC_TILE.POND_BANK_NORTH_WEST,
        CLASSIC_TILE.POND_BANK_NORTH,
        CLASSIC_TILE.POND_BANK_NORTH,
        CLASSIC_TILE.POND_BANK_NORTH,
        CLASSIC_TILE.POND_BANK_NORTH,
        CLASSIC_TILE.POND_BANK_NORTH,
        CLASSIC_TILE.POND_BANK_NORTH_EAST,
      ],
      ...Array.from({ length: 4 }, () => [
        CLASSIC_TILE.POND_BANK_WEST,
        CLASSIC_TILE.POND_WATER,
        CLASSIC_TILE.POND_WATER,
        CLASSIC_TILE.POND_WATER,
        CLASSIC_TILE.POND_WATER,
        CLASSIC_TILE.POND_WATER,
        CLASSIC_TILE.POND_BANK_EAST,
      ]),
      [
        CLASSIC_TILE.POND_BANK_SOUTH_WEST,
        CLASSIC_TILE.POND_BANK_SOUTH,
        CLASSIC_TILE.POND_BANK_SOUTH,
        CLASSIC_TILE.POND_BANK_SOUTH,
        CLASSIC_TILE.POND_BANK_SOUTH,
        CLASSIC_TILE.POND_BANK_SOUTH,
        CLASSIC_TILE.POND_BANK_SOUTH_EAST,
      ],
    ]);
  });

  it('builds a readable two-tile-wide path through the map', () => {
    const ground = buildGroundLayerData();

    expect(ground.every((row) => row[7] === CLASSIC_TILE.DIRT_PATH)).toBe(true);
    expect(ground.every((row) => row[8] === CLASSIC_TILE.DIRT_PATH)).toBe(true);
    expect(ground[10].slice(7).every((tile) => tile === CLASSIC_TILE.DIRT_PATH)).toBe(true);
    expect(ground[11].slice(7).every((tile) => tile === CLASSIC_TILE.DIRT_PATH)).toBe(true);
  });

  it('places trees, flowers, and a joined fence line on the detail layer', () => {
    const details = buildDetailLayerData();
    const placedTiles = details.flat().filter((tile) => tile >= 0);

    expect(placedTiles).toContain(CLASSIC_TILE.TREE_RED);
    expect(placedTiles).toContain(CLASSIC_TILE.TREE_LEAFY);
    expect(placedTiles).toContain(CLASSIC_TILE.FLOWER_RED);
    expect(placedTiles).toContain(CLASSIC_TILE.FLOWER_BLUE);
    expect(placedTiles).toContain(CLASSIC_TILE.FLOWER_YELLOW);
    expect(details[9].slice(12, 17)).toEqual([
      CLASSIC_TILE.FENCE_LEFT,
      CLASSIC_TILE.FENCE_MIDDLE,
      CLASSIC_TILE.FENCE_MIDDLE,
      CLASSIC_TILE.FENCE_MIDDLE,
      CLASSIC_TILE.FENCE_RIGHT,
    ]);
  });

  it('marks trees, pond tiles, and fences as solid while leaving flowers walkable', () => {
    const collision = buildCollisionData();

    expect(collision[1][1]).toBe(true);
    expect(collision[2][12]).toBe(true);
    expect(collision[4][15]).toBe(true);
    expect(collision[9][14]).toBe(true);
    expect(collision[3][5]).toBe(false);
  });
});
