import { describe, expect, it } from 'vitest';
import { GREYSTONE_VALE } from '../../../tools/mapcraft/worlds/greystoneVale/plan';
import { SPYGLASS_SIGHTS, spyglassLines } from './spyglass';

/** Every name in the vale's plan, wherever it is, with the `reach` brief of the place that carries it. */
function namedInPlan(): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.name === 'string') {
        found.set(record.name, JSON.stringify(record.reach ?? ''));
      }
      Object.values(record).forEach(walk);
    }
  };
  walk(GREYSTONE_VALE);
  return found;
}

describe('the captain\'s spyglass', () => {
  it('shows, after dark, every far place the vale plans as hard to reach - each one a place the plan names', () => {
    const plan = namedInPlan();
    const shown = SPYGLASS_SIGHTS.night.map((sight) => sight.place);
    for (const place of shown) {
      expect([place, plan.has(place ?? '')]).toEqual([place, true]);
      expect([place, (plan.get(place ?? '') ?? '').length > 2]).toEqual([place, true]);
    }
    expect(new Set(shown).size).toBe(shown.length);
  });

  it('lends the glass once and then goes round the sights for the hour, in order', () => {
    expect(spyglassLines('night', 0)[0]).toContain('have a look through my glass');
    expect(spyglassLines('night', 1)[0]).toContain('Another look');
    expect(spyglassLines('night', 0)[1]).toBe(SPYGLASS_SIGHTS.night[0].line);
    expect(spyglassLines('night', SPYGLASS_SIGHTS.night.length)[1]).toBe(SPYGLASS_SIGHTS.night[0].line);
    expect(spyglassLines('day', 1)[1]).toBe(SPYGLASS_SIGHTS.day[1].line);
  });

  it('tells a player by day to come back after dark', () => {
    expect(SPYGLASS_SIGHTS.day.some((sight) => sight.line.includes('after dark'))).toBe(true);
  });
});
