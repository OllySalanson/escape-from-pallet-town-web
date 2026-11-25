import { describe, expect, it } from 'vitest';
import { PAD_ICONS, arrowRuns, bottomEdgeRuns, crossRuns, discRuns, iconRuns, outlineRuns, runsPath, topEdgeRuns } from './touchPadArt';

const area = (runs: readonly { width: number }[]) => runs.reduce((sum, run) => sum + run.width, 0);

describe('the touch pad\'s pixel art', () => {
  it('draws a disc that is round, symmetrical and as wide as asked', () => {
    for (const size of [5, 12, 23, 34]) {
      const runs = discRuns(size);
      expect(runs).toHaveLength(size);
      expect(Math.max(...runs.map((run) => run.width))).toBe(size);
      for (const run of runs) {
        expect(run.x * 2 + run.width).toBe(size);
        expect(runs[size - 1 - run.y].width).toBe(run.width);
      }
      expect(area(runs) / (Math.PI * (size / 2) ** 2)).toBeGreaterThan(0.9);
      expect(area(runs) / (Math.PI * (size / 2) ** 2)).toBeLessThan(1.1);
    }
  });

  it('draws a cross whose two bars are the arm thick and the square long', () => {
    const runs = crossRuns(30, 10);
    expect(runs).toHaveLength(30);
    expect(Math.max(...runs.map((run) => run.width))).toBe(30);
    // The ends of each bar have their corners cut.
    expect(runs[0].width).toBe(8);
    expect(runs[15].width).toBe(30);
  });

  it('points an arrow the way it is asked', () => {
    const up = arrowRuns('up', 3);
    expect(up[0]).toEqual({ x: 2, y: 0, width: 1 });
    expect(up[2]).toEqual({ x: 0, y: 2, width: 5 });
    const down = arrowRuns('down', 3);
    expect(down.find((run) => run.width === 1)?.y).toBe(2);
    expect(area(arrowRuns('left', 3))).toBe(area(up));
    expect(area(arrowRuns('right', 3))).toBe(area(up));
  });

  it('outlines a shape a pixel out on every side, and never across a corner', () => {
    const square = [{ x: 0, y: 0, width: 2 }, { x: 0, y: 1, width: 2 }];
    const outline = outlineRuns(square);
    expect(outline).toEqual([
      { x: 0, y: -1, width: 2 },
      { x: -1, y: 0, width: 4 },
      { x: -1, y: 1, width: 4 },
      { x: 0, y: 2, width: 2 },
    ]);
  });

  it('writes runs as one path', () => {
    expect(runsPath([{ x: 1, y: 2, width: 3 }], 10, 20)).toBe('M11 22h3v1h-3z');
  });

  it('lights the top edge of a shape and shades its bottom edge', () => {
    const disc = discRuns(9);
    const top = topEdgeRuns(disc);
    expect(top[0]).toEqual(disc[0]);
    expect(top.every((run) => run.y <= 4)).toBe(true);
    const bottom = bottomEdgeRuns(disc);
    expect(bottom.every((run) => run.y >= 4)).toBe(true);
    expect(bottom.at(-1)).toEqual(disc.at(-1));
  });

  it('draws every icon on its eleven-by-nine grid', () => {
    for (const icon of Object.keys(PAD_ICONS) as (keyof typeof PAD_ICONS)[]) {
      expect(PAD_ICONS[icon]).toHaveLength(9);
      expect(PAD_ICONS[icon].every((row) => row.length === 11)).toBe(true);
      expect(iconRuns(icon).length).toBeGreaterThan(5);
    }
  });
});
