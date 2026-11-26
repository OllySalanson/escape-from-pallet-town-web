import { describe, expect, it } from 'vitest';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { availableInsertionIds, runInsertion } from '../run/runGeneration';
import { isWorldMapId } from '../worldMap';
import { homeChartMap } from './chartKnown';

describe('homeChartMap: THE MAP on M at home', () => {
  it("is the map the next raid's landings are on, and always a raid's map", () => {
    const first = availableInsertionIds(DEFAULT_RAID_PROGRESS)[0];
    expect(first).toBeDefined();
    const mapId = homeChartMap(DEFAULT_RAID_PROGRESS);
    expect(mapId).toBe(runInsertion(first ?? '')?.mapId);
    expect(isWorldMapId(mapId)).toBe(true);
  });

  it('is Greystone Vale when no landing is offered', () => {
    expect(homeChartMap({ unlockedInsertions: [], reachedInsertions: [] })).toBe('greystone-vale');
  });
});
