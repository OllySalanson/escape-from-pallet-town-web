import { describe, expect, it } from 'vitest';
import { counted, countWord, GO_SHOWN_MS, READY_MS, splitCount } from './readyCount';

const COUNT = 2400;

describe('the start line every harbour game opens on', () => {
  it('reads READY, then 3, 2, 1, then GO! over the first moments of play, then nothing', () => {
    const words = [0, READY_MS - 1, READY_MS, READY_MS + 800, READY_MS + 1600, READY_MS + COUNT - 1, READY_MS + COUNT, READY_MS + COUNT + GO_SHOWN_MS].map(
      (elapsed) => countWord(elapsed, COUNT),
    );
    expect(words).toEqual(['READY', 'READY', '3', '2', '1', '1', 'GO!', '']);
  });

  it('splits a frame exactly between READY, the count and play, so a 100 ms frame starts play on the millisecond', () => {
    expect(splitCount(950, 100, COUNT)).toEqual({ ready: 50, count: 50, play: 0 });
    expect(splitCount(READY_MS + COUNT - 30, 100, COUNT)).toEqual({ ready: 0, count: 30, play: 70 });
    // One frame longer than the whole line still spends each part once.
    expect(splitCount(0, READY_MS + COUNT + 5, COUNT)).toEqual({ ready: READY_MS, count: COUNT, play: 5 });
    let elapsed = 0;
    let played = 0;
    while (!counted(elapsed, COUNT)) {
      played += splitCount(elapsed, 100, COUNT).play;
      elapsed += 100;
    }
    expect(elapsed).toBe(READY_MS + COUNT);
    expect(played).toBe(0);
  });
});
