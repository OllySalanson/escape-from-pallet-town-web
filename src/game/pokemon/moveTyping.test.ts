import { describe, expect, it } from 'vitest';
import { EMBER, POISON_POWDER, SING, THUNDER_WAVE, VINE_WHIP, WATER_GUN } from './moves';
import { PokemonType } from './PokemonType';
import { MoveCategory } from './MoveBase';

describe('move typing', () => {
  // Unity's Sing.asset and ThunderWave.asset both store type 8 (Poison), the
  // same value as PoisonPowder beside them. Typing drives immunity and the
  // battle move guidance, so these two are deliberately corrected.
  it('types Sing as Normal and Thunder Wave as Electric', () => {
    expect(SING.type).toBe(PokemonType.Normal);
    expect(THUNDER_WAVE.type).toBe(PokemonType.Electric);
    expect(POISON_POWDER.type).toBe(PokemonType.Poison);
  });

  it('keeps every move typed to the effect it actually delivers', () => {
    for (const move of [SING, THUNDER_WAVE, POISON_POWDER]) {
      expect(move.category).toBe(MoveCategory.Status);
      expect(move.power).toBe(0);
      expect(move.description).not.toBe('');
    }
    expect(EMBER.type).toBe(PokemonType.Fire);
    expect(WATER_GUN.type).toBe(PokemonType.Water);
    expect(VINE_WHIP.type).toBe(PokemonType.Grass);
  });
});
