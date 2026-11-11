import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
  },
}));

import { Bag } from '../items';
import { getSpeciesById, Pokemon, PokemonParty } from '../pokemon';
import { BagScene } from './BagScene';

interface BagInternals {
  usingItemId?: string;
  time: { now: number; delayedCall: ReturnType<typeof vi.fn> };
  menuOverlay: { root: { innerHTML: string } };
  giveTo(index: number): void;
  handleKey(event: Partial<KeyboardEvent>): void;
}

/**
 * The characters bug hunt (11 Nov 2026) found a stone used at home evolving
 * with only a status line the next press wiped; the raid's pack did the same.
 * Both now hold the evolution on screen until it has been seen.
 */
describe('a stone used from the raid pack', () => {
  it('holds the evolution on screen through the presses straight after it', () => {
    const pikachu = new Pokemon(getSpeciesById('pikachu')!, 12);
    const bag = new Bag({ 'thunder-stone': 1 });
    const scene = Object.create(BagScene.prototype) as BagInternals;
    Object.assign(scene as unknown as Record<string, unknown>, {
      bag,
      party: new PokemonParty([pikachu]),
      onItemUsed: vi.fn(),
      time: { now: 0, delayedCall: vi.fn() },
      menuOverlay: {
        root: { innerHTML: '', querySelector: () => ({}), querySelectorAll: () => [] },
        refocus: vi.fn(),
      },
    });
    scene.usingItemId = 'thunder-stone';

    scene.giveTo(0);

    expect(pikachu.base.id).toBe('raichu');
    expect(bag.count('thunder-stone')).toBe(0);
    const moment = scene.menuOverlay.root.innerHTML;
    expect(moment).toContain('data-evolve-moment');
    expect(moment).toContain('Congratulations! Your Pikachu evolved into Raichu!');
    scene.handleKey({ key: 'Enter', repeat: true, preventDefault: vi.fn() });
    scene.handleKey({ key: 'Enter', repeat: false, preventDefault: vi.fn() });
    expect(scene.menuOverlay.root.innerHTML).toContain('data-evolve-moment');
  });
});
