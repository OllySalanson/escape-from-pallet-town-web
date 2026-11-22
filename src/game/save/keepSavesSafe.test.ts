import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepSavesSafe, saveWritten } from './keepSavesSafe';
import { SaveManager, type StorageLike } from './SaveManager';
import { gameBeforeChoosing } from './newGame';

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

const browser = (persisted = false) => ({
  persisted: vi.fn(() => Promise.resolve(persisted)),
  persist: vi.fn(() => Promise.resolve(true)),
});

afterEach(() => void keepSavesSafe(undefined, false));

describe('keeping the save safe', () => {
  it('asks nothing until a save is written, then asks once', async () => {
    const storage = browser();
    void keepSavesSafe(storage, false);
    expect(storage.persist).not.toHaveBeenCalled();

    await saveWritten();
    await saveWritten();
    expect(storage.persist).toHaveBeenCalledTimes(1);
  });

  it('asks at once when a game is already saved, and not again on the next write', async () => {
    const storage = browser();
    await keepSavesSafe(storage, true);
    expect(storage.persist).toHaveBeenCalledTimes(1);
    await saveWritten();
    expect(storage.persist).toHaveBeenCalledTimes(1);
  });

  it('does not ask a browser that already keeps it', async () => {
    const storage = browser(true);
    await keepSavesSafe(storage, true);
    expect(storage.persisted).toHaveBeenCalledTimes(1);
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('shrugs off a browser without the request, or one that throws', async () => {
    void keepSavesSafe({}, false);
    await expect(saveWritten()).resolves.toBeUndefined();
    void keepSavesSafe({ persist: () => Promise.reject(new Error('no')) }, false);
    await expect(saveWritten()).resolves.toBeUndefined();
  });

  it('is asked by a save that lands, and not by one that is refused', async () => {
    const storage = browser();
    void keepSavesSafe(storage, false);
    const refusing: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    };
    const game = gameBeforeChoosing();
    expect(new SaveManager(refusing).save(game)).toBe(false);
    await Promise.resolve();
    expect(storage.persisted).not.toHaveBeenCalled();

    expect(new SaveManager(new MemoryStorage()).save(game)).toBe(true);
    await vi.waitFor(() => expect(storage.persist).toHaveBeenCalledTimes(1));
  });
});
