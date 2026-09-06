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
import { EXTRACTION_POINTS } from './world/extractionPoints';
import { createRunTrainerEncounters } from './world/trainers';

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

  it('registers the connected overworld and standalone Floodplain Relay map data', () => {
    const palletTown = getWorldMap('pallet-town');
    const route1 = getWorldMap('route-1');
    const viridianForest = getWorldMap('viridian-forest');
    const floodplain = getWorldMap('floodplain-relay');

    expect(Object.keys(WORLD_MAPS)).toEqual([
      'pallet-town',
      'route-1',
      'viridian-forest',
      'floodplain-relay',
    ]);
    expect(palletTown.width).toBe(MAP_WIDTH);
    expect(route1.height).toBe(32);
    expect(route1.groundLayer).toHaveLength(route1.height);
    expect(route1.groundLayer.every((row) => row.length === route1.width)).toBe(true);
    expect(isTallGrassInMap(route1, { x: 3, y: 8 })).toBe(true);
    expect(isTallGrassInMap(route1, { x: 7, y: 1 })).toBe(false);
    expect(route1.encounters).toBeDefined();
    expect(viridianForest.height).toBe(36);
    expect(viridianForest.tallGrassZones).toHaveLength(3);
    expect(viridianForest.encounters?.entries.some((entry) => entry.speciesId === 'pikachu')).toBe(
      true,
    );
    expect(viridianForest.loot).toHaveLength(4);
    expect(route1.pois).toHaveLength(1);
    expect(route1.pois[0]).toMatchObject({
      id: 'oak-field-station-relay',
      position: { x: 12, y: 5 },
    });
    expect(floodplain.entities.map((entity) => entity.id)).toEqual([
      'floodplain-route-board',
      'vault-warning',
    ]);
  });

  it('connects the maps with reciprocal edge warps', () => {
    const palletExit = getWarpAt(getWorldMap('pallet-town'), { x: 7, y: MAP_HEIGHT - 1 }, 'step');
    const routeReturn = getWarpAt(getWorldMap('route-1'), { x: 7, y: 0 }, 'step');
    const routeExit = getWarpAt(getWorldMap('route-1'), { x: 7, y: 31 }, 'step');
    const forestReturn = getWarpAt(getWorldMap('viridian-forest'), { x: 7, y: 0 }, 'step');

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
    expect(routeExit).toMatchObject({
      destinationMapId: 'viridian-forest',
      destination: { x: 7, y: 1 },
      facing: 'down',
    });
    expect(forestReturn).toMatchObject({
      destinationMapId: 'route-1',
      destination: { x: 7, y: 30 },
      facing: 'up',
    });
  });

  it('closes every map edge that is not a real route and keeps extraction away from routes', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (x !== 0 && x !== map.width - 1 && y !== 0 && y !== map.height - 1) {
            continue;
          }
          const warp = getWarpAt(map, { x, y }, 'step');
          expect(map.collision[y][x]).toBe(warp === undefined);
        }
      }
    }

    for (const extraction of EXTRACTION_POINTS) {
      const map = getWorldMap(extraction.mapId);
      expect(map.warps.some((warp) => warp.source.x === extraction.position.x && warp.source.y === extraction.position.y)).toBe(false);
      expect(extraction.position.x).toBeGreaterThan(0);
      expect(extraction.position.x).toBeLessThan(map.width - 1);
      expect(extraction.position.y).toBeGreaterThan(0);
      expect(extraction.position.y).toBeLessThan(map.height - 1);
    }
  });

  it('keeps every placed run interaction on a walkable tile', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      for (const warp of map.warps) {
        const destinationMap = getWorldMap(warp.destinationMapId);
        expect(map.collision[warp.source.y][warp.source.x]).toBe(false);
        expect(destinationMap.collision[warp.destination.y][warp.destination.x]).toBe(false);
      }

      for (const loot of map.loot) {
        expect(map.collision[loot.position.y][loot.position.x]).toBe(false);
      }

      for (const poi of map.pois) {
        expect(map.collision[poi.position.y][poi.position.x]).toBe(false);
      }

      for (const entity of map.entities) {
        expect(map.collision[entity.position.y][entity.position.x]).toBe(false);
      }
    }

    for (const trainer of createRunTrainerEncounters()) {
      const map = getWorldMap(trainer.mapId);
      expect(map.collision[trainer.position.y][trainer.position.x]).toBe(false);
    }

    for (const extraction of EXTRACTION_POINTS) {
      const map = getWorldMap(extraction.mapId);
      expect(map.collision[extraction.position.y][extraction.position.x]).toBe(false);
    }
  });

  it('has a fully connected overworld graph and a self-contained Floodplain insertion', () => {
    const mapIds = Object.keys(WORLD_MAPS).filter((mapId) => mapId !== 'floodplain-relay');
    const reachableFrom = (start: string): Set<string> => {
      const visited = new Set<string>([start]);
      const pending = [start];
      while (pending.length > 0) {
        const current = pending.shift()!;
        for (const warp of WORLD_MAPS[current as keyof typeof WORLD_MAPS].warps) {
          if (!visited.has(warp.destinationMapId)) {
            visited.add(warp.destinationMapId);
            pending.push(warp.destinationMapId);
          }
        }
      }
      return visited;
    };

    for (const mapId of mapIds) {
      expect([...reachableFrom(mapId)].sort()).toEqual([...mapIds].sort());
    }
    expect(getWorldMap('floodplain-relay').warps).toEqual([]);
  });

  it('connects Floodplain Relay insertion to all exits through direct and reed routes', () => {
    const map = getWorldMap('floodplain-relay');
    const reachableFrom = (start: { x: number; y: number }): Set<string> => {
      const visited = new Set([`${start.x},${start.y}`]);
      const pending = [start];
      while (pending.length > 0) {
        const current = pending.shift()!;
        for (const next of [
          { x: current.x + 1, y: current.y },
          { x: current.x - 1, y: current.y },
          { x: current.x, y: current.y + 1 },
          { x: current.x, y: current.y - 1 },
        ]) {
          const key = `${next.x},${next.y}`;
          if (
            next.x >= 0 &&
            next.y >= 0 &&
            next.x < map.width &&
            next.y < map.height &&
            !map.collision[next.y][next.x] &&
            !visited.has(key)
          ) {
            visited.add(key);
            pending.push(next);
          }
        }
      }
      return visited;
    };
    const reachable = reachableFrom({ x: 15, y: 3 });
    const exits = EXTRACTION_POINTS.filter((point) => point.mapId === map.id);

    expect(exits.map((exit) => exit.label)).toEqual(['SOUTH GATE', 'FERRY DOCK', 'RADIO EXIT']);
    expect(exits.every((exit) => reachable.has(`${exit.position.x},${exit.position.y}`))).toBe(true);
    expect(reachable.has('7,12')).toBe(true);
    expect(reachable.has('27,15')).toBe(true);
  });

  it('keeps deeper extraction markers undisclosed on Oak’s route board', () => {
    const board = getWorldMap('pallet-town').entities.find(
      (entity) => entity.id === 'oak-route-board',
    );
    const message = board?.dialogLines.join(' ') ?? '';

    expect(message).toContain('SOUTH GATE');
    expect(message).toContain('Route 1 and the forest');
    expect(message).not.toContain('ROUTE OUTPOST');
    expect(message).not.toContain('FOREST CLEARING');
  });
});
