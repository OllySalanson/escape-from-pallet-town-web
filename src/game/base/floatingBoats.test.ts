import { describe, expect, it } from 'vitest';
import { ARRIVAL_MS, arrivalOffset, bobOffset } from './floatingBoats';
import { HARBOUR_LANDMARKS } from './landmarks';

describe('the boats on the water', () => {
  it('ride the swell a pixel up and down, never more, and come round again', () => {
    const seen = new Set<number>();
    for (let ms = 0; ms < 4000; ms += 16) {
      const offset = bobOffset(ms, 1900);
      expect(Math.abs(offset)).toBeLessThanOrEqual(1);
      seen.add(offset);
    }
    expect([...seen].sort()).toEqual([-1, 0, 1]);
    expect(bobOffset(0, 1900)).toBe(bobOffset(1900, 1900));
  });

  it('bring the Seagallop in from the bay to her berth, and leave her there', () => {
    const start = arrivalOffset(0);
    expect(Math.hypot(start.x, start.y)).toBeGreaterThan(32);
    let last = Math.hypot(start.x, start.y);
    for (let ms = 0; ms <= ARRIVAL_MS; ms += 50) {
      const here = arrivalOffset(ms);
      const away = Math.hypot(here.x, here.y);
      expect(away).toBeLessThanOrEqual(last);
      last = away;
    }
    expect(arrivalOffset(ARRIVAL_MS)).toEqual({ x: 0, y: 0 });
    expect(arrivalOffset(ARRIVAL_MS * 3)).toEqual({ x: 0, y: 0 });
  });

  it('have exactly one boat a raid comes home on, and give every boat its own swell', () => {
    const boats = HARBOUR_LANDMARKS.filter((landmark) => landmark.floats);
    expect(boats.filter((boat) => boat.floats?.bringsRaidsHome).map((boat) => boat.id)).toEqual(['seagallop']);
    expect(new Set(boats.map((boat) => boat.floats?.swellMs)).size).toBe(boats.length);
  });
});
