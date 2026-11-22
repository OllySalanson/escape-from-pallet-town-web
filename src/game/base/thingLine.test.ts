import { describe, expect, it } from 'vitest';
import { thingLine } from './thingLine';

describe('what a faced thing says', () => {
  it('keeps the names inside its caption, lowering only the first letter', () => {
    // Read as "MEDICINE BAG - back where joy can reach it." in the veteran playtest.
    expect(thingLine('MEDICINE BAG', 'Back where Joy can reach it')).toBe('MEDICINE BAG - back where Joy can reach it.');
    expect(thingLine('BILL’S PC', 'Your boxes and your Pokémon')).toBe('BILL’S PC - your boxes and your Pokémon.');
  });

  it('keeps the capital on a caption that opens with a name or a word in capitals', () => {
    expect(thingLine('PRICE CARD', 'Joy quotes half')).toBe('PRICE CARD - Joy quotes half.');
    expect(thingLine('THE COURSE', 'CUT, SMASH, PUSH and SURF it')).toBe('THE COURSE - CUT, SMASH, PUSH and SURF it.');
  });
});
