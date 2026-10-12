import { describe, expect, it } from 'vitest';
import { BUILT_IN_MAP_IDS, isMapInProgress } from '../worldMap';
import { stepDistances, walkableTiles } from './mapStructure';
import { densityOf, nearestThingSteps, SHIPPED_DENSITY } from './nearestThing';
import { shippedNearestSteps } from './shippedDensity';

/**
 * The reference a player's map is read against in review is the game's own
 * maps measured the same way (`mapFileSummary.ts`), so the two numbers it
 * quotes are held to those maps here rather than to a note.
 */
describe("the game's own maps, measured for the review summary", () => {
  // The reference is the finished maps: one still being drawn is mostly wood (`MAPS_IN_PROGRESS`).
  const means = BUILT_IN_MAP_IDS.filter((mapId) => !isMapInProgress(mapId)).map((mapId) => {
    const { map, nearest } = shippedNearestSteps(mapId);
    return densityOf(walkableTiles(map.collision).map((tile) => nearest[tile.y][tile.x]))!.mean;
  });

  it('runs from the least to the most the summary quotes, to the tenth', () => {
    const rounded = means.map((mean) => Math.round(mean * 10) / 10);
    expect(Math.min(...rounded)).toBe(SHIPPED_DENSITY.least);
    expect(Math.max(...rounded)).toBe(SHIPPED_DENSITY.most);
  });

  it('walks out of every thing at once to the same answer as a walk out of each', () => {
    const { map, things, nearest } = shippedNearestSteps('route-1');
    const each = things.map((thing) => stepDistances(map.collision, thing));
    for (const tile of walkableTiles(map.collision)) {
      const reached = each.map((field) => field[tile.y][tile.x]).filter((steps) => steps >= 0);
      expect(nearest[tile.y][tile.x], `${tile.x},${tile.y}`).toBe(
        reached.length > 0 ? Math.min(...reached) : -1,
      );
    }
    expect(nearestThingSteps(map.collision, [])[0][0]).toBe(-1);
  });
});
