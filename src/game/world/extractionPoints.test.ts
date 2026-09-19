import { describe, expect, it } from 'vitest';
import { EXTRACTION_POINTS, extractionCaption } from './extractionPoints';

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
