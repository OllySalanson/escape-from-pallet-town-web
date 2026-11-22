import { describe, expect, it } from 'vitest';
import { fieldHealHint } from './fieldHealHint';

describe("Oak's word after a fight that left somebody worn out", () => {
  it('names who, and where the medicine is', () => {
    expect(fieldHealHint([{ name: 'Bulbasaur', currentHp: 4, maxHp: 23 }], 'Potion', false)).toBe(
      'OAK: BULBASAUR is worn out! Press B for your pack and give it a POTION before the next fight.',
    );
  });

  it('says nothing above a quarter, of a fainted Pokémon, with nothing to give, or once the pack is known', () => {
    expect(fieldHealHint([{ name: 'Bulbasaur', currentHp: 7, maxHp: 23 }], 'Potion', false)).toBeNull();
    expect(fieldHealHint([{ name: 'Bulbasaur', currentHp: 0, maxHp: 23 }], 'Potion', false)).toBeNull();
    expect(fieldHealHint([{ name: 'Bulbasaur', currentHp: 4, maxHp: 23 }], null, false)).toBeNull();
    expect(fieldHealHint([{ name: 'Bulbasaur', currentHp: 4, maxHp: 23 }], 'Potion', true)).toBeNull();
  });
});
