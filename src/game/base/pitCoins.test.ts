import { describe, expect, it } from 'vitest';
import { WEARABLES } from '../look/wearables';
import { ITEMS } from '../items/items';
import { BUILT_IN_FILE_PRIZES } from '../world/filePrizes';
import { WORLD_MAPS } from '../worldMap';
import { arenaCollision } from './arenaHall';
import {
  COIN_FALL_MS,
  COIN_PRICE,
  PIT_GIFTS,
  PIT_GIFT_TILE,
  coinAt,
  coinsForGift,
  giftAt,
  giftLines,
  giftName,
  giftWaiting,
  giftsEarned,
  isHumbleGift,
} from './pitCoins';

/** Everything a shipped map holds at odds of its own: a prize, which the pit must never hand over. */
const longOdds = new Set<string>([
  ...Object.values(WORLD_MAPS).flatMap((map) => map.loot.flatMap((piece) => (piece.chance === undefined ? [] : [piece.itemId]))),
  ...Object.values(BUILT_IN_FILE_PRIZES).flatMap((prizes) => (prizes ?? []).map((prize) => prize.itemId)),
]);

describe('what the pit gives back', () => {
  it('names only things that are in the game, each once', () => {
    expect(new Set(PIT_GIFTS.map((gift) => gift.id)).size).toBe(PIT_GIFTS.length);
    for (const gift of PIT_GIFTS) {
      if (gift.kind === 'item') {
        expect(ITEMS[gift.id as keyof typeof ITEMS], gift.id).toBeDefined();
      } else {
        expect(WEARABLES.find((piece) => piece.id === gift.id), gift.id).toBeDefined();
      }
      expect(giftName(gift)).not.toBe(gift.id);
      expect(giftLines(gift)[0].length).toBeLessThanOrEqual(80);
    }
  });

  it('is cosmetic and humble: never a prize, a raid-only piece or a famous look', () => {
    for (const gift of PIT_GIFTS) {
      expect(isHumbleGift(gift, longOdds), gift.id).toBe(true);
    }
  });

  it('always costs more in coins than the shop would ask', () => {
    PIT_GIFTS.forEach((gift, index) => {
      const coinsThisOne = coinsForGift(index) - (index === 0 ? 0 : coinsForGift(index - 1));
      const shop = gift.kind === 'wearable' ? (WEARABLES.find((piece) => piece.id === gift.id)?.price ?? 0) : 0;
      expect(coinsThisOne * COIN_PRICE, gift.id).toBeGreaterThan(shop);
    });
  });

  it('comes back after more and more coins, one at a time, until there is no more', () => {
    expect(giftsEarned(0)).toBe(0);
    expect(giftsEarned(coinsForGift(0) - 1)).toBe(0);
    expect(giftsEarned(coinsForGift(0))).toBe(1);
    expect(giftsEarned(coinsForGift(1))).toBe(2);
    expect(coinsForGift(2) - coinsForGift(1)).toBeGreaterThan(coinsForGift(1) - coinsForGift(0));
    expect(giftsEarned(1_000_000)).toBe(PIT_GIFTS.length);
  });

  it('waits on the floor until it is picked up, and then the next is waited for', () => {
    expect(giftWaiting(undefined)).toBeNull();
    expect(giftWaiting({ fed: coinsForGift(0), taken: 0 })).toEqual(PIT_GIFTS[0]);
    expect(giftWaiting({ fed: coinsForGift(0), taken: 1 })).toBeNull();
    expect(giftWaiting({ fed: coinsForGift(1), taken: 1 })).toEqual(PIT_GIFTS[1]);
    expect(giftWaiting({ fed: 1_000_000, taken: PIT_GIFTS.length })).toBeNull();
  });

  it('lands on floor that can be walked, on the way up from the door', () => {
    expect(arenaCollision()[PIT_GIFT_TILE.y][PIT_GIFT_TILE.x]).toBe(false);
  });
});

describe('a coin in the air', () => {
  it('goes towards the pit from either side, in whole pixels, and out of sight', () => {
    for (const from of [{ x: 520, y: 900 }, { x: 520, y: 150 }, { x: 150, y: 520 }]) {
      const late = coinAt(COIN_FALL_MS * 0.5, from)!;
      expect(Number.isInteger(late.x) && Number.isInteger(late.y)).toBe(true);
      expect(Math.hypot(late.x - 520, late.y - 528)).toBeLessThan(Math.hypot(from.x - 520, from.y - 528) + 1);
      expect(coinAt(COIN_FALL_MS, from)).toBeNull();
    }
    expect(coinAt(0, { x: 520, y: 900 })?.size).toBeGreaterThan(coinAt(COIN_FALL_MS - 1, { x: 520, y: 900 })!.size);
  });

  it('comes up out of the middle of the pit and lands on its tile', () => {
    expect(giftAt(0)).toEqual({ x: 520, y: 528 });
    const landed = giftAt(100000);
    expect(Math.floor(landed.x / 16)).toBe(PIT_GIFT_TILE.x);
    expect(Math.floor(landed.y / 16)).toBe(PIT_GIFT_TILE.y);
  });
});
