import { describe, expect, it } from 'vitest';
import type { MapRaidRecord } from '../save/SaveManager';
import { WORLD_MAP_NAMES, TILE_SIZE } from '../worldMap';
import { baseGame } from './baseGames.testkit';
import { PENNANTS, earnedPennants, pennantLines, pennantsNote, pennantsPoster } from './pennants';
import { PENNANT_WALL } from './rooms';

const raids = (record: Record<string, MapRaidRecord>) => baseGame({ progress: { raidRecord: record } });
const alpha = (picture: { width: number; data: Uint8ClampedArray }, x: number, y: number): number =>
  picture.data[(y * picture.width + x) * 4 + 3];

describe('the pennants along the bedroom wall', () => {
  it('has one pennant for every map the game ships, one to a tile of the wall it hangs on', () => {
    expect(PENNANTS.map((pennant) => pennant.mapId).sort()).toEqual(Object.keys(WORLD_MAP_NAMES).sort());
    expect(PENNANT_WALL.width).toBe(PENNANTS.length);
    for (const pennant of PENNANTS) {
      expect(pennant.mark).toHaveLength(5);
      for (const row of pennant.mark) expect(/^[x.]{5}$/.test(row)).toBe(true);
    }
  });

  /** Coming home is what the game asks of a place - a raid that was lost there earns nothing. */
  it('hangs a pennant for a place only once a raid has come home from it', () => {
    expect(earnedPennants(baseGame())).toEqual([]);
    const lostOnly = raids({ 'route-1': { deployed: 3, extracted: 0, wiped: 3 } });
    expect(earnedPennants(lostOnly)).toEqual([]);
    const home = raids({
      'route-1': { deployed: 3, extracted: 1, wiped: 2 },
      'floodplain-relay': { deployed: 5, extracted: 4, wiped: 1 },
    });
    // In the string's own order: the Floodplain first.
    expect(earnedPennants(home).map((pennant) => pennant.mapId)).toEqual(['floodplain-relay', 'route-1']);
    expect(pennantsNote(home)).toBe(`2 of ${PENNANTS.length} places come home from`);
    expect(pennantLines(home).slice(1)).toEqual(['FLOODPLAIN RELAY: home 4 times.', 'ROUTE 1: home once.']);
  });

  it('says how many there are to collect before any is', () => {
    expect(pennantsNote(baseGame())).toBe('Bare pins, waiting');
    expect(pennantLines(baseGame())[0]).toContain(`${PENNANTS.length} bare pins`);
  });

  it('paints an earned pennant into its tile and leaves an unearned one a pin', () => {
    const earned = pennantsPoster(raids({ 'floodplain-relay': { deployed: 1, extracted: 1, wiped: 0 } }), PENNANT_WALL);
    expect([earned.width, earned.height]).toEqual([PENNANT_WALL.width * TILE_SIZE, PENNANT_WALL.height * TILE_SIZE]);
    const paintedIn = (slot: number): number => {
      let count = 0;
      // Below the string, which sags to row 7.
      for (let y = 9; y < earned.height; y += 1) {
        for (let x = slot * TILE_SIZE; x < (slot + 1) * TILE_SIZE; x += 1) {
          if (alpha(earned, x, y) > 0) count += 1;
        }
      }
      return count;
    };
    // The Floodplain's pennant hangs below the string; Route 1's tile is bare.
    expect(paintedIn(0)).toBeGreaterThan(40);
    expect(paintedIn(1)).toBe(0);
  });
});
