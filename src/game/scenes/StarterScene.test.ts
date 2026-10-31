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
      owner: this,
      innerHTML: '',
      querySelector: (selector: string) => ({
        addEventListener: (_event: string, handler: () => void) => this.clicks.set(selector, handler),
      }),
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
  create(data?: { refused?: boolean }): void;
  readonly overlay: {
    root: { innerHTML: string };
    clicks: Map<string, () => void>;
  };
}

function openStarter(storage: StorageLike | null, data?: { refused?: boolean }): { scene: StarterInternals; start: ReturnType<typeof vi.fn> } {
  const start = vi.fn();
  const scene = Object.create(StarterScene.prototype) as StarterInternals;
  Object.assign(scene as unknown as Record<string, unknown>, {
    scene: { start },
    saveManager: new SaveManager(storage),
  });
  scene.create(data);
  return { scene, start };
}

describe('NEW GAME in a browser that cannot save', () => {
  it.each([
    ['no storage at all', null],
    ['storage that refuses every write', new RefusingStorage()],
  ])('says so plainly instead of offering a partner: %s', (_name, storage) => {
    const { scene, start } = openStarter(storage);

    expect(scene.overlay.root.innerHTML).toContain(CANNOT_SAVE_MESSAGE);
    // The one way on is back to the title, never into a game with no save.
    scene.overlay.clicks.get('[data-title]')!();
    expect(start).toHaveBeenCalledWith('title');
    expect(start).not.toHaveBeenCalledWith('base', expect.anything());
  });

  it('says the same when Oak was told YES and the browser would not keep it', () => {
    const { scene, start } = openStarter(new MemoryStorage(), { refused: true });

    expect(scene.overlay.root.innerHTML).toContain(CANNOT_SAVE_MESSAGE);
    expect(start).not.toHaveBeenCalled();
  });
});

describe('NEW GAME in a browser that can', () => {
  it('goes to Oak’s table with nothing written yet', () => {
    const storage = new MemoryStorage();
    const { start } = openStarter(storage);

    expect(start).toHaveBeenCalledTimes(1);
    const [key, data] = start.mock.calls[0] as [string, { room: string; choosing: boolean; savedGame: { stash: { listPokemon(): unknown[] } } }];
    expect(key).toBe('base');
    expect(data.room).toBe('oaks-lab');
    expect(data.choosing).toBe(true);
    // The room stands on a game nobody holds, so closing the tab here costs nothing.
    expect(data.savedGame.stash.listPokemon()).toEqual([]);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
});
