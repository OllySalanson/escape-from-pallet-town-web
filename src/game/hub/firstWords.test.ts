import { describe, expect, it } from 'vitest';
import { FIRST_WORDS, spokenLines } from './firstWords';

describe("Oak's first words", () => {
  it('greet the player by the name they have just given (playtest 47)', () => {
    const lines = spokenLines(FIRST_WORDS.lab, 'ROWAN');

    expect(lines[0]).toBe('Ah, ROWAN, there you are! Out there are maps full of loot and wild Pokémon.');
    expect(lines.slice(1)).toEqual(FIRST_WORDS.lab.lines.slice(1));
  });

  it('still greet a player the game has no name for', () => {
    expect(spokenLines(FIRST_WORDS.lab, null)[0]).toBe('Ah, there you are! Out there are maps full of loot and wild Pokémon.');
  });

  it('leave words with no greeting as they are written', () => {
    expect(spokenLines(FIRST_WORDS.center, 'ROWAN')).toEqual(FIRST_WORDS.center.lines);
  });
});
