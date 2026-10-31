import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } },
}));

import { sameLook, wearing } from '../look/look';
import { DEFAULT_RAID_PROGRESS, SaveManager, type StorageLike } from '../save/SaveManager';
import { PokemonParty } from '../pokemon';
import { Bag } from '../items';
import { createStartingStash } from '../stash';
import { BoutiqueScene } from './BoutiqueScene';

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

interface BoutiqueInternals {
  tryOnCard(look: unknown, card: string, event: { detail: number }): void;
  buy(): void;
  crossToOrFromBar(key: string): boolean;
  cursorOn(target: unknown): void;
  trying: unknown;
  lastCard: string | null;
  triedOnAt: number;
}

/** The scene's real keys, on a screen that only remembers where the cursor was sent. */
function shop() {
  const manager = new SaveManager(new MemoryStorage());
  const stash = createStartingStash();
  stash.addItem('money', 500);
  manager.save({ party: new PokemonParty(), mapId: 'pallet-town', position: { x: 0, y: 0 }, bag: new Bag(), stash, raidProgress: DEFAULT_RAID_PROGRESS });
  const focused: string[] = [];
  const sent: string[][] = [];
  const found = new Map<string, { focus: () => void }>();
  const overlay = {
    focus: (...selectors: string[]) => sent.push(selectors),
    root: {
      querySelector: (selector: string) => {
        const element = found.get(selector) ?? { focus: () => focused.push(selector) };
        found.set(selector, element);
        return element;
      },
    },
  };
  const scene = Object.create(BoutiqueScene.prototype) as BoutiqueInternals & Record<string, unknown>;
  Object.assign(scene, {
    overlay,
    saveManager: manager,
    game_: manager.load()!,
    trying: null,
    lastCard: null,
    triedOnAt: Number.NEGATIVE_INFINITY,
    mode: 'shop',
    render: vi.fn(),
    sheet: () => '',
  });
  return { scene, sent, focused, manager };
}

const hat = wearing(null, 'youngster-cap');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the way to BUY at THE HARBOUR BOUTIQUE', () => {
  it('is one press by the keys: ENTER on a card tries it on and goes to the bar', () => {
    const { scene, sent } = shop();

    scene.tryOnCard(hat, '[data-wear="youngster-cap"]', { detail: 0 });

    expect(sameLook(scene.trying as never, hat)).toBe(true);
    // BUY if it is for sale, WEAR if it is owned, and the card back if there is nothing to do.
    expect(sent).toEqual([['[data-buy]', '[data-wear-it]:not([aria-disabled="true"])', '[data-wear="youngster-cap"]']]);
  });

  it('leaves a mouse where it is: it can reach the bar for itself', () => {
    const { scene, sent } = shop();

    scene.tryOnCard(hat, '[data-wear="youngster-cap"]', { detail: 1 });

    expect(sent).toEqual([]);
  });

  it('never spends on the second press of a double-tap, and does on a press after it', () => {
    const { scene, manager } = shop();
    scene.tryOnCard(hat, '[data-wear="youngster-cap"]', { detail: 0 });

    scene.buy();
    expect(manager.load()?.raidProgress.wardrobe ?? []).not.toContain('youngster-cap');

    scene.triedOnAt = Number.NEGATIVE_INFINITY;
    scene.buy();
    expect(manager.load()?.raidProgress.wardrobe).toContain('youngster-cap');
  });

  it('comes back with Up or Tab to the card it left, and Tab goes across from the shelves', () => {
    const { scene, focused } = shop();
    const card = { dataset: { wear: 'youngster-cap' }, hasAttribute: () => false };
    vi.stubGlobal('HTMLElement', Object);
    scene.cursorOn(card);
    expect(scene.lastCard).toBe('[data-wear="youngster-cap"]');

    vi.stubGlobal('Element', Object);
    vi.stubGlobal('document', { activeElement: { matches: () => true } });
    expect(scene.crossToOrFromBar('ArrowUp')).toBe(true);
    expect(scene.crossToOrFromBar('Tab')).toBe(true);
    expect(focused).toEqual(['[data-wear="youngster-cap"]', '[data-wear="youngster-cap"]']);

    focused.length = 0;
    vi.stubGlobal('document', { activeElement: { matches: () => false } });
    // Up on the shelves is the shelves' own.
    expect(scene.crossToOrFromBar('ArrowUp')).toBe(false);
    expect(scene.crossToOrFromBar('Tab')).toBe(true);
    expect(focused[0]).toContain('[data-buy]');
  });
});
