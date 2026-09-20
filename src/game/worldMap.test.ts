import { describe, expect, it } from 'vitest';
import { CLASSIC_TILE, getWorldMap, isTallGrassInMap, WORLD_MAPS } from './worldMap';
import { EXTRACTION_POINTS } from './world/extractionPoints';
import { MapSketch } from './world/mapGrid';
import { buildMapLayers } from './world/tiles';
import { CLASSIC_TILESET } from './world/tileset/classicTileset';
import { FLOOD_TOWN_TILESET } from './world/tileset/floodTownTileset';
import { createRunTrainerEncounters } from './world/trainers';

/** A small map drawn as character art, the way a real map is authored. */
function sketch(rows: readonly string[]): MapSketch {
  const map = new MapSketch({ width: rows[0].length, height: rows.length, fill: '.' });
  map.draw(0, 0, rows);
  return map;
}

describe('worldMap', () => {
  it('registers four self-contained raid maps', () => {
    expect(Object.keys(WORLD_MAPS)).toEqual([
      'pallet-town',
      'route-1',
      'viridian-forest',
      'floodplain-relay',
    ]);
    // Pallet Town is the valley one: the town it shipped as is its north-west
    // quarter and the parish round it is the rest, up to the ceiling the
    // lobby's banner sets on a picture drawn at one pixel to the tile.
    expect(getWorldMap('pallet-town').width).toBe(64);
    expect(getWorldMap('pallet-town').height).toBe(76);
    // Route 1 and Viridian Forest are the long ones now: each is four and a
    // half times the footprint it shipped in, played the way the Floodplain is
    // - a district at a time, with more of it left unwalked at the end of a
    // raid than walked. Route 1 keeps its shipped 32x32 braid as its top-left
    // quarter, and is taller than it is wide because it is a route.
    expect(getWorldMap('route-1').width).toBe(64);
    expect(getWorldMap('route-1').height).toBe(72);
    expect(getWorldMap('viridian-forest').width).toBe(64);
    expect(getWorldMap('viridian-forest').height).toBe(72);
    // The Floodplain is the vast one: it is played a district at a time.
    expect(getWorldMap('floodplain-relay').width).toBe(64);
    expect(getWorldMap('floodplain-relay').height).toBe(64);
  });

  it('builds complete layers for every map', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      const { ground, overlay, detail, canopy } = map.layers;
      for (const layer of [ground, overlay, detail, canopy]) {
        expect(layer.tiles).toHaveLength(map.height);
        expect(layer.tiles.every((row) => row.length === map.width)).toBe(true);
        expect(layer.tints).toHaveLength(map.height);
        expect(layer.tints.every((row) => row.length === map.width)).toBe(true);
      }
      expect(map.collision).toHaveLength(map.height);
      expect(map.tallGrass).toHaveLength(map.height);
    }
  });

  /**
   * A sheet is chosen per map, which is what let the four be redrawn to the
   * wide vocabulary one at a time: the Floodplain first, with the other three
   * still on the classic catalogue beside it. All four have been redrawn now,
   * so all four draw from the town catalogue - the FireRed ground with the
   * chosen buildings standing on it - and none is left on the classic sheet.
   */
  it('draws every map from the town catalogue', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      expect({ map: map.id, fromTheTownCatalogue: map.tileset === FLOOD_TOWN_TILESET })
        .toMatchObject({ fromTheTownCatalogue: true });
    }
    // Every tile a map draws has to land inside one of its catalogue's sheets:
    // a map with two sheets shares one numbering, and a tile in the gap between
    // them would render as whatever Phaser found nearest.
    for (const map of Object.values(WORLD_MAPS)) {
      const spans = map.tileset.sources.map((source) => ({
        from: source.firstIndex,
        to: source.firstIndex + source.columns * source.rows,
      }));
      for (const layer of [map.layers.ground, map.layers.overlay, map.layers.detail, map.layers.canopy]) {
        for (const row of layer.tiles) {
          for (const tile of row) {
            if (tile < 0) continue;
            const onSheet = spans.some((span) => tile >= span.from && tile < span.to);
            expect({ map: map.id, tile, onSheet }).toMatchObject({ onSheet: true });
          }
        }
      }
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

  it('walls a map with whatever stands at its edge, and leaves its front door dry', () => {
    // The Floodplain is cut out of a forest, so its corner is a wall; the
    // river runs off its north edge as water, which is a wall too; and its
    // front door, in the Landing's yard, is dry ground.
    const flood = getWorldMap('floodplain-relay');
    expect(flood.collision[0][0]).toBe(true);
    expect(flood.collision[0][41]).toBe(true);
    expect(isTallGrassInMap(flood, { x: 13, y: 9 })).toBe(false);
    expect(flood.collision[9][13]).toBe(false);
  });

  it('records tall grass tile by tile, not as rectangles', () => {
    const forest = getWorldMap('viridian-forest');

    // A trail is one tile wide and the trees either side of it are not grass.
    // The redrawn forest kept its trails, so this is the tile it always was.
    expect(isTallGrassInMap(forest, { x: 8, y: 5 })).toBe(true);
    expect(forest.collision[5][8]).toBe(false);
    expect(isTallGrassInMap(forest, { x: 7, y: 5 })).toBe(false);
    expect(forest.collision[5][7]).toBe(true);
    // It is drawn as the map's own catalogue draws tall grass, on the ground
    // layer: the FireRed plant is a ground tile, not a tuft laid over grass.
    expect(forest.layers.ground.tiles[5][8]).toBe(forest.tileset.materials['tall-grass'].roles.fill);
    expect(forest.layers.overlay.tiles[5][8]).toBeLessThan(0);
    // A clearing is open ground, not an encounter zone.
    expect(isTallGrassInMap(forest, { x: 7, y: 3 })).toBe(false);
    expect(forest.collision[3][7]).toBe(false);
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

  // Three is the floor, not the count: a region behind a boss-held gate brings
  // its own way out, so a gated map has more exits than rules.
  it('gives every map at least three exits, on three different rules', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      const exits = EXTRACTION_POINTS.filter((point) => point.mapId === map.id);
      expect({ map: map.id, enoughExits: exits.length >= 3 }).toMatchObject({ enoughExits: true });
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

    // The board names every way out of its own map, spelt the way the map
    // captions it - in capitals - so the name read in the square is the name
    // read over the gate. Asked of the exits themselves, so one added or
    // renamed fails here rather than leaving the board a gate short.
    const exits = EXTRACTION_POINTS.filter((point) => point.mapId === 'pallet-town');
    expect(exits.map((exit) => exit.label).sort()).toEqual([
      'FERRY HARD',
      'HEADLAND STEPS',
      'LIME ROAD',
      'MILL STAIR',
      'QUARRY TRACK',
      'SOUTH GATE',
      'WEST CULVERT',
    ]);
    // The board names the three a player standing in the square can act on -
    // the ones out of the town itself. The other four are a valley away and are
    // named by the board that stands where they can be walked to from: a sign
    // that listed all seven would be a list nobody reads, and the map's own
    // rule is that a caption speaks where the thing it names can be seen.
    const outOfTheTown = new Set(['SOUTH GATE', 'MILL STAIR', 'WEST CULVERT']);
    for (const exit of exits.filter((point) => outOfTheTown.has(point.label))) {
      expect(message).toContain(exit.label);
    }
    const boards = getWorldMap('pallet-town')
      .entities.filter((entity) => entity.kind === 'sign')
      .flatMap((entity) => entity.dialogLines)
      .join(' ');
    for (const exit of exits) {
      expect(`some board names ${exit.label}: ${boards.includes(exit.label)}`)
        .toBe(`some board names ${exit.label}: true`);
    }
  });
});

