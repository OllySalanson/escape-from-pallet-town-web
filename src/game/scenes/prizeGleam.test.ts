import { describe, expect, it, vi } from 'vitest';

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

vi.mock('../ui/WorldLabel', () => ({
  WorldLabel: class {
    destroy = vi.fn();
  },
}));

import type { WorldLoot } from '../world/loot';
import { WorldScene } from './WorldScene';

/** A drawn thing on the map: the scene's `add` calls chain, and it can be destroyed. */
function drawn(kind: string) {
  const object: Record<string, unknown> = { kind, destroyed: false };
  for (const method of ['setDepth', 'fillStyle', 'fillRect', 'setPosition']) {
    object[method] = () => object;
  }
  object.destroy = () => {
    object.destroyed = true;
  };
  return object;
}

const PRIZE = {
  id: 'weir-key',
  itemId: 'weir-key',
  quantity: 1,
  position: { x: 8, y: 8 },
  chance: 0.25,
} as WorldLoot;

describe('a prize picked up off the ground', () => {
  it('takes its gleam with it, rather than leaving the light over an empty tile', () => {
    const made: Record<string, unknown>[] = [];
    const tweened = new Set<unknown>();
    const scene = Object.create(WorldScene.prototype) as WorldScene;
    Object.assign(scene as object, {
      add: {
        image: () => {
          const image = drawn('image');
          made.push(image);
          return image;
        },
        graphics: () => {
          const graphics = drawn('graphics');
          made.push(graphics);
          return graphics;
        },
      },
      tweens: {
        add: ({ targets }: { targets: unknown }) => tweened.add(targets),
        killTweensOf: (target: unknown) => tweened.delete(target),
      },
      cameras: { main: { flash: vi.fn() } },
      lootForCurrentMap: () => [PRIZE],
      isLootAvailable: () => true,
      collectRunItem: () => true,
      collectedLootIds: new Set<string>(),
      lootSprites: new Map(),
      prizeLabels: new Map(),
      prizeGleams: new Map(),
      mapObjects: [],
      worldLabels: [],
      packReseated: false,
    });
    const driven = scene as unknown as {
      createLoot(): void;
      collectLootHere(loot: WorldLoot): string | null;
    };

    driven.createLoot();
    const gleam = made.find((object) => object.kind === 'graphics');
    expect(gleam).toBeDefined();
    expect(tweened.has(gleam)).toBe(true);

    expect(driven.collectLootHere(PRIZE)).toBe('Found Weir Key!');
    expect(made.every((object) => object.destroyed)).toBe(true);
    expect(tweened.size).toBe(0);
  });
});
