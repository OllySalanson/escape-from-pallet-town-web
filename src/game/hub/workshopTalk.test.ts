import { describe, expect, it } from 'vitest';
import { CHARMANDER } from '../pokemon';
import { createStartingStash } from '../stash';
import { WORKSHOP_UPGRADES } from './workshop';
import { BUILD_QUESTION, LADDER_BUILT_LINE, brockFromTheMat, brockQuoteFor } from './workshopTalk';

const vaultHolding = (items: Readonly<Record<string, number>>) => {
  const stash = createStartingStash(CHARMANDER);
  for (const [itemId, quantity] of Object.entries(items)) {
    stash.addItem(itemId, quantity);
  }
  return { stash };
};

describe('Brock on a rung', () => {
  it('says what it does and what it takes, and asks only if it can be paid for', () => {
    const quote = brockQuoteFor(vaultHolding({ 'parts-crate': 4 }), [], 'secure-locker-1');
    expect(quote.lines[0]).toBe('Secure locker I. One more column of the secure container.');
    expect(quote.lines[1]).toBe('That takes 4 Parts crates. You have it.');
    expect(quote.question).toBe(BUILD_QUESTION);
    expect(quote.upgradeId).toBe('secure-locker-1');
  });

  it('says what is short, and asks nothing', () => {
    const quote = brockQuoteFor(vaultHolding({ 'parts-crate': 1 }), [], 'secure-locker-1');
    expect(quote.lines[1]).toBe('That takes 4 Parts crates. You are short 3 Parts crates.');
    expect(quote.question).toBeUndefined();
  });

  it('says which rung has to go in first', () => {
    const quote = brockQuoteFor(vaultHolding({ 'parts-crate': 9, 'mooring-rope': 9 }), [], 'secure-locker-2');
    expect(quote.lines[1]).toContain('after Secure locker I');
    expect(quote.question).toBeUndefined();
  });

  it('asks in one row of the box, or the question runs into YES and NOT NOW', () => {
    expect(BUILD_QUESTION.length).toBeLessThanOrEqual(34);
  });
});

describe('Brock from the mat', () => {
  it('quotes what this vault can pay for before what comes first on the ladder', () => {
    const quote = brockFromTheMat(vaultHolding({ 'linen-roll': 4 }), []);
    expect(quote.upgradeId).toBe('recovery-bay-1');
  });

  it('with nothing payable, says what the next open rung wants', () => {
    const quote = brockFromTheMat(vaultHolding({}), []);
    expect(quote.question).toBeUndefined();
    expect(quote.lines[0]).toContain('Radio mast');
  });

  it('has nothing to quote with the whole ladder standing', () => {
    const quote = brockFromTheMat(vaultHolding({}), WORKSHOP_UPGRADES.map((upgrade) => upgrade.id));
    expect(quote.lines).toEqual([LADDER_BUILT_LINE]);
  });
});
