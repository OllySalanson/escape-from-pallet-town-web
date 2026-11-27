import { describe, expect, it } from 'vitest';
import { getSpeciesById } from '../pokemon/species';
import { headsOf } from './berryPicking';
import { HOUSE_JUMPER, HOUSE_PICKER } from './houseLoans';
import { loanPlayer } from './whoPlays';
import { jumpTypeOf } from './pokemonJump';

/**
 * Ten raids in, the harbour critic tour (26 Nov 2026) could play neither
 * cabinet in THE GAME CORNER. The house lends one of each, and each must be a
 * kind FireRed lets play.
 */
describe("THE GAME CORNER's lent Pokémon", () => {
  it('lends a kind that can jump and a kind that can pick', () => {
    expect(jumpTypeOf(HOUSE_JUMPER.species)).toBeDefined();
    expect(headsOf(HOUSE_PICKER.species)).toBeGreaterThan(0);
  });

  it('names each as the species it is, by its own dex number', () => {
    for (const loan of [HOUSE_JUMPER, HOUSE_PICKER]) {
      expect(getSpeciesById(loan.species)?.dexId).toBe(loan.dexId);
      expect(loanPlayer(loan).id).toMatch(/^house:/);
      expect(loanPlayer(loan).lent).toBe(true);
    }
  });
});
