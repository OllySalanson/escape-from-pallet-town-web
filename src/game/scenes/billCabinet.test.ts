import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class { public x = 0; public y = 0; } },
    Geom: { Rectangle: class { public static Contains = () => true; } },
    Input: {
      Keyboard: { KeyCodes: {}, JustDown: () => false },
      Events: {
        GAMEOBJECT_POINTER_OVER: 'pointerover',
        GAMEOBJECT_POINTER_OUT: 'pointerout',
        GAME_OUT: 'gameout',
      },
    },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Scale: { Events: { RESIZE: 'resize' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

import { BaseScene } from './BaseScene';

type Handler = () => void;

/** Something that hands its listeners back, as Phaser's emitters do. */
const listening = () => {
  const handlers = new Map<string, Handler>();
  const emitter = {
    handlers,
    on: (event: string, handler: Handler) => {
      handlers.set(event, handler);
      return emitter;
    },
  };
  return emitter;
};

/**
 * Bill's shelves answer the pointer: resting on a thing puts its label up,
 * and moving off it takes the label down. Phaser only hears a pointer that is
 * over the canvas, so moving off the game's frame altogether is no pointer-out
 * on the thing - the label stayed up, and every other caption in the room
 * stayed out of the seating behind it, until the pointer came back.
 */
describe("Bill's cabinet and the pointer", () => {
  function cottageWithOneOddity() {
    const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
    const image = {
      ...listening(),
      setOrigin: () => image,
      setDepth: () => image,
      setInteractive: () => image,
    };
    const input = listening();
    const label = { destroy: vi.fn() };
    Object.assign(scene, {
      place: {
        room: {
          cabinet: {
            layout: {
              placed: [{ index: 0, oddity: { itemId: 'quick-claw' }, unit: 0, run: 0, x: 40, y: 40, width: 4, height: 4 }],
            },
          },
        },
      },
      add: { image: () => image },
      input,
      oddityFrame: () => ({ key: 'bill-oddities', frame: 'quick-claw' }),
      inspectLabel: label,
      inspectMark: null,
    });
    (scene.drawOddities as () => void).call(scene);
    return { scene, image, input, label };
  }

  it('takes the label down when the pointer leaves the game', () => {
    const { scene, input, label } = cottageWithOneOddity();
    scene.inspecting = { index: 0, by: 'pointer' };

    input.handlers.get('gameout')?.();

    expect(scene.inspecting).toBeNull();
    expect(label.destroy).toHaveBeenCalled();
  });

  it('leaves a look the keys are taking alone', () => {
    const { scene, input, label } = cottageWithOneOddity();
    scene.inspecting = { index: 0, by: 'keys' };

    input.handlers.get('gameout')?.();

    expect(scene.inspecting).toEqual({ index: 0, by: 'keys' });
    expect(label.destroy).not.toHaveBeenCalled();
  });
});
