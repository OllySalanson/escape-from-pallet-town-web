import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { bagFocusPreference, firstMatching } from './menuFocus';

/**
 * A stand-in for `root.querySelector` over a menu whose controls are listed in
 * document order, which is the property the fault turned on: a selector list
 * matches the earliest element in the document, not the earliest selector.
 */
function menu(controlsInDocumentOrder: readonly string[]): (selector: string) => string | null {
  return (selector) => {
    const wanted = selector.split(',').map((part) => part.trim());
    return controlsInDocumentOrder.find((control) => wanted.includes(control)) ?? null;
  };
}

const BAG_CHOOSING = ['[data-close]', '[data-item]', '[data-target]'];

describe('menu focus', () => {
  it('reproduces playtest 3 B4: a selector list lands on the back button', () => {
    expect(menu(BAG_CHOOSING)('[data-item], [data-close]')).toBe('[data-close]');
  });

  it('tries a preference one selector at a time, so document order cannot outvote it', () => {
    expect(firstMatching(menu(BAG_CHOOSING), ['[data-target]', '[data-close]'])).toBe('[data-target]');
    expect(firstMatching(menu(['[data-close]']), ['[data-target]', '[data-close]'])).toBe('[data-close]');
    expect(firstMatching(menu([]), ['[data-target]'])).toBeNull();
  });

  it('puts the keyboard on the first recipient after "Use item"', () => {
    const preference = bagFocusPreference({ choosingPokemon: true });
    expect(firstMatching(menu(BAG_CHOOSING), preference)).toBe('[data-target]');
  });

  it('only ever offers the back button as a last resort', () => {
    for (const choosingPokemon of [true, false]) {
      const preference = bagFocusPreference({ choosingPokemon });
      expect(preference.indexOf('[data-close]')).toBe(preference.length - 1);
    }
  });

  it('is what the in-raid overlays actually focus through', async () => {
    const overlay = await readFile(new URL('./MenuOverlay.ts', import.meta.url), 'utf8');
    expect(overlay).toContain('firstMatching(');
    for (const scene of ['BagScene', 'PartyScene']) {
      const source = await readFile(new URL(`../scenes/${scene}.ts`, import.meta.url), 'utf8');
      // A comma inside one focus selector is the fault coming back.
      expect(source).not.toMatch(/\.(?:re)?focus\('[^']*,[^']*'\)/);
    }
  });
});
