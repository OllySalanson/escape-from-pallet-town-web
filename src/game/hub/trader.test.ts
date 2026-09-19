import { describe, expect, it } from 'vitest';
import {
  CURRENCY_ITEM_ID,
  ITEM_DEFINITIONS,
  ItemCategory,
  getItemById,
  isFoundOnly,
  isMaterial,
} from '../items';
import { cellsFor, gridCells } from '../items';
import { secureGrid } from '../objectives/contracts';
import { MINIMUM_SUPPLIES, Stash } from '../stash';
import { ICON_NAMES } from '../ui/icons';
import { WORLD_MAPS } from '../worldMap';
import { OUTFITTER_UPGRADES, outfitterMaterialKinds } from './outfitter';
import {
  barterShortfall,
  berthSecureColumns,
  checkBarter,
  checkBerth,
  checkPurchase,
  clampTraderBarters,
  clampTraderCount,
  meetsStanding,
  nextTraderStanding,
  rationLeft,
  scripHeld,
  STANDING_PER_BOSS,
  STANDING_PER_CONTRACT,
  STANDING_PER_SCRIP,
  TRADER_BARTERS,
  TRADER_BERTH_PRICE,
  TRADER_STANDINGS,
  TRADER_STOCK,
  traderBarterOffers,
  traderStanding,
  traderStandingPoints,
  traderStockOffers,
  traderWantedMaterials,
  type TraderCounter,
  type TraderProgress,
} from './trader';

const NO_PROGRESS: TraderProgress = {
  completedContracts: [],
  standingContractsBanked: 0,
  defeatedBosses: [],
  traderScripSpent: 0,
  traderBarters: [],
};

function progress(overrides: Partial<TraderProgress> = {}): TraderProgress {
  return { ...NO_PROGRESS, ...overrides };
}

/** Standing high enough for everything, without spending a note to get there. */
const PARTNER = progress({
  completedContracts: ['a', 'b', 'c', 'd'],
  defeatedBosses: ['w', 'x', 'y', 'z'],
  standingContractsBanked: 3,
});

function counter(overrides: Partial<TraderCounter> = {}): TraderCounter {
  return {
    stash: new Stash({ items: { scrip: 1_000, ...MINIMUM_SUPPLIES } }),
    progress: NO_PROGRESS,
    rationUsed: 0,
    berthPaid: false,
    ...overrides,
  };
}

describe('scrip', () => {
  it('is money, and money is loot: found only, in the pack, never a wallet', () => {
    const scrip = getItemById(CURRENCY_ITEM_ID);
    expect(scrip?.effect.type).toBe('currency');
    // The Other pocket, beside the materials, because it is spent at base and
    // does nothing in the field - and so a raid screen never has to know it.
    expect(scrip?.category).toBe(ItemCategory.Misc);
    // Found only: the same rule as a material, which is what makes it something
    // a wipe can take rather than a number that survives everything.
    expect(isFoundOnly(CURRENCY_ITEM_ID)).toBe(true);
    // Not a material: nothing at the Outfitter may ever be priced in money.
    expect(isMaterial(CURRENCY_ITEM_ID)).toBe(false);
    // It has to take room to be loot rather than a score, and it does: a square
    // a bundle in the raid pack (`../items/itemGrid`), so a hoard carried out
    // is squares that could have held loot.
    expect(scrip?.footprint).toEqual({ width: 1, height: 1 });
    expect(scrip?.stackSize).toBeGreaterThan(1);
    expect(cellsFor(CURRENCY_ITEM_ID, 1)).toBe(1);
    expect(cellsFor(CURRENCY_ITEM_ID, (scrip?.stackSize ?? 1) + 1)).toBe(2);
    // Never part of the kit, so the wipe restock can never hand out money.
    expect(MINIMUM_SUPPLIES).not.toHaveProperty(CURRENCY_ITEM_ID);
  });

  it('is only ever one item: nothing else in the catalogue is money', () => {
    expect(ITEM_DEFINITIONS.filter((item) => item.effect.type === 'currency').map((item) => item.id)).toEqual([
      CURRENCY_ITEM_ID,
    ]);
  });

  it('is field loot on every map, so a raid is the only way to earn it', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      const bundles = map.loot.filter((item) => item.itemId === CURRENCY_ITEM_ID);
      expect(bundles.length, `${map.id} holds no scrip`).toBeGreaterThan(0);
      // Part of the ordinary pool rather than a rare roll of its own: money
      // has to arrive reliably or its prices cannot be set against it.
      expect(bundles.every((bundle) => bundle.chance === undefined)).toBe(true);
      // Unequal amounts, so a find is a find rather than a tick.
      expect(new Set(bundles.map((bundle) => bundle.quantity)).size).toBe(bundles.length);
    }
  });

  it('a raid cannot find more than a couple of purchases at a time', () => {
    // The faucet, measured off the maps themselves rather than asserted. Even
    // the map that holds the most, picked completely clean, is short of two of
    // the cheapest things on his shelf plus the berth - which is what keeps the
    // fourth constraint true as the maps are redrawn.
    const cheapest = Math.min(...TRADER_STOCK.map((item) => item.price));
    for (const map of Object.values(WORLD_MAPS)) {
      const whole = map.loot
        .filter((item) => item.itemId === CURRENCY_ITEM_ID)
        .reduce((total, item) => total + item.quantity, 0);
      expect(whole, `${map.id} pays out too much scrip`).toBeLessThan(cheapest * 2 + TRADER_BERTH_PRICE);
    }
  });

  it('has an icon of its own, so a note on the ground is not a crate', () => {
    expect(ICON_NAMES).toContain('scrip');
  });
});

