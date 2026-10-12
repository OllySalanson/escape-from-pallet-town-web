import { describe, expect, it } from 'vitest';
import {
  checkPlayerName,
  cleanPlayerName,
  loadPlayerName,
  PLAYER_NAME_MAX_LENGTH,
  PLAYER_NAME_STORAGE_KEY,
  savePlayerName,
  typedPlayerName,
} from './playerName';

function memoryStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe('the name a player types at the console', () => {
  it('keeps only what the pixel font draws and the games accept, in capitals', () => {
    expect(typedPlayerName('olly')).toBe('OLLY');
    expect(typedPlayerName('Ash K.')).toBe('ASH K.');
    expect(typedPlayerName("o'neil-2!?")).toBe("O'NEIL-2!?");
    // Markup, accents, emoji and anything the face has no glyph for are dropped.
    expect(typedPlayerName('<b>Zoë</b> 😀 & "x"')).toBe('BZOB X');
  });

  it('holds a name to ten characters, the games\' own limit', () => {
    expect(PLAYER_NAME_MAX_LENGTH).toBe(10);
    expect(typedPlayerName('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJ');
  });

  it('never lets spaces pile up, and trims them from a finished name', () => {
    expect(typedPlayerName('  RED    BLUE ')).toBe('RED BLUE ');
    expect(cleanPlayerName('  RED    BLUE ')).toBe('RED BLUE');
  });

  it('refuses an empty name and a rude one, and says which', () => {
    expect(checkPlayerName('   ')).toEqual({ ok: false, problem: 'empty' });
    expect(checkPlayerName('<>')).toEqual({ ok: false, problem: 'empty' });
    expect(checkPlayerName('SH1T')).toEqual({ ok: false, problem: 'unkind' });
    expect(checkPlayerName('fuuuck')).toEqual({ ok: false, problem: 'unkind' });
    expect(checkPlayerName('B4STARD')).toEqual({ ok: false, problem: 'unkind' });
  });

  it('lets a clean name through as it will be shown, Scunthorpe included', () => {
    expect(checkPlayerName(' gary oak ')).toEqual({ ok: true, name: 'GARY OAK' });
    expect(checkPlayerName('scunthorpe')).toEqual({ ok: true, name: 'SCUNTHORPE' });
  });

  it('is kept on this device and read back, and a stored name the rules refuse is asked for again', () => {
    const store = memoryStore();
    expect(loadPlayerName(store)).toBeNull();
    savePlayerName('MISTY', store);
    expect(store.values.get(PLAYER_NAME_STORAGE_KEY)).toBe('MISTY');
    expect(loadPlayerName(store)).toBe('MISTY');
    expect(loadPlayerName(memoryStore({ [PLAYER_NAME_STORAGE_KEY]: 'twat' }))).toBeNull();
    expect(loadPlayerName(memoryStore({ [PLAYER_NAME_STORAGE_KEY]: 'lower' }))).toBeNull();
  });

  it('copes with a browser that refuses storage', () => {
    const refusing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadPlayerName(refusing)).toBeNull();
    expect(() => savePlayerName('ASH', refusing)).not.toThrow();
    expect(loadPlayerName(undefined)).toBeNull();
  });
});
