import { describe, expect, it } from 'vitest';
import { HUNTER_SPAWN_DISTANCE } from '../world/hunter';
import {
  entersTallGrass,
  HUNTER_NEAR_RELEASE_STEPS,
  HUNTER_NEAR_STEPS,
  nextBump,
  nextHunterProximity,
} from './worldSounds';

describe('entersTallGrass', () => {
  it('rustles once down a whole lane of reeds', () => {
    const lane = [false, true, true, true, true, false, true];
    const rustles = lane.slice(1).map((tile, index) => entersTallGrass(lane[index], tile));
    expect(rustles).toEqual([true, false, false, false, false, true]);
  });
});

describe('nextBump', () => {
  it('thuds once for a key held against a wall', () => {
    let pushing = null as ReturnType<typeof nextBump>['pushingAgainst'];
    const thuds = Array.from({ length: 60 }, () => {
      const result = nextBump(pushing, 'left');
      pushing = result.pushingAgainst;
      return result.thud;
    });
    expect(thuds.filter(Boolean)).toHaveLength(1);
    expect(thuds[0]).toBe(true);
  });

  it('thuds again after letting go, after a step, or against a different wall', () => {
    expect(nextBump(nextBump('left', null).pushingAgainst, 'left').thud).toBe(true);
    expect(nextBump('left', 'up').thud).toBe(true);
  });

  it('is silent while nothing is in the way', () => {
    expect(nextBump(null, null)).toEqual({ pushingAgainst: null, thud: false });
  });
});

describe('nextHunterProximity', () => {
  it('warns once as the hunter closes in', () => {
    let near = false;
    const warnings = [9, 7, 5, 4, 3, 2, 3, 4, 3].map((distance) => {
      const result = nextHunterProximity(near, distance);
      near = result.near;
      return result.warn;
    });
    expect(warnings.filter(Boolean)).toHaveLength(1);
    expect(warnings[4]).toBe(true);
  });

  it('is not an echo of the arrival: the hunter spawns outside it, with a step to spare', () => {
    expect(HUNTER_NEAR_STEPS).toBeLessThan(HUNTER_SPAWN_DISTANCE - 1);
    expect(nextHunterProximity(false, HUNTER_SPAWN_DISTANCE - 1).warn).toBe(false);
  });

  it('does not chatter when the hunter paces the player at the boundary', () => {
    let near = false;
    let warnings = 0;
    for (let step = 0; step < 40; step += 1) {
      const result = nextHunterProximity(near, step % 2 === 0 ? HUNTER_NEAR_STEPS : HUNTER_NEAR_STEPS + 1);
      near = result.near;
      warnings += result.warn ? 1 : 0;
    }
    expect(warnings).toBe(1);
  });

  it('re-arms once the player has really got away, or the hunter has left the map', () => {
    expect(nextHunterProximity(true, HUNTER_NEAR_RELEASE_STEPS).near).toBe(false);
    expect(nextHunterProximity(true, null).near).toBe(false);
    expect(nextHunterProximity(false, HUNTER_NEAR_STEPS).warn).toBe(true);
  });
});
