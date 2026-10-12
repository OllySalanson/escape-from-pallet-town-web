import { describe, expect, it } from 'vitest';
import {
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_STORAGE_KEY,
  loadPlayerName,
  savePlayerName,
} from '../console/playerName';
import {
  HOUSE_NAME_HINTS,
  YOUR_NAME_TITLE,
  houseNameCountLine,
  houseNameMarkup,
  houseNameNeeded,
  houseNameProblemLine,
  welcomeHomeLines,
} from './houseName';

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

  it("is the console's own name: given at the door, the console has it, and the other way about", () => {
    const store = memoryStore();
    expect(houseNameNeeded(loadPlayerName(store))).toBe(true);
    savePlayerName('ASH', store);
    expect(store.getItem(PLAYER_NAME_STORAGE_KEY)).toBe('ASH');
    // The console reads the same key, so it never asks somebody the door has named.
    expect(loadPlayerName(store)).toBe('ASH');
    expect(houseNameNeeded(loadPlayerName(store))).toBe(false);
  });

  it("asks in FireRed's words, with one line of ten letters, OK and a way back out", () => {
    const markup = houseNameMarkup({ value: '' });
    expect(YOUR_NAME_TITLE).toBe('YOUR NAME?');
    expect(markup).toContain(YOUR_NAME_TITLE);
    expect(markup).toContain('THE BOLTHOLE');
    expect(markup).toContain(`maxlength="${PLAYER_NAME_MAX_LENGTH}"`);
    expect(markup).toContain('data-house-name-ok');
    expect(markup).toContain('data-house-name-leave');
    expect(markup).toContain(HOUSE_NAME_HINTS);
    expect(markup).toContain(houseNameCountLine(''));
  });

  it("keeps a name's apostrophe inside the field it is written back into", () => {
    const markup = houseNameMarkup({ value: "O'NEIL" });
    expect(markup).toContain('value="O\'NEIL"');
  });

  it('counts the letters used and says why a name was not taken', () => {
    expect(houseNameCountLine('OLLY')).toBe(`4 of ${PLAYER_NAME_MAX_LENGTH} letters`);
    expect(houseNameProblemLine('empty')).toMatch(/Type a name first/);
    expect(houseNameProblemLine('unkind')).toMatch(/pick another/);
  });

  it('welcomes the player home by the name given', () => {
    expect(welcomeHomeLines('OLLY')[0]).toBe('Welcome home, OLLY!');
  });
});
