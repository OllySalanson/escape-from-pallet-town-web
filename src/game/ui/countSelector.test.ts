import { describe, expect, it } from 'vitest';
import { clampCount, COUNT_BIG_STEP, countKeyTarget, countSelector } from './countSelector';

const selector = (value: number, max: number) =>
  countSelector({ kind: 'item', id: 'potion', label: 'Potion', value, max, limit: 'Pack is full.', help: 'Pack it.' });

describe('count selector', () => {
  it('clamps to its ends, and to a ceiling below its floor', () => {
    expect(clampCount(9, 0, 4)).toBe(4);
    expect(clampCount(-3, 0, 4)).toBe(0);
    expect(clampCount(2, 1, 0)).toBe(1);
  });

  it('steps by one, five with Shift or the page keys, and to the ends with Home and End', () => {
    expect(countKeyTarget('ArrowRight', false, 2, 0, 9)).toBe(3);
    expect(countKeyTarget('ArrowLeft', false, 2, 0, 9)).toBe(1);
    expect(countKeyTarget('ArrowRight', true, 2, 0, 9)).toBe(2 + COUNT_BIG_STEP);
    expect(countKeyTarget('PageUp', false, 2, 0, 9)).toBe(7);
    expect(countKeyTarget('PageDown', false, 2, 0, 9)).toBe(0);
    expect(countKeyTarget('Home', false, 5, 0, 9)).toBe(0);
    expect(countKeyTarget('End', false, 5, 0, 9)).toBe(9);
    expect(countKeyTarget('ArrowUp', false, 5, 0, 9)).toBeUndefined();
  });

  it('never targets more than what fits, however far a key reaches', () => {
    expect(countKeyTarget('ArrowRight', true, 3, 0, 4)).toBe(4);
    expect(countKeyTarget('End', false, 0, 0, 0)).toBe(0);
  });

  it('says the limit, not the help, on a plus that has nowhere to go', () => {
    const full = selector(4, 4);
    expect(full).toContain('data-help="Pack is full."');
    expect(full).toContain('aria-disabled="true"');
    expect(full).toContain('data-count-max="4"');
    const room = selector(1, 4);
    expect(room).not.toContain('Pack is full.');
    expect(room).not.toContain('aria-disabled');
  });

  it('shuts the minus at the floor and shows the running total', () => {
    const none = selector(0, 3);
    expect(none).toContain('disabled');
    expect(none).toContain('aria-valuenow="0"');
    expect(selector(2, 3)).toContain('<b role="spinbutton" aria-valuemin="0" aria-valuemax="3" aria-valuenow="2">2</b>');
  });

  it('draws the value clamped, so a stale count can never read past the ceiling', () => {
    expect(selector(9, 3)).toContain('data-count-value="3"');
  });
});
