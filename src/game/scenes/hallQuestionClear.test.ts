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

import { BaseScene } from './BaseScene';

/**
 * The gyms playtest of 14 Nov 2026: MISTY on her own tile on the far floor,
 * spoken to from the tile below - the hall's view eased on round to the stands
 * after "A BOUT FOR SHOW?" was seated clear of her, and both she and the
 * player slid down under the box.
 */
type Hall = {
  settleHallCamera(deltaMs: number, snap: boolean): void;
  say(lines: readonly string[], about: readonly { x: number; y: number }[]): void;
};

function hall(view = { left: 0, top: 0 }) {
  const setScroll = vi.fn();
  const setY = vi.fn();
  const scene = Object.create(BaseScene.prototype) as BaseScene;
  Object.assign(scene as object, {
    arena: {},
    jump: null,
    still: true,
    player: { x: 480, y: 112 },
    currentTile: { x: 30, y: 7 },
    cameraOffset: { x: 0, y: 0 },
    dialogBox: { visible: false, x: 10, setY, showMessages: vi.fn() },
    boxQuestion: null,
    fogLift: null,
    crowdLookMs: 0,
    rivalHere: null,
    rivalAt: { x: 30, y: 6 },
    scale: { width: 320, height: 240 },
    cameras: { main: { worldView: view, width: 320, height: 240, setScroll, getBounds: () => ({ bottom: 2000 }) } },
  });
  (scene as unknown as Record<string, unknown>).panelCover = () => ({ right: 0, bottom: 0 });
  return { scene: scene as unknown as Hall & { dialogBox: { visible: boolean } }, setScroll, setY };
}

describe('a question on the hall floor', () => {
  it('holds the view still while somebody is speaking to the player, and lets it go after', () => {
    const { scene, setScroll } = hall();
    scene.say(['A BOUT FOR SHOW?'], [{ x: 30, y: 6 }]);
    scene.dialogBox.visible = true;
    scene.settleHallCamera(100, false);
    expect(setScroll).not.toHaveBeenCalled();
    scene.dialogBox.visible = false;
    scene.settleHallCamera(100, false);
    expect(setScroll).toHaveBeenCalled();
  });

  it('is seated clear of the player as well as of whoever is speaking', () => {
    // The speaker off the top of the screen, the player at its foot: the box
    // goes up, out of the player's way, where it used to sit on them.
    const { scene, setY } = hall({ left: 0, top: 0 });
    Object.assign(scene as object, { currentTile: { x: 10, y: 13 } });
    scene.say(['...'], [{ x: 10, y: -10 }]);
    const [y] = setY.mock.calls.at(-1) as [number];
    expect(y).toBeLessThan(120);
  });
});
