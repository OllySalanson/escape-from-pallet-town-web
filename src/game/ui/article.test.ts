import { describe, expect, it } from 'vitest';
import { aOrAn, isPluralName, withArticle } from './article';

describe('the article a name takes', () => {
  it('says "an" before a vowel and an HM, "a" before anything else, in any case', () => {
    expect(withArticle('Old Rod')).toBe('an Old Rod');
    expect(withArticle('Good Rod')).toBe('a Good Rod');
    expect(withArticle('HM06 Rock Smash')).toBe('an HM06 Rock Smash');
    expect(withArticle('TM39 Rock Tomb')).toBe('a TM39 Rock Tomb');
    expect(aOrAn('EEVEE')).toBe('an');
    expect(aOrAn('ORAN BERRY')).toBe('an');
    expect(aOrAn('PIDGEY')).toBe('a');
  });

  it('says "some" before one thing with a plural name, shouted or not', () => {
    expect(withArticle('Leftovers')).toBe('some Leftovers');
    expect(withArticle('LEFTOVERS')).toBe('some LEFTOVERS');
    expect(withArticle('QUICK CLAW')).toBe('a QUICK CLAW');
  });

  it('reads the word a name is about, and leaves a counted name bare', () => {
    expect(withArticle('house with flowers')).toBe('a house with flowers');
    expect(withArticle('block of flats')).toBe('a block of flats');
    expect(withArticle('stone steps')).toBe('some stone steps');
    expect(withArticle('two crates')).toBe('two crates');
    expect(withArticle('surf water')).toBe('some surf water');
    expect(withArticle('underground path')).toBe('an underground path');
    expect(isPluralName('Stacked crates')).toBe(true);
    expect(isPluralName('Rock with steps')).toBe(false);
  });
});
