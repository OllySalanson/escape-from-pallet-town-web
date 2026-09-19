import { describe, expect, it } from 'vitest';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap, type WorldMapId } from '../worldMap';
import { districtAt, districtsForMap, MAP_DISTRICTS } from './districts';
import { EXTRACTION_POINTS } from './extractionPoints';
import { gatesForMap } from './gates';
import { sketchViridianForest } from './maps/viridianForest';
import { WORLD_POIS } from './pois';

const DISTRICTED_MAPS = [...new Set(MAP_DISTRICTS.map((district) => district.mapId))];

/** Every door open, so ground behind a gate is asked about too. */
const openMap = (mapId: WorldMapId) =>
  getWorldMap(mapId, gatesForMap(mapId).map((gate) => gate.bossId));

describe('the named districts of a map', () => {
  it.each(DISTRICTED_MAPS)('%s leaves no ground a player can stand on nameless', (mapId) => {
    const { collision } = openMap(mapId);
    const nameless: string[] = [];
    collision.forEach((row, y) =>
      row.forEach((blocked, x) => {
        if (!blocked && !districtAt(mapId, { x, y })) {
          nameless.push(`${x},${y}`);
        }
      }),
    );
    expect(nameless).toEqual([]);
  });

  it.each(DISTRICTED_MAPS)('%s gives every district ground of its own, and a name of its own', (mapId) => {
    const { collision } = openMap(mapId);
    const districts = districtsForMap(mapId);
    expect(new Set(districts.map((district) => district.name)).size).toBe(districts.length);
    for (const district of districts) {
      const ground = collision.flatMap((row, y) =>
        row.flatMap((blocked, x) => (!blocked && districtAt(mapId, { x, y })?.id === district.id ? [1] : [])),
      ).length;
      expect(`${district.name}: ${ground > 0}`).toBe(`${district.name}: true`);
    }
  });

  it('names every map: the arrival plate works wherever a raid can start', () => {
    const everyMap = [...new Set(Object.values(RUN_INSERTIONS).map((insertion) => insertion.mapId))];
    expect([...DISTRICTED_MAPS].sort()).toEqual([...everyMap].sort());
  });

  it('is undefined off the ground a map names', () => {
    expect(districtAt('pallet-town', { x: -1, y: 5 })).toBeUndefined();
  });

  /**
   * The same sentence for the three smaller maps, one table each: every exit,
   * every landing and every landmark, by the place a player would say it is in.
   */
  const placesOn = (mapId: WorldMapId) => {
    const named = (tile: { x: number; y: number }): string | undefined => districtAt(mapId, tile)?.name;
    return {
      exits: Object.fromEntries(
        EXTRACTION_POINTS.filter((point) => point.mapId === mapId).map((point) => [point.label, named(point.position)]),
      ),
      landings: Object.fromEntries(
        Object.values(RUN_INSERTIONS)
          .filter((insertion) => insertion.mapId === mapId)
          .map((insertion) => [insertion.label, named(insertion.position)]),
      ),
      landmarks: Object.fromEntries(
        WORLD_POIS.filter((poi) => poi.mapId === mapId).map((poi) => [poi.label, named(poi.position)]),
      ),
    };
  };

  it('Pallet Town: puts every exit, landing and landmark in the place it is remembered as part of', () => {
    expect(placesOn('pallet-town')).toEqual({
      exits: { 'SOUTH GATE': 'THE STOCKYARD', 'MILL STAIR': 'THE MILLPOND', 'WEST CULVERT': 'THE FLOOD' },
      landings: { 'Town Square': 'MARKET SQUARE' },
      landmarks: { 'TOWN PUMP': 'THE GREEN', 'SLUICE WHEEL': 'THE STOCKYARD' },
    });
    // The south is named where the south bank starts: on the far step of each
    // crossing, never on the near one. Named on the bridge head, THE STOCKYARD
    // went up over a screen that was still three quarters allotments, and a
    // stranger who toured the town once called the hut band the Stockyard.
    for (const [x, south] of [[7, 'THE FLOOD'], [13, 'THE STOCKYARD'], [20, 'THE STOCKYARD']] as const) {
      for (const y of [27, 28, 29]) {
        expect(`${x},${y}: ${districtAt('pallet-town', { x, y })?.name}`).toBe(`${x},${y}: THE ALLOTMENTS`);
      }
      expect(getWorldMap('pallet-town').collision[30][x]).toBe(false);
      expect(districtAt('pallet-town', { x, y: 30 })?.name).toBe(south);
    }
  });

  it('Route 1: puts every exit, landing and landmark in the place it is remembered as part of', () => {
    expect(placesOn('route-1')).toEqual({
      exits: {
        'WEST GATE': 'WEST GATE',
        'ROUTE OUTPOST': 'THE OUTPOST',
        'STATION RELAY': "OAK'S FIELD STATION",
        'OVERLOOK STILE': 'THE OVERLOOK',
      },
      landings: { 'Route 1': 'ROUTE HEAD', 'Overlook Landing': 'THE OVERLOOK' },
      landmarks: { "OAK'S FIELD STATION": "OAK'S FIELD STATION" },
    });
    // Both of the warden's doors belong to the place they open.
    for (const gate of gatesForMap('route-1')) {
      for (const tile of gate.tiles) {
        expect(`${gate.label}: ${districtAt('route-1', tile)?.name}`).toBe(`${gate.label}: THE OVERLOOK`);
      }
    }
  });

  it('Viridian Forest: puts every exit, landing and landmark in the clearing it is named for', () => {
    expect(placesOn('viridian-forest')).toEqual({
      exits: { 'BROOK FORD': 'BROOK HEAD', 'FOREST CLEARING': 'THE CLEARING', 'TOWER STEPS': 'TOWER STEPS' },
      landings: { 'Viridian Forest': 'NORTH LANDING' },
      landmarks: { 'FIRE TOWER': 'FIRE TOWER' },
    });
  });

  /**
   * A plate is read once and a place is remembered because it looks like
   * something. A stranger toured the forest and placed every clearing that
   * holds an object - tower, stair, pool, brook, log - and not one of the four
   * that held nothing; DEEP STAND, attached to nothing, he pinned on the nearest
   * thing that looked deep. So every clearing's name is on the thing it names.
   */
  it('Viridian Forest: every clearing holds the thing its name says', () => {
    const sketch = sketchViridianForest();
    const where = (tile: { x: number; y: number }) => districtAt('viridian-forest', tile)?.name;
    const planted = (name: string) =>
      sketch.props().filter((prop) => prop.name === name).map((prop) => where(prop));
    const drawn = (char: string) =>
      sketch.toGrid().flatMap((row, y) => [...row].flatMap((cell, x) => (cell === char ? [where({ x, y })] : [])));

    expect(planted('tower')).toEqual(['FIRE TOWER']);
    expect(planted('rockStair')).toEqual(['TOWER STEPS']);
    expect(planted('log').sort()).toEqual(['BEETLE HOLLOW', 'THE CLEARING']);
    expect(planted('bigStump')).toEqual(["WARDEN'S CUT"]);
    expect(new Set(planted('sack'))).toEqual(new Set(['EAST RISE']));
    expect(new Set(['bankWest', 'bank', 'bankEast'].flatMap(planted))).toEqual(new Set(['EAST RISE']));
    // The one worn ground in the wood is the crossing, and all of it is.
    expect(new Set(drawn(','))).toEqual(new Set(['THE CROSSROADS']));
    // Water: the pool, and the brook with its ford.
    expect(new Set([...drawn('W'), ...drawn('w')])).toEqual(new Set(['SAP POOL', 'BROOK HEAD', 'BEETLE HOLLOW']));
    // DEEP STAND is the stand: no other place has as many of the forest's
    // broadleaves standing in it, and its clearing is under its name.
    const trees = new Map<string, number>();
    for (const tree of planted('tree')) {
      trees.set(tree ?? '', (trees.get(tree ?? '') ?? 0) + 1);
    }
    const [deepest] = [...trees].sort((a, b) => b[1] - a[1]);
    expect(deepest[0]).toBe('DEEP STAND');
    expect(where({ x: 13, y: 22 })).toBe('DEEP STAND');
  });

  /**
   * Where things are, by the name a player would give it. This is the sentence
   * "the South Gate is in Old Town" written down: a redraw that moves a
   * boundary has to decide on purpose which place an exit belongs to.
   */
  describe('Floodplain Relay', () => {
    const named = (tile: { x: number; y: number }): string | undefined =>
      districtAt('floodplain-relay', tile)?.name;

    it('puts every exit in the place it is remembered as part of', () => {
      const exits = Object.fromEntries(
        EXTRACTION_POINTS.filter((point) => point.mapId === 'floodplain-relay').map((point) => [
          point.label,
          named(point.position),
        ]),
      );
      expect(exits).toEqual({
        'SOUTH GATE': 'OLD TOWN',
        'FERRY DOCK': 'THE LANDING',
        'RADIO EXIT': 'THE REEDBEDS',
        'MILL RACE': 'MILL WEIR',
        'SIGNAL FIRE': 'BEACON KEEP',
        'VAULT CULVERT': 'THE VAULT',
      });
    });

    it('drops every raid into the place its lobby row is named for', () => {
      const dropIns = Object.fromEntries(
        Object.values(RUN_INSERTIONS)
          .filter((insertion) => insertion.mapId === 'floodplain-relay')
          .map((insertion) => [insertion.label, named(insertion.position)]),
      );
      expect(dropIns).toEqual({
        'Floodplain Relay': 'THE LANDING',
        'Market Isle': 'MARKET ISLE',
        'Mill Weir': 'MILL WEIR',
        'Beacon Keep': 'BEACON KEEP',
        'The Vault': 'THE VAULT',
      });
    });

    it('stands every landmark somewhere named', () => {
      const landmarks = Object.fromEntries(
        WORLD_POIS.filter((poi) => poi.mapId === 'floodplain-relay').map((poi) => [
          poi.label,
          named(poi.position),
        ]),
      );
      expect(landmarks).toEqual({
        'DROWNED CHAPEL': 'OLD TOWN',
        'FLOODED SUPPLY VAULT': 'THE VAULT',
        'RANGER STATION': 'THE REEDBEDS',
      });
    });

    it('keeps the whole of Old Town one place: the street, the chapel, the last house, the gate', () => {
      for (const tile of [{ x: 10, y: 37 }, { x: 12, y: 41 }, { x: 8, y: 55 }, { x: 17, y: 60 }]) {
        expect(named(tile)).toBe('OLD TOWN');
      }
    });
  });
});
