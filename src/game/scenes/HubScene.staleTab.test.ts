import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));

// The move chooser is a DOM screen; what matters here is the answer it hands
// back, so the test holds on to the callback and answers it itself.
const chooser = vi.hoisted(() => ({ answer: undefined as undefined | ((choice: unknown) => void) }));
vi.mock('../ui/MoveChooserOverlay', () => ({
  openMoveChooser: (_scene: unknown, _offer: unknown, answer: (choice: unknown) => void) => {
    chooser.answer = answer;
  },
}));

import { Bag } from '../items';
import { CHARMANDER, Pokemon, PokemonParty, WATER_GUN } from '../pokemon';
import { FIRST_CONTRACT_ID } from '../objectives';
import { createStartingStash, type Stash } from '../stash';
import { SAVE_KEY, SaveManager, type RestoredGame, type StorageLike } from '../save/SaveManager';
import { HubScene, STALE_SAVE_REFUSAL } from './HubScene';

/**
 * Two tabs on one save. Tab B opened the Pokemon Center and was left there;
 * tab A then played on. Every write the Center makes used to save tab B's whole
 * copy of the game, so pressing NEW BOX in it erased the contract tab A had
 * just banked, or brought back what a wipe in tab A had taken.
 */

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

interface CenterInternals {
  init(): void;
  setView(view: 'stash'): void;
  recover(ids: readonly string[]): void;
  treat(pokemonId: string, itemId: string): void;
  giveGear(pokemonId: string, itemId: string): void;
  takeGear(pokemonId: string): void;
  pickUp(pokemonId: string): void;
  putDown(destination: string): void;
  addBoxAndShow(): void;
  deleteBox(): void;
  submitBoxForm(text: string): void;
  offerPendingMoves(): void;
  boxScope: number | 'all';
  boxEditing: string | undefined;
  readonly view: string;
  readonly status: string;
  readonly stash: Stash;
  readonly savedGame: RestoredGame;
}

/** A save with a hurt Charmander holding Leftovers, a Quick Claw and a spare box. */
function seedSave(storage: MemoryStorage): void {
  const stash = createStartingStash();
  const charmander = new Pokemon(CHARMANDER, 7);
  charmander.takeDamage(5);
  stash.addPokemon(charmander, 'charmander-1');
  stash.addItem('leftovers', 1);
  stash.addItem('quick-claw', 1);
  stash.giveHeldItem('charmander-1', 'leftovers');
  stash.addBox();
  new SaveManager(storage).save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
  });
}

/** Tab B: the Pokemon Center, opened on the save as it stood. */
function openCenter(storage: MemoryStorage): CenterInternals {
  const hub = Object.create(HubScene.prototype) as CenterInternals;
  Object.assign(hub as unknown as Record<string, unknown>, {
    cameras: { main: { fadeIn: vi.fn(), fadeOut: vi.fn(), once: vi.fn() } },
    scene: { start: vi.fn() },
    saveManager: new SaveManager(storage),
    counterCounts: new Map<string, number>(),
    time: { delayedCall: vi.fn() },
    overlay: {
      root: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] },
      focus: vi.fn(),
      refocus: vi.fn(),
    },
  });
  hub.init();
  hub.setView('stash');
  return hub;
}

/** Tab A banks the first contract, through the same path a raid banks it by. */
function bankContractElsewhere(storage: MemoryStorage): void {
  const saves = new SaveManager(storage);
  const game = saves.load()!;
  saves.save({
    ...game,
    raidProgress: {
      ...game.raidProgress,
      completedContracts: [FIRST_CONTRACT_ID],
      firstContractExtracted: true,
    },
  });
}

/** Tab A loses a raid the Charmander and its Leftovers were on. */
function wipeElsewhere(storage: MemoryStorage): void {
  expect(new SaveManager(storage).applyWipeLoss(['charmander-1'], [])).toBe(true);
}

const contractsInStorage = (storage: MemoryStorage) =>
  new SaveManager(storage).load()!.raidProgress.completedContracts;
const charmanderInStorage = (storage: MemoryStorage) =>
  new SaveManager(storage).load()!.stash.listPokemon().some((stored) => stored.id === 'charmander-1');

/** Every write the Center makes, as the button that makes it does. */
const CENTER_WRITES: readonly [string, (hub: CenterInternals) => void][] = [
  ['recovery', (hub) => hub.recover(['charmander-1'])],
  ['treatment', (hub) => hub.treat('charmander-1', 'potion')],
  ['giving gear', (hub) => hub.giveGear('bulbasaur-1', 'quick-claw')],
  ['taking gear', (hub) => hub.takeGear('charmander-1')],
  ['NEW BOX', (hub) => hub.addBoxAndShow()],
  ['moving a Pokemon to a box', (hub) => { hub.pickUp('bulbasaur-1'); hub.putDown('1'); }],
  ['taking a box away', (hub) => { hub.boxScope = 1; hub.deleteBox(); }],
  ['renaming a box', (hub) => { hub.boxScope = 0; hub.boxEditing = 'rename'; hub.submitBoxForm('Keepers'); }],
  ['answering the move chooser', (hub) => {
    hub.stash.listPokemon()[0].pokemon.pendingMoves.push(WATER_GUN);
    hub.offerPendingMoves();
    chooser.answer!({ kind: 'forget', index: 0 });
  }],
];

describe('a Pokemon Center left open in another tab', () => {
  it.each(CENTER_WRITES)('never erases a contract banked elsewhere: %s', (_name, write) => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const center = openCenter(storage);
    bankContractElsewhere(storage);
    const banked = storage.getItem(SAVE_KEY);

    write(center);

    // Nothing was written, and the screen says why rather than pretending.
    expect(storage.getItem(SAVE_KEY)).toBe(banked);
    expect(contractsInStorage(storage)).toEqual([FIRST_CONTRACT_ID]);
    expect(center.status).toBe(STALE_SAVE_REFUSAL);
    // It caught up and stayed where it was, so the next press is made against
    // the game as it now stands - and goes through without losing the contract.
    expect(center.view).toBe('stash');
    expect(center.savedGame.raidProgress.completedContracts).toEqual([FIRST_CONTRACT_ID]);
    write(center);
    expect(center.status).not.toBe(STALE_SAVE_REFUSAL);
    expect(storage.getItem(SAVE_KEY)).not.toBe(banked);
    expect(contractsInStorage(storage)).toEqual([FIRST_CONTRACT_ID]);
  });

  it.each(CENTER_WRITES)('never undoes a wipe taken elsewhere: %s', (_name, write) => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const center = openCenter(storage);
    wipeElsewhere(storage);
    expect(charmanderInStorage(storage)).toBe(false);

    write(center);

    expect(charmanderInStorage(storage)).toBe(false);
    expect(new SaveManager(storage).load()!.stash.itemCount('leftovers')).toBe(0);
    expect(center.stash.listPokemon().some((stored) => stored.id === 'charmander-1')).toBe(false);
  });

  it('writes as it always did while nobody else has touched the save', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const center = openCenter(storage);

    center.addBoxAndShow();
    center.recover(['charmander-1']);

    expect(center.status).not.toBe(STALE_SAVE_REFUSAL);
    const saved = new SaveManager(storage).load()!;
    expect(saved.stash.listBoxes()).toHaveLength(3);
    const charmander = saved.stash.listPokemon().find((stored) => stored.id === 'charmander-1')!;
    expect(charmander.pokemon.currentHp).toBe(charmander.pokemon.maxHp);
  });
});
