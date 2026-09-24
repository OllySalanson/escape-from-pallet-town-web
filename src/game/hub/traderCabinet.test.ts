import { describe, expect, it } from 'vitest';
import { TRADER_BARTERS, type TraderBarter } from './trader';
import {
  cabinetDayLabel,
  cabinetEntryFor,
  cabinetOddities,
  clampCabinet,
  dayOf,
  oddityLabel,
} from './traderCabinet';

const barter = (id: string): TraderBarter => TRADER_BARTERS.find((each) => each.id === id)!;
const TODAY = new Date(2026, 8, 24);

describe("Bill's book", () => {
  it('writes a deal down as it was struck: the price paid, what came back and the day', () => {
    const entry = cabinetEntryFor(barter('barter-moon-stone'), 2, new Date(2026, 8, 24, 23, 30));
    expect(entry).toEqual({
      barter: 'barter-moon-stone',
      gave: [
        { itemId: 'parts-crate', quantity: 4 },
        { itemId: 'radio-valve', quantity: 4 },
        { itemId: 'mooring-rope', quantity: 2 },
      ],
      got: { itemId: 'moon-stone', quantity: 2 },
      // The player's own calendar day, not the day in Greenwich.
      day: '2026-09-24',
    });
  });

  it('puts one thing on the shelf for every unit handed over, in the order they went across', () => {
    const oddities = cabinetOddities({
      traderBarters: ['barter-hm01'],
      traderCabinet: [
        cabinetEntryFor(barter('barter-hm01'), 1, TODAY),
        cabinetEntryFor(barter('barter-hm03'), 1, TODAY),
      ],
    });
    expect(oddities.map((oddity) => oddity.itemId)).toEqual([
      'linen-roll',
      'parts-crate',
      'mooring-rope',
      'mooring-rope',
      'lamp-oil',
    ]);
    expect(oddities[4].got).toEqual({ itemId: 'hm03-surf', quantity: 1 });
  });

  /**
   * A player who bartered before the book was kept should not walk into an
   * empty cabinet that forgot what they paid. The once-only deals are already
   * recorded by id, so their price is known, and they go first, undated.
   */
  it('remembers the once-only deals struck before it was kept, first and undated', () => {
    const oddities = cabinetOddities({
      traderBarters: ['barter-quick-claw', 'barter-hm01'],
      traderCabinet: [cabinetEntryFor(barter('barter-hm01'), 1, TODAY)],
    });
    expect(oddities.map((oddity) => [oddity.itemId, oddity.day])).toEqual([
      ['parts-crate', undefined],
      ['parts-crate', undefined],
      ['cable-coil', undefined],
      ['linen-roll', '2026-09-24'],
      ['parts-crate', '2026-09-24'],
    ]);
    expect(cabinetOddities({})).toEqual([]);
  });

  it('labels a thing with what it is, what it went for and when', () => {
    const [rope] = cabinetOddities({
      traderCabinet: [cabinetEntryFor(barter('barter-hm03'), 1, TODAY)],
    });
    expect(oddityLabel(rope, TODAY)).toEqual({ name: 'MOORING ROPE', note: 'For the HM03 Surf, 24 Sep' });
    const [crate] = cabinetOddities({
      traderCabinet: [cabinetEntryFor(barter('barter-fire-stone'), 3, new Date(2025, 11, 1))],
    });
    expect(oddityLabel(crate, TODAY).note).toBe('For 3 Fire Stones, 1 Dec 2025');
    const [remembered] = cabinetOddities({ traderBarters: ['barter-leftovers'] });
    expect(oddityLabel(remembered, TODAY)).toEqual({
      name: 'LINEN ROLL',
      note: 'For the Leftovers, a while back',
    });
  });

  it('gives a day as a label in a case does, and forgets one that is not a date', () => {
    expect(dayOf(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(cabinetDayLabel('2026-01-05', TODAY)).toBe('5 Jan');
    expect(cabinetDayLabel('2024-12-31', TODAY)).toBe('31 Dec 2024');
    expect(cabinetDayLabel(undefined, TODAY)).toBeUndefined();
    expect(cabinetDayLabel('last Tuesday', TODAY)).toBeUndefined();
  });

  it('reads back only what names real things on both sides of the counter', () => {
    const good = cabinetEntryFor(barter('barter-hm01'), 1, TODAY);
    expect(clampCabinet(undefined)).toEqual([]);
    expect(clampCabinet('nonsense')).toEqual([]);
    expect(
      clampCabinet([
        good,
        { ...good, gave: [{ itemId: 'a-thing-nobody-makes', quantity: 1 }] },
        { ...good, gave: [] },
        { ...good, got: { itemId: 'hm01-cut', quantity: 0 } },
        { ...good, barter: 7 },
        { ...good, day: 'yesterday' },
        null,
      ]),
    ).toEqual([good, { barter: good.barter, gave: good.gave, got: good.got }]);
  });

  it('reads a retired item id as the item it became', () => {
    const [entry] = clampCabinet([
      { barter: 'barter-x', gave: [{ itemId: 'scrip', quantity: 3 }], got: { itemId: 'potion', quantity: 1 } },
    ]);
    expect(entry.gave).toEqual([{ itemId: 'money', quantity: 3 }]);
  });
});
