import { describe, expect, it } from 'vitest';
import { isDimmed, inkAtHour, townLights } from './pitClock';
import { isGroundKnown } from './arenaPit';

const picture = { width: 4, height: 2, rows: ['g.??', 'T,??'] };

describe('the pit by the player\'s clock', () => {
  it('is brighter by day and darker and bluer by night, always in 15-bit colour', () => {
    const grass: readonly [number, number, number] = [104, 160, 80];
    const day = inkAtHour(grass, 'ground', 'day');
    const night = inkAtHour(grass, 'ground', 'night');
    expect(day[1]).toBeGreaterThan(grass[1]);
    expect(night[1]).toBeLessThan(grass[1] / 2);
    expect(night[2]).toBeGreaterThan(night[0]);
    for (const value of [...day, ...night, ...inkAtHour([248, 248, 248], 'cloud', 'day')]) {
      expect(value % 8).toBe(0);
      expect(value).toBeLessThanOrEqual(248);
    }
  });

  it('has no lights by day, and lights by night only on ground this save has walked', () => {
    const places = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(townLights(picture, places, isGroundKnown, 984, 'day')).toEqual([]);
    const lights = townLights(picture, places, isGroundKnown, 984, 'night');
    expect(lights).toHaveLength(2);
    // Two of the places are known; the map is drawn big in the middle of the floor.
    expect(lights[0].x).toBeGreaterThan(0);
    expect(lights[0].x).toBeLessThan(984);
  });

  it('has fewer lit at dusk than at night', () => {
    const rows = Array.from({ length: 40 }, () => 'g'.repeat(40));
    const places = Array.from({ length: 1600 }, (_each, index) => ({ x: index % 40, y: Math.floor(index / 40) }));
    const dusk = townLights({ width: 40, height: 40, rows }, places, isGroundKnown, 984, 'dusk').length;
    const night = townLights({ width: 40, height: 40, rows }, places, isGroundKnown, 984, 'night').length;
    expect(night).toBe(1600);
    expect(dusk).toBeGreaterThan(400);
    expect(dusk).toBeLessThan(1200);
  });

  it('twinkles a little, not all together', () => {
    const lit = Array.from({ length: 400 }, (_each, index) => isDimmed(index, 7)).filter(Boolean).length;
    expect(lit).toBeGreaterThan(10);
    expect(lit).toBeLessThan(100);
  });
});
