import { describe, expect, it } from 'vitest';
import { MAP_TOOLTIPS_STORAGE_KEY, mapTooltipsOn, setMapTooltips } from './mapTooltips';

const store = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), values };
};

describe('the map tooltips setting', () => {
  it('is on in a browser that has never chosen, and with no storage at all', () => {
    expect(mapTooltipsOn(store())).toBe(true);
    expect(mapTooltipsOn(null)).toBe(true);
  });

  it('keeps a choice to turn them off, and back on', () => {
    const kept = store();
    expect(setMapTooltips(false, kept)).toBe(true);
    expect(kept.values.get(MAP_TOOLTIPS_STORAGE_KEY)).toBe('off');
    expect(mapTooltipsOn(kept)).toBe(false);
    setMapTooltips(true, kept);
    expect(mapTooltipsOn(kept)).toBe(true);
  });

  it('stays on when storage throws, as a private window can', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(mapTooltipsOn(broken)).toBe(true);
    expect(setMapTooltips(false, broken)).toBe(false);
  });
});
