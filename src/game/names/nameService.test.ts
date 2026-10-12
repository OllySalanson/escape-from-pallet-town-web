import { describe, expect, it } from 'vitest';
import { localNameService, nameService } from './nameService';

describe('names, one each', () => {
  it('asks nothing in a test that did not ask for a harbour', () => {
    expect(nameService()).toBeNull();
  });

  it("holds the local stand-in to the console's own rules", async () => {
    const names = localNameService();
    expect(await names.check('ASH')).toBe('free');
    expect(await names.check('ash')).toBe('free');
    expect(await names.check('')).toBe('invalid');
    expect(await names.check('ARSE')).toBe('unkind');
    expect(await names.claim('ASH')).toBe('claimed');
    expect(await names.claim('ARSE')).toBe('refused');
  });
});
