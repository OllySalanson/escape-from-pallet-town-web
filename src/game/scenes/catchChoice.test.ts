import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import type { GridPosition } from '../movement/gridMovement';
import { WorldScene } from './WorldScene';

interface Choosing {
  currentTile: GridPosition;
  choosingAfterTheCatch(exit: GridPosition, stake: GridPosition): boolean;
}

const EXIT = { x: 0, y: 0 };
const STAKE = { x: 20, y: 0 };

/** One open row of ground, the exit at one end and the stake at the other, with the catch made at `caughtAt`. */
function afterTheCatch(caughtAt: GridPosition | undefined, caught = true): Choosing {
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentTile: caughtAt ?? { x: 12, y: 0 },
    runSession: { firstCatch: { tried: [], caughtBefore: 0, answered: true, caught, caughtAt } },
    wayField: (to: GridPosition) => [Array.from({ length: 21 }, (_unused, x) => Math.abs(x - to.x))],
  });
  return scene as unknown as Choosing;
}

describe("the first raid's choice after the catch", () => {
  it('offers both ways where the catch was made, even nearer the money than the way out', () => {
    expect(afterTheCatch({ x: 12, y: 0 }).choosingAfterTheCatch(EXIT, STAKE)).toBe(true);
  });

  it('is made once the player walks towards the money and away from the way out', () => {
    const scene = afterTheCatch({ x: 12, y: 0 });
    scene.currentTile = { x: 14, y: 0 };
    expect(scene.choosingAfterTheCatch(EXIT, STAKE)).toBe(false);
  });

  it('still offers both while the player heads for the way out', () => {
    const scene = afterTheCatch({ x: 12, y: 0 });
    scene.currentTile = { x: 8, y: 0 };
    expect(scene.choosingAfterTheCatch(EXIT, STAKE)).toBe(true);
  });

  it('is no question before the catch', () => {
    expect(afterTheCatch({ x: 12, y: 0 }, false).choosingAfterTheCatch(EXIT, STAKE)).toBe(false);
  });
});
