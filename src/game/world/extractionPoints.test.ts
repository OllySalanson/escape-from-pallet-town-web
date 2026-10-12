import { describe, expect, it } from 'vitest';
import { KEY_ITEM_IDS } from '../items';
import { BUILT_IN_MAP_IDS, WORLD_MAPS, type BuiltInMapId } from '../worldMap';
import { districtAt } from './districts';
import {
  EXTRACTION_POINTS,
  extractionCaption,
  extractionRequirementText,
  isBarredExit,
  isDugExit,
  isExtractionAvailable,
  itemThatOpens,
} from './extractionPoints';
import { isPrize } from './loot';
import { WORLD_POIS } from './pois';

const exit = (mapId: string, label: string) =>
  EXTRACTION_POINTS.find((point) => point.mapId === mapId && point.label === label)!;

/**
 * A map lives in people's heads as the names of its ways out. Every exit used
 * to be captioned `EXTRACT OPEN`, and a stranger asked to draw the Floodplain
 * from memory could place all six of its exits and name two.
 */
describe('what the map says over an exit', () => {
  it('leads with the name of the exit, on a line of its own', () => {
    expect(extractionCaption(exit('floodplain-relay', 'MILL RACE'), true, 0)).toBe(
      'MILL RACE\nEXTRACT OPEN',
    );
  });

  it('says what a shut exit is waiting for, under its name', () => {
    const ferry = exit('floodplain-relay', 'FERRY DOCK');
    expect(extractionCaption(ferry, false, 5_000)).toBe('FERRY DOCK\nEXTRACT OPENS IN 40s');
  });

  it('gives an exit a landmark has to open a line for that, rather than two verbs in a row', () => {
    const radio = exit('floodplain-relay', 'RADIO EXIT');
    expect(extractionCaption(radio, false, 0)).toBe(
      'RADIO EXIT\nEXTRACT SEALED\nWORK RANGER STATION',
    );
    expect(extractionCaption(radio, true, 0)).toBe('RADIO EXIT\nEXTRACT OPEN');
  });

  it('holds every exit to a caption width, because one of them had nowhere to sit', () => {
    // This rule was only ever asked of the Radio Exit, and Route 1's
    // `ACTIVATE OAK'S FIELD STATION` broke it by two characters: a 171px
    // window, more than half the base stage, with no seat anywhere on the
    // apron it names. Asked of all of them, the widest is now 19.
    const longestNameOnAMap = 'HELD BY SLUICE KEEPER DANE'.length;
    for (const point of EXTRACTION_POINTS) {
      const widest = Math.max(
        ...extractionCaption(point, false, 0).split('\n').map((line) => line.length),
      );
      expect(`${point.mapId}/${point.label}: ${widest}`).toBe(
        `${point.mapId}/${point.label}: ${Math.min(widest, longestNameOnAMap)}`,
      );
    }
  });

  it('names every authored exit differently on its own map, or the names are no use to steer by', () => {
    const byMap = new Map<string, string[]>();
    for (const point of EXTRACTION_POINTS) {
      byMap.set(point.mapId, [...(byMap.get(point.mapId) ?? []), point.label]);
    }
    for (const [mapId, labels] of byMap) {
      expect(`${mapId}: ${new Set(labels).size} distinct of ${labels.length}`).toBe(
        `${mapId}: ${labels.length} distinct of ${labels.length}`,
      );
    }
  });
});

/**
 * The Tarkov key exit, and the map maker's rubble brought to the shipped maps:
 * ways out a raid has to bring something to open. Most locks give to a
 * Lockpick; an exit with a key of its own gives to that key and nothing else.
 */
describe('a barred exit', () => {
  it('says what it is and what opens it, while it is shut', () => {
    const gate = exit('pallet-town', 'WEIR GATE');
    expect(extractionCaption(gate, false, 0)).toBe('WEIR GATE\nLOCKED: WEIR KEY');
    expect(extractionRequirementText(gate, 0)).toBe('NEEDS THE WEIR KEY');
    expect(extractionCaption(gate, true, 0)).toBe('WEIR GATE\nEXTRACT OPEN');
    expect(extractionCaption(exit('pallet-town', 'ROCKFALL'), false, 0)).toBe(
      'ROCKFALL\nUNDER RUBBLE\nNEEDS A PICKAXE',
    );
  });

  it('opens only once this raid has opened it, never with the clock or a landmark', () => {
    const gate = exit('floodplain-relay', 'MARKET STAIRS');
    const everyLandmark = new Set(WORLD_POIS.map((poi) => poi.id));
    expect(isExtractionAvailable(gate, 300_000, everyLandmark, new Set())).toBe(false);
    expect(isExtractionAvailable(gate, 0, new Set(), new Set(['MARKET STAIRS']))).toBe(true);
    expect(itemThatOpens(gate)).toBe('market-key');
    expect(itemThatOpens(exit('floodplain-relay', 'QUARRY FALL'))).toBe('pickaxe');
    expect(itemThatOpens(exit('floodplain-relay', 'MILL RACE'))).toBeUndefined();
  });

  it('gives every key one gate, on the map the key is found on, in a place of its own', () => {
    for (const keyId of KEY_ITEM_IDS) {
      const gates = EXTRACTION_POINTS.filter((point) => itemThatOpens(point) === keyId);
      expect(gates.map((point) => point.label), keyId).toHaveLength(1);
      const [gate] = gates;
      // A key is a find, not a supply: rolled on its own odds and seated in
      // one district of the gate's own map, so a raid can be *for* it.
      const laid = WORLD_MAPS[gate.mapId as BuiltInMapId].loot.filter((loot) => loot.itemId === keyId);
      expect(laid, keyId).toHaveLength(1);
      expect(isPrize(laid[0]), keyId).toBe(true);
      expect(laid[0].district, keyId).toBeDefined();
      // And never in the district its gate is in: the key is a walk away.
      expect(districtAt(gate.mapId, gate.position)?.id, keyId).not.toBe(laid[0].district);
      // Nowhere else hands one out: no barter, no shelf, no other map.
      for (const mapId of BUILT_IN_MAP_IDS.filter((id) => id !== gate.mapId)) {
        expect(WORLD_MAPS[mapId].loot.some((loot) => loot.itemId === keyId), `${keyId} on ${mapId}`).toBe(false);
      }
    }
  });

  it('stands on every shipped map: a key exit on each, and rubble wherever the rock allows', () => {
    for (const mapId of BUILT_IN_MAP_IDS) {
      const barred = EXTRACTION_POINTS.filter((point) => point.mapId === mapId && isBarredExit(point));
      expect(barred.filter((point) => point.requirement?.kind === 'key'), mapId).toHaveLength(1);
      expect(barred.filter(isDugExit).length, mapId).toBeLessThanOrEqual(1);
    }
    expect(EXTRACTION_POINTS.filter(isDugExit).map((point) => point.mapId).sort()).toEqual(
      ['floodplain-relay', 'pallet-town', 'route-1', 'viridian-forest'],
    );
  });
});
