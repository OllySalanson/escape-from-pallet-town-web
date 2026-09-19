import { describe, expect, it } from 'vitest';
import { SpentPresses } from './spentPresses';

describe('spent key presses', () => {
  it('reads a held key as up once its press has been answered', () => {
    const right = { isDown: true };
    const presses = new SpentPresses<{ isDown: boolean }>();

    expect(presses.isFreshlyDown(right)).toBe(true);
    presses.spendHeld([right]);
    expect(presses.isFreshlyDown(right)).toBe(false);
    // Still held a frame later: still the same press, still spent.
    expect(presses.isFreshlyDown(right)).toBe(false);
  });

  it('hands the key back on release, so walking that way is one more press', () => {
    const right = { isDown: true };
    const presses = new SpentPresses<{ isDown: boolean }>();
    presses.spendHeld([right]);

    right.isDown = false;
    expect(presses.isFreshlyDown(right)).toBe(false);
    right.isDown = true;
    expect(presses.isFreshlyDown(right)).toBe(true);
  });

  it('spends only what is held, and leaves every other key alone', () => {
    const right = { isDown: true };
    const up = { isDown: false };
    const presses = new SpentPresses<{ isDown: boolean }>();
    presses.spendHeld([right, up]);

    up.isDown = true;
    expect(presses.isFreshlyDown(up)).toBe(true);
    expect(presses.isFreshlyDown(right)).toBe(false);
  });
});
