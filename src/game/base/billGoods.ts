import type { GridPosition } from '../movement/gridMovement';
import { getItemById } from '../items';
import { itemIconName } from '../ui/icons';
import type { BillGood } from '../hub/billTalk';
import {
  TRADER_BARTERS,
  TRADER_BERTH_STANDING,
  TRADER_STOCK,
  barterTaken,
  meetsStanding,
  rationLeft,
  type TraderBarter,
  type TraderCounter,
} from '../hub/trader';
import type { PaintedPicture } from '../world/minimap';
import type { Rect } from '../ui/labelPlacement';

/**
 * What Bill has out on his shelves: a thing a tile, so that walking along them
 * and facing one is choosing it (the menu playtest of 31 Oct, row 2).
 *
 * A small counter, as a FireRed Mart's is: only what he will sell this player
 * stands out, never more than `ON_SHOW_AT_MOST` things, and nothing he keeps
 * back is shown at all. His everyday money goods first, then the trades the
 * player could strike now or has brought home a part for. Everything here is
 * derived from the counter, so the shelves and his list (`HubScene.traderView`)
 * always show the same few things.
 *
 * The deal is in `../hub/trader.ts`, what he says about it in `../hub/billTalk.ts`.
 */

/** The most things on his counter at once, the shelves and the list alike. */
export const ON_SHOW_AT_MOST = 8;

/** The row his shelves stand on, the one nearest the door: walked along from the row below it. */
export const GOODS_ROW = 12;

/** The two runs, west and east of the aisle up from the door. */
const WEST_RUN = [1, 2, 3, 4, 5, 6] as const;
const EAST_RUN = [8, 9, 10, 11, 12, 13] as const;

const stock = (itemId: string): BillGood => ({ kind: 'stock', itemId });

/** His money goods in the order a Mart lists them: balls, then medicine, then the berth. */
const MONEY_GOODS: readonly BillGood[] = [
  stock('poke-ball'),
  stock('great-ball'),
  stock('potion'),
  stock('super-potion'),
  stock('antidote'),
  { kind: 'berth' },
];

/** Everything he could ever have out, whoever is asking. */
export const EVERY_GOOD: readonly BillGood[] = [
  ...MONEY_GOODS,
  ...TRADER_BARTERS.map((deal): BillGood => ({ kind: 'barter', barterId: deal.id })),
];

/** Whether he sells this money good to this player now: his standing met, and the trip's ration not spent. */
function moneyGoodOut(counter: TraderCounter, good: BillGood): boolean {
  if (good.kind === 'berth') {
    return meetsStanding(counter.progress, TRADER_BERTH_STANDING) && !counter.berthPaid;
  }
  if (good.kind !== 'stock') {
    return false;
  }
  const item = TRADER_STOCK.find((each) => each.itemId === good.itemId);
  return item !== undefined && meetsStanding(counter.progress, item.standing) && (!item.rationed || rationLeft(counter) > 0);
}

/** How much of a trade's parts the player holds, from 0 to 1. */
function partsHeld(counter: TraderCounter, deal: TraderBarter): number {
  const asked = deal.takes.reduce((total, { quantity }) => total + quantity, 0);
  const held = deal.takes.reduce(
    (total, { itemId, quantity }) => total + Math.min(quantity, counter.stash.itemCount(itemId)),
    0,
  );
  return asked === 0 ? 0 : held / asked;
}

/**
 * What is on his counter for this player, in the order it stands: the money
 * goods he sells them, then the trades they hold a part for - the ones they can
 * strike first, then the nearest. Never more than `ON_SHOW_AT_MOST`.
 */
export function goodsOnShow(counter: TraderCounter): readonly BillGood[] {
  const money = MONEY_GOODS.filter((good) => moneyGoodOut(counter, good));
  const trades = TRADER_BARTERS.map((deal, order) => ({ deal, order, held: partsHeld(counter, deal) }))
    .filter(({ deal, held }) => held > 0 && meetsStanding(counter.progress, deal.standing) && !barterTaken(counter, deal))
    .sort((a, b) => b.held - a.held || a.order - b.order)
    .map(({ deal }): BillGood => ({ kind: 'barter', barterId: deal.id }));
  return [...money, ...trades].slice(0, ON_SHOW_AT_MOST);
}

/** Whether two goods are the same thing on his counter. */
export function sameGood(a: BillGood, b: BillGood): boolean {
  if (a.kind === 'stock' && b.kind === 'stock') {
    return a.itemId === b.itemId;
  }
  if (a.kind === 'barter' && b.kind === 'barter') {
    return a.barterId === b.barterId;
  }
  return a.kind === b.kind;
}

