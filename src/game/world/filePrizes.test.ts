import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { districtsForMap } from './districts';
import { BUILT_IN_FILE_HOARDS, BUILT_IN_FILE_PRIZES, hoardOf } from './filePrizes';
import { isPrize } from './loot';

/**
 * What a shipped map drawn as a file finds in one place and nowhere else: a
 * far place's prize, and a hoard whose spots hold what it is rather than the
 * rotation every other spot is dealt from.
 */
describe("Greystone Vale's far places' finds", () => {
  const map = getWorldMap('greystone-vale');
  const placeOf = (district: string | undefined) =>
    districtsForMap(map.id).find((candidate) => candidate.id === district)?.name;

  it('lays each prize in its own place, on its own odds', () => {
    for (const prize of BUILT_IN_FILE_PRIZES['greystone-vale'] ?? []) {
      const laid = map.loot.filter((piece) => piece.itemId === prize.itemId);
      expect(laid, prize.itemId).toHaveLength(1);
      expect(isPrize(laid[0])).toBe(true);
      expect(placeOf(laid[0].district)).toBe(prize.place);
    }
    expect(map.loot.some((piece) => piece.itemId === 'charcoal')).toBe(true);
  });

  it("fills the smugglers' hoard with what the hoard holds, seated in the hoard", () => {
    const [hoard] = BUILT_IN_FILE_HOARDS['greystone-vale'] ?? [];
    expect(hoard.place).toBe('THE HOARD');
    const laid = map.loot.filter((piece) => placeOf(piece.district) === 'THE HOARD');
    expect(laid.map(({ itemId, quantity }) => ({ itemId, quantity }))).toEqual(hoard.contents);
    // Pool loot, not prizes: dealt half to all of it, as every piece is.
    expect(laid.every((piece) => piece.chance === undefined)).toBe(true);
  });

  it('is the richest ground in the vale: more spots, money and the rarest materials', () => {
    const [hoard] = BUILT_IN_FILE_HOARDS['greystone-vale'] ?? [];
    expect(hoard.contents.filter((piece) => piece.itemId === 'money').length).toBeGreaterThanOrEqual(3);
    expect(hoard.contents.filter((piece) => piece.itemId === 'radio-valve').length).toBeGreaterThanOrEqual(2);
  });

  it('refuses a hoard with more spots than pieces', () => {
    const at = hoardOf('greystone-vale', {
      districts: [{ name: 'THE HOARD', x: 0, y: 0, width: 4, height: 4 }],
      itemSpots: [],
    });
    const contents = BUILT_IN_FILE_HOARDS['greystone-vale']![0].contents;
    contents.forEach((piece) => expect(at({ x: 1, y: 1 })?.contents).toEqual(piece));
    expect(() => at({ x: 1, y: 1 })).toThrow(/more item spots/);
    expect(at({ x: 9, y: 9 })).toBeUndefined();
  });
});
