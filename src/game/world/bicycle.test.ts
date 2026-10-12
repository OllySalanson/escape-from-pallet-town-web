import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { buildWipeSettlement } from '../run/raidSettlement';
import { decodePng } from '../testing/pngPixels';
import { BUILT_IN_MAP_IDS, getWorldMap } from '../worldMap';
import {
  BICYCLE_ITEM_ID,
  BIKE_ASSET_PATH,
  BIKE_FRAME_SIZE,
  BIKE_SHEET_COLUMNS,
  BIKE_WORDS,
  bikeAction,
  mayRideIn,
  stepDurationFor,
  stillRiding,
  toggleBike,
} from './bicycle';
import { isPrize } from './loot';

const PUBLIC_ROOT = new URL('../../../public/', import.meta.url);

describe('where the Bicycle may be ridden', () => {
  it('is FireRed\'s allow_cycling: out of doors, in a cave and in a tunnel - never inside a building', () => {
    expect(mayRideIn('outdoors')).toBe(true);
    expect(mayRideIn('cave')).toBe(true);
    expect(mayRideIn('tunnel')).toBe(true);
    expect(mayRideIn('inside')).toBe(false);
  });

  it('gets on outdoors, refuses in Oak\'s words indoors, and always lets the rider off', () => {
    expect(toggleBike({ riding: false, carried: true, place: 'outdoors' })).toEqual({ kind: 'mount' });
    expect(toggleBike({ riding: false, carried: true, place: 'inside' })).toEqual({
      kind: 'refused',
      message: BIKE_WORDS.notHere,
    });
    expect(toggleBike({ riding: true, carried: true, place: 'outdoors' })).toEqual({ kind: 'dismount' });
    expect(toggleBike({ riding: false, carried: false, place: 'outdoors' }).kind).toBe('refused');
  });

  it('keeps a rider on only while it is carried and the ground allows it', () => {
    expect(stillRiding({ riding: true, carried: true, place: 'cave' })).toBe(true);
    expect(stillRiding({ riding: true, carried: true, place: 'inside' })).toBe(false);
    expect(stillRiding({ riding: true, carried: false, place: 'outdoors' })).toBe(false);
    expect(stillRiding({ riding: false, carried: true, place: 'outdoors' })).toBe(false);
  });

  it('is offered in the pack with FireRed\'s own two words', () => {
    expect(bikeAction(false)).toBe('USE');
    expect(bikeAction(true)).toBe('WALK');
  });
});

describe('the pace', () => {
  it('halves a tile, and the explorer run stays the quickest of the three', () => {
    expect(stepDurationFor(false, null)).toBe(STEP_DURATION_MS);
    expect(stepDurationFor(true, null)).toBe(STEP_DURATION_MS / 2);
    expect(stepDurationFor(true, 3)).toBe(STEP_DURATION_MS / 3);
    expect(stepDurationFor(false, 3)).toBe(STEP_DURATION_MS / 3);
  });
});

describe('the ridden figure', () => {
  it('is FireRed\'s, four facings of idle and two strokes, standing on the walkers\' sole line', async () => {
    const sheet = decodePng(await readFile(new URL(BIKE_ASSET_PATH, PUBLIC_ROOT)));
    expect(sheet.width).toBe(BIKE_FRAME_SIZE * BIKE_SHEET_COLUMNS);
    expect(sheet.height).toBe(BIKE_FRAME_SIZE * 4);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < BIKE_SHEET_COLUMNS; column += 1) {
        let lowest = -1;
        for (let y = 0; y < BIKE_FRAME_SIZE; y += 1) {
          for (let x = 0; x < BIKE_FRAME_SIZE; x += 1) {
            if (sheet.at(column * BIKE_FRAME_SIZE + x, row * BIKE_FRAME_SIZE + y)[3] > 0) {
              lowest = y;
            }
          }
        }
        // Every frame has art, and no wheel is drawn on the tile to the south.
        expect(lowest, `row ${row} column ${column}`).toBeGreaterThan(0);
        expect(lowest, `row ${row} column ${column}`).toBeLessThanOrEqual(27);
      }
    }
  });
});

describe('the gamble', () => {
  it('is lost on a wipe like anything else in the pack, unless the secure container held it', () => {
    const lost = buildWipeSettlement([], { [BICYCLE_ITEM_ID]: 1, potion: 1 });
    expect(lost.destroyedItems).toContainEqual({ itemId: BICYCLE_ITEM_ID, quantity: 1 });

    const kept = buildWipeSettlement([{ itemId: BICYCLE_ITEM_ID, quantity: 1 }], { [BICYCLE_ITEM_ID]: 1 });
    expect(kept.securedItems).toEqual([{ itemId: BICYCLE_ITEM_ID, quantity: 1 }]);
    expect(kept.destroyedItems).toEqual([]);
  });

  it('is found at the longest odds of any prize, on two maps, each in a place of its own', () => {
    const prizes = BUILT_IN_MAP_IDS.flatMap((id) => getWorldMap(id).loot.filter(isPrize));
    const bicycles = prizes.filter((loot) => loot.itemId === BICYCLE_ITEM_ID);
    expect(bicycles).toHaveLength(2);
    const longest = Math.min(...prizes.filter((loot) => loot.itemId !== BICYCLE_ITEM_ID).map((loot) => loot.chance!));
    for (const bicycle of bicycles) {
      expect(bicycle.chance!).toBeLessThan(longest);
      expect(bicycle.district).toBeDefined();
    }
  });
});
