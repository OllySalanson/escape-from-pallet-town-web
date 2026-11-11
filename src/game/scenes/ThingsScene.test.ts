import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
  },
}));

import { Bag } from '../items';
import { getSpeciesById, Pokemon, PokemonParty } from '../pokemon';
import { SaveManager } from '../save/SaveManager';
import { Stash } from '../stash';
import { ThingsScene } from './ThingsScene';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem = (key: string): string | null => this.values.get(key) ?? null;
  public setItem = (key: string, value: string): void => void this.values.set(key, value);
  public removeItem = (key: string): void => void this.values.delete(key);
}

interface ThingsInternals {
  using: { kind: 'evolve'; itemId: string } | null;
  time: { now: number; delayedCall: ReturnType<typeof vi.fn> };
  overlay: { root: { innerHTML: string } };
  reload(): void;
  render(): void;
  useStoneOn(index: number): void;
  onKey(event: Partial<KeyboardEvent>): void;
}

/** YOUR THINGS over a save holding one Pikachu and a Thunder Stone. */
function thingsWithAStone(): ThingsInternals {
  const stash = new Stash();
  stash.addPokemon(new Pokemon(getSpeciesById('pikachu')!, 12), 'home-1');
  stash.addItem('thunder-stone', 1);
  const saveManager = new SaveManager(new MemoryStorage());
  saveManager.save({ party: new PokemonParty([]), mapId: 'pallet-town', position: { x: 1, y: 1 }, items: [], bag: new Bag({}), stash });
  const scene = Object.create(ThingsScene.prototype) as ThingsInternals;
  Object.assign(scene as unknown as Record<string, unknown>, {
    saveManager,
    time: { now: 0, delayedCall: vi.fn() },
    overlay: {
      root: { innerHTML: '', dataset: {}, querySelector: () => null, querySelectorAll: () => [] },
      refocus: vi.fn(),
      moveCursor: () => false,
      remeasure: vi.fn(),
    },
    using: null,
  });
  scene.reload();
  return scene;
}

const key = (name: string, repeat = false): Partial<KeyboardEvent> => ({
  key: name,
  repeat,
  preventDefault: vi.fn(),
});

/**
 * The characters bug hunt (11 Nov 2026): a Thunder Stone used from YOUR THINGS
 * turned Pikachu into Raichu with only a status line, which the next press
 * wiped, so a player mashing through it never saw that anything had happened.
 * FireRed shows the evolution; so does this.
 */
describe('a stone used at home', () => {
  it('holds an evolution moment on screen that the press which used the stone cannot skip', () => {
    const scene = thingsWithAStone();
    scene.using = { kind: 'evolve', itemId: 'thunder-stone' };
    scene.useStoneOn(0);

    const moment = scene.overlay.root.innerHTML;
    expect(moment).toContain('data-evolve-moment');
    expect(moment).toContain('Congratulations! Your Pikachu evolved into Raichu!');
    // Both pictures are there: the one it was and the one it became.
    expect(moment).toContain('/25.png');
    expect(moment).toContain('/26.png');

    // The ENTER that used the stone, still coming, and another straight after.
    scene.onKey(key('Enter', true));
    scene.onKey(key('Enter'));
    expect(scene.overlay.root.innerHTML).toContain('data-evolve-moment');
  });

  it('ends on a key once it has been seen, and says what happened on the list', () => {
    const scene = thingsWithAStone();
    scene.using = { kind: 'evolve', itemId: 'thunder-stone' };
    scene.useStoneOn(0);

    scene.time.now = 5_000;
    scene.onKey(key('Enter'));

    const list = scene.overlay.root.innerHTML;
    expect(list).not.toContain('data-evolve-moment');
    expect(list).toContain('Congratulations! Your Pikachu evolved into Raichu!');
  });
});
