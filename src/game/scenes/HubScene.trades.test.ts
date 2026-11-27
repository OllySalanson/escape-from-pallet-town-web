import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));

import { Bag } from '../items';
import { Pokemon, PokemonParty, getSpeciesById } from '../pokemon';
import { createStartingStash } from '../stash';
import { SaveManager, type StorageLike } from '../save/SaveManager';
import { TRADER_POSITION } from '../base/harbourLife';
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

interface TradesHub {
  init(data?: unknown): void;
  overlay: { root: { innerHTML: string } };
  scene: { start: ReturnType<typeof vi.fn> };
  tradeArmed: string | undefined;
  makeTrade(pokemonId: string): void;
  render(): void;
}

/** The partner, an Abra, a Kadabra and a Pidgey. */
function seedSave(storage: MemoryStorage): { abra: string; kadabra: string; pidgey: string } {
  const stash = createStartingStash();
  const abra = stash.addPokemon(new Pokemon(getSpeciesById('abra')!, 9));
  const kadabra = stash.addPokemon(new Pokemon(getSpeciesById('kadabra')!, 20));
  const pidgey = stash.addPokemon(new Pokemon(getSpeciesById('pidgey')!, 4));
  new SaveManager(storage).save({ party: new PokemonParty(), mapId: 'greystone-vale', position: { x: 0, y: 0 }, bag: new Bag(), stash });
  return { abra, kadabra, pidgey };
}

/** Speaking to THE TRADER on the lawn: his list, opened on the save as it stands. */
function speakToHim(storage: MemoryStorage): TradesHub {
  const hub = Object.create(HubScene.prototype) as TradesHub;
  Object.assign(hub as unknown as Record<string, unknown>, {
    cameras: { main: { fadeIn: vi.fn(), fadeOut: vi.fn(), once: vi.fn() } },
    scene: { start: vi.fn() },
    saveManager: new SaveManager(storage),
    counterCounts: new Map<string, number>(),
    time: { delayedCall: vi.fn(), now: 0 },
    overlay: {
      root: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [], classList: { toggle: () => false } },
      focus: vi.fn(),
      refocus: vi.fn(),
      redraw(markup: string) {
        this.root.innerHTML = markup;
      },
    },
  });
  hub.init({ view: 'trades', at: { x: 14, y: 10 } });
  hub.render();
  return hub;
}

describe('THE TRADER’s list', () => {
  it('lists what he would trade first, saying what each comes back as, and why not for the rest', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const html = speakToHim(storage).overlay.root.innerHTML;
    expect(html).toContain('Who goes?');
    // What comes back is shown, standing opposite: his MIMIEN, and one sent over and back, grown.
    expect(html).toContain('<p class="tr-name">MIMIEN</p>');
    expect(html).toContain('grown</p>');
    expect(html).toContain('He has no trade for a PIDGEY.');
    // The two he would take come before the one he would not.
    expect(html.indexOf('data-trade=')).toBeLessThan(html.indexOf('He has no trade for a PIDGEY.'));
  });

  it('asks before a trade is made, and makes nothing until it is answered', () => {
    const storage = new MemoryStorage();
    const ids = seedSave(storage);
    const hub = speakToHim(storage);
    hub.tradeArmed = ids.abra;
    hub.render();

    expect(hub.overlay.root.innerHTML).toContain('Trade ABRA for MIMIEN the MR. MIME? ABRA will not come back.');
    expect(new SaveManager(storage).load()!.stash.listPokemon().some((stored) => stored.id === ids.abra)).toBe(true);
  });

  it('puts the cursor on KEEP IT once a trade is asked, not on the chip that asked', () => {
    // The chip stays on the card, scrolled under its MORE; a keyboard player's
    // second press asked again instead of reaching the bar (scenario loop, 23 Nov 2026).
    const storage = new MemoryStorage();
    const ids = seedSave(storage);
    const hub = speakToHim(storage);
    const chip: { dataset: Record<string, string>; onclick?: (event: { detail: number }) => void } = { dataset: { trade: ids.kadabra } };
    const overlay = hub.overlay as unknown as { root: { querySelectorAll(selector: string): unknown[] }; focus: ReturnType<typeof vi.fn> };
    overlay.root.querySelectorAll = (selector: string) => (selector === '[data-trade]' ? [chip] : []);
    hub.render();
    chip.onclick!({ detail: 0 });
    expect(hub.tradeArmed).toBe(ids.kadabra);
    expect(overlay.focus).toHaveBeenLastCalledWith('[data-deal-cancel]');
  });

  it('makes the trade in one write and says so back on the lawn, by him', () => {
    const storage = new MemoryStorage();
    const ids = seedSave(storage);
    const hub = speakToHim(storage);

    hub.makeTrade(ids.kadabra);

    expect(hub.scene.start).toHaveBeenCalledWith(
      'base',
      expect.objectContaining({
        at: { x: 14, y: 10 },
        saidBy: TRADER_POSITION,
        said: expect.arrayContaining(['Congratulations! Your KADABRA evolved into ALAKAZAM!']) as unknown,
      }),
    );
    const kadabra = new SaveManager(storage).load()!.stash.listPokemon().find((stored) => stored.id === ids.kadabra)!;
    expect(kadabra.pokemon.base.id).toBe('alakazam');
  });
});
