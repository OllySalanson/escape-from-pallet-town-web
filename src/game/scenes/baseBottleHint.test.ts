import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class { public x = 0; public y = 0; } },
    Geom: { Rectangle: class { public static Contains = () => true; } },
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false }, Events: {} },
    Scenes: { Events: { SHUTDOWN: 'shutdown', UPDATE: 'update' } },
    Scale: { Events: { RESIZE: 'resize' } },
    BlendModes: { ADD: 1 },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

import { BEACH_BOTTLE } from '../treasure/treasureMap';
import { BaseScene, BOTTLE_HINT } from './BaseScene';

/** The real yard hint line on a stand-in of the harbour, stood beside the bottle. */
function hintBesideTheBottle(facing: 'left' | 'right', lying: boolean): string {
  const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
  Object.assign(scene, {
    place: {},
    choosing: false,
    partner: undefined,
    harbourLife: undefined,
    visit: undefined,
    beachBottle: lying ? [{}] : [],
    currentTile: { x: BEACH_BOTTLE.x - 1, y: BEACH_BOTTLE.y },
    facing,
    savedGame: { raidProgress: { keysLearned: [] } },
  });
  return (scene as unknown as { hintHere(): string }).hintHere();
}

describe('the bottle on THE BEACH', () => {
  it('says SPACE takes it when it is faced, and nothing about it once it is gone or not faced', () => {
    expect(hintBesideTheBottle('right', true)).toBe(BOTTLE_HINT);
    expect(hintBesideTheBottle('right', false)).not.toBe(BOTTLE_HINT);
    expect(hintBesideTheBottle('left', true)).not.toBe(BOTTLE_HINT);
  });
});
