import { describe, expect, it } from 'vitest';
import { EMBER, GROWL, Pokemon, experienceForLevel } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import {
  XP_BAR_WIDTH,
  experienceBarFill,
  experienceLine,
  experienceProgress,
  moveSlotNote,
  moveSummary,
} from './pokemonSummary';

describe('experience progress', () => {
  it('measures the level from its own start, not from zero', () => {
    const pokemon = new Pokemon(CHARMANDER, 8);
    const span = experienceForLevel(9) - experienceForLevel(8);
    pokemon.experience = experienceForLevel(8) + Math.floor(span / 4);

    const progress = experienceProgress(pokemon);

    expect(progress.level).toBe(8);
    expect(progress.levelSpan).toBe(span);
    expect(progress.intoLevel).toBe(Math.floor(span / 4));
    expect(progress.toNextLevel).toBe(span - Math.floor(span / 4));
    expect(progress.fraction).toBeCloseTo(0.25, 2);
    expect(progress.atTopOfCurve).toBe(false);
  });

  it('reads a freshly levelled Pokemon as empty rather than full', () => {
    const pokemon = new Pokemon(CHARMANDER, 8);

    const progress = experienceProgress(pokemon);

    expect(progress.intoLevel).toBe(0);
    expect(progress.fraction).toBe(0);
    expect(experienceBarFill(progress)).toBe(0);
    expect(experienceLine(progress)).toBe(
      `${(experienceForLevel(9) - experienceForLevel(8)).toLocaleString('en-GB')} XP to Lv 9`,
    );
  });

  it('shows a pixel for any experience at all, and never more than the bar', () => {
    const pokemon = new Pokemon(CHARMANDER, 8);
    pokemon.experience = experienceForLevel(8) + 1;
    expect(experienceBarFill(experienceProgress(pokemon))).toBe(1);

    pokemon.experience = experienceForLevel(9) - 1;
    expect(experienceBarFill(experienceProgress(pokemon))).toBe(XP_BAR_WIDTH);
  });

  /**
   * The top of the curve is read off the curve rather than from a second copy
   * of the level cap: `experienceForLevel` clamps, so the last level is the one
   * whose next costs no more than it does.
   */
  it('says a Pokemon at the top of the curve is fully grown', () => {
    const pokemon = new Pokemon(CHARMANDER, 100);

    const progress = experienceProgress(pokemon);

    expect(progress.atTopOfCurve).toBe(true);
    expect(progress.toNextLevel).toBe(0);
    expect(experienceLine(progress)).toBe('Fully grown.');
    expect(experienceBarFill(progress)).toBe(XP_BAR_WIDTH);
  });
});

describe('move summary', () => {
  it('says the type, the category, the numbers and what the move is for', () => {
    const summary = moveSummary({ base: EMBER, pp: 21 });

    expect(summary.detail).toBe('FIRE · SPECIAL · POWER 40 · ACC 100 · PP 21/25');
    expect(summary.description).toBe(EMBER.description);
  });

  /** A status move has no power, and a zero there reads as a broken number. */
  it('names a status move as doing no damage rather than printing a zero', () => {
    const summary = moveSummary({ base: GROWL, pp: 30 });

    expect(summary.detail).toBe('NORMAL · STATUS · NO DAMAGE · ACC 100 · PP 30/30');
    expect(summary.description).toBe(GROWL.description);
  });

  it('counts the slots so an empty one is visible', () => {
    expect(moveSlotNote(3)).toBe('3 of 4 known');
  });
});
