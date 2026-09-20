import { describe, expect, it } from 'vitest';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap, type WorldMapId } from '../worldMap';
import {
  districtAt,
  districtsForMap,
  weatherAt,
  MAP_DISTRICTS,
  WEATHER_WITHOUT_A_CHIP,
} from './districts';
import { WEATHER_CONDITIONS, WeatherId } from '../pokemon/battle/weather';
import { EXTRACTION_POINTS } from './extractionPoints';
import { gateKeys, gatesForMap } from './gates';
import { sketchViridianForest } from './maps/viridianForest';
import { WORLD_POIS } from './pois';

const DISTRICTED_MAPS = [...new Set(MAP_DISTRICTS.map((district) => district.mapId))];

/** Every door open - a boss's and a field move's alike - so ground behind a gate is asked about too. */
const openMap = (mapId: WorldMapId) => getWorldMap(mapId, gateKeys(gatesForMap(mapId)));

describe('the weather a place has', () => {
  /**
   * The rule and its reason are in `districts.ts`: weather chips a flat one HP
   * a turn at the levels this game is played at, and a flat charge is paid by
   * whoever has the fewest Pokemon - which in the hunter fight is always the
   * player. Measured, the top rung falls from 49% to 17% in a sandstorm
   * (`tools/weather/measure.mts --hunter`). The hunter arrives wherever the
   * player is standing, so a chipping district would reprice the one fight a
   * raid cannot decline, with nothing said about it before the insertion.
   */
  it('never chips: a place may bend damage, and may not take HP', () => {
    const chipping = MAP_DISTRICTS.filter(
      (district) => district.weather && WEATHER_CONDITIONS[district.weather].chipFraction > 0,
    );
    expect(chipping.map((district) => district.name)).toEqual([]);
    expect(WEATHER_WITHOUT_A_CHIP).toEqual([WeatherId.Rain, WeatherId.HarshSunlight]);
  });

  it('is the exception, not the map: only where the place is made of water', () => {
    const weathered = Object.fromEntries(
      MAP_DISTRICTS.filter((district) => district.weather).map((district) => [
        district.name,
        district.weather,
      ]),
    );
    expect(weathered).toEqual({
      'THE REEDBEDS': WeatherId.Rain,
      'THE FLOOD': WeatherId.Rain,
      'BROOK HEAD': WeatherId.Rain,
      'THE MERE': WeatherId.Rain,
    });
    // Three of twenty. Weather that changed every dozen steps would be weather
    // nobody reads, and weather on every map would be a tax rather than a place.
    expect(Object.keys(weathered).length * 6).toBeLessThan(MAP_DISTRICTS.length * 2);
  });

  it('is read off the tile, so the chip and the fight cannot disagree', () => {
    expect(weatherAt('pallet-town', { x: 4, y: 35 })).toBe(WeatherId.Rain);
    expect(weatherAt('pallet-town', { x: 20, y: 35 })).toBeNull();
    expect(weatherAt('route-1', { x: 14, y: 12 })).toBeNull();
  });
});

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
      exits: { 'SOUTH GATE': 'THE STOCKYARD', 'MILL STAIR': 'THE FAR BANK', 'WEST CULVERT': 'THE FLOOD' },
      landings: { 'Town Square': 'MARKET SQUARE', 'The Far Bank': 'THE FAR BANK' },
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
      exits: {
        'BROOK FORD': 'BROOK HEAD',
        'FOREST CLEARING': 'THE CLEARING',
        'TOWER STEPS': 'TOWER STEPS',
        'RIDGE GAP': 'THE RIDGE',
        'CRAG PATH': 'RAVEN CRAG',
        'KILN ROAD': 'CHARCOAL BURN',
        'MERE STAITH': 'THE MERE',
        'SOUTH GATE': 'THE SOUTH ROAD',
        'QUARRY ADIT': 'THE QUARRY',
      },
      landings: {
        'Viridian Forest': 'NORTH LANDING',
        'The Ridge': 'THE RIDGE',
        'The Burn': 'THE BURN',
        'The Sawpit': 'THE SAWPIT',
        'Charcoal Burn': 'CHARCOAL BURN',
      },
      landmarks: {
        'FIRE TOWER': 'FIRE TOWER',
        "COPPICER'S STORE": 'THE COPPICE',
        "SAWYER'S STORE": 'THE SAWPIT',
        'ADIT STORE': 'THE QUARRY',
        'THE OLD DIG': 'THE WARREN',
      },
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
    // Fallen timber is the south and east of the wood's own vocabulary, so a
    // log is no longer one place's signature - what is asserted is that every
    // place holding one is a place whose name is about wood on the ground.
    expect(new Set(planted('log'))).toEqual(
      new Set(['BEETLE HOLLOW', 'THE CLEARING', 'THE BLOWDOWN', 'HORNET GLADE', 'CHARCOAL BURN', 'THE MERE', 'THE SAWPIT', 'BROOK FOOT']),
    );
    expect(new Set(planted('bigStump'))).toEqual(
      new Set(["WARDEN'S CUT", 'HORNET GLADE', 'THE BLOWDOWN', 'THE SAWPIT', 'BEECH FLAT']),
    );
    // THE COPPICE is the one place in the wood that was cut and grew back, so
    // it is the one with stools standing round its rim; the sawpit, the glade
    // and the collier's yard are the three places somebody has felled since.
    expect(new Set(planted('stump'))).toEqual(
      new Set(['BEETLE HOLLOW', 'NORTH LANDING', 'THE COPPICE', 'HORNET GLADE', 'THE SAWPIT', 'CHARCOAL BURN']),
    );
    // A dead stump is what fire, sand and bare rock leave, which is the other
    // three places it stands.
    expect(new Set(planted('deadStump'))).toEqual(
      new Set(['BEETLE HOLLOW', 'NORTH LANDING', 'THE COPPICE', 'THE BURN', 'THE WARREN', 'THE ROOKERY']),
    );
    // Sacks are somebody's: the warden's cache, and the collier's yard.
    expect(new Set(planted('sack'))).toEqual(new Set(['EAST RISE', 'CHARCOAL BURN']));
    expect(new Set(['bankWest', 'bank', 'bankEast'].flatMap(planted))).toEqual(new Set(['EAST RISE']));
    // Everything built or worked stands where its name says, and only there.
    expect(planted('hut')).toEqual(['CHARCOAL BURN']);
    expect(planted('mineMouth')).toEqual(['THE QUARRY']);
    expect(planted('jetty')).toEqual(['THE MERE']);
    expect(planted('gravestoneWorn')).toEqual(['STONE ROW']);
    // Worn ground is where people work: the crossing, the firebreak, the burn
    // it opens on, the sawpit floor, the collier's yard and his ride south.
    expect(new Set(drawn(','))).toEqual(
      new Set(['THE CROSSROADS', 'TOWER STEPS', 'THE BURN', 'THE SAWPIT', 'CHARCOAL BURN', 'THE LONG DRIVE']),
    );
    // Water: the two pools, and the brook from its head to the mere.
    expect(new Set([...drawn('W'), ...drawn('w')])).toEqual(
      new Set(['SAP POOL', 'BROOK HEAD', 'BEETLE HOLLOW', 'BROOK FOOT', 'THE MERE', 'THE TARN']),
    );
    // And the one-off grounds, each in the single place it is about.
    expect(new Set(drawn('~'))).toEqual(new Set(['THE MERE', 'THE TARN']));
    expect(new Set(drawn('d'))).toEqual(new Set(['THE WARREN']));
    expect(new Set(drawn('P'))).toEqual(new Set(['THE SOUTH ROAD']));
    expect(new Set(drawn('M'))).toEqual(new Set(['CHARCOAL BURN']));
    // Ash. The burn's floor and the quarry's, and nowhere a tree ever stood.
    expect(new Set(drawn('v'))).toEqual(new Set(['THE BURN', 'THE QUARRY']));
    // DEEP STAND is the stand: no other named clearing of the old wood has as
    // many of the forest's broadleaves standing in it, and its plate is on the
    // tree block rather than on the lawn beside it.
    //
    // Asked of the thirteen places the map shipped with, because the east and
    // the south are wood the new districts are *cut out of*: a rectangle drawn
    // round the hollow way covers two hundred tiles of untouched thicket, and
    // counting its trees would say it is deeper than the deep stand when what
    // it is is bigger.
    const OLD_WOOD = new Set([
      'THE RIDGE', 'TOWER STEPS', 'FIRE TOWER', 'NORTH LANDING', 'SAP POOL', 'BEETLE HOLLOW',
      'THE CROSSROADS', 'THE COPPICE', 'DEEP STAND', 'BROOK HEAD', "WARDEN'S CUT", 'EAST RISE',
      'THE CLEARING',
    ]);
    const trees = new Map<string, number>();
    for (const tree of planted('tree')) {
      if (OLD_WOOD.has(tree ?? '')) {
        trees.set(tree ?? '', (trees.get(tree ?? '') ?? 0) + 1);
      }
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
        'STRANDED LIGHTER': 'THE SHOAL',
      });
    });

    it('keeps the whole of Old Town one place: the street, the chapel, the last house, the gate', () => {
      for (const tile of [{ x: 10, y: 37 }, { x: 12, y: 41 }, { x: 8, y: 55 }, { x: 17, y: 60 }]) {
        expect(named(tile)).toBe('OLD TOWN');
      }
    });
  });
});
