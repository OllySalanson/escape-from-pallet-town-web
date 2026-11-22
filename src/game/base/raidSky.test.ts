import { describe, expect, it } from 'vitest';
import { clockAfterWaiting, raidSky, waitableSkies, WAIT_FOR_DARK_MS } from './raidSky';

const at = (hour: number) => new Date(2026, 10, 22, hour, 0);

describe('waiting on the rim for a darker sky', () => {
  it('waits only for a sky later in the evening, never for the day', () => {
    expect(waitableSkies(at(12))).toEqual(['dusk', 'night']);
    expect(waitableSkies(at(19))).toEqual(['night']);
    expect(waitableSkies(at(23))).toEqual([]);
    expect(waitableSkies(at(2))).toEqual([]);
    // Six in the morning is the sun coming up: the next dusk is the evening's.
    expect(waitableSkies(at(6))).toEqual(['dusk', 'night']);
  });

  it('gives the sky waited for when it can be waited for, and the clock’s otherwise', () => {
    expect(raidSky(at(12), 'night')).toBe('night');
    expect(raidSky(at(12), 'dusk')).toBe('dusk');
    expect(raidSky(at(12), undefined)).toBe('day');
    expect(raidSky(at(23), 'dusk')).toBe('night');
  });

  it('costs a minute of the raid clock, and never more than the clock has', () => {
    expect(WAIT_FOR_DARK_MS).toBe(60_000);
    expect(clockAfterWaiting(300_000, true)).toBe(240_000);
    expect(clockAfterWaiting(300_000, false)).toBe(300_000);
    expect(clockAfterWaiting(30_000, true)).toBe(0);
  });
});
