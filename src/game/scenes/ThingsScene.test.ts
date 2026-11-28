import { describe, expect, it, vi } from 'vitest';

vi.stubGlobal('requestAnimationFrame', () => 0);
// onKey asks what the focus is on; with no page, it is on nothing.
vi.stubGlobal('HTMLElement', class {});

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
  return thingsOver(items, level, false, ...others);
}

/** As `thingsHolding`, with the Pikachu as the partner when `partner` says so: it then takes no room in the locker. */
function thingsOver(items: Record<string, number>, level: number, partner: boolean, ...others: readonly string[]): ThingsInternals {
  const stash = new Stash();
  for (const speciesId of others) {
    stash.addPokemon(new Pokemon(getSpeciesById(speciesId)!, 20));
  }
  stash.addPokemon(new Pokemon(getSpeciesById('pikachu')!, level), 'home-1');
  if (partner) {
    stash.adoptPartner('home-1');
  }
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
      root: { innerHTML: '', dataset: {}, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => undefined },
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

/**
 * YOUR THINGS as the stash grid (the captain, 25 Nov 2026): a thing moved
 * from the stash into the pack is packed for the next raid, and back out is
 * unpacked, written to the save as the arena's rack writes it.
 */
describe('packing from YOUR THINGS', () => {
  interface Packing {
    packOne(itemId: string, at?: { x: number; y: number; rotated: boolean }): boolean;
    transfer(from: string, to: string, ref: unknown, x: number, y: number, rotated: boolean): boolean;
    takeOut(ref: { kind: 'item'; itemId: string; index: number }): void;
    stashContents(): Record<string, number>;
  }
  const packing = (scene: ThingsInternals) => scene as unknown as Packing;
  const saved = (scene: ThingsInternals) => (scene as unknown as { saveManager: SaveManager }).saveManager.load()!;

  it('packs one stack on ENTER and writes it to the save, out of what the stash shows', () => {
    const scene = thingsHolding({ 'poke-ball': 4 }, 10);
    const before = packing(scene).stashContents()['poke-ball'] ?? 0;
    expect(packing(scene).packOne('poke-ball')).toBe(true);
    const packed = saved(scene).raidProgress.lastPack?.['poke-ball'] ?? 0;
    expect(packed).toBeGreaterThan(0);
    expect(packing(scene).stashContents()['poke-ball'] ?? 0).toBe(4 - packed);
    expect(before).toBeGreaterThanOrEqual(packing(scene).stashContents()['poke-ball'] ?? 0);
  });

  it('seats a thing dragged into the pack where it was let go', () => {
    // A rod, which nothing packs by itself the way medicine and balls are.
    const scene = thingsHolding({ 'old-rod': 1 }, 10);
    expect(packing(scene).transfer('stash', 'pack', { kind: 'cargo', cargoId: 'old-rod' }, 3, 1, false)).toBe(true);
    const seats = saved(scene).raidProgress.packArrangement?.items ?? [];
    expect(seats).toContainEqual(expect.objectContaining({ itemId: 'old-rod', x: 3, y: 1 }));
  });

  it('takes one back out to the stash', () => {
    const scene = thingsHolding({ 'poke-ball': 1 }, 10);
    packing(scene).packOne('poke-ball');
    packing(scene).takeOut({ kind: 'item', itemId: 'poke-ball', index: 0 });
    expect(saved(scene).raidProgress.lastPack?.['poke-ball'] ?? 0).toBe(0);
    expect(packing(scene).stashContents()['poke-ball']).toBe(1);
  });

  it('refuses to pack what never goes on a raid, and packs none of it', () => {
    const scene = thingsHolding({ 'mooring-rope': 2 }, 10);
    expect(packing(scene).packOne('mooring-rope')).toBe(false);
    expect(saved(scene).raidProgress.lastPack?.['mooring-rope'] ?? 0).toBe(0);
  });
});

describe('locking from YOUR THINGS', () => {
  interface Locking {
    lock(itemId: string, more: boolean): boolean;
    transfer(from: string, to: string, ref: unknown, x: number, y: number, rotated: boolean): boolean;
    flow: { secureQuantity(itemId: string): number; itemQuantity(itemId: string): number };
    status: string | undefined;
  }
  const locking = (scene: ThingsInternals) => scene as unknown as Locking;
  const saved = (scene: ThingsInternals) => (scene as unknown as { saveManager: SaveManager }).saveManager.load()!;

  it('lets go of a Potion it kept, remembers that, and opens that way next time', () => {
    // The partner is going alone, so the locker has kept the packed medicine by itself.
    const scene = thingsOver({ potion: 3 }, 10, true);
    expect(locking(scene).flow.secureQuantity('potion')).toBe(3);
    expect(locking(scene).lock('potion', false)).toBe(true);
    expect(locking(scene).flow.secureQuantity('potion')).toBe(2);
    expect(saved(scene).raidProgress.securePreference?.items).toContainEqual({ itemId: 'potion', quantity: 2 });
    scene.reload();
    expect(locking(scene).flow.secureQuantity('potion')).toBe(2);
    expect(locking(scene).lock('potion', true)).toBe(true);
    expect(locking(scene).flow.secureQuantity('potion')).toBe(3);
  });

  it('unlocks a block dragged out of the locker, and locks one dragged onto it', () => {
    const scene = thingsOver({ potion: 3 }, 10, true);
    const ref = { kind: 'item', itemId: 'potion', index: 0 };
    expect(locking(scene).transfer('locker', 'pack', ref, 0, 0, false)).toBe(true);
    expect(locking(scene).flow.secureQuantity('potion')).toBe(2);
    expect(locking(scene).transfer('pack', 'locker', ref, 0, 0, false)).toBe(true);
    expect(locking(scene).flow.secureQuantity('potion')).toBe(3);
  });

  it('keeps the Pokémon chosen on the team strip, and opens with it kept next time', () => {
    // The partner and two more: both at level 20, and the locker would keep the Pidgey by itself.
    const scene = thingsOver({}, 10, true, 'pidgey', 'rattata');
    const saves = (scene as unknown as { saveManager: SaveManager }).saveManager;
    const ids = saves.load()!.stash.listPokemon().map((one) => one.id);
    const rattata = saves.load()!.stash.listPokemon().find((one) => one.pokemon.base.id === 'rattata')!.id;
    saves.chooseBench(ids);
    scene.reload();
    const flow = (scene as unknown as { flow: { securesPokemon(id: string): boolean } }).flow;
    expect(flow.securesPokemon(rattata)).toBe(false);
    (scene as unknown as { lockPokemon(id: string): void }).lockPokemon(rattata);
    expect(flow.securesPokemon(rattata)).toBe(true);
    expect(saved(scene).raidProgress.securePreference?.pokemonIds).toEqual([rattata]);
    scene.reload();
    expect((scene as unknown as { flow: { securesPokemon(id: string): boolean } }).flow.securesPokemon(rattata)).toBe(true);
  });

  it('never puts the partner in the locker', () => {
    const scene = thingsOver({}, 10, true);
    (scene as unknown as { lockPokemon(id: string): void }).lockPokemon('home-1');
    expect(saved(scene).raidProgress.securePreference?.pokemonIds ?? []).toEqual([]);
  });

  it('keeps room in the locker for a find dragged onto it from home', () => {
    const scene = thingsOver({ 'mooring-rope': 1 }, 10, true);
    expect(locking(scene).transfer('stash', 'locker', { kind: 'cargo', cargoId: 'mooring-rope' }, 0, 0, false)).toBe(true);
    expect(locking(scene).flow.secureQuantity('mooring-rope')).toBeGreaterThan(0);
  });

  it('keeps room for a find nobody has at home yet, money included, from ROOM FOR A FIND', () => {
    const scene = thingsOver({}, 10, true);
    const internals = scene as unknown as { keepRoomFor(itemId: string, more: boolean): void; findRows(): { itemId: string; kept: number }[] };
    expect(internals.findRows().map((row) => row.itemId)).toEqual(expect.arrayContaining(['parts-crate', 'money']));
    internals.keepRoomFor('money', true);
    expect(locking(scene).flow.secureQuantity('money')).toBeGreaterThan(0);
    expect(internals.findRows().find((row) => row.itemId === 'money')?.kept).toBe(1);
    internals.keepRoomFor('money', false);
    expect(locking(scene).flow.secureQuantity('money')).toBe(0);
  });

  it('says so when the locker is full, and keeps no more', () => {
    const scene = thingsOver({ potion: 8 }, 10, true);
    expect(locking(scene).flow.secureQuantity('potion')).toBe(4);
    expect(locking(scene).lock('potion', true)).toBe(false);
    expect(locking(scene).flow.secureQuantity('potion')).toBe(4);
    expect(scene.overlay.root.innerHTML).toMatch(/locker|room/i);
  });
});

describe('from YOUR THINGS to YOUR TEAM', () => {
  it('P closes the screen and asks the harbour for YOUR TEAM', () => {
    const scene = thingsHolding({ potion: 1 }, 10);
    const openTeam = vi.fn();
    const stop = vi.fn();
    Object.assign(scene as unknown as Record<string, unknown>, {
      toTeam: openTeam,
      scene: { stop, isPaused: () => false, resume: vi.fn() },
    });
    scene.onKey(key('p'));
    expect(openTeam).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('P does nothing where nobody asked for YOUR TEAM', () => {
    const scene = thingsHolding({ potion: 1 }, 10);
    const stop = vi.fn();
    Object.assign(scene as unknown as Record<string, unknown>, { scene: { stop, isPaused: () => false, resume: vi.fn() } });
    scene.onKey(key('p'));
    expect(stop).not.toHaveBeenCalled();
  });
});

describe('a thing let go at the edge of a grid', () => {
  it('stands where it was let go, moved in just far enough to be all on the grid', async () => {
    const { withinGrid } = await import('./ThingsScene');
    // The Old Rod is a square wide and two tall: let go on the foot row it stands one higher.
    expect(withinGrid({ width: 6, height: 3 }, 'old-rod', { x: 5, y: 2, rotated: false })).toEqual({ x: 5, y: 1 });
    expect(withinGrid({ width: 6, height: 3 }, 'old-rod', { x: 5, y: 2, rotated: true })).toEqual({ x: 4, y: 2 });
    expect(withinGrid({ width: 6, height: 3 }, 'poke-ball', { x: 2, y: 1, rotated: false })).toEqual({ x: 2, y: 1 });
  });
});
