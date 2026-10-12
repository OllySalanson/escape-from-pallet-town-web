import { describe, expect, it } from 'vitest';
import { PLAYER_NAME_STORAGE_KEY, loadPlayerName, savePlayerName } from '../console/playerName';
import { houseNameNeeded, welcomeHomeLines } from './houseName';

/** A device's storage, as far as a name needs one. */
function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> {
  const kept = new Map<string, string>();
  return {
    getItem: (key) => kept.get(key) ?? null,
    setItem: (key, value) => void kept.set(key, value),
  };
}

describe("THE BOLTHOLE's name", () => {
  it('is asked only while the device has no name', () => {
    expect(houseNameNeeded(null)).toBe(true);
    expect(houseNameNeeded('OLLY')).toBe(false);
  });

  it("is the console's own name: given anywhere, the console has it, and the other way about", () => {
    const store = memoryStore();
    expect(houseNameNeeded(loadPlayerName(store))).toBe(true);
    savePlayerName('ASH', store);
    expect(store.getItem(PLAYER_NAME_STORAGE_KEY)).toBe('ASH');
    expect(loadPlayerName(store)).toBe('ASH');
    expect(houseNameNeeded(loadPlayerName(store))).toBe(false);
  });

  it('reads no name kept before names started again', () => {
    const store = memoryStore();
    store.setItem('escape-from-pallet-town.console.name', 'OLDNAME');
    expect(loadPlayerName(store)).toBeNull();
  });

  it('welcomes the player home by the name given', () => {
    expect(welcomeHomeLines('OLLY')[0]).toBe('Welcome home, OLLY!');
  });
});