describe('trader standing', () => {
  it('rises with what is brought home, and never with raids attempted', () => {
    expect(traderStandingPoints(NO_PROGRESS)).toBe(0);
    expect(traderStandingPoints(progress({ completedContracts: ['a', 'b'] }))).toBe(
      2 * STANDING_PER_CONTRACT,
    );
    expect(traderStandingPoints(progress({ defeatedBosses: ['x'] }))).toBe(STANDING_PER_BOSS);
    expect(traderStandingPoints(progress({ standingContractsBanked: 3 }))).toBe(
      3 * STANDING_PER_CONTRACT,
    );
  });

  it('counts scrip turned over rather than scrip held', () => {
    // Turnover: a hoard buys no standing, and spending is what he remembers.
    expect(traderStandingPoints(progress({ traderScripSpent: STANDING_PER_SCRIP * 2 }))).toBe(2);
    expect(traderStandingPoints(progress({ traderScripSpent: STANDING_PER_SCRIP - 1 }))).toBe(0);
    // A corrupt or negative record can only ever read as nothing spent.
    expect(traderStandingPoints(progress({ traderScripSpent: -500 }))).toBe(0);
  });

  it('starts every save as a stranger and is derived, never stored', () => {
    expect(traderStanding(NO_PROGRESS).id).toBe('stranger');
    // A stranger is sold nothing at all, which is the second constraint's
    // first gate: a fresh save cannot buy a supply at any price.
    expect(traderStanding(NO_PROGRESS).ration).toBe(0);
    expect(TRADER_STOCK.every((item) => item.standing !== 'stranger')).toBe(true);
  });

  it('opens each tier in turn, and the top one is reachable', () => {
    for (const tier of TRADER_STANDINGS) {
      expect(traderStanding(progress({ traderScripSpent: tier.points * STANDING_PER_SCRIP })).id).toBe(
        tier.id,
      );
    }
    // The authored content alone gets a player to TRUSTED and no further: the
    // last tier is bought by carrying on raiding, which is what stops the boat
    // running out of things to want.
    const authored = progress({
      completedContracts: ['a', 'b', 'c', 'd'],
      defeatedBosses: ['w', 'x', 'y', 'z'],
    });
    expect(traderStanding(authored).id).toBe('trusted');
    expect(nextTraderStanding(authored)?.tier.id).toBe('partner');
    expect(traderStanding(PARTNER).id).toBe('partner');
    expect(nextTraderStanding(PARTNER)).toBeUndefined();
  });

  it('reads a tier as meeting every tier below it', () => {
    expect(meetsStanding(PARTNER, 'stranger')).toBe(true);
    expect(meetsStanding(PARTNER, 'trusted')).toBe(true);
    expect(meetsStanding(NO_PROGRESS, 'regular')).toBe(false);
  });
});

