import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy({}, { get: () => vi.fn() }),
}));

import { getWorldMap } from '../worldMap';
import { PRESS_ARROWS } from '../ui/pressArrows';
import { WorldScene } from './WorldScene';

/**
 * Every caption the world scene writes for a door, on a shipped map with
 * rooms: a real `WorldScene` building its own doorway labels through real
 * `WorldLabel`s, on a stand-in scene that only records the words it is asked
 * to set.
 */
function doorwayCaptions(): string[] {
  const written: string[] = [];
  const chain: unknown = new Proxy(() => chain, { get: () => () => chain });
  const text = (_x: number, _y: number, words: string) => {
    written.push(words);
    const label = {
      x: 0,
      y: 0,
      width: 80,
      height: 12,
      visible: true,
      setOrigin: () => label,
      setDepth: () => label,
      setVisible: () => label,
      setPosition: () => label,
    };
    return label;
  };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: getWorldMap('floodplain-relay'),
    runSession: {},
    worldLabels: [],
    add: { graphics: () => chain, text } as unknown as Phaser.GameObjects.GameObjectFactory,
  });
  (scene as unknown as { createDoorwayLabels(): void }).createDoorwayLabels();
  return written;
}

describe("a door's caption", () => {
  it('points the way to press with a triangle the game draws whole, never a thin arrow', () => {
    const captions = doorwayCaptions();
    // The Press House is gone into by pressing up from the street and left by
    // pressing down off its mats.
    expect(captions).toContain(`THE PRESS HOUSE ${PRESS_ARROWS.up}`);
    expect(captions).toContain(`THE CIDER YARD ${PRESS_ARROWS.down}`);
    // Orange Kid has no arrows, and cut to the pixel grid a typed `↑` read `T`.
    for (const caption of captions) {
      expect(caption).not.toMatch(/[←-⇿]/u);
      expect(caption).toMatch(/ [▲▼◀▶]$/u);
    }
  });
});