/** Whether a thing is on his counter for this player. */
export function isOnShow(counter: TraderCounter, good: BillGood): boolean {
  return goodsOnShow(counter).some((each) => sameGood(each, good));
}

export interface ShelfSeat {
  readonly good: BillGood;
  readonly tile: GridPosition;
}

/**
 * Where each thing on show stands: the money goods on the west run and the
 * trades on the east, each gathered to the aisle up from the door; the rest of
 * the shelf is bare.
 */
export function goodsOnShelves(counter: TraderCounter): readonly ShelfSeat[] {
  const shown = goodsOnShow(counter);
  const money = shown.filter((good) => good.kind !== 'barter');
  const trades = shown.filter((good) => good.kind === 'barter').slice(0, EAST_RUN.length);
  const westFrom = WEST_RUN.length - money.length;
  return [
    ...money.map((good, index) => ({ good, tile: { x: WEST_RUN[westFrom + index], y: GOODS_ROW } })),
    ...trades.map((good, index) => ({ good, tile: { x: EAST_RUN[index], y: GOODS_ROW } })),
  ];
}

/** Every tile his shelves stand on, things on them or not: the shelf is solid whatever is on it. */
export const SHELF_TILES: readonly GridPosition[] = [...WEST_RUN, ...EAST_RUN].map((x) => ({ x, y: GOODS_ROW }));

/** The runs of shelf, west then east, as the rectangles they are painted into. */
export const SHELF_RUNS: readonly Rect[] = [WEST_RUN, EAST_RUN].map((xs) => ({ x: xs[0], y: GOODS_ROW, width: xs.length, height: 1 }));

/** The name of a thing on his shelves, as the hint at the foot of the screen says it. */
export function goodName(good: BillGood): string {
  if (good.kind === 'stock') {
    return getItemById(good.itemId)?.displayName ?? good.itemId;
  }
  if (good.kind === 'berth') {
    return 'A locker shelf';
  }
  return TRADER_BARTERS.find((each) => each.id === good.barterId)?.name ?? good.barterId;
}

/** Which of the game's icons a thing stands on the shelf as. */
export function goodIcon(good: BillGood): string {
  if (good.kind === 'stock') {
    return itemIconName(good.itemId);
  }
  if (good.kind === 'berth') {
    return itemIconName('supply-crate');
  }
  return TRADER_BARTERS.find((each) => each.id === good.barterId)?.icon ?? itemIconName('supply-crate');
}

// --- the shelves themselves ---------------------------------------------------

/**
 * Painted rather than cut, because the sheet has no piece a tile deep: a low run
 * of the same shelving as the cabinet above it, in the colours of `lab.shelvesEmpty`
 * read off the sheet, with the same white top, slate back and lilac planks. Whole
 * pixels, no scaling, and an icon stands on its top as an icon stands anywhere.
 */
const SHELF = {
  top: '#ffffff',
  plank: '#c5bdd5',
  back: '#52526a',
  edge: '#7b7b7b',
} as const;

/** How many pixels of a tile the top of a shelf starts down. */
const SHELF_TOP_ROW = 7;

/** How far above its tile a thing on a shelf stands, in pixels, feet on the top of the shelf. */
export const GOOD_LIFT = 7;

/** The picture for one run of shelf. */
export function shelfPoster(area: Rect): PaintedPicture {
  const width = area.width * 16;
  const height = area.height * 16;
  const data = new Uint8ClampedArray(width * height * 4);
  const fill = (x: number, y: number, w: number, h: number, ink: string): void => {
    const rgb = [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));
    for (let py = Math.max(0, y); py < Math.min(height, y + h); py += 1) {
      for (let px = Math.max(0, x); px < Math.min(width, x + w); px += 1) {
        data.set([rgb[0], rgb[1], rgb[2], 255], (py * width + px) * 4);
      }
    }
  };
  fill(0, SHELF_TOP_ROW, width, 2, SHELF.top);
  fill(0, SHELF_TOP_ROW + 2, width, 1, SHELF.plank);
  fill(0, SHELF_TOP_ROW + 3, width, 3, SHELF.back);
  fill(0, SHELF_TOP_ROW + 6, width, 1, SHELF.plank);
  fill(0, SHELF_TOP_ROW + 7, width, 1, SHELF.edge);
  // An upright between every two tiles and at both ends, as the cabinet has.
  for (let column = 0; column <= area.width; column += 1) {
    const x = Math.min(width - 1, column * 16 - (column === area.width ? 1 : 0));
    fill(x, SHELF_TOP_ROW + 3, 1, 4, SHELF.plank);
  }
  return { width, height, data };
}
