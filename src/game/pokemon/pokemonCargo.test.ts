import { describe, expect, it } from 'vitest';
import { EVOLUTIONS } from './evolution';
import { getSpeciesById, SPECIES_BY_ID } from './species';
import { Pokemon } from './Pokemon';
import {
  cargoSquaresLabel,
  evolutionStage,
  pokemonCargo,
  pokemonCargoCells,
  POKEMON_STAGE_FOOTPRINTS,
} from './pokemonCargo';

describe('what a Pokemon costs to carry home', () => {
  /** The captain's ruling, 2026-09-19: four squares, then six, then nine. */
  it('is four squares, six and nine by evolution stage', () => {
    expect(POKEMON_STAGE_FOOTPRINTS.map((piece) => piece.width * piece.height)).toEqual([4, 6, 9]);
    expect(pokemonCargoCells('bulbasaur')).toBe(4);
    expect(pokemonCargoCells('ivysaur')).toBe(6);
    expect(pokemonCargoCells('venusaur')).toBe(9);
  });

  /**
   * Derived from the chain rather than stored on a species, so the day the
   * other 144 arrive not one of them needs a footprint written for it.
   */
  it('derives the stage from the evolution table alone', () => {
    for (const rule of EVOLUTIONS) {
      expect(evolutionStage(rule.to), `${rule.from} -> ${rule.to}`).toBe(
        evolutionStage(rule.from) + 1,
      );
    }
    // Caterpie arrived with the other 144, so Butterfree went from a
    // first-stage four to the full nine without a footprint being written.
    expect(evolutionStage('caterpie')).toBe(1);
    expect(pokemonCargoCells('caterpie')).toBe(4);
    expect(evolutionStage('butterfree')).toBe(3);
    expect(pokemonCargoCells('butterfree')).toBe(9);
    // A trade line counts its stages the same way, because the rule is in the
    // table whether or not anything can trigger it.
    expect(evolutionStage('alakazam')).toBe(3);
  });

  it('gives every shipped species a footprint no bigger than the raid pack', () => {
    for (const species of Object.values(SPECIES_BY_ID)) {
      const piece = pokemonCargo('x', new Pokemon(species, 5));
      expect(piece.width, species.id).toBeLessThanOrEqual(6);
      expect(piece.height, species.id).toBeLessThanOrEqual(3);
      expect(piece.name).toBe(species.name);
      expect(piece.art).toContain(`${species.dexId}.png`);
    }
  });

  it('names a price the way a refusal has to say it', () => {
    expect(cargoSquaresLabel(1)).toBe('1 square');
    expect(cargoSquaresLabel(pokemonCargoCells(getSpeciesById('charizard')!.id))).toBe('9 squares');
  });
});
