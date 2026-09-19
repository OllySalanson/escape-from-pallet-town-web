import { describe, expect, it } from 'vitest';
import { BASE_SECURE_GRID, stackSizeOf } from '../items';
import {
  autofillSecureSlot,
  DEFAULT_SECURE_PREFERENCE,
  readSecurePreference,
  type SecureCandidate,
} from './secureAutofill';

const pidgey = (id: string, level: number): SecureCandidate => ({
  id,
  level,
  cargo: { cargoId: id, name: 'Pidgey', width: 2, height: 2 },
});

const ivysaur = (id: string, level: number): SecureCandidate => ({
  id,
  level,
  cargo: { cargoId: id, name: 'Ivysaur', width: 3, height: 2 },
});

const GROWN = { width: 4, height: 2 };
const held = (): number => 9;

describe('what the secure container fills itself with', () => {
  /**
   * The captain's addition, 2026-09-19: Pokemon first, ordered by level, so
   * nobody deploys with their best unprotected because they forgot a screen.
   */
  it('leads with the highest-level Pokemon', () => {
    const fill = autofillSecureSlot(
      [pidgey('low', 4), pidgey('high', 18), pidgey('middle', 9)],
      DEFAULT_SECURE_PREFERENCE,
      BASE_SECURE_GRID,
      1,
      held,
    );
    expect(fill.pokemonIds).toEqual(['high']);
    // Four squares of four: nothing else goes in with it.
    expect(fill.items).toEqual([]);
  });

  it('fills every slot the container has room for, in level order', () => {
    const fill = autofillSecureSlot(
      [pidgey('a', 4), pidgey('b', 18), pidgey('c', 9)],
      DEFAULT_SECURE_PREFERENCE,
      GROWN,
      2,
      held,
    );
    expect(fill.pokemonIds).toEqual(['b', 'c']);
  });

  /**
   * Sorted by level, not by size, so one that will not fit must not stand in
   * front of one that would.
   */
  it('steps past a Pokemon too big for the container rather than stopping at it', () => {
    const fill = autofillSecureSlot(
      [ivysaur('big', 20), pidgey('small', 6)],
      DEFAULT_SECURE_PREFERENCE,
      BASE_SECURE_GRID,
      1,
      held,
    );
    expect(fill.pokemonIds).toEqual(['small']);
  });

  it('never lets a remembered supply keep a Pokemon out', () => {
    const fill = autofillSecureSlot(
      [pidgey('best', 12)],
      { pokemon: true, items: [{ itemId: 'potion', quantity: 4 }] },
      BASE_SECURE_GRID,
      1,
      held,
    );
    expect(fill.pokemonIds).toEqual(['best']);
    expect(fill.items).toEqual([]);
  });

  it('keeps what the remembered supply still has room for, a square at a time', () => {
    const fill = autofillSecureSlot(
      [pidgey('best', 12)],
      { pokemon: true, items: [{ itemId: 'potion', quantity: 6 }] },
      GROWN,
      1,
      held,
    );
    expect(fill.pokemonIds).toEqual(['best']);
    // Eight squares less the Pokemon's four: four of the six Potions.
    expect(fill.items).toEqual([{ itemId: 'potion', quantity: 4 }]);
  });

  it('remembers a container the player chose to fill with gear instead', () => {
    const fill = autofillSecureSlot(
      [pidgey('best', 12)],
      { pokemon: false, items: [{ itemId: 'potion', quantity: 3 }] },
      BASE_SECURE_GRID,
      1,
      held,
    );
    expect(fill.pokemonIds).toEqual([]);
    expect(fill.items).toEqual([{ itemId: 'potion', quantity: 3 }]);
  });

  it('caps a remembered supply at what the loadout actually packed', () => {
    const fill = autofillSecureSlot(
      [],
      { pokemon: true, items: [{ itemId: 'potion', quantity: 4 }] },
      BASE_SECURE_GRID,
      1,
      () => 1,
    );
    expect(fill.items).toEqual([{ itemId: 'potion', quantity: 1 }]);
  });

  it('reserves whole squares of a stacked kind, never one note of it', () => {
    const fill = autofillSecureSlot(
      [],
      { pokemon: true, items: [{ itemId: 'scrip', quantity: stackSizeOf('scrip') * 2 }] },
      BASE_SECURE_GRID,
      1,
      held,
    );
    expect(fill.items).toEqual([{ itemId: 'scrip', quantity: stackSizeOf('scrip') * 2 }]);
  });
});

describe('a stored container preference', () => {
  it('reads a save written before it existed as the default', () => {
    expect(readSecurePreference(undefined)).toEqual(DEFAULT_SECURE_PREFERENCE);
    expect(readSecurePreference(null)).toEqual(DEFAULT_SECURE_PREFERENCE);
    expect(readSecurePreference('lead with the Pokemon')).toEqual(DEFAULT_SECURE_PREFERENCE);
  });

  it('keeps only entries it can act on', () => {
    expect(
      readSecurePreference({
        pokemon: false,
        items: [
          { itemId: 'potion', quantity: 2 },
          { itemId: 'potion', quantity: 0 },
          { itemId: 7, quantity: 2 },
          'nonsense',
        ],
      }),
    ).toEqual({ pokemon: false, items: [{ itemId: 'potion', quantity: 2 }] });
  });
});
