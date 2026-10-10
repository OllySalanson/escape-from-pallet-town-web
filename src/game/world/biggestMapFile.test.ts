import { describe, expect, it } from 'vitest';
import { tiledSample } from '../maker/tiledSample.testkit';
import { sendRefusal, SENDABLE_MAP_SIZE } from '../maker/submissions';
import { generateRunPlan } from '../run/runGeneration';
import { buildPlayerMap, MAP_FILE_LIMITS, readMapFile } from './mapFile';
import { checkMapFile } from './mapFileChecks';
import { registerPlayerMap, unregisterPlayerMap } from './playerMaps';
import { getWorldMap } from '../worldMap';

/**
 * The biggest map a maker may draw is a map the game plays: it is read, passes
 * every check and deploys. How fast is measured in a browser rather than here
 * (`tools/playtest/makerHuge.mjs`), because a timing in a shared test run says
 * more about the box than about the game.
 */
describe('the biggest map a maker may draw', () => {
  const file = {
    ...tiledSample(MAP_FILE_LIMITS.maxWidth, MAP_FILE_LIMITS.maxHeight),
    id: 'biggest',
    name: 'Biggest',
  };

  it('is four times the area of the biggest map the game ships', () => {
    expect(MAP_FILE_LIMITS.maxWidth * MAP_FILE_LIMITS.maxHeight).toBe(4 * 128 * 128);
  });

  it('is read, and passes every check', () => {
    expect(readMapFile(file).ok).toBe(true);
    expect(checkMapFile(file).filter((check) => !check.passed)).toEqual([]);
  });

  it('deploys, with its loot laid on ground you can stand on', () => {
    const map = buildPlayerMap(file);
    registerPlayerMap(map);
    try {
      const plan = generateRunPlan(7, undefined, map.insertions[0].id);
      expect(plan.insertion.mapId).toBe(map.id);
      const world = getWorldMap(map.id);
      expect(world.collision).toHaveLength(MAP_FILE_LIMITS.maxHeight);
      expect(
        plan.loot[map.id].every((piece) => !world.collision[piece.position.y][piece.position.x]),
      ).toBe(true);
    } finally {
      unregisterPlayerMap(map.id);
    }
  });

  it('can be sent in: the inbox takes every map the maker can draw', () => {
    expect(SENDABLE_MAP_SIZE).toBe(MAP_FILE_LIMITS.maxWidth);
    expect(sendRefusal(file)).toBeUndefined();
  });
});
