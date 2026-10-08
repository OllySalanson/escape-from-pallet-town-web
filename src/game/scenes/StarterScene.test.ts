import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: { Scene: class {} },
}));

// The screen is DOM; what matters here is what it says and where its one
// button goes, so the overlay is a root that keeps its markup and its clicks.
vi.mock('../ui/MenuOverlay', () => ({
  MenuOverlay: class {
    public readonly clicks = new Map<string, () => void>();
    public readonly root = {
      innerHTML: '',
      querySelector: (selector: string) => ({
        addEventListener: (_event: string, handler: () => void) => this.clicks.set(selector, handler),
      }),
      querySelectorAll: () => [],
    };
    public focus(): void {}
  },
}));

import { SAVE_KEY, SaveManager, type StorageLike } from '../save/SaveManager';
import { CANNOT_SAVE_MESSAGE, StarterScene } from './StarterScene';

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

/** Storage that reads but refuses every write, as a browser with site data blocked or full does. */
class RefusingStorage extends MemoryStorage {
  public override setItem(): void {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  }
}

interface StarterInternals {
  create(): void;
  confirmStarter(): void;
  readonly overlay: { root: { innerHTML: string }; clicks: Map<string, () => void> };
}

function openStarter(storage: StorageLike | null): { scene: StarterInternals; start: ReturnType<typeof vi.fn> } {
  const start = vi.fn();
  const scene = Object.create(StarterScene.prototype) as StarterInternals;
  Object.assign(scene as unknown as Record<string, unknown>, {
    scene: { start },
    saveManager: new SaveManager(storage),
    selectedStarterId: 'bulbasaur',
  });
  scene.create();
  return { scene, start };
}

describe('NEW GAME in a browser that cannot save', () => {
  it.each([
    ['no storage at all', null],
    ['storage that refuses every write', new RefusingStorage()],
  ])('says so plainly instead of offering a partner: %s', (_name, storage) => {
    const { scene, start } = openStarter(storage);

    expect(scene.overlay.root.innerHTML).toContain(CANNOT_SAVE_MESSAGE);
    expect(scene.overlay.root.innerHTML).not.toContain('data-starter=');
    // The one way on is back to the title, never into a game with no save.
    scene.overlay.clicks.get('[data-title]')!();
    expect(start).toHaveBeenCalledWith('title');
    expect(start).not.toHaveBeenCalledWith('base', expect.anything());
  });

  it('never starts the base on a game it could not write', () => {
    // Storage that let the probe through and then refused the game itself -
    // the base used to be started on the unsaved game and read a save that
    // was not there, which is the black screen.
    const storage = new MemoryStorage();
    const { scene, start } = openStarter(storage);
    expect(scene.overlay.root.innerHTML).toContain('data-starter=');
    storage.setItem = (key: string, value: string) => {
      if (key === SAVE_KEY) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      MemoryStorage.prototype.setItem.call(storage, key, value);
    };

    scene.confirmStarter();

    expect(start).not.toHaveBeenCalled();
    expect(scene.overlay.root.innerHTML).toContain(CANNOT_SAVE_MESSAGE);
  });

  it('starts the game on its saved copy where the browser can save', () => {
    const storage = new MemoryStorage();
    const { scene, start } = openStarter(storage);

    scene.confirmStarter();

    expect(start).toHaveBeenCalledTimes(1);
    const [key, data] = start.mock.calls[0] as [string, { savedGame: { raidProgress?: unknown } }];
    expect(key).toBe('base');
    // The game the base reads is the saved one, whole - never the unsaved draft.
    expect(data.savedGame.raidProgress).toBeDefined();
    expect(new SaveManager(storage).load()?.starterSpeciesId).toBe('bulbasaur');
  });
});
