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
    expect(extractionCaption(exit('floodplain-relay', 'RADIO EXIT'), false, 0)).toBe(
      'RADIO EXIT\nEXTRACT ACTIVATE RANGER STATION',
    );
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
