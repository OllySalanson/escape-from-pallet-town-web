import { describe, expect, it } from 'vitest';
import { RunManager } from '../run/RunManager';
import {
  extractionRequirementText,
  isExtractionAvailable,
  EXTRACTION_POINTS,
} from './extractionPoints';
import { tryActivatePoi, WORLD_POIS } from './pois';

const floodplainExits = EXTRACTION_POINTS.filter((point) => point.mapId === 'floodplain-relay');
const vault = WORLD_POIS.find((poi) => poi.id === 'floodplain-supply-vault')!;
const rangerStation = WORLD_POIS.find((poi) => poi.id === 'floodplain-ranger-radio')!;

describe('Floodplain Relay', () => {
  it('keeps South Gate dependable, Ferry Dock timed, and Radio Exit station-activated', () => {
    const [southGate, ferryDock, radioExit] = floodplainExits;
    const inactive = new Set<string>();

    expect(isExtractionAvailable(southGate, 0, inactive)).toBe(true);
    expect(isExtractionAvailable(ferryDock, 44_999, inactive)).toBe(false);
    expect(extractionRequirementText(ferryDock, 44_999)).toBe('FERRY IN 1s');
    expect(isExtractionAvailable(ferryDock, 45_000, inactive)).toBe(true);
    expect(isExtractionAvailable(radioExit, 60_000, inactive)).toBe(false);
    expect(extractionRequirementText(radioExit, 60_000)).toBe('ACTIVATE RANGER RADIO');

    inactive.add(rangerStation.id);
    expect(isExtractionAvailable(radioExit, 0, inactive)).toBe(true);
  });

  it('activates the Ranger Station without granting a cache and retains its radio state', () => {
    const activated = new Set<string>();
    const grants: string[] = [];

    expect(
      tryActivatePoi(rangerStation, true, activated, (itemId, quantity) => {
        grants.push(`${itemId}:${quantity}`);
        return true;
      }),
    ).toBe('activated');
    expect(grants).toEqual([]);
    expect(activated).toEqual(new Set([rangerStation.id]));
    expect(tryActivatePoi(rangerStation, true, activated, () => true)).toBe('unavailable');
  });

  it('only banks the Flooded Supply Vault reward after extraction', () => {
    const extracted = new RunManager();
    extracted.startRun({ party: [], items: [] }, { mapId: 'floodplain-relay', durationMs: 60_000 });
    expect(
      tryActivatePoi(vault, true, new Set(), (itemId, quantity) => {
        extracted.registerFoundItem(itemId, quantity);
        return true;
      }),
    ).toBe('activated');
    expect(extracted.resolveEscape().bankedItems).toEqual([
      { itemId: 'great-ball', quantity: 2 },
      { itemId: 'super-potion', quantity: 1 },
    ]);

    const wiped = new RunManager();
    wiped.startRun({ party: [], items: [] }, { mapId: 'floodplain-relay', durationMs: 60_000 });
    tryActivatePoi(vault, true, new Set(), (itemId, quantity) => {
      wiped.registerFoundItem(itemId, quantity);
      return true;
    });
    const wipeResult = wiped.resolveWipe();
    expect(wipeResult.bankedItems).toEqual([]);
    expect(wipeResult.lostItems).toEqual([
      { itemId: 'great-ball', quantity: 2 },
      { itemId: 'super-potion', quantity: 1 },
    ]);
  });
});
