import { describe, expect, it } from 'vitest';
import {
  buildCollisionData,
  buildDetailLayerData,
  buildGroundLayerData,
  buildTallGrassLayerData,
  CLASSIC_TILE,
  getWarpAt,
  getWorldMap,
  isTallGrassTile,
  isTallGrassInMap,
  MAP_HEIGHT,
  MAP_WIDTH,
  WORLD_MAPS,
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

  it('overlays dark-green grass tufts on the encounter zone', () => {
    const tallGrass = buildTallGrassLayerData();

    expect(tallGrass[22][3]).toBe(CLASSIC_TILE.TALL_GRASS_TUFT);
    expect(tallGrass[33][28]).toBe(CLASSIC_TILE.TALL_GRASS_TUFT);
    expect(tallGrass[21][3]).toBe(-1);
    expect(tallGrass[34][28]).toBe(-1);
  });

  it('builds a route that requires walking through tall grass south of town', () => {
    const ground = buildGroundLayerData();

    expect(ground.slice(0, 22).every((row) => row[7] === CLASSIC_TILE.DIRT_PATH)).toBe(true);
    expect(ground.slice(0, 22).every((row) => row[8] === CLASSIC_TILE.DIRT_PATH)).toBe(true);
    expect(ground[10].slice(7).every((tile) => tile === CLASSIC_TILE.DIRT_PATH)).toBe(true);
    expect(ground[11].slice(7).every((tile) => tile === CLASSIC_TILE.DIRT_PATH)).toBe(true);
    expect(ground[22][7]).toBe(CLASSIC_TILE.TALL_GRASS);
    expect(ground[33][8]).toBe(CLASSIC_TILE.TALL_GRASS);
    expect(ground[34][7]).toBe(CLASSIC_TILE.DIRT_PATH);
    expect(isTallGrassTile({ x: 7, y: 22 })).toBe(true);
    expect(isTallGrassTile({ x: 7, y: 21 })).toBe(false);
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
    expect(details[21][7]).toBe(-1);
    expect(details[21][8]).toBe(-1);
  });

  it('marks trees, pond tiles, and fences as solid while leaving flowers walkable', () => {
    const collision = buildCollisionData();

    expect(collision[1][1]).toBe(true);
    expect(collision[2][12]).toBe(true);
    expect(collision[4][15]).toBe(true);
    expect(collision[9][14]).toBe(true);
    expect(collision[3][5]).toBe(false);
    expect(collision[22][7]).toBe(false);
  });

  it('registers Pallet Town and Route 1 with their own map data', () => {
    const palletTown = getWorldMap('pallet-town');
    const route1 = getWorldMap('route-1');

    expect(Object.keys(WORLD_MAPS)).toEqual(['pallet-town', 'route-1']);
    expect(palletTown.width).toBe(MAP_WIDTH);
    expect(route1.height).toBe(32);
    expect(route1.groundLayer).toHaveLength(route1.height);
    expect(route1.groundLayer.every((row) => row.length === route1.width)).toBe(true);
    expect(isTallGrassInMap(route1, { x: 3, y: 8 })).toBe(true);
    expect(isTallGrassInMap(route1, { x: 7, y: 1 })).toBe(false);
    expect(route1.encounters).toBeDefined();
  });

  it('connects the maps with reciprocal edge warps', () => {
    const palletExit = getWarpAt(getWorldMap('pallet-town'), { x: 7, y: MAP_HEIGHT - 1 }, 'step');
    const routeReturn = getWarpAt(getWorldMap('route-1'), { x: 7, y: 0 }, 'step');

    expect(palletExit).toMatchObject({
      destinationMapId: 'route-1',
      destination: { x: 7, y: 1 },
      facing: 'down',
    });
    expect(routeReturn).toMatchObject({
      destinationMapId: 'pallet-town',
      destination: { x: 7, y: 42 },
      facing: 'up',
    });
  });
});
