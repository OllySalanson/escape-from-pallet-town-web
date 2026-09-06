import { describe, expect, it } from 'vitest';
import { TEST_LAB_STORAGE_KEY, TestLabStore } from './TestLabStore';

class MemoryStorage {
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

describe('TestLabStore', () => {
  it('persists checklist results under a dedicated development key', () => {
    const storage = new MemoryStorage();
    const store = new TestLabStore(storage);

    expect(store.save({ 'first-deployment': { result: 'pass', notes: 'Ready.' } })).toBe(true);
    expect(store.load()).toEqual({ 'first-deployment': { result: 'pass', notes: 'Ready.' } });
    expect(storage.getItem(TEST_LAB_STORAGE_KEY)).not.toBeNull();
  });

  it('rejects malformed persisted records and resets only the lab key', () => {
    const storage = new MemoryStorage();
    storage.setItem(TEST_LAB_STORAGE_KEY, JSON.stringify({ bad: { result: 'unknown', notes: 4 } }));
    const store = new TestLabStore(storage);

    expect(store.load()).toEqual({});
    store.reset();
    expect(storage.getItem(TEST_LAB_STORAGE_KEY)).toBeNull();
  });
});
