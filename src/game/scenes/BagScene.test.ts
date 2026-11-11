import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('requestAnimationFrame', () => 0);

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
  pressItem(itemId: string): void;
  choosePupil(index: number): void;
  teachPupil(): void;
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

/**
 * The playtest of PRs 490-508 (11 Nov 2026) found two quick ENTERs on a stone
 * at home evolving the first Pokémon on a list nobody saw; the raid pack's
 * recipient list is the same shape. The second press of a double-tap gives
 * nothing to anybody.
 */
describe('a double press in the raid pack', () => {
  function packWith(bag: Bag, ...party: Pokemon[]): BagInternals {
    const scene = Object.create(BagScene.prototype) as BagInternals;
    Object.assign(scene as unknown as Record<string, unknown>, {
      bag,
      party: new PokemonParty(party),
      onItemUsed: vi.fn(),
      time: { now: 0, delayedCall: vi.fn() },
      menuOverlay: {
        root: { innerHTML: '', querySelector: () => ({}), querySelectorAll: () => [] },
        refocus: vi.fn(),
        focus: vi.fn(),
      },
    });
    return scene;
  }

  it('opens the list of who it is for and evolves nobody on the second press', () => {
    const eevee = new Pokemon(getSpeciesById('eevee')!, 20);
    const pikachu = new Pokemon(getSpeciesById('pikachu')!, 20);
    const bag = new Bag({ 'thunder-stone': 1 });
    const scene = packWith(bag, eevee, pikachu);
    scene.time.now = 1_000;
    scene.pressItem('thunder-stone');
    scene.time.now = 1_080;
    scene.giveTo(0);

    expect(eevee.base.id).toBe('eevee');
    expect(bag.count('thunder-stone')).toBe(1);
    expect(scene.usingItemId).toBe('thunder-stone');

    scene.time.now = 1_600;
    scene.giveTo(1);
    expect(pikachu.base.id).toBe('raichu');
    expect(bag.count('thunder-stone')).toBe(0);
  });

  it('reads no disc on the press straight after the pupil was chosen', () => {
    const pikachu = new Pokemon(getSpeciesById('pikachu')!, 5);
    const bag = new Bag({ 'tm23-iron-tail': 1 });
    const scene = packWith(bag, pikachu);
    scene.time.now = 1_000;
    scene.pressItem('tm23-iron-tail');
    scene.time.now = 1_600;
    scene.choosePupil(0);
    scene.time.now = 1_680;
    scene.teachPupil();
    expect(bag.count('tm23-iron-tail')).toBe(1);

    scene.time.now = 2_200;
    scene.teachPupil();
    expect(bag.count('tm23-iron-tail')).toBe(0);
  });
});
