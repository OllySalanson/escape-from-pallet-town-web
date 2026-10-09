import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));

// The move chooser is a DOM screen; what matters is who it is opened for and
// what answer it hands back, so the test records each offer and answers it.
const chooser = vi.hoisted(() => ({
  offers: [] as { name: string; move: string; answer: (choice: unknown) => void }[],
}));
vi.mock('../ui/MoveChooserOverlay', () => ({
  openMoveChooser: (
    _scene: unknown,
    offer: { pokemon: { base: { name: string } }; incoming: { name: string } },
    answer: (choice: unknown) => void,
  ) => {
    chooser.offers.push({ name: offer.pokemon.base.name, move: offer.incoming.name, answer });
  },
}));

import { Bag } from '../items';
import { BULBASAUR, CHARMANDER, FLAMETHROWER, Pokemon, PokemonParty, RAZOR_LEAF } from '../pokemon';
import { createStartingStash } from '../stash';
import { SaveManager, type StorageLike } from '../save/SaveManager';
import { HubScene } from './HubScene';

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

interface HubInternals {
  init(): void;
  offerPendingMoves(): void;
}

let saveNumber = 0;

/** Two Pokemon at base, each with a full moveset and a move waiting to be learned. */
function seedSave(storage: MemoryStorage): { charmander: string; bulbasaur: string } {
  saveNumber += 1;
  const ids = { charmander: `charmander-q${saveNumber}`, bulbasaur: `bulbasaur-q${saveNumber}` };
  const stash = createStartingStash();
  const charmander = new Pokemon(CHARMANDER, 20);
  charmander.pendingMoves.push(FLAMETHROWER);
  const bulbasaur = new Pokemon(BULBASAUR, 20);
  bulbasaur.pendingMoves.push(RAZOR_LEAF);
  stash.addPokemon(charmander, ids.charmander);
  stash.addPokemon(bulbasaur, ids.bulbasaur);
  new SaveManager(storage).save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
  });
  return ids;
}

/** Walking in at a building door: a hub opened on the save as it stands. */
function walkIn(storage: MemoryStorage): HubInternals {
  const hub = Object.create(HubScene.prototype) as HubInternals;
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
  hub.offerPendingMoves();
  return hub;
}

const later = { kind: 'later' };
const lastOffer = () => chooser.offers[chooser.offers.length - 1];

describe('"decide later" on a queued move', () => {
  beforeEach(() => {
    chooser.offers.length = 0;
  });

  it('goes on to the next Pokemon rather than hiding everything queued behind it', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    walkIn(storage);
    expect(chooser.offers.map((offer) => offer.name)).toEqual(['Charmander']);

    lastOffer().answer(later);

    // Playtest 32 #4: Escape on the first Pokemon closed the chooser, and the
    // second was never asked.
    expect(chooser.offers.map((offer) => offer.name)).toEqual(['Charmander', 'Bulbasaur']);
    lastOffer().answer(later);
    expect(chooser.offers).toHaveLength(2);
  });

  it('is not asked again at the next building door', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    walkIn(storage);
    lastOffer().answer(later);
    lastOffer().answer(later);
    chooser.offers.length = 0;

    walkIn(storage);
    walkIn(storage);

    expect(chooser.offers).toEqual([]);
  });

  it('asks again once another raid has gone out, and nothing was learned meanwhile', () => {
    const storage = new MemoryStorage();
    const ids = seedSave(storage);
    walkIn(storage);
    lastOffer().answer(later);
    lastOffer().answer(later);
    chooser.offers.length = 0;

    new SaveManager(storage).recordDeployment('pallet-town');
    walkIn(storage);

    expect(chooser.offers.map((offer) => offer.move)).toEqual(['Flamethrower']);
    const stored = new SaveManager(storage).load()!.stash.listPokemon();
    expect(stored.find((one) => one.id === ids.charmander)!.pokemon.pendingMoves).toHaveLength(1);
    expect(stored.find((one) => one.id === ids.bulbasaur)!.pokemon.pendingMoves).toHaveLength(1);
  });

  it('still asks the next Pokemon after one is answered', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    walkIn(storage);
    lastOffer().answer({ kind: 'decline' });

    expect(chooser.offers.map((offer) => offer.name)).toEqual(['Charmander', 'Bulbasaur']);
  });
});
