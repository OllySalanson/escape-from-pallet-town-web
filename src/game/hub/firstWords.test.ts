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

  it('says the hall and the rim in few enough boxes to be read', () => {
    expect(FIRST_WORDS.loadout.lines.length).toBeLessThanOrEqual(4);
    expect(FIRST_WORDS.check.lines.length).toBeLessThanOrEqual(3);
  });
});
