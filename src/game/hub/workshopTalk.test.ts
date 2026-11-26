import { describe, expect, it } from 'vitest';
import { CHARMANDER } from '../pokemon';
import { createStartingStash } from '../stash';
import { WORKSHOP_UPGRADES } from './workshop';
import { LADDER_BUILT_LINE, brockFromTheMat, brockQuoteFor } from './workshopTalk';

const vaultHolding = (items: Readonly<Record<string, number>>) => {
  const stash = createStartingStash(CHARMANDER);
  for (const [itemId, quantity] of Object.entries(items)) {
    stash.addItem(itemId, quantity);
  }
  return { stash };
};

describe('Brock on a rung', () => {
  it('says what it does and what it takes, and names the build his screen opens on', () => {
    const quote = brockQuoteFor(vaultHolding({ 'parts-crate': 4 }), [], 'secure-locker-1');
    expect(quote.lines[0]).toBe('Locker I. Two more squares in THE LOCKER.');
    expect(quote.lines[1]).toBe("That takes 4 Parts crates, and you've got it.");
    expect(quote.upgradeId).toBe('secure-locker-1');
    expect(Object.keys(quote)).toEqual(['lines', 'upgradeId']);
  });

  it('says what is short', () => {
    const quote = brockQuoteFor(vaultHolding({ 'parts-crate': 1 }), [], 'secure-locker-1');
    expect(quote.lines[1]).toBe('That takes 4 Parts crates. You are short 3 Parts crates.');
    expect(quote.upgradeId).toBe('secure-locker-1');
  });

  it('says where materials come from when none of the price is held, rather than reading the price back', () => {
    const quote = brockQuoteFor(vaultHolding({}), [], 'secure-locker-1');
    expect(quote.lines[1]).toBe("That takes 4 Parts crates. Raids turn them up, and Oak's jobs pay in them.");
  });

  it('says which rung has to go in first', () => {
    const quote = brockQuoteFor(vaultHolding({ 'parts-crate': 9, 'mooring-rope': 9 }), [], 'secure-locker-2');
    expect(quote.lines[1]).toContain('after Locker I');
  });
});

describe('Brock from the mat', () => {
  it('quotes what this vault can pay for before what comes first on the ladder', () => {
    const quote = brockFromTheMat(vaultHolding({ 'linen-roll': 4 }), []);
    expect(quote.upgradeId).toBe('recovery-bay-1');
  });

  it('with nothing payable, says what the next open rung wants', () => {
    const quote = brockFromTheMat(vaultHolding({}), []);
    expect(quote.upgradeId).toBe('radio-mast');
    expect(quote.lines[0]).toContain('Radio mast');
  });

  it('has nothing to quote with the whole ladder standing', () => {
    const quote = brockFromTheMat(vaultHolding({}), WORKSHOP_UPGRADES.map((upgrade) => upgrade.id));
    expect(quote.lines).toEqual([LADDER_BUILT_LINE]);
    expect(quote.upgradeId).toBeUndefined();
  });
});
