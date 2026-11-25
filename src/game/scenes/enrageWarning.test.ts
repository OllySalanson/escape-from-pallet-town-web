import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { FIRST_WORDS } from '../hub/firstWords';
import { WorldScene } from './WorldScene';

interface Warned {
  runSession: { enrageWarned?: boolean };
  warnOfEnrage(remainingMs: number | undefined): void;
}

/** A raid's world, as far as Oak's minute-left word reads it. */
function aRaid(): { scene: Warned; said: string[] } {
  const said: string[] = [];
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    runSession: {},
    interrupt: (lines: readonly string[]) => said.push(...lines),
  });
  return { scene: scene as unknown as Warned, said };
}

describe("Oak's minute-left word about the enrage", () => {
  it('says nothing while more than a minute is left', () => {
    const { scene, said } = aRaid();
    scene.warnOfEnrage(61_000);
    expect(said).toEqual([]);
    expect(scene.runSession.enrageWarned).toBeUndefined();
  });

  it('says what 0:00 does once a minute is left, and only once a raid', () => {
    const { scene, said } = aRaid();
    scene.warnOfEnrage(60_000);
    scene.warnOfEnrage(30_000);
    expect(said).toEqual([...FIRST_WORDS.enraged.lines]);
    expect(scene.runSession.enrageWarned).toBe(true);
  });

  it('says nothing once the clock has run out, nor on a clock that does not say what is left', () => {
    // A test's stand-in clock gives only the elapsed time; an undefined
    // remainder once read as "a minute left" and stopped every such raid.
    for (const remaining of [0, -5_000, undefined, Number.NaN]) {
      const { scene, said } = aRaid();
      scene.warnOfEnrage(remaining);
      expect(said).toEqual([]);
    }
  });
});
