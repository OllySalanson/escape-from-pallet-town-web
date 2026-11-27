import { describe, expect, it } from 'vitest';
import { LEAVE_MS, arrivalLength, arrivalPlan, movesAsScreen, screensMove } from './menuMotion';

describe('a screen arriving', () => {
  it('takes about a fifth of a second, however many cards it holds', () => {
    for (const cards of [1, 2, 5, 12, 151]) {
      const length = arrivalLength(arrivalPlan(cards, false));
      expect(length, `${cards} cards`).toBeGreaterThanOrEqual(150);
      expect(length, `${cards} cards`).toBeLessThanOrEqual(260);
    }
  });

  it('dims the place, drops its title, steps its cards up one after another and raises its help', () => {
    const plan = arrivalPlan(3, false);
    expect(plan.map((step) => step.part)).toEqual(['dim', 'title', 'card', 'card', 'card', 'help']);
    const cards = plan.filter((step) => step.part === 'card');
    expect(cards.map((step) => step.index)).toEqual([0, 1, 2]);
    expect(cards[1].delayMs).toBeGreaterThan(cards[0].delayMs);
    expect(cards[2].delayMs).toBeGreaterThan(cards[1].delayMs);
  });

  it('is stepped, never eased: every part moves in a few whole steps', () => {
    for (const plan of [arrivalPlan(6, false), arrivalPlan(6, true)]) {
      for (const step of plan) {
        expect(Number.isInteger(step.steps)).toBe(true);
        expect(step.steps).toBeGreaterThanOrEqual(2);
        expect(step.steps).toBeLessThanOrEqual(4);
      }
    }
  });

  it('only steps its cards in when it follows another screen: the place is dim already', () => {
    const plan = arrivalPlan(4, true);
    expect(new Set(plan.map((step) => step.part))).toEqual(new Set(['card']));
    expect(plan[0].delayMs).toBe(0);
    expect(arrivalLength(plan)).toBeLessThan(arrivalLength(arrivalPlan(4, false)));
  });

});

describe('a screen leaving', () => {
  it('is gone in half the time it took to come', () => {
    expect(LEAVE_MS).toBeLessThanOrEqual(arrivalLength(arrivalPlan(3, false)) / 2);
  });
});

describe('which screens move', () => {
  it('is every one in the game\'s own look, and no other', () => {
    expect(movesAsScreen('things-menu pixel-ui wood-floor')).toBe(true);
    expect(movesAsScreen('pixel-ui')).toBe(true);
    expect(movesAsScreen('chart-screen')).toBe(false);
    expect(movesAsScreen('not-pixel-ui')).toBe(false);
  });
});

describe('test mode', () => {
  it('has screens arrive and leave at once, because a stepped loop does not turn the wall clock', () => {
    expect(screensMove('logic', '?testmode=1')).toBe(false);
    expect(screensMove('pixels', '?testmode=pixels')).toBe(false);
  });

  it('plays the move when the address asks for it, and always for a player', () => {
    expect(screensMove('pixels', '?testmode=pixels&menumotion=1')).toBe(true);
    expect(screensMove('off', '')).toBe(true);
  });
});
