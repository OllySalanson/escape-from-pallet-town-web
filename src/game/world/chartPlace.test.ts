import { describe, expect, it } from 'vitest';
import { CHART_CELLS, CLOSE_TILE_GAME_PIXELS, placeChart } from './chart';

const rect = { x: 0, y: 0, width: 384, height: 384 };

describe('THE MAP is laid in its frame', () => {
  it('fits the whole place and centres it', () => {
    const place = placeChart(rect, { width: 1000, height: 768 }, 'whole', { x: 0, y: 0 }, 2);
    expect(place.tilePixels).toBe(2);
    expect(place.left).toBe(116);
    expect(place.top).toBe(0);
  });

  it('close up, draws a tile a whole number of device pixels a cell and centres on the player', () => {
    const place = placeChart(rect, { width: 1000, height: 800 }, 'close', { x: 100, y: 150 }, 2);
    expect(place.tilePixels).toBe(2 * CHART_CELLS);
    // The player's tile sits in the middle of the frame.
    expect(place.left + 100.5 * place.tilePixels).toBe(500);
    expect(place.top + 150.5 * place.tilePixels).toBe(400);
    expect(CLOSE_TILE_GAME_PIXELS).toBeGreaterThan(1);
  });

  it('close up, keeps the map over the whole frame at its edges', () => {
    const corner = placeChart(rect, { width: 1000, height: 800 }, 'close', { x: 0, y: 0 }, 2);
    expect(corner.left).toBe(0);
    expect(corner.top).toBe(0);
    const far = placeChart(rect, { width: 1000, height: 800 }, 'close', { x: 383, y: 383 }, 2);
    expect(far.left + 384 * far.tilePixels).toBe(1000);
    expect(far.top + 384 * far.tilePixels).toBe(800);
  });

  it('centres a map smaller than the frame rather than pinning it to a corner', () => {
    const small = { x: 0, y: 0, width: 20, height: 10 };
    const place = placeChart(small, { width: 1000, height: 800 }, 'close', { x: 3, y: 3 }, 2);
    expect(place.left).toBe((1000 - 20 * 8) / 2);
    expect(place.top).toBe((800 - 10 * 8) / 2);
  });
});
