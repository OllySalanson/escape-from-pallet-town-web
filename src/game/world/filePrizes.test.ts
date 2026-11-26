import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { districtsForMap } from './districts';
import { isMaterial } from '../items';
import { BUILT_IN_FILE_HOARDS, BUILT_IN_FILE_LEANS, BUILT_IN_FILE_PRIZES, hoardOf, leanOf } from './filePrizes';
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
      // One of each in its own place: TM28 Dig is in two, the caves' diggings and Millbrook's allotments.
      const laid = map.loot.filter((piece) => piece.itemId === prize.itemId && placeOf(piece.district) === prize.place);
      expect(laid, `${prize.itemId} in ${prize.place}`).toHaveLength(1);
      expect(isPrize(laid[0])).toBe(true);
      expect(laid[0].chance).toBe(prize.chance);
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

/**
 * The coast leans to parts crates (`BUILT_IN_FILE_LEANS`): nine of Bill's deals
 * want them, a newcomer raids the coast first, and ten raids from the Old Quay
 * found one (the 20 Nov AI playtest, #42, #51).
 */
describe("the coast's salvage", () => {
  const map = getWorldMap('greystone-vale');
  const districts = districtsForMap(map.id);
  const inPlace = (name: string, position: { x: number; y: number }) =>
    districts
      .filter((district) => district.name === name)
      .some((district) =>
        district.areas.some(
          (area) => position.x >= area.x && position.x < area.x + area.width && position.y >= area.y && position.y < area.y + area.height,
        ),
      );
  const [lean] = BUILT_IN_FILE_LEANS['greystone-vale'] ?? [];
  const onTheCoast = map.loot.filter((piece) => piece.chance === undefined && lean.places.some((place) => inPlace(place, piece.position)));

  it('turns every material on the coast’s ground into a parts crate, and leaves its supplies alone', () => {
    expect(lean.itemId).toBe('parts-crate');
    const materials = onTheCoast.filter((piece) => isMaterial(piece.itemId));
    expect(materials.length).toBeGreaterThanOrEqual(6);
    expect(materials.every((piece) => piece.itemId === 'parts-crate')).toBe(true);
    expect(onTheCoast.some((piece) => !isMaterial(piece.itemId))).toBe(true);
  });

  it('makes the parts crate the commonest material on the vale’s ground', () => {
    const counts = new Map<string, number>();
    for (const piece of map.loot) {
      if (piece.chance === undefined && isMaterial(piece.itemId)) counts.set(piece.itemId, (counts.get(piece.itemId) ?? 0) + piece.quantity);
    }
    const crates = counts.get('parts-crate') ?? 0;
    for (const [itemId, count] of counts) {
      if (itemId !== 'parts-crate') expect(crates, itemId).toBeGreaterThan(count);
    }
  });

  it('leans only a material, and only inside its places', () => {
    const at = leanOf('greystone-vale', { districts: [{ name: 'GULL STRAND', x: 0, y: 0, width: 4, height: 4 }] });
    expect(at({ x: 1, y: 1 }, { itemId: 'lamp-oil', quantity: 1 })).toEqual({ itemId: 'parts-crate', quantity: 1 });
    expect(at({ x: 1, y: 1 }, { itemId: 'potion', quantity: 1 })).toEqual({ itemId: 'potion', quantity: 1 });
    expect(at({ x: 9, y: 9 }, { itemId: 'lamp-oil', quantity: 1 })).toEqual({ itemId: 'lamp-oil', quantity: 1 });
  });
});