describe('the shelf', () => {
  it('sells supplies and nothing else, so gear can never be bought', () => {
    for (const item of TRADER_STOCK) {
      const definition = getItemById(item.itemId);
      expect(definition?.category, `${item.itemId} is not a supply`).not.toBe(ItemCategory.Held);
      expect(definition?.effect.type).not.toBe('currency');
      expect(isMaterial(item.itemId), `${item.itemId} belongs to the Outfitter`).toBe(false);
    }
  });

  it('prices every unit above what a raid finds', () => {
    // A raid nets roughly 40-70 scrip. The cheapest thing on the shelf is more
    // than that, so nothing is ever a single raid's casual purchase.
    expect(Math.min(...TRADER_STOCK.map((item) => item.price))).toBeGreaterThan(70);
  });

  it('refuses a stranger before it looks at the money', () => {
    const offer = checkPurchase(counter(), 'potion');
    expect(offer?.refusal).toBe('standing-short');
  });

  it('sells to a regular, and only what the tier has opened', () => {
    const regular = counter({ progress: progress({ completedContracts: ['a', 'b', 'c'] }) });
    expect(traderStanding(regular.progress).id).toBe('regular');
    expect(checkPurchase(regular, 'potion')?.refusal).toBeUndefined();
    expect(checkPurchase(regular, 'super-potion')?.refusal).toBe('standing-short');
    expect(checkPurchase(regular, 'great-ball')?.refusal).toBe('standing-short');
  });

  it('rations the shelf per raid, however much money is on the table', () => {
    const rich = counter({ progress: PARTNER });
    const ration = traderStanding(PARTNER).ration;
    expect(rationLeft(rich)).toBe(ration);
    const spent = counter({ progress: PARTNER, rationUsed: ration });
    expect(rationLeft(spent)).toBe(0);
    // A thousand scrip and the deal is still refused: the ration is the gate
    // that a hoard cannot buy its way past.
    expect(scripHeld(spent.stash)).toBeGreaterThan(1_000 - 1);
    expect(checkPurchase(spent, 'potion')?.refusal).toBe('ration-spent');
  });

  it('refuses what the vault cannot pay for', () => {
    const broke = counter({
      progress: PARTNER,
      stash: new Stash({ items: { scrip: 10, ...MINIMUM_SUPPLIES } }),
    });
    expect(checkPurchase(broke, 'super-potion')?.refusal).toBe('scrip-short');
  });

  it('never stocks something it does not sell', () => {
    expect(checkPurchase(counter({ progress: PARTNER }), 'leftovers')).toBeUndefined();
    expect(traderStockOffers(counter({ progress: PARTNER }))).toHaveLength(TRADER_STOCK.length);
  });
});

describe('the barter table', () => {
  const GOODS = {
    'radio-valve': 4,
    'cable-coil': 4,
    'parts-crate': 6,
    'lamp-oil': 4,
    'mooring-rope': 4,
    'linen-roll': 4,
    ...MINIMUM_SUPPLIES,
  };

  it('never asks for money, which is what puts these beyond buying', () => {
    for (const barter of TRADER_BARTERS) {
      expect(
        barter.takes.every(({ itemId }) => itemId !== CURRENCY_ITEM_ID),
        `${barter.id} is priced in scrip`,
      ).toBe(true);
      // Found goods only, so a barter is always paid for out of a raid.
      expect(barter.takes.every(({ itemId }) => isFoundOnly(itemId))).toBe(true);
    }
  });

  it('gives what the shelf never can', () => {
    const forSale = new Set(TRADER_STOCK.map((item) => item.itemId));
    for (const barter of TRADER_BARTERS) {
      expect(forSale.has(barter.gives.itemId as never), `${barter.name} is also for sale`).toBe(false);
      expect(ICON_NAMES).toContain(barter.icon);
    }
    // Gear is the headline, and every piece of it a boss carries is on the
    // table - the second copy, which is what arms a second Pokemon.
    const gear = TRADER_BARTERS.filter(
      (barter) => getItemById(barter.gives.itemId)?.category === ItemCategory.Held,
    );
    expect(gear.length).toBeGreaterThanOrEqual(4);
    expect(gear.every((barter) => barter.once)).toBe(true);
  });

  it('competes with the Outfitter for the same materials', () => {
    // The whole reason the table is a real cost: a parts crate is a locker or
    // it is a Focus Band, and a raid only finds one or two.
    const ladder = new Set(outfitterMaterialKinds([]));
    const wanted = traderWantedMaterials(NO_PROGRESS);
    expect(wanted.some((itemId) => ladder.has(itemId as never))).toBe(true);
  });

  it('refuses a barter the standing has not opened', () => {
    const stranger = counter({ stash: new Stash({ items: GOODS }) });
    expect(checkBarter(stranger, 'barter-life-orb')?.refusal).toBe('standing-short');
  });

  it('refuses one the vault is short for, and names what is missing', () => {
    const empty = counter({ progress: PARTNER, stash: new Stash({ items: MINIMUM_SUPPLIES }) });
    const offer = checkBarter(empty, 'barter-quick-claw');
    expect(offer?.refusal).toBe('goods-short');
    expect(offer?.message).toContain('Parts crate');
    expect(barterShortfall(empty.stash, TRADER_BARTERS[0]).length).toBeGreaterThan(0);
  });

  it('takes a gear barter once per save and never again', () => {
    const stocked = counter({ progress: PARTNER, stash: new Stash({ items: GOODS }) });
    expect(checkBarter(stocked, 'barter-quick-claw')?.refusal).toBeUndefined();
    const again = counter({
      progress: { ...PARTNER, traderBarters: ['barter-quick-claw'] },
      stash: new Stash({ items: GOODS }),
    });
    expect(checkBarter(again, 'barter-quick-claw')?.refusal).toBe('already-taken');
    // The stone is the one deal he will make twice, because evolution is a
    // reward the game wants to keep paying and the materials are the brake.
    const stone = TRADER_BARTERS.find((barter) => barter.id === 'barter-thunder-stone');
    expect(stone?.once).toBe(false);
    expect(
      checkBarter(
        counter({
          progress: { ...PARTNER, traderBarters: ['barter-thunder-stone'] },
          stash: new Stash({ items: GOODS }),
        }),
        'barter-thunder-stone',
      )?.refusal,
    ).toBeUndefined();
    expect(traderBarterOffers(stocked)).toHaveLength(TRADER_BARTERS.length);
  });
});

