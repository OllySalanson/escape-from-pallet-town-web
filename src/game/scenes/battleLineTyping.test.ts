import { describe, expect, it, vi } from 'vitest';

interface StubKey {
  justDown: boolean;
}

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: (key: StubKey) => key?.justDown === true } },
  },
}));
vi.mock('../audio/AudioManager', () => ({ audioManager: { play: vi.fn() } }));

import { BattleScene } from './BattleScene';

/**
 * Every AI playtest of 22 Nov 2026 reported the foe's move line missing - 'Foe
 * KRABBY used L' and straight on to 'Your SQUIRTLE's Defense fell!'. The line
 * was typed before the press was read, so a press made while it was still
 * typing, in the frame its last letters landed, read as "next" and threw it
 * away unread. A press answers the line as it stood when the frame began.
 */
function battleOnATypingLine() {
  const confirmKey: StubKey = { justDown: false };
  const dialog = {
    visible: true,
    isCurrentMessageComplete: false,
    // This frame's typing finishes the line.
    update: vi.fn(() => {
      dialog.isCurrentMessageComplete = true;
    }),
    skip: vi.fn(),
    advance: vi.fn(() => false),
  };
  const scene = Object.create(BattleScene.prototype) as BattleScene;
  Object.assign(scene as object, {
    mode: 'events',
    dialog,
    confirmKey,
    keyPresses: { justPressed: (key: StubKey) => key === confirmKey && key.justDown },
    advanceSlides: () => undefined,
    updateRain: () => undefined,
  });
  return { scene, dialog, confirmKey };
}

describe('a press on a battle line that is still typing', () => {
  it('finishes the line, and never also moves on from it', () => {
    const { scene, dialog, confirmKey } = battleOnATypingLine();
    confirmKey.justDown = true;

    scene.update(0, 100);

    expect(dialog.advance).not.toHaveBeenCalled();
    expect(dialog.skip).toHaveBeenCalledTimes(1);
  });

  it('moves on from a line that was already whole when the frame began', () => {
    const { scene, dialog, confirmKey } = battleOnATypingLine();
    dialog.isCurrentMessageComplete = true;
    confirmKey.justDown = true;

    scene.update(0, 100);

    expect(dialog.advance).toHaveBeenCalledTimes(1);
  });
});
