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
  pressThing(itemId: string): void;
  choosePupil(index: number): void;
  teach(): void;
  onKey(event: Partial<KeyboardEvent>): void;
}

/** YOUR THINGS over a save holding one Pikachu (and whoever else is named) and a Thunder Stone. */
function thingsWithAStone(...others: readonly string[]): ThingsInternals {
  return thingsHolding({ 'thunder-stone': 1 }, 12, ...others);
}

/** YOUR THINGS over a save holding a Pikachu of `level`, whoever else is named (at level 20), and `items`. */
function thingsHolding(items: Record<string, number>, level: number, ...others: readonly string[]): ThingsInternals {
  const stash = new Stash();
  for (const speciesId of others) {
    stash.addPokemon(new Pokemon(getSpeciesById(speciesId)!, 20));
  }
  stash.addPokemon(new Pokemon(getSpeciesById('pikachu')!, level), 'home-1');
  for (const [itemId, quantity] of Object.entries(items)) {
    stash.addItem(itemId, quantity);
  }
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

/**
 * The playtest of PRs 490-508 (11 Nov 2026): two quick ENTERs on THUNDER STONE
 * turned Eevee into Jolteon. The first opened USE THUNDER STONE ON with the
 * cursor on the first able Pokémon, and the second - the same double-tap -
 * landed on it, so the list was never seen and the stone was spent on whoever
 * happened to be first. Evolving cannot be undone, so the second press of a
 * double-tap gives nothing to anybody, as at the prize window and the Boutique.
 */
describe('a double press on a stone or a disc at home', () => {
  const saved = (scene: ThingsInternals) => (scene as unknown as { saveManager: SaveManager }).saveManager;
  const species = (scene: ThingsInternals): string[] =>
    saved(scene).load()!.stash.listPokemon().map((one) => one.pokemon.base.id);
  const count = (scene: ThingsInternals, itemId: string): number => saved(scene).load()!.stash.itemCount(itemId);

  it('opens the list of who it is for and evolves nobody on the second press', () => {
    const scene = thingsWithAStone('eevee');
    scene.time.now = 1_000;
    scene.pressThing('thunder-stone');
    scene.time.now = 1_080;
    scene.useStoneOn(0);

    expect(species(scene).sort()).toEqual(['eevee', 'pikachu']);
    expect(count(scene, 'thunder-stone')).toBe(1);
    expect(scene.overlay.root.innerHTML).not.toContain('data-evolve-moment');
    expect(scene.using).toEqual({ kind: 'evolve', itemId: 'thunder-stone' });
  });

  it('uses the stone on a press made once the list has been seen', () => {
    const scene = thingsWithAStone('eevee');
    scene.time.now = 1_000;
    scene.pressThing('thunder-stone');
    scene.time.now = 1_600;
    scene.useStoneOn(0);

    expect(species(scene)).not.toEqual(expect.arrayContaining(['eevee', 'pikachu']));
    expect(count(scene, 'thunder-stone')).toBe(0);
    expect(scene.overlay.root.innerHTML).toContain('data-evolve-moment');
  });

  it('teaches nothing on the press straight after the pupil was chosen', () => {
    // A level-5 Pikachu has a free move slot, so TEACH teaches there and then.
    const scene = thingsHolding({ 'tm23-iron-tail': 1 }, 5);
    scene.time.now = 1_000;
    scene.pressThing('tm23-iron-tail');
    scene.time.now = 1_600;
    scene.choosePupil(0);
    scene.time.now = 1_680;
    scene.teach();
    expect(count(scene, 'tm23-iron-tail')).toBe(1);

    scene.time.now = 2_200;
    scene.teach();
    expect(count(scene, 'tm23-iron-tail')).toBe(0);
  });
});
