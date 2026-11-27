import type { GridPosition } from '../movement/gridMovement';
import { getItemById } from '../items';
import { itemIconName } from '../ui/icons';
import type { BillGood } from '../hub/billTalk';
import {
  TRADER_BARTERS,
  TRADER_BERTH_STANDING,
  TRADER_STANDING_IDS,
  TRADER_STOCK,
  barterTaken,
  meetsStanding,
  traderStanding,
  type TraderCounter,
  type TraderStandingId,
} from '../hub/trader';
import type { PaintedPicture } from '../world/minimap';
import type { Rect } from '../ui/labelPlacement';

/**
 * What Bill has out on his shelves: a thing a tile, so that walking along them
 * and facing one is choosing it (the menu playtest of 31 Oct, row 2). The four
 * runs stand either side of the aisle up from the door, below the cabinet of what
 * the player has traded him (`cabinet.ts`) - what he will give, under what he has
 * been given.
 *
 * Only what he sells today is out. A thing the player has not earned is not on
 * the shelves at all, save one: **the next thing he will bring out** stands
 * under a dust sheet (`coveredGood`), and the day his trust rises the sheet comes
 * off in front of the player and a new one goes over the next (`pendingSheetLift`,
 * played by `BaseScene`). A deal he only had one of leaves **a gap**. Progress is
 * a thing in the room, and there is only ever one thing to look forward to.
 *
 * Which run a thing is on is the only thing authored here. The deal is in
 * `../hub/trader.ts`, what he says about it in `../hub/billTalk.ts`.
 */

/** The rows his shelves stand on: each is walked along from the row below it. */
export const GOODS_ROWS = [10, 12] as const;

/** The columns of a run, west and east of the aisle up the middle of the room. */
const WEST_RUN = [1, 2, 3, 4, 5, 6] as const;
/**
 * The back row's two runs go on to the walls, one longer each side, so the
 * Repel stands with his Lockpick; the east run's end, by the wall, is bare
 * shelf, and the room stays the same either side of the aisle.
 */
const WEST_TO_THE_WALL = [0, 1, 2, 3, 4, 5, 6] as const;
const EAST_TO_THE_WALL = [8, 9, 10, 11, 12, 13, 14] as const;
const EAST_RUN = [8, 9, 10, 11, 12, 13] as const;

const stock = (itemId: string): BillGood => ({ kind: 'stock', itemId });
const barter = (barterId: string): BillGood => ({ kind: 'barter', barterId });

/**
 * Every shelf, in reading order. West of the aisle by the door is what money
 * buys, because that is what a player comes in for most; the stones and the
 * Bicycle across from it; below them the keys to the map and his tools, and the
 * rods and the gear.
 */
const SHELVES: readonly { readonly y: number; readonly xs: readonly number[]; readonly goods: readonly BillGood[] }[] = [
  {
    y: GOODS_ROWS[1],
    xs: WEST_RUN,
    goods: [
      stock('poke-ball'),
      stock('great-ball'),
      stock('potion'),
      stock('super-potion'),
      stock('antidote'),
      { kind: 'berth' },
    ],
  },
  {
    y: GOODS_ROWS[1],
    xs: EAST_RUN,
    goods: [
      barter('barter-thunder-stone'),
      barter('barter-fire-stone'),
      barter('barter-water-stone'),
      barter('barter-leaf-stone'),
      barter('barter-moon-stone'),
      barter('barter-bicycle'),
    ],
  },
  {
    y: GOODS_ROWS[0],
    xs: WEST_TO_THE_WALL,
    goods: [
      barter('barter-hm01'),
      barter('barter-hm03'),
      barter('barter-hm04'),
      barter('barter-hm06'),
      barter('barter-pickaxe'),
      barter('barter-lockpick'),
      barter('barter-repel'),
    ],
  },
  {
    y: GOODS_ROWS[0],
    xs: EAST_TO_THE_WALL,
    goods: [
      barter('barter-old-rod'),
      barter('barter-good-rod'),
      barter('barter-quick-claw'),
      barter('barter-focus-band'),
      barter('barter-leftovers'),
      barter('barter-life-orb'),
    ],
  },
];

export interface ShelfSeat {
  readonly good: BillGood;
  readonly tile: GridPosition;
}

/** Every deal he has, on the tile it stands on. */
export const GOODS_ON_SHELVES: readonly ShelfSeat[] = SHELVES.flatMap(({ y, xs, goods }) =>
  goods.map((good, index) => ({ good, tile: { x: xs[index], y } })),
);

/** Every tile his shelves stand on, things on them or not: the shelf is solid whatever is on it. */
export const SHELF_TILES: readonly GridPosition[] = SHELVES.flatMap(({ y, xs }) => xs.map((x) => ({ x, y })));

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

export type ShelfState = 'out' | 'sheeted' | 'gone';

/** How one thing stands today: out, under a sheet, or gone. */
export function shelfState(counter: Pick<TraderCounter, 'stash' | 'progress'>, good: BillGood): ShelfState {
  if (good.kind === 'stock') {
    const item = TRADER_STOCK.find((each) => each.itemId === good.itemId);
    return item && meetsStanding(counter.progress, item.standing) ? 'out' : 'sheeted';
  }
  if (good.kind === 'berth') {
    return meetsStanding(counter.progress, TRADER_BERTH_STANDING) ? 'out' : 'sheeted';
  }
  const deal = TRADER_BARTERS.find((each) => each.id === good.barterId);
  if (!deal) {
    return 'gone';
  }
  if (barterTaken(counter, deal)) {
    return 'gone';
  }
  return meetsStanding(counter.progress, deal.standing) ? 'out' : 'sheeted';
}

