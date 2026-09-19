import { describe, expect, it } from 'vitest';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap, type WorldMapId } from '../worldMap';
import { districtAt, districtsForMap, MAP_DISTRICTS } from './districts';
import { EXTRACTION_POINTS } from './extractionPoints';
import { gatesForMap } from './gates';
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

  it('is undefined on a map that names none', () => {
    expect(districtAt('pallet-town', { x: 5, y: 5 })).toBeUndefined();
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
