import { describe, expect, it } from 'vitest';
import { RunManager } from '../run/RunManager';
import { WORLD_POIS, tryActivatePoi } from './pois';

const fieldStation = WORLD_POIS[0];

describe('world POIs', () => {
  it('only activates a fixed POI once during an active run', () => {
    const activated = new Set<string>();
    const grants: string[] = [];

    expect(
      tryActivatePoi(fieldStation, true, activated, (itemId, quantity) => {
        grants.push(`${itemId}:${quantity}`);
        return true;
      }),
    ).toBe('activated');
    expect(activated).toEqual(new Set([fieldStation.id]));
    expect(grants).toEqual(['poke-ball:2', 'potion:1']);
    expect(tryActivatePoi(fieldStation, true, activated, () => true)).toBe('unavailable');
  });

  it('remains consumed when battle return recreates the scene state', () => {
    const activatedBeforeBattle = new Set([fieldStation.id]);
    const activatedAfterBattle = new Set([...activatedBeforeBattle]);

    expect(tryActivatePoi(fieldStation, true, activatedAfterBattle, () => true)).toBe('unavailable');
    expect(activatedAfterBattle).toEqual(activatedBeforeBattle);
  });

  it('cannot grant the cache outside a raid or when the bag rejects it', () => {
    const activated = new Set<string>();

    expect(tryActivatePoi(fieldStation, false, activated, () => true)).toBe('unavailable');
    expect(tryActivatePoi(fieldStation, true, activated, () => false)).toBe('bag-full');
    expect(activated).toEqual(new Set());
  });

  it('keeps the marked cache temporary until extraction and loses it on wipe', () => {
    const extracted = new RunManager();
    extracted.startRun({ party: [], items: [] }, { mapId: 'route-1', durationMs: 60_000 });
    const extractedPoiIds = new Set<string>();
    tryActivatePoi(fieldStation, true, extractedPoiIds, (itemId, quantity) => {
      extracted.registerFoundItem(itemId, quantity);
      return true;
    });

    expect(extracted.resolveEscape().bankedItems).toEqual([
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ]);

    const wiped = new RunManager();
    wiped.startRun({ party: [], items: [] }, { mapId: 'route-1', durationMs: 60_000 });
    tryActivatePoi(fieldStation, true, new Set(), (itemId, quantity) => {
      wiped.registerFoundItem(itemId, quantity);
      return true;
    });

    const wipeResult = wiped.resolveWipe();
    expect(wipeResult.bankedItems).toEqual([]);
    expect(wipeResult.lostItems).toEqual([
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ]);
  });
});