/**
 * The classic catalogue - `tileset.png`, the 104-tile sheet every map was once
 * drawn from. No shipped map draws from it any more, so its rules are held on
 * ground drawn here: they used to be read off Pallet Town's millpond and the
 * forest's trails, and redrawing those maps on another sheet would otherwise
 * have left the catalogue with nothing checking it.
 */
describe('the classic catalogue, on a map drawn for it', () => {
  it('marks hedges, water and fences solid and leaves grass and lanes walkable', () => {
    // A paved yard inside a fence, a hedge behind it, a lane past its gate and
    // a pond below the lane.
    const { collision, ground, overlay } = buildMapLayers(
      sketch([
        '########',
        '#FFFFFF#',
        '#FPPPPF#',
        '#FPPPPF#',
        '#FF,FFF#',
        '.,,,,,,.',
        '.WWWWWW.',
        '.WWWWWW.',
        '.WWWWWW.',
        '........',
      ]),
      CLASSIC_TILESET,
    );

    // The yard, and the lane it opens onto: this sheet has one laid floor.
    expect(collision[2][3]).toBe(false);
    expect(ground.tiles[2][3]).toBe(CLASSIC_TILE.DIRT_PATH);
    expect(collision[5][3]).toBe(false);
    expect(ground.tiles[5][3]).toBe(CLASSIC_TILE.DIRT_PATH);
    expect(collision[5][0]).toBe(false);
    expect(ground.tiles[5][0]).toBe(CLASSIC_TILE.GRASS);
    // Its fence is a wall you can see through, so it is drawn over ground.
    expect(collision[2][1]).toBe(true);
    expect(overlay.tiles[2][1]).toBeGreaterThanOrEqual(0);
    expect(collision[4][3]).toBe(false);
    // The pond, and the hedge the whole yard is set in.
    expect(collision[7][3]).toBe(true);
    expect(ground.tiles[7][3]).toBe(CLASSIC_TILE.POND_WATER);
    expect(collision[0][0]).toBe(true);
    expect(overlay.tiles[0][0]).toBeGreaterThanOrEqual(0);
  });

  it('draws a bank wherever water meets ground, and none where it does not', () => {
    // A pond that runs off the north edge of the map, as a river does. This
    // sheet has no shoreline to lay on the land, so the bank is the water's
    // own edge, drawn on the water tile that touches ground.
    const { ground } = buildMapLayers(
      sketch([
        '..WWW..',
        '..WWW..',
        '..WWW..',
        '.......',
      ]),
      CLASSIC_TILESET,
    );

    expect(ground.tiles[1][2]).toBe(CLASSIC_TILE.POND_BANK_WEST);
    expect(ground.tiles[1][4]).toBe(CLASSIC_TILE.POND_BANK_EAST);
    expect(ground.tiles[2][3]).toBe(CLASSIC_TILE.POND_BANK_SOUTH);
    expect(ground.tiles[2][2]).toBe(CLASSIC_TILE.POND_BANK_SOUTH_WEST);
    // Its middle is open water, and so is where it leaves the map: the edge of
    // the map is not a shore.
    expect(ground.tiles[1][3]).toBe(CLASSIC_TILE.POND_WATER);
    expect(ground.tiles[0][3]).toBe(CLASSIC_TILE.POND_WATER);
    // The land beside it is left alone.
    expect(ground.tiles[1][1]).toBe(CLASSIC_TILE.GRASS);
  });

  it('lays tall grass over grass tile by tile, not as rectangles', () => {
    // A trail one tile wide through a wood, out of a clearing.
    const { ground, overlay, tallGrass, collision } = buildMapLayers(
      sketch([
        'TTTTT',
        'T...T',
        'TTgTT',
        'TTgTT',
        'TTggT',
      ]),
      CLASSIC_TILESET,
    );

    expect(tallGrass[2][2]).toBe(true);
    expect(overlay.tiles[2][2]).toBe(CLASSIC_TILE.TALL_GRASS_TUFT);
    expect(ground.tiles[2][2]).toBe(CLASSIC_TILE.GRASS);
    // The trees either side of the trail are not grass, and are not walked.
    expect(tallGrass[2][1]).toBe(false);
    expect(collision[2][1]).toBe(true);
    expect(tallGrass[2][3]).toBe(false);
    // A clearing is open ground, not an encounter zone.
    expect(tallGrass[1][2]).toBe(false);
    expect(overlay.tiles[1][2]).toBeLessThan(0);
  });
});
