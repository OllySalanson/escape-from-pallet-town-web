import { describe, expect, it } from 'vitest';
import { getItemById } from '../items';
import { HOVER_HELP_DELAY_MS, hoverHelpMarkup, hoverHelpPlacement, hoverHelpWords } from './itemHoverHelp';

const SCREEN = { left: 0, top: 0, right: 640, bottom: 480 };
const TIP = { width: 200, height: 40 };

describe('what an item does, once the pointer rests on it (the captain, 2026-10-29)', () => {
  it('waits well under a second, not the two or three a tooltip reads as nothing happening in', () => {
    expect(HOVER_HELP_DELAY_MS).toBeGreaterThanOrEqual(600);
    expect(HOVER_HELP_DELAY_MS).toBeLessThanOrEqual(800);
  });

  it('says the catalogue’s own name and description', () => {
    const potion = getItemById('potion')!;
    expect(hoverHelpWords('item:potion')).toEqual({ name: potion.displayName, what: potion.description });
    expect(hoverHelpMarkup(hoverHelpWords('item:potion')!)).toContain(potion.description);
    // A Pokémon in the pack, or nothing at all, has no item box.
    expect(hoverHelpWords('cargo:bulbasaur-1')).toBeNull();
    expect(hoverHelpWords(undefined)).toBeNull();
    expect(hoverHelpWords('item:no-such-thing')).toBeNull();
  });

  it('stands below the item, never over it', () => {
    const anchor = { left: 100, top: 100, right: 300, bottom: 120 };
    expect(hoverHelpPlacement(anchor, TIP, SCREEN, 4)).toEqual({ left: 100, top: 124 });
  });

  it('stands above when there is no room below', () => {
    const anchor = { left: 100, top: 450, right: 300, bottom: 470 };
    const place = hoverHelpPlacement(anchor, TIP, SCREEN, 4);
    expect(place.top).toBe(406);
    expect(place.top + TIP.height).toBeLessThanOrEqual(anchor.top);
  });

  it('is slid back inside the screen at its edges', () => {
    const anchor = { left: 600, top: 100, right: 630, bottom: 120 };
    expect(hoverHelpPlacement(anchor, TIP, SCREEN, 4).left).toBe(440);
    const off = { left: -20, top: 100, right: 10, bottom: 120 };
    expect(hoverHelpPlacement(off, TIP, SCREEN, 4).left).toBe(0);
  });
});
