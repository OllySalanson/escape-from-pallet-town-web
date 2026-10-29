import { describe, expect, it } from 'vitest';
import { canWear, CLASSIC_LOOK, lookIds, lookKey, readLook, STARTER_LOOK, wearing, withoutOutfit, wornIds } from './look';

describe('a look', () => {
  it('reads a whole look and nothing less: half a figure is the classic one', () => {
    expect(readLook(STARTER_LOOK)).toEqual(STARTER_LOOK);
    expect(readLook(undefined)).toBe(CLASSIC_LOOK);
    expect(readLook({ head: 'red-cap', top: 'red-vest' })).toBe(CLASSIC_LOOK);
    expect(readLook('red-cap')).toBe(CLASSIC_LOOK);
  });

  it('believes only catalogue ids, each in the slot it is worn in', () => {
    // A cap is not a pair of trousers, whoever says so.
    expect(readLook({ head: 'red-cap', top: 'red-vest', legs: 'red-cap', body: null })).toBe(CLASSIC_LOOK);
    expect(readLook({ head: 'a-crown', top: 'red-vest', legs: 'denim-jeans', body: null })).toBe(CLASSIC_LOOK);
    // An outfit that is not an outfit is dropped; the rest of the look stands.
    expect(readLook({ head: 'red-cap', top: 'red-vest', legs: 'denim-jeans', body: 'red-cap' })).toEqual({
      head: 'red-cap',
      top: 'red-vest',
      legs: 'denim-jeans',
      body: null,
    });
    expect(readLook({ head: 'constructor', top: 'toString', legs: '__proto__', body: null })).toBe(CLASSIC_LOOK);
  });

  it('puts a piece on in its own slot, starting from the starter pieces', () => {
    expect(wearing(CLASSIC_LOOK, 'red-cap')).toEqual({ ...STARTER_LOOK, head: 'red-cap' });
    expect(wearing(STARTER_LOOK, 'lass-dress')).toEqual({ ...STARTER_LOOK, body: 'lass-dress' });
    expect(withoutOutfit(wearing(STARTER_LOOK, 'lass-dress'))).toEqual(STARTER_LOOK);
    expect(wearing(STARTER_LOOK, 'no-such-thing')).toEqual(STARTER_LOOK);
  });

  it('draws an outfit instead of the top and trousers under it, and keeps them', () => {
    const dressed = wearing(STARTER_LOOK, 'lass-dress');
    expect(wornIds(dressed)).toEqual(['lass-dress', 'short-crop']);
    expect(lookIds(dressed)).toEqual(['short-crop', 'plain-tee', 'plain-trousers', 'lass-dress']);
    expect(wornIds(STARTER_LOOK)).toEqual(['plain-trousers', 'plain-tee', 'short-crop']);
  });

  it('is worn only by a save that owns all of it', () => {
    expect(canWear(CLASSIC_LOOK, new Set())).toBe(true);
    expect(canWear(STARTER_LOOK, new Set())).toBe(true);
    expect(canWear(wearing(STARTER_LOOK, 'red-cap'), new Set())).toBe(false);
    expect(canWear(wearing(STARTER_LOOK, 'red-cap'), new Set(['red-cap']))).toBe(true);
  });

  it('names a look in one string', () => {
    expect(lookKey(CLASSIC_LOOK)).toBe('classic');
    expect(lookKey(STARTER_LOOK)).toBe('short-crop+plain-tee+plain-trousers+-');
  });
});
