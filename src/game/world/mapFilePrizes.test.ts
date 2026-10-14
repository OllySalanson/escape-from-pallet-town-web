import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import { isPrize } from './loot';
import {
  BUILT_IN_MAP_FILE_LIMITS,
  buildPlayerMap,
  MAP_FILE_PRIZES,
  readMapFile,
  type MapFile,
} from './mapFile';

/**
 * A prize on a file map: gear the game's own map holds in one place and
 * nowhere else, laid on its own odds and seated in its own place, as the Card
 * Key is. A player's map holds none, because gear is never handed out by
 * anything a maker places.
 */
const SAMPLE = sampleLane as MapFile;
const WITH_PRIZE: MapFile = {
  ...SAMPLE,
  itemSpots: [...SAMPLE.itemSpots, { x: 5, y: 5, prize: 'spell-tag' }],
};

describe('a prize on a file map', () => {
  it('is the game’s own map’s alone', () => {
    const player = readMapFile(WITH_PRIZE);
    expect(player.ok).toBe(false);
    if (!player.ok) {
      expect(player.problems.join(' ')).toMatch(/cannot hold a prize/);
    }
    expect(readMapFile(WITH_PRIZE, { limits: BUILT_IN_MAP_FILE_LIMITS }).ok).toBe(true);
  });

  it('is refused if it is not one of the game’s prizes, or shares a spot with the Card Key', () => {
    const odd = { ...SAMPLE, itemSpots: [{ x: 5, y: 5, prize: 'potion' }] };
    const keyed = { ...SAMPLE, itemSpots: [{ x: 5, y: 5, prize: 'spell-tag', key: true }] };
    for (const file of [odd, keyed]) {
      expect(readMapFile(file, { limits: BUILT_IN_MAP_FILE_LIMITS }).ok).toBe(false);
    }
  });

  it('is laid on its own odds in the place its spot stands in, out of every other spot’s turn', () => {
    const plain = buildPlayerMap(SAMPLE, BUILT_IN_MAP_FILE_LIMITS).loot;
    const prized = buildPlayerMap(WITH_PRIZE, BUILT_IN_MAP_FILE_LIMITS).loot;
    expect(prized.slice(0, plain.length).map((loot) => [loot.itemId, loot.quantity])).toEqual(
      plain.map((loot) => [loot.itemId, loot.quantity]),
    );
    const prize = prized.at(-1)!;
    expect(prize).toMatchObject({ itemId: 'spell-tag', quantity: 1, chance: MAP_FILE_PRIZES['spell-tag'] });
    expect(isPrize(prize)).toBe(true);
    // The spot stands in the sample's pond, and the prize is that place's.
    expect(prize.district).toBe('player-sample-lane/district-1');
  });
});
