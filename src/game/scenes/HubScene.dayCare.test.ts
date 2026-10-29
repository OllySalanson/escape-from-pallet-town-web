import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));

// A move with no room is asked about on the move chooser, a DOM screen; what
// matters here is that it is asked, and about what.
const chooser = vi.hoisted(() => ({ offers: [] as { name: string; move: string }[] }));
vi.mock('../ui/MoveChooserOverlay', () => ({
  openMoveChooser: (_scene: unknown, offer: { pokemon: { base: { name: string } }; incoming: { name: string } }) => {
    chooser.offers.push({ name: offer.pokemon.base.name, move: offer.incoming.name });
  },
}));

import { Bag } from '../items';
import { CHARMANDER, Pokemon, PokemonParty, getSpeciesById } from '../pokemon';
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

interface DayCareHub {
  init(data?: unknown): void;
  overlay: { root: { innerHTML: string } };
  speaking: { readonly words: { readonly lines: readonly string[] } } | undefined;
  leaveAtDayCare(pokemonId: string): void;
  takeBackFromDayCare(): void;
  doneListening(): void;
  render(): void;
}

/** The partner, a Pidgey, and a Charmander one level short of a move it has no room for. */
function seedSave(storage: MemoryStorage): { charmander: string; pidgey: string } {
  const stash = createStartingStash();
  const charmander = stash.addPokemon(new Pokemon(CHARMANDER, 18));
  const pidgey = stash.addPokemon(new Pokemon(getSpeciesById('pidgey')!, 4));
  new SaveManager(storage).save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 0, y: 0 },
    bag: new Bag(),
    stash,
  });
  return { charmander, pidgey };
}

/** Speaking to the Day-Care Man in the yard: his screen, opened on the save as it stands. */
function speakToHim(storage: MemoryStorage): DayCareHub {
  const hub = Object.create(HubScene.prototype) as DayCareHub;
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
      redraw(markup: string) {
        this.root.innerHTML = markup;
      },
    },
  });
  hub.init({ view: 'daycare', at: { x: 33, y: 11 } });
  hub.render();
  return hub;
}

describe('the Day-Care screen', () => {
  beforeEach(() => {
    chooser.offers.length = 0;
  });

  it('asks which Pokémon to raise, and leaving one takes it out of the vault', () => {
    const storage = new MemoryStorage();
    const ids = seedSave(storage);
    const hub = speakToHim(storage);
    expect(hub.overlay.root.innerHTML).toContain('Which Pokémon should I raise?');

    hub.leaveAtDayCare(ids.charmander);

    expect(hub.speaking?.words.lines[0]).toBe('Fine, I’ll look after your Charmander for a while.');
    const saved = new SaveManager(storage).load()!;
    expect(saved.stash.dayCare()?.id).toBe(ids.charmander);
    expect(saved.stash.listPokemon().map((stored) => stored.id)).not.toContain(ids.charmander);
  });

  it('shows how it has grown, and gives it back grown, asking about a move with no room', () => {
    const storage = new MemoryStorage();
    const ids = seedSave(storage);
    speakToHim(storage).leaveAtDayCare(ids.charmander);

    // Two raids go out and come home without it.
    new SaveManager(storage).recordDeployment('pallet-town');
    new SaveManager(storage).recordDeployment('pallet-town');

    const hub = speakToHim(storage);
    expect(hub.overlay.root.innerHTML).toContain('Left at Lv 18 · 2 raids ago');
    expect(hub.overlay.root.innerHTML).toContain('Grown 1 level');
    // The pane shows it as it would come back today; nothing is taken back yet.
    expect(hub.overlay.root.innerHTML).toContain('Lv 19');
    expect(new SaveManager(storage).load()!.stash.dayCare()?.pokemon.level).toBe(18);
    expect(hub.overlay.root.innerHTML).toContain('By level, it’s grown by 1.');

    hub.takeBackFromDayCare();

    const back = new SaveManager(storage)
      .load()!
      .stash.listPokemon()
      .find((stored) => stored.id === ids.charmander)!;
    expect(back.pokemon.level).toBe(19);
    expect(back.pokemon.base.id).toBe('charmander');
    expect(back.pokemon.pendingMoves.map((move) => move.name)).toEqual(['Smokescreen']);
    expect(new SaveManager(storage).load()!.stash.dayCare()).toBeNull();
    expect(hub.speaking?.words.lines).toContain('Charmander is Lv 19 now.');

    // His words first, then the move it reached with no room for it.
    expect(chooser.offers).toEqual([]);
    hub.doneListening();
    expect(chooser.offers).toEqual([{ name: 'Charmander', move: 'Smokescreen' }]);
  });

  it('refuses the only Pokémon at base without writing anything', () => {
    const storage = new MemoryStorage();
    const stash = createStartingStash();
    new SaveManager(storage).save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 0, y: 0 },
      bag: new Bag(),
      stash,
    });
    const before = storage.getItem([...(storage as unknown as { values: Map<string, string> }).values.keys()][0]);
    const hub = speakToHim(storage);

    hub.leaveAtDayCare(stash.partnerId()!);

    expect(hub.speaking).toBeUndefined();
    expect(hub.overlay.root.innerHTML).toContain('Oh? You only have one Pokémon.');
    expect(storage.getItem([...(storage as unknown as { values: Map<string, string> }).values.keys()][0])).toBe(before);
  });
});