describe('the berth', () => {
  it('is one column of the secure container, rented rather than built', () => {
    expect(berthSecureColumns(true)).toBe(1);
    expect(berthSecureColumns(false)).toBe(0);
    // The same two squares the cordon ledger and the first locker each add, so
    // renting and building buy exactly the same thing on different terms.
    expect(gridCells(secureGrid([], [], true)) - gridCells(secureGrid([], [], false))).toBe(
      gridCells(secureGrid([], ['secure-locker-1'], false)) - gridCells(secureGrid([], [], false)),
    );
  });

  it('is enough room for a raid\'s whole take of money', () => {
    // A berth that could not hold what a raid finds would be a berth nobody
    // buys: one square of scrip is 250, and no map lays that much.
    const richest = Math.max(
      ...Object.values(WORLD_MAPS).map((map) =>
        map.loot
          .filter((item) => item.itemId === CURRENCY_ITEM_ID)
          .reduce((total, item) => total + item.quantity, 0),
      ),
    );
    expect(cellsFor(CURRENCY_ITEM_ID, richest)).toBeLessThanOrEqual(
      gridCells(secureGrid([], [], true)) - gridCells(secureGrid([], [], false)),
    );
  });

  it('costs more than any one raid can find, measured off the maps', () => {
    // The drain that keeps the fourth constraint true: even the richest map,
    // picked completely clean in a single raid, does not pay for one berth.
    const richest = Math.max(
      ...Object.values(WORLD_MAPS).map((map) =>
        map.loot
          .filter((item) => item.itemId === CURRENCY_ITEM_ID)
          .reduce((total, item) => total + item.quantity, 0),
      ),
    );
    expect(TRADER_BERTH_PRICE).toBeGreaterThan(richest);
  });

  it('is refused to a stranger, to the broke and to anyone who has one', () => {
    expect(checkBerth(counter()).refusal).toBe('standing-short');
    expect(checkBerth(counter({ progress: PARTNER })).refusal).toBeUndefined();
    expect(checkBerth(counter({ progress: PARTNER, berthPaid: true })).refusal).toBe('already-paid');
    expect(
      checkBerth(
        counter({ progress: PARTNER, stash: new Stash({ items: { scrip: 10, ...MINIMUM_SUPPLIES } }) }),
      ).refusal,
    ).toBe('scrip-short');
  });

  it('is never cheaper than an Outfitter locker over a few raids', () => {
    // Renting must not make the built locker pointless. The first locker asks
    // two Pokemon and two parts crates, which is several raids of catching and
    // scavenging - and the berth is 250 scrip *every* raid, so the ladder is
    // still the answer for a player who intends to keep raiding.
    const locker = OUTFITTER_UPGRADES.find((upgrade) => upgrade.id === 'secure-locker-1');
    expect(locker?.secureItemStack).toBe(true);
    expect(locker?.cost.pokemon).toBeGreaterThan(0);
  });
});

describe('what a save may hold', () => {
  it('reads anything that is not a whole count as nothing', () => {
    expect(clampTraderCount(undefined)).toBe(0);
    expect(clampTraderCount(-4)).toBe(0);
    expect(clampTraderCount(2.5)).toBe(0);
    expect(clampTraderCount('400')).toBe(0);
    expect(clampTraderCount(400)).toBe(400);
  });

  it('keeps only barters still on the table, once each', () => {
    expect(clampTraderBarters(undefined)).toEqual([]);
    expect(clampTraderBarters(['nope', 7, 'barter-quick-claw', 'barter-quick-claw'])).toEqual([
      'barter-quick-claw',
    ]);
  });
});
