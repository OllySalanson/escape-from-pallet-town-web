import { describe, expect, it } from 'vitest';
import { WORLD_MAPS } from '../worldMap';
import { TILE_SIZE } from '../worldMap';
import {
  chaseAt,
  chaseRunMs,
  CHASE_PERIOD_MS,
  CHASE_START_MS,
  DRIFT_MS_PER_PIXEL,
  duskBands,
  logoGlint,
  RIVAL_GAP,
  shineColumn,
  shineEndMs,
  shineStrength,
  sparkleAt,
  sparklePixels,
  TITLE_TOWN,
  townDrift,
  vignetteBands,
} from './titleScenery';

describe('the town behind the title', () => {
  it('is a band of a real map, taller than any stage', () => {
    const map = WORLD_MAPS[TITLE_TOWN.map];
    expect(TITLE_TOWN.top + TITLE_TOWN.rows).toBeLessThanOrEqual(map.height);
    expect(TITLE_TOWN.rows * TILE_SIZE).toBeGreaterThanOrEqual(256);
  });

  it('drifts a whole pixel at a time, one way and back, and never off the town', () => {
    const span = 752;
    let previous = townDrift(0, span, 300);
    for (let time = 0; time < span * 2 * DRIFT_MS_PER_PIXEL * 2; time += DRIFT_MS_PER_PIXEL) {
      const drift = townDrift(time, span, 300);
      expect(Number.isInteger(drift)).toBe(true);
      expect(drift).toBeGreaterThanOrEqual(0);
      expect(drift).toBeLessThanOrEqual(span);
      expect(Math.abs(drift - previous)).toBeLessThanOrEqual(1);
      previous = drift;
    }
    expect(townDrift(0, span, 300)).toBe(300);
    expect(townDrift(12_345, 0)).toBe(0);
  });
});

describe('dusk', () => {
  it.each([240, 256, 251])('covers a %i-pixel screen in bands with no gap and no overlap', (height) => {
    const bands = duskBands(height);
    let y = 0;
    for (const band of bands) {
      expect(band.y).toBe(y);
      expect(band.alpha).toBeGreaterThan(0);
      expect(band.alpha).toBeLessThan(1);
      y += band.height;
    }
    expect(y).toBe(height);
  });

  it('is heaviest at the top, so the name always has dark behind it', () => {
    const bands = duskBands(256);
    const lightest = Math.min(...bands.map((band) => band.alpha));
    expect(bands[0].alpha).toBe(Math.max(...bands.map((band) => band.alpha)));
    expect(bands[0].alpha - lightest).toBeGreaterThan(0.2);
  });

  it('gathers at the sides, fading to nothing inwards', () => {
    const bands = vignetteBands();
    for (let index = 1; index < bands.length; index += 1) {
      expect(bands[index].alpha).toBeLessThanOrEqual(bands[index - 1].alpha);
      expect(bands[index].inset).toBe(bands[index - 1].inset + bands[index - 1].width);
    }
    expect(bands[bands.length - 1].alpha).toBeLessThan(0.02);
  });
});

describe('sparkles', () => {
  it('open and close, and are dark most of the time', () => {
    const sizes = Array.from({ length: 40 }, (_, step) => sparkleAt(step * 100, 4_000, 0).size);
    expect(sizes.slice(0, 8)).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
    expect(sizes.filter((size) => size === 0).length).toBeGreaterThan(30);
  });

  it('count a new appearance each period, so each one can turn up somewhere new', () => {
    expect(sparkleAt(3_999, 4_000, 0).cycle).toBe(0);
    expect(sparkleAt(4_000, 4_000, 0).cycle).toBe(1);
  });

  it('are a dot, a cross and a star, on whole pixels round their centre', () => {
    expect(sparklePixels(0)).toEqual([]);
    expect(sparklePixels(1)).toEqual([[0, 0]]);
    expect(sparklePixels(2)).toHaveLength(5);
    expect(sparklePixels(3)).toHaveLength(13);
  });
});

describe('the chase', () => {
  it.each([320, 400])('comes on whole and goes off whole on a %i-wide screen, rival last', (width) => {
    const run = chaseRunMs(width);
    const first = chaseAt(CHASE_START_MS, width);
    const last = chaseAt(CHASE_START_MS + run - 1, width);
    expect(first.running).toBe(true);
    expect(first.trainerX).toBeLessThan(-8);
    expect(last.rivalX).toBeGreaterThan(width + 8);
    expect(chaseAt(CHASE_START_MS + run, width).running).toBe(false);
    expect(chaseAt(CHASE_START_MS - 1, width).running).toBe(false);
    // And it is over well before the next lap begins.
    expect(CHASE_START_MS + run).toBeLessThan(CHASE_PERIOD_MS);
  });

  it('keeps the partner at the trainer\'s heel and Blue behind them both, whichever way it runs', () => {
    for (const lap of [0, 1]) {
      const chase = chaseAt(lap * CHASE_PERIOD_MS + CHASE_START_MS + 2_000, 400);
      expect(chase.heading).toBe(lap === 0 ? 1 : -1);
      expect((chase.trainerX - chase.partnerX) * chase.heading).toBeGreaterThan(0);
      expect((chase.partnerX - chase.rivalX) * chase.heading).toBeGreaterThan(0);
      expect(Math.abs(chase.trainerX - chase.rivalX)).toBe(RIVAL_GAP);
      expect(Number.isInteger(chase.trainerX)).toBe(true);
    }
  });
});

describe('the shine', () => {
  const width = 264;
  const height = 28;

  it('crosses the whole name and then leaves it alone', () => {
    const lit = new Set<number>();
    for (let time = 0; time < 6_000; time += 4) {
      const column = shineColumn(time, width, height);
      if (column === null) {
        continue;
      }
      for (let x = 0; x < width; x += 1) {
        if (shineStrength(column, x, height - 1, height) === 1 || shineStrength(column, x, 0, height) === 1) {
          lit.add(x);
        }
      }
    }
    expect(lit.size).toBe(width);
    expect(shineColumn(0, width, height)).toBeNull();
    expect(shineColumn(shineEndMs(width, height) + 10, width, height)).toBeNull();
  });

  it('leans, so its top is ahead of its foot, with a soft pixel either side', () => {
    expect(shineStrength(10, 10, height - 1, height)).toBe(1);
    expect(shineStrength(10, 10, 0, height)).toBe(0);
    expect(shineStrength(10, 9, height - 1, height)).toBe(0.5);
    expect(shineStrength(10, 15, height - 1, height)).toBe(0.5);
    expect(shineStrength(10, 16, height - 1, height)).toBe(0);
  });

  it('leaves a glint behind it once it has gone by, and only then', () => {
    expect(logoGlint(1_000, width, height)).toBe(0);
    const glints = Array.from({ length: 30 }, (_, step) => logoGlint(shineEndMs(width, height) - 200 + step * 50, width, height));
    expect(Math.max(...glints)).toBe(3);
    expect(logoGlint(5_900, width, height)).toBe(0);
  });
});
