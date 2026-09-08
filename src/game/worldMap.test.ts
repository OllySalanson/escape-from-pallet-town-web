import { describe, expect, it } from 'vitest';
import { CLASSIC_TILE, getWorldMap, isTallGrassInMap, WORLD_MAPS } from './worldMap';
import { EXTRACTION_POINTS } from './world/extractionPoints';
import { SOLID_CLASSIC_TILES } from './world/tiles';
import { createRunTrainerEncounters } from './world/trainers';

describe('worldMap', () => {
  it('registers four self-contained raid maps', () => {
    expect(Object.keys(WORLD_MAPS)).toEqual([
      'pallet-town',
      'route-1',
      'viridian-forest',
      'floodplain-relay',
    ]);
    expect(getWorldMap('pallet-town').width).toBe(32);
    expect(getWorldMap('pallet-town').height).toBe(44);
    expect(getWorldMap('route-1').height).toBe(32);
    expect(getWorldMap('viridian-forest').height).toBe(36);
    expect(getWorldMap('floodplain-relay').height).toBe(32);
  });

  it('builds complete layers for every map', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      for (const layer of [map.groundLayer, map.tallGrassLayer, map.detailLayer]) {
        expect(layer).toHaveLength(map.height);
        expect(layer.every((row) => row.length === map.width)).toBe(true);
      }
      expect(map.collision).toHaveLength(map.height);
      expect(map.tallGrass).toHaveLength(map.height);
    }
  });

  /**
   * A raid map is an arena entered at its own insertion, so no map may promise
   * a route into another one. Nothing authored uses a warp.
   */
  it('gives no map a warp into another', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      expect(map.warps).toEqual([]);
    }
  });

  it('marks hedges, water and fences solid and leaves grass and lanes walkable', () => {
    const pallet = getWorldMap('pallet-town');

    // The market square's paved yard, its fence, and the millpond.
    expect(pallet.collision[6][7]).toBe(false);
    expect(pallet.groundLayer[6][7]).toBe(CLASSIC_TILE.DIRT_PATH);
    expect(pallet.collision[6][4]).toBe(true);
    expect(SOLID_CLASSIC_TILES.has(pallet.detailLayer[6][4])).toBe(true);
    expect(pallet.collision[4][22]).toBe(true);
    expect(pallet.groundLayer[4][22]).toBe(CLASSIC_TILE.POND_WATER);
    expect(pallet.collision[0][0]).toBe(true);
  });

  it('draws a bank wherever water meets ground, and none where it does not', () => {
    const pallet = getWorldMap('pallet-town');
    // The millpond's west shore is a bank; its middle is open water.
    expect(pallet.groundLayer[5][19]).toBe(CLASSIC_TILE.POND_BANK_WEST);
    expect(pallet.groundLayer[5][22]).toBe(CLASSIC_TILE.POND_WATER);

    // The Floodplain is water to its edges, so its corner has no shoreline
    // painted on it and its landing jetty is dry.
    const flood = getWorldMap('floodplain-relay');
    expect(flood.groundLayer[0][0]).toBe(CLASSIC_TILE.POND_WATER);
    expect(flood.collision[3][15]).toBe(false);
  });

  it('records tall grass tile by tile, not as rectangles', () => {
    const forest = getWorldMap('viridian-forest');

    // A trail is one tile wide and the trees either side of it are not grass.
    expect(isTallGrassInMap(forest, { x: 8, y: 5 })).toBe(true);
    expect(isTallGrassInMap(forest, { x: 7, y: 5 })).toBe(false);
    expect(forest.tallGrassLayer[5][8]).toBe(CLASSIC_TILE.TALL_GRASS_TUFT);
    expect(forest.groundLayer[5][8]).toBe(CLASSIC_TILE.TALL_GRASS);
    // A clearing is open ground, not an encounter zone.
    expect(isTallGrassInMap(forest, { x: 7, y: 3 })).toBe(false);
  });

  it('keeps every placed run interaction on a walkable tile', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      for (const loot of map.loot) {
        expect({ map: map.id, loot: loot.id, blocked: map.collision[loot.position.y][loot.position.x] })
          .toMatchObject({ blocked: false });
      }
      for (const poi of map.pois) {
        expect({ map: map.id, poi: poi.id, blocked: map.collision[poi.position.y][poi.position.x] })
          .toMatchObject({ blocked: false });
      }
      for (const entity of map.entities) {
        expect({ map: map.id, entity: entity.id, blocked: map.collision[entity.position.y][entity.position.x] })
          .toMatchObject({ blocked: false });
      }
    }

    for (const trainer of createRunTrainerEncounters()) {
      const map = getWorldMap(trainer.mapId);
      expect(map.collision[trainer.position.y][trainer.position.x]).toBe(false);
    }

    for (const extraction of EXTRACTION_POINTS) {
      const map = getWorldMap(extraction.mapId);
      expect({ label: extraction.label, blocked: map.collision[extraction.position.y][extraction.position.x] })
        .toMatchObject({ blocked: false });
    }
  });

  it('gives every map three exits on three different rules', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      const exits = EXTRACTION_POINTS.filter((point) => point.mapId === map.id);
      expect({ map: map.id, exits: exits.length }).toMatchObject({ exits: 3 });
      const kinds = exits.map((exit) => exit.requirement?.kind ?? 'elapsed');
      expect([...new Set(kinds)].sort()).toEqual(['always', 'elapsed', 'poi-activated']);
    }
  });

  it('opens every landmark-gated exit with a landmark that exists on the same map', () => {
    for (const point of EXTRACTION_POINTS) {
      const requirement = point.requirement;
      if (requirement?.kind !== 'poi-activated') {
        continue;
      }
      const poi = getWorldMap(point.mapId).pois.find((candidate) => candidate.id === requirement.poiId);
      expect(`${point.label} is opened by ${poi?.id ?? 'nothing on this map'}`)
        .toBe(`${point.label} is opened by ${requirement.poiId}`);
      expect(poi?.effect).toBe('unlock-extraction');
      expect(poi?.unlockedExtractionLabel).toBe(point.label);
    }
  });

  it("keeps the town's own board honest about the exits it can see", () => {
    const board = getWorldMap('pallet-town').entities.find((entity) => entity.id === 'town-sign');
    const message = board?.dialogLines.join(' ') ?? '';

    expect(message).toContain('South Gate');
    expect(message).toContain('Mill Stair');
    expect(message).toContain('West Culvert');
  });
});
