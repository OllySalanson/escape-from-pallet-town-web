import { KeyPresses } from '../input/KeyPresses';
import { PressLatch } from '../input/pressLatch';
import { describe, expect, it, vi } from 'vitest';

interface StubKey {
  justDown: boolean;
  isDown: boolean;
}

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: (key: StubKey) => key?.justDown === true } },
  },
}));

import { SpentPresses } from '../world/spentPresses';
import { WorldScene } from './WorldScene';

/**
 * Playtest 3, B6c: dismissing "A RIVAL HUNTER is on your trail!" with
 * ArrowRight also walked one tile right in the same press - towards the hunter.
 * The direction key still answers the box; the press is spent on doing so.
 */
function sceneWithHunterWarning() {
  const key = (): StubKey => ({ justDown: false, isDown: false });
  const controls = {
    up: key(), down: key(), left: key(), right: key(),
    w: key(), a: key(), s: key(), d: key(),
    interact: [key()],
  };
  const dialogBox = {
    visible: true,
    isCurrentMessageComplete: true,
    advance: vi.fn(() => { dialogBox.visible = false; }),
    skip: vi.fn(),
  };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    controls,
    dialogBox,
    unsolicitedDialog: true,
    spentPresses: new SpentPresses(),
    // `readInput` also honours a press latched for the frame that processed it.
    directionPresses: new PressLatch(),
    keyPresses: new KeyPresses(() => 0),
    game: { loop: { frame: 0 } },
  });
  const internals = scene as unknown as {
    handleDialogInput(): void;
    readInput(): { up: boolean; down: boolean; left: boolean; right: boolean };
  };
  return { internals, controls, dialogBox };
}

describe('dismissing a dialogue the world raised', () => {
  it('answers to the direction key, and does not also walk on that press', () => {
    const { internals, controls, dialogBox } = sceneWithHunterWarning();

    controls.right.justDown = true;
    controls.right.isDown = true;
    internals.handleDialogInput();

    expect(dialogBox.advance).toHaveBeenCalledOnce();
    expect(dialogBox.visible).toBe(false);
    // The next frame: the box is gone, the key is still physically down.
    controls.right.justDown = false;
    expect(internals.readInput().right).toBe(false);
  });

  it('walks on the next press of the same key', () => {
    const { internals, controls } = sceneWithHunterWarning();
    controls.right.justDown = true;
    controls.right.isDown = true;
    internals.handleDialogInput();

    controls.right.isDown = false;
    internals.readInput();
    controls.right.isDown = true;

    expect(internals.readInput().right).toBe(true);
  });

  it('leaves a key that was not part of the dismissal alone', () => {
    const { internals, controls } = sceneWithHunterWarning();
    controls.interact[0].justDown = true;
    internals.handleDialogInput();

    controls.up.isDown = true;
    expect(internals.readInput().up).toBe(true);
  });
});
