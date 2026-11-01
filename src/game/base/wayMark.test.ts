import { describe, expect, it } from 'vitest';
import { chevronRoundFigure, chevronTowards, runnerChevrons } from './wayMark';

const VIEW = { left: 100, top: 200, width: 400, height: 256 };

describe('the way shown in a raid', () => {
  const figure = { x: 300, y: 330 };

  it('stands over the thing once it is on the screen', () => {
    expect(chevronRoundFigure({ x: 300, y: 320 }, { x: 300, y: 320 }, VIEW, figure, 0).angle).toBe(180);
  });

  it('points where the walk sets off, beside the figure, wherever the thing itself lies', () => {
    const away = { x: 5000, y: 330 };
    const north = chevronRoundFigure(away, { x: 300, y: 200 }, VIEW, figure, 0);
    expect(north.angle).toBe(0);
    expect(north.x).toBe(figure.x - VIEW.left);
    expect(north.y).toBeLessThan(figure.y - VIEW.top);
    const east = chevronRoundFigure(away, { x: 420, y: 330 }, VIEW, figure, 0);
    expect(east.angle).toBe(90);
    expect(east.x).toBeGreaterThan(figure.x - VIEW.left);
  });
});

describe('the way shown to a first raid', () => {
  it('stands over what it points at while that is on the screen, pointing down at it', () => {
    const at = chevronTowards({ x: 300, y: 320 }, VIEW, { x: 300, y: 330 }, 0);
    expect(at.angle).toBe(180);
    expect(at.x).toBe(200);
    expect(at.y).toBeLessThan(120);
  });

  it('stands at the edge of the screen pointing at it when it is off the screen', () => {
    const west = chevronTowards({ x: 0, y: 320 }, VIEW, { x: 300, y: 320 }, 0);
    expect(west.angle).toBe(270);
    expect(west.x).toBeLessThan(40);
    const east = chevronTowards({ x: 900, y: 320 }, VIEW, { x: 300, y: 320 }, 0);
    expect(east.angle).toBe(90);
    expect(east.x).toBeGreaterThan(VIEW.width - 40);
  });

  it('is always whole pixels and on the screen', () => {
    for (let ms = 0; ms < 2000; ms += 37) {
      const at = chevronTowards({ x: 0, y: 9000 }, VIEW, { x: 300, y: 320 }, ms);
      expect(Number.isInteger(at.x) && Number.isInteger(at.y)).toBe(true);
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.y).toBeLessThanOrEqual(VIEW.height);
    }
  });

  it('runs up the runner ahead of the player, to the rail and no further', () => {
    const rows = runnerChevrons(500, 1000, 850);
    expect(rows.length).toBeGreaterThan(0);
    for (const y of rows) {
      expect(y).toBeLessThan(1000);
      expect(y).toBeGreaterThanOrEqual(850);
    }
    // Later, the same ones are further up.
    const later = runnerChevrons(510, 1000, 850);
    expect(later[0]).toBeLessThan(rows[0]);
  });

  it('holds still for anybody who asked for less movement', () => {
    expect(runnerChevrons(500, 1000, 850, true)).toEqual(runnerChevrons(9000, 1000, 850, true));
  });
});
