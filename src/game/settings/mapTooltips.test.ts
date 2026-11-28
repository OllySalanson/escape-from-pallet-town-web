import { describe, expect, it } from 'vitest';
import { MAP_TOOLTIPS_STORAGE_KEY, mapTooltipsOn, setMapTooltips } from './mapTooltips';

const store = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), values };
};

describe('the map tooltips setting', () => {
  it('is off in a browser that has never chosen, and with no storage at all', () => {
    expect(mapTooltipsOn(store())).toBe(false);
    expect(mapTooltipsOn(null)).toBe(false);
  });

  it('keeps a choice to turn them on, and back off', () => {
    const kept = store();
    expect(setMapTooltips(true, kept)).toBe(true);
    expect(kept.values.get(MAP_TOOLTIPS_STORAGE_KEY)).toBe('on');
    expect(mapTooltipsOn(kept)).toBe(true);
    setMapTooltips(false, kept);
    expect(mapTooltipsOn(kept)).toBe(false);
  });

  it('stays off when storage throws, as a private window can', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(mapTooltipsOn(broken)).toBe(false);
    expect(setMapTooltips(false, broken)).toBe(false);
  });
});
