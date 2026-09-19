import { describe, expect, it } from 'vitest';
import { FIRST_CONTRACT } from '../objectives';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { compassBearing, compassWord } from './bearing';

describe('a heading', () => {
  const here = { x: 10, y: 10 };

  it('names the nearest of eight points, not the quadrant', () => {
    expect(compassBearing(here, { x: 10, y: 3 })).toBe('N');
    expect(compassBearing(here, { x: 8, y: 21 })).toBe('S');
    expect(compassBearing(here, { x: 21, y: 9 })).toBe('E');
    expect(compassBearing(here, { x: 0, y: 12 })).toBe('W');
    expect(compassBearing(here, { x: 15, y: 15 })).toBe('SE');
    expect(compassBearing(here, { x: 5, y: 14 })).toBe('SW');
    expect(compassBearing(here, { x: 6, y: 5 })).toBe('NW');
    expect(compassBearing(here, { x: 13, y: 6 })).toBe('NE');
  });

  it('has nothing to say about the tile you are on', () => {
    expect(compassBearing(here, here)).toBeNull();
  });

  // Playtest 4: the deployment briefing said the kit was SOUTH while the chip
  // above it read LOST KIT: SW.
  it('agrees with the first briefing about where the kit is', () => {
    const bearing = compassBearing(
      RUN_INSERTIONS['floodplain-relay'].position,
      FIRST_CONTRACT.markers[0].position,
    )!;
    expect(FIRST_CONTRACT.deploymentBriefing).toContain(
      `The field kit is ${compassWord(bearing).toUpperCase()},`,
    );
  });
});
