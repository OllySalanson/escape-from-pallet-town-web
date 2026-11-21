import { describe, expect, it } from 'vitest';
import { PLAYER_NAME_MAX_LENGTH, PLAYER_NAME_STORAGE_KEY, loadPlayerName, savePlayerName } from '../console/playerName';
import { BASE_DOORS } from '../base/doors';
import { HOUSE_NAME, houseTitle } from './houseName';

/** A device's storage, as far as a name needs one. */
function memoryStore(): Pick<Storage, 'getItem' | 'setItem'> {
  const kept = new Map<string, string>();
  return {
    getItem: (key) => kept.get(key) ?? null,
    setItem: (key, value) => void kept.set(key, value),
  };
}

describe("THE BOLTHOLE's name", () => {
  it("carries the player's name over its door, with nothing to do to give it one", () => {
    expect(houseTitle('OLLY')).toBe('OLLY’S BOLTHOLE');
  });

  it('is THE BOLTHOLE until there is a name, which is what its door is called', () => {
    expect(houseTitle(null)).toBe(HOUSE_NAME);
    expect(BASE_DOORS.find((door) => door.id === 'bolthole')?.name).toBe(HOUSE_NAME);
  });

  it('fits the longest name a player can have', () => {
    expect(houseTitle('W'.repeat(PLAYER_NAME_MAX_LENGTH)).length).toBeLessThanOrEqual(24);
  });

  it("is the console's own name: given anywhere, the house has it, and the other way about", () => {
    const store = memoryStore();
    expect(houseTitle(loadPlayerName(store))).toBe(HOUSE_NAME);
    savePlayerName('ASH', store);
    expect(store.getItem(PLAYER_NAME_STORAGE_KEY)).toBe('ASH');
    expect(houseTitle(loadPlayerName(store))).toBe('ASH’S BOLTHOLE');
  });

  it('keeps a name an existing player already chose', () => {
    const store = memoryStore();
    store.setItem(PLAYER_NAME_STORAGE_KEY, 'MISTY');
    expect(houseTitle(loadPlayerName(store))).toBe('MISTY’S BOLTHOLE');
  });

  it('reads no name kept before names started again', () => {
    const store = memoryStore();
    store.setItem('escape-from-pallet-town.console.name', 'OLDNAME');
    expect(loadPlayerName(store)).toBeNull();
  });
});
