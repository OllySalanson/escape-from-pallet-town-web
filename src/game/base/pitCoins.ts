import { ITEMS, ItemCategory } from '../items/items';
import { WEARABLES } from '../look/wearables';
import type { GridPosition } from '../movement/gridMovement';
import { ARENA_CENTRE, ARENA_MAT, ARENA_TILE } from './arenaHall';

/**
 * A Pokédollar over the rail of THE RAID ARENA, and whatever it is that keeps
 * count of them. Nothing in the game explains it, on purpose: a coin goes over,
 * there is a very long wait and a tiny plink, and now and then, a long way on,
 * something comes back up out of the pit and lands beside the runner.
 *
 * It is a ritual and a secret, and it must not be a way to get anything: what
 * comes back is cosmetic, is never one of the things a map holds at long odds or
 * a raid-only piece, and has cost more in coins than it would in the shop. Money
 * goes in and only money: nothing here can be sold, and nothing a raid is for
 * comes out. Phaser-free.
 */

/** What a coin costs: little enough to toss before a raid for luck. */
export const COIN_PRICE = 10;
/** How long somebody stands at the rail before the key is named to them at all. */
export const COIN_HINT_AFTER_MS = 10000;

export type PitGift = { readonly kind: 'item' | 'wearable'; readonly id: string };

/** What comes back, in order: the commoner furniture of the old maps, and hats anybody can buy. */
export const PIT_GIFTS: readonly PitGift[] = [
  { kind: 'item', id: 'pika-cushion' },
  { kind: 'wearable', id: 'youngster-cap' },
  { kind: 'item', id: 'tropical-plant' },
  { kind: 'item', id: 'ball-cushion' },
  { kind: 'wearable', id: 'bug-catcher-hat' },
  { kind: 'item', id: 'pretty-flowers' },
  { kind: 'item', id: 'comfort-chair' },
  { kind: 'wearable', id: 'camper-cap' },
  { kind: 'item', id: 'surf-mat' },
  { kind: 'item', id: 'pokemon-desk' },
];

/** How many coins until the first comes back, and how many more each one after it takes than the last. */
const COINS_FOR_FIRST = 15;
const COINS_MORE_EACH = 10;

/** How many coins it takes in all for the nth thing to come back, counting from nothing. */
export function coinsForGift(index: number): number {
  return (index + 1) * COINS_FOR_FIRST + (COINS_MORE_EACH * index * (index + 1)) / 2;
}

export interface PitRecord {
  readonly fed: number;
  readonly taken: number;
}

/** How many have come back for this many coins, whether or not anybody has picked them up. */
export function giftsEarned(fed: number): number {
  let earned = 0;
  while (earned < PIT_GIFTS.length && coinsForGift(earned) <= fed) {
    earned += 1;
  }
  return earned;
}

/** What is lying by the runner, if anything. */
export function giftWaiting(pit: PitRecord | undefined): PitGift | null {
  const taken = pit?.taken ?? 0;
  return taken < giftsEarned(pit?.fed ?? 0) ? PIT_GIFTS[taken] : null;
}

/** The name of what came back, for the line that says so. */
export function giftName(gift: PitGift): string {
  return gift.kind === 'item'
    ? (ITEMS[gift.id as keyof typeof ITEMS]?.displayName ?? gift.id)
    : (WEARABLES.find((piece) => piece.id === gift.id)?.name ?? gift.id);
}

/** What is said on picking it up, which explains nothing. */
export function giftLines(gift: PitGift): readonly string[] {
  return [`Something came up out of the pit. A ${giftName(gift)}, a little scorched.`];
}

/** Whether a gift really is what this file promises: furniture from a pool, or a hat from a shelf. */
export function isHumbleGift(gift: PitGift, longOdds: ReadonlySet<string>): boolean {
  if (gift.kind === 'item') {
    return ITEMS[gift.id as keyof typeof ITEMS]?.category === ItemCategory.Furniture && !longOdds.has(gift.id);
  }
  return WEARABLES.find((piece) => piece.id === gift.id)?.rarity === 'everyday';
}

/** Where what comes back lands: beside the runner, a step short of the rail, where a partner at the heel does not stand on it. */
export const PIT_GIFT_TILE: GridPosition = { x: ARENA_MAT.x - 2, y: 57 };

// --- a coin in the air ---------------------------------------------------------

/** How long a coin takes to go over and out of sight, and how much later it is heard. */
export const COIN_FALL_MS = 820;
export const COIN_PLINK_MS = 2300;
/** A player can only have one in the air. */
export const COIN_EVERY_MS = 1000;
/** Every so many coins, something in the gates looks up. */
export const COINS_TO_WAKE_THE_EYES = 4;

const COIN_REACH = 46;
const COIN_RISE = 18;
const COIN_DROP = 40;

export interface CoinPose {
  readonly x: number;
  readonly y: number;
  /** Which way it is turned: flat, or edge on. */
  readonly flat: boolean;
  /** Getting small as it goes: a square of this many pixels. */
  readonly size: number;
}

/** A coin over the rail, from a hand towards the middle of the hall, in whole pixels. Null once it is out of sight. */
export function coinAt(ms: number, from: { readonly x: number; readonly y: number }): CoinPose | null {
  if (ms < 0 || ms >= COIN_FALL_MS) {
    return null;
  }
  const through = ms / COIN_FALL_MS;
  const dx = ARENA_CENTRE.x - from.x;
  const dy = ARENA_CENTRE.y - from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    x: Math.round(from.x + (dx / length) * COIN_REACH * through),
    y: Math.round(from.y + (dy / length) * COIN_REACH * through - Math.sin(Math.min(1, through * 1.7) * Math.PI) * COIN_RISE + through * through * COIN_DROP),
    flat: Math.floor(ms / 70) % 2 === 0,
    size: through < 0.55 ? 2 : 1,
  };
}

// --- something coming back ---------------------------------------------------

/** How long it takes to come up out of the pit and land. */
export const GIFT_FLIGHT_MS = 1100;
const GIFT_RISE = 90;

/** Where it is on its way up and over to the runner, in hall pixels. */
export function giftAt(ms: number): { readonly x: number; readonly y: number } {
  const through = Math.max(0, Math.min(1, ms / GIFT_FLIGHT_MS));
  const toX = (PIT_GIFT_TILE.x + 0.5) * ARENA_TILE;
  const toY = (PIT_GIFT_TILE.y + 0.5) * ARENA_TILE;
  return {
    x: Math.round(ARENA_CENTRE.x + (toX - ARENA_CENTRE.x) * through),
    y: Math.round(ARENA_CENTRE.y + (toY - ARENA_CENTRE.y) * through - Math.sin(through * Math.PI) * GIFT_RISE),
  };
}
