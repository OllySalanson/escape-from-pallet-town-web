import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

const played: string[] = [];
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy(
    {},
    { get: (_target, key) => (key === 'play' ? (name: string) => played.push(name) : vi.fn(() => Promise.resolve())) },
  ),
}));

import { Bag } from '../items';
import { getSpeciesById, Pokemon } from '../pokemon';
import { BagScene } from './BagScene';

interface PackHarness {
  pressItem(itemId: string): void;
  usingItemId?: string;
  status?: string;
}

/** The raid pack open on one Pokemon, holding `itemId`, with nothing chosen yet. */
function packHolding(itemId: string): PackHarness {
  const bag = new Bag();
  bag.add(itemId);
  const scene = Object.create(BagScene.prototype) as BagScene;
  Object.assign(scene as object, {
    bag,
    party: { pokemon: [new Pokemon(getSpeciesById('rattata')!, 10)] },
    usingItemId: undefined,
    onItemUsed: () => undefined,
    render: () => undefined,
  });
  return scene as unknown as PackHarness;
}

describe('a tool in the raid pack', () => {
  it.each([
    ['old-rod', 'Face open water'],
    ['good-rod', 'Face open water'],
    ['pickaxe', 'Face the rubble'],
    ['ranger-pack', 'chosen at base'],
  ])('%s says where it is used rather than opening a list of Pokemon to use it on', (itemId, where) => {
    played.length = 0;
    const scene = packHolding(itemId);
    scene.pressItem(itemId);
    expect(scene.usingItemId).toBeUndefined();
    expect(scene.status).toContain(where);
    expect(played).toEqual(['denied']);
  });

  it('still opens the list of Pokemon for a Potion', () => {
    const scene = packHolding('potion');
    scene.pressItem('potion');
    expect(scene.usingItemId).toBe('potion');
  });
});
