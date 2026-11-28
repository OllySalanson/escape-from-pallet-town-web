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
 * The real talk hint on a stand-in of a scene with `boxesLeft` of a keeper's
 * words to come: what is drawn on the screen, and what the controls bar is
 * handed (`momentLine`).
 */
function talking(boxesLeft: number): { drawn: string; offered: string } {
  const anything: unknown = new Proxy(() => anything, { get: () => anything });
  const text = { width: 46, height: 12, text: '', setText: () => text, setVisible: () => text, setPosition: () => text };
  const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
  Object.assign(scene, {
    dialogBox: { boxesLeft, x: 48, y: 192 },
    afterSaid: null,
    hintText: text,
    hintFrame: anything,
    hintShown: '',
    momentLine: '',
    scale: { width: 400, height: 256 },
    cameras: { main: { scrollY: 400 } },
    currentTile: { x: 50, y: 30 },
  });
  (scene as unknown as { showTalkHint(): void }).showTalkHint();
  return { drawn: scene.hintShown as string, offered: scene.momentLine as string };
}

describe('the [ESC] SKIP key while somebody talks', () => {
  it('is offered on the controls bar and never written beside the box, as FireRed writes no key there', () => {
    expect(talking(3)).toEqual({ drawn: '', offered: '[ESC] SKIP' });
  });

  it('is not offered on the last box, where there is nothing left to skip', () => {
    expect(talking(1)).toEqual({ drawn: '', offered: '' });
  });
});
