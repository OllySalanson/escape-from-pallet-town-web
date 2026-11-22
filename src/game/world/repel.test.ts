import { describe, expect, it } from 'vitest';
import { getItemById, ITEMS } from '../items';
import { TRADER_BARTERS } from '../hub/trader';
import {
  repelKeepsAway,
  repelSprayedLine,
  repelWoreOff,
  repelWorking,
  sprayRepel,
  stepRepel,
  type RepelState,
} from './repel';

const repel = getItemById('repel')!;
const lead = (level: number, isFainted = false) => ({ level, isFainted });

describe('the Repel', () => {
  it('is FireRed’s: a hundred steps, said in the catalogue', () => {
    expect(ITEMS.repel.effect).toEqual({ type: 'repel', steps: 100 });
    expect(sprayRepel(undefined, repel)).toEqual({ stepsLeft: 100 });
    expect(repelSprayedLine(repel)).toContain('100 steps');
  });

  it('is refused while one is still working, and not spent', () => {
    expect(sprayRepel({ stepsLeft: 1 }, repel)).toBeNull();
    // One that has run out and not yet been said is replaced.
    expect(sprayRepel({ stepsLeft: 0 }, repel)).toEqual({ stepsLeft: 100 });
    expect(sprayRepel(undefined, getItemById('potion')!)).toBeNull();
  });

  it('counts a step off every step, and wears off on the hundredth', () => {
    let state: RepelState | undefined = sprayRepel(undefined, repel)!;
    for (let step = 1; step < 100; step += 1) {
      state = stepRepel(state);
      expect(repelWorking(state)).toBe(true);
      expect(repelWoreOff(state)).toBe(false);
    }
    state = stepRepel(state);
    expect(repelWorking(state)).toBe(false);
    expect(repelWoreOff(state)).toBe(true);
    // Worn off it counts nothing further, and a raid with none has nothing to count.
    expect(stepRepel(state)).toEqual({ stepsLeft: 0 });
    expect(stepRepel(undefined)).toBeUndefined();
  });

  it('turns back a wild Pokémon weaker than the first one standing, and nothing else', () => {
    const working = { stepsLeft: 50 };
    expect(repelKeepsAway(working, 9, [lead(10)])).toBe(true);
    // Level with the lead or above gets through, as FireRed's does.
    expect(repelKeepsAway(working, 10, [lead(10)])).toBe(false);
    expect(repelKeepsAway(working, 14, [lead(10)])).toBe(false);
    // The lead is the first that can still fight.
    expect(repelKeepsAway(working, 9, [lead(30, true), lead(8)])).toBe(false);
    expect(repelKeepsAway(working, 9, [lead(5, true), lead(12)])).toBe(true);
    // Nobody standing turns nothing back.
    expect(repelKeepsAway(working, 2, [lead(30, true)])).toBe(false);
    // Nor does one worn off, or none at all.
    expect(repelKeepsAway({ stepsLeft: 0 }, 2, [lead(30)])).toBe(false);
    expect(repelKeepsAway(undefined, 2, [lead(30)])).toBe(false);
  });

  it('is bartered at Bill’s for one lamp oil, as often as it can be paid for', () => {
    const barter = TRADER_BARTERS.find((deal) => deal.gives.itemId === 'repel');
    expect(barter).toMatchObject({
      takes: [{ itemId: 'lamp-oil', quantity: 1 }],
      standing: 'regular',
      once: false,
      icon: 'repel',
    });
  });
});