/** The standing a thing on his shelves waits for. */
function goodStanding(good: BillGood): TraderStandingId | undefined {
  if (good.kind === 'stock') {
    return TRADER_STOCK.find((each) => each.itemId === good.itemId)?.standing;
  }
  if (good.kind === 'berth') {
    return TRADER_BERTH_STANDING;
  }
  return TRADER_BARTERS.find((each) => each.id === good.barterId)?.standing;
}

/**
 * The one thing under a sheet, for a player who stands `at` with him: the first,
 * in shelf reading order, of what he brings out at the next standing up. Nothing
 * at the top of his trust, where everything is out.
 */
export function coveredGood(
  counter: Pick<TraderCounter, 'stash' | 'progress'>,
  at: TraderStandingId = traderStanding(counter.progress).id,
): ShelfSeat | undefined {
  for (const next of TRADER_STANDING_IDS.slice(TRADER_STANDING_IDS.indexOf(at) + 1)) {
    const seat = GOODS_ON_SHELVES.find((each) => goodStanding(each.good) === next && shelfState(counter, each.good) !== 'gone');
    if (seat) {
      return seat;
    }
  }
  return undefined;
}

/**
 * The sheet still to come off: the thing that was under it the last time the
 * player saw his shelves (`seen`, from the save; absent is a stranger's), when
 * his trust has risen since and it is out now.
 */
export function pendingSheetLift(
  counter: Pick<TraderCounter, 'stash' | 'progress'>,
  seen: TraderStandingId | undefined,
): ShelfSeat | undefined {
  const now = traderStanding(counter.progress).id;
  const before = seen ?? 'stranger';
  if (TRADER_STANDING_IDS.indexOf(now) <= TRADER_STANDING_IDS.indexOf(before)) {
    return undefined;
  }
  const lifted = coveredGood(counter, before);
  return lifted && shelfState(counter, lifted.good) === 'out' ? lifted : undefined;
}

/** Where the sheet is as the room is walked into: on the thing about to be shown, if a lift is due. */
export function sheetOnEntry(
  counter: Pick<TraderCounter, 'stash' | 'progress'>,
  seen: TraderStandingId | undefined,
): ShelfSeat | undefined {
  return pendingSheetLift(counter, seen) ?? coveredGood(counter);
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
  sheet: '#efe9d8',
  sheetFold: '#cfc7b0',
  sheetShade: '#a79f8c',
} as const;

/** How many pixels of a tile the top of a shelf starts down. */
const SHELF_TOP_ROW = 7;

/** How far above its tile a thing on a shelf stands, in pixels, feet on the top of the shelf. */
export const GOOD_LIFT = 7;

/** A dust sheet over a thing's shape: taller than it is wide at the shoulder, and folded. */
const SHEET_ART: readonly string[] = [
  '....ssss....',
  '...ssssss...',
  '..ssssffss..',
  '..sssssfss..',
  '.sssfsssss..',
  '.sssfssssss.',
  'ssssfsssssfs',
  'dsdsdsdsdsdd',
];

/** Where a sheet sits on its tile, in pixels from the tile's corner. */
export const SHEET_OFFSET = { x: 2, y: SHELF_TOP_ROW + 2 - SHEET_ART.length } as const;

/** The sheet on its own, for the scene to lift off a shelf. */
export function sheetPicture(): PaintedPicture {
  const width = SHEET_ART[0].length;
  const height = SHEET_ART.length;
  const data = new Uint8ClampedArray(width * height * 4);
  const inks: Readonly<Record<string, string>> = { s: SHELF.sheet, f: SHELF.sheetFold, d: SHELF.sheetShade };
  SHEET_ART.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell !== '.') {
        const ink = inks[cell];
        const rgb = [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));
        data.set([rgb[0], rgb[1], rgb[2], 255], (y * width + x) * 4);
      }
    });
  });
  return { width, height, data };
}

/** The picture for one run of shelf, with a sheet painted over the one thing still covered. */
export function shelfPoster(area: Rect, sheeted: readonly number[]): PaintedPicture {
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
  for (const column of sheeted) {
    const inks: Readonly<Record<string, string>> = { s: SHELF.sheet, f: SHELF.sheetFold, d: SHELF.sheetShade };
    SHEET_ART.forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell !== '.') {
          fill(column * 16 + SHEET_OFFSET.x + x, SHEET_OFFSET.y + y, 1, 1, inks[cell]);
        }
      });
    });
  }
  return { width, height, data };
}

/** The runs of shelf, west to east and back to front, as the rectangles they are painted into. */
export const SHELF_RUNS: readonly Rect[] = SHELVES.map(({ y, xs }) => ({ x: xs[0], y, width: xs.length, height: 1 }));

/** Which tile along one run is under the sheet as the room is walked into, by column of the run. */
export function sheetedColumns(
  run: Rect,
  counter: Pick<TraderCounter, 'stash' | 'progress'>,
  seen: TraderStandingId | undefined,
): readonly number[] {
  const sheet = sheetOnEntry(counter, seen);
  return sheet && sheet.tile.y === run.y && sheet.tile.x >= run.x && sheet.tile.x < run.x + run.width ? [sheet.tile.x - run.x] : [];
}
