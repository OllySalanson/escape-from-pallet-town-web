import { describe, expect, it } from 'vitest';
import {
  REVEAL_FLASHES,
  REVEAL_FLASH_MS,
  REVEAL_RISE_MS,
  REVEAL_SETTLE_MS,
  REVEAL_TOTAL_MS,
  revealFrame,
} from './chartReveal';

const FLASH_END = REVEAL_SETTLE_MS + REVEAL_FLASHES * 2 * REVEAL_FLASH_MS;

describe('a place coming up out of the fog on THE MAP', () => {
  it('opens on the map as it was: nothing lit, nothing risen', () => {
    expect(revealFrame(0)).toEqual({ edge: false, risen: 0, cheer: false, done: false });
    expect(revealFrame(REVEAL_SETTLE_MS - 1).edge).toBe(false);
  });

  it('flashes the square three times', () => {
    const lit = (at: number) => revealFrame(at).edge;
    let flashes = 0;
    let was = false;
    for (let at = 0; at < FLASH_END; at += 10) {
      if (lit(at) && !was) flashes += 1;
      was = lit(at);
    }
    expect(flashes).toBe(REVEAL_FLASHES);
    expect(revealFrame(FLASH_END - 1).risen).toBe(0);
  });

  it('then fills it in, quick to start and settling into the corners', () => {
    const quarter = revealFrame(FLASH_END + REVEAL_RISE_MS / 4).risen;
    const half = revealFrame(FLASH_END + REVEAL_RISE_MS / 2).risen;
    expect(quarter).toBeGreaterThan(0.25);
    expect(half).toBeGreaterThan(quarter);
    expect(revealFrame(FLASH_END + REVEAL_RISE_MS).risen).toBe(1);
  });

  it('cheers once it is all in, and is over by itself', () => {
    expect(revealFrame(FLASH_END + REVEAL_RISE_MS - 1).cheer).toBe(false);
    expect(revealFrame(FLASH_END + REVEAL_RISE_MS).cheer).toBe(true);
    expect(revealFrame(REVEAL_TOTAL_MS - 1).done).toBe(false);
    expect(revealFrame(REVEAL_TOTAL_MS).done).toBe(true);
    // A moment, not a scene: under five seconds from the map coming up to it going.
    expect(REVEAL_TOTAL_MS).toBeLessThan(5000);
  });
});
