import { describe, expect, it } from 'vitest';
import {
  PRIZE_VALUE_FALLBACK,
  prizeLeftLine,
  prizeLine,
  prizeDue,
  prizeMoneyFor,
} from './prizeMoney';

describe('prize money', () => {
  it('is FireRed\'s: four times the last Pokémon\'s level times the class\'s value', () => {
    // FireRed's Brock: a Lv 14 Onix last, a leader's 25 - ₽1,400, as the game pays.
    expect(prizeMoneyFor({ levels: [12, 14], design: 'brock', boss: true })).toBe(1_400);
    // A bug catcher is worth 3, a youngster 4, a swimmer 1.
    expect(prizeMoneyFor({ levels: [6], design: 'bug-catcher' })).toBe(72);
    expect(prizeMoneyFor({ levels: [5], design: 'youngster' })).toBe(80);
    expect(prizeMoneyFor({ levels: [9, 9], design: 'swimmer' })).toBe(36);
  });

  it('reads the last Pokémon sent out, never the strongest', () => {
    expect(prizeMoneyFor({ levels: [20, 17, 18], design: 'koga', boss: true })).toBe(4 * 18 * 25);
  });

  it('pays a look with no row of its own at FireRed\'s fallback, and a boss at least a leader\'s', () => {
    expect(prizeMoneyFor({ levels: [10] })).toBe(4 * 10 * PRIZE_VALUE_FALLBACK);
    expect(prizeMoneyFor({ levels: [16, 17], design: 'sailor', boss: true })).toBe(4 * 17 * 25);
  });

  it('pays a hunter as FireRed\'s early rival, whatever they look like', () => {
    expect(prizeMoneyFor({ levels: [7], hunter: true, design: 'beauty' })).toBe(4 * 7 * 4);
  });

  it('is never negative, and nothing for an empty party', () => {
    expect(prizeMoneyFor({ levels: [] })).toBe(0);
    expect(prizeMoneyFor({ levels: [-3] })).toBe(0);
  });

  it('is paid once a save: a trainer beaten again pays nothing, a hunter is the raid\'s to rule', () => {
    const bugCatcher = { levels: [6], design: 'bug-catcher' } as const;
    expect(prizeDue('greystone-vale/trainer-1', bugCatcher, [])).toBe(72);
    expect(prizeDue('greystone-vale/trainer-1', bugCatcher, ['greystone-vale/trainer-1'])).toBe(0);
    expect(prizeDue('greystone-vale/trainer-2', bugCatcher, ['greystone-vale/trainer-1'])).toBe(72);
    expect(prizeDue('hunter', { levels: [7], hunter: true }, ['hunter'])).toBe(112);
  });

  it('says it as FireRed does, and where the rest went', () => {
    expect(prizeLine('₽80')).toBe('You got ₽80 for winning!');
    expect(prizeLeftLine('₽750', '₽1,050')).toBe('Your pack had room for ₽750. The other ₽1,050 is on the ground.');
    expect(prizeLeftLine('', '₽80')).toContain('no room for ₽80');
  });
});
