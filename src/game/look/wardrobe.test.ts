import { describe, expect, it } from 'vitest';
import { lookSlotOf, STARTER_LOOK, wearing } from './look';
import { billFor, billLine, checkBill, ownedWearables, priceLine, unownedIn, WHOLE_LOOKS } from './wardrobe';
import { wearableById } from './wearables';

const vault = (items: Record<string, number>) => ({ itemCount: (id: string) => items[id] ?? 0 });

describe('the wardrobe', () => {
  it('owns the starter pieces, and whatever was bought that still exists', () => {
    const owned = ownedWearables(['red-cap', 'a-retired-thing']);
    expect([...owned].sort()).toEqual(['plain-tee', 'plain-trousers', 'red-cap', 'short-crop']);
  });

  it('bills a try-on for what is not owned yet, money and goods apart', () => {
    const look = wearing(wearing(STARTER_LOOK, 'youngster-cap'), 'erika-bob');
    const missing = unownedIn(wearing(look, 'lab-coat'), ownedWearables([]));
    expect(missing.map((piece) => piece.id)).toEqual(['erika-bob', 'lab-coat']);
    const bill = billFor(missing);
    expect(bill.money).toBe(400);
    expect(bill.goods).toEqual({ 'linen-roll': 3, 'lamp-oil': 2 });
    expect(billLine(bill)).toBe('₽400 and 3 Linen rolls and 2 Lamp oils');
  });

  it('refuses a raid find, a short purse and short goods, in that order', () => {
    const raid = billFor([wearableById('zapdos-jacket')!, wearableById('lab-coat')!]);
    expect(checkBill(raid, vault({ money: 9999 })).refusal).toBe('raid-only');
    const coat = billFor([wearableById('lab-coat')!]);
    expect(checkBill(coat, vault({ money: 399 })).refusal).toBe('money-short');
    expect(checkBill(coat, vault({ money: 400 })).refusal).toBeUndefined();
    const bob = billFor([wearableById('erika-bob')!]);
    expect(checkBill(bob, vault({ 'linen-roll': 3, 'lamp-oil': 1 })).refusal).toBe('goods-short');
    expect(checkBill(bob, vault({ 'linen-roll': 3, 'lamp-oil': 2 })).refusal).toBeUndefined();
  });

  it('says a price the way a card does', () => {
    expect(priceLine(wearableById('lab-coat')!)).toBe('₽400');
    expect(priceLine(wearableById('short-crop')!)).toBe('Yours already');
    expect(priceLine(wearableById('zapdos-jacket')!)).toBe('Found on raids');
    expect(priceLine(wearableById('brock-spikes')!)).toBe('3 Linen rolls and 2 Parts crates');
  });

  it('builds every whole look out of real pieces, each in its own slot', () => {
    expect(WHOLE_LOOKS.length).toBeGreaterThan(25);
    expect(new Set(WHOLE_LOOKS.map((entry) => entry.id)).size).toBe(WHOLE_LOOKS.length);
    for (const entry of WHOLE_LOOKS) {
      for (const slot of ['head', 'top', 'legs', 'body'] as const) {
        const id = entry.look[slot];
        if (id === null) continue;
        const piece = wearableById(id);
        expect([entry.id, slot, piece ? lookSlotOf(piece) : 'missing']).toEqual([entry.id, slot, slot]);
      }
    }
  });
});
