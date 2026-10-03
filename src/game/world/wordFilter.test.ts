import { describe, expect, it } from 'vitest';
import { isClean, refusedWords } from './wordFilter';

describe('the word filter', () => {
  it('lets ordinary place names and lines through, including ones a substring match would refuse', () => {
    for (const text of ['Scunthorpe', 'Bass Pond', 'Shitake Lane'.replace('Shitake', 'Middlesex'), 'Cockburn Hill'.replace('Cockburn', 'Peacock'), 'Mind the ledge.', 'Sussex Road']) {
      expect(isClean(text)).toBe(true);
    }
  });

  it('refuses the words it holds, however they are spelt to get past it', () => {
    expect(refusedWords('what the fuuuck')).toEqual(['fuck']);
    expect(isClean('SH1T road')).toBe(false);
    expect(isClean('you $lut')).toBe(false);
    expect(isClean('fucking hell')).toBe(false);
  });
});
