import { describe, expect, it } from 'vitest';
import { POKEMON_ICON_ORDER, POKEMON_ICON_SHEET } from '../pokemon/generated/pokemonIcons';
import { MON_ICON_TICKS, monIconCell, monIconPace, pixelItemTile, pixelMonIcon, pixelMonTile, pixelStack } from './monIcon';

describe('a Pokémon on a menu, as FireRed draws it', () => {
  it('flaps at FireRed’s pace for its health, and stands still fainted', () => {
    expect(monIconPace(20, 20)).toBe('full');
    expect(monIconPace(19, 20)).toBe('green');
    // 48 * 10 / 20 = 24 pixels: not above half, so yellow, as GetHPBarLevel has it.
    expect(monIconPace(10, 20)).toBe('yellow');
    // 4 of 20 is 9.6 pixels, 9 in whole numbers: not above 9, so red.
    expect(monIconPace(4, 20)).toBe('red');
    expect(monIconPace(5, 24)).toBe('yellow');
    expect(monIconPace(1, 300)).toBe('red');
    expect(monIconPace(0, 20)).toBe('still');
  });

  it('holds each frame for sMonIconAnims’ ticks: the healthier, the quicker', () => {
    expect(MON_ICON_TICKS).toEqual({ full: 6, green: 8, yellow: 14, red: 22 });
  });

  it('finds every species’ two frames on the sheet', () => {
    expect(monIconCell('bulbasaur')).toEqual({ column: 0, row: 0 });
    expect(monIconCell('ivysaur')).toEqual({ column: 2, row: 0 });
    expect(monIconCell('mew')).toEqual({ column: (150 * 2) % 16, row: Math.floor(300 / 16) });
    for (const species of POKEMON_ICON_ORDER) {
      const cell = monIconCell(species)!;
      // Both frames on one row, so the flap never wraps to the next.
      expect(cell.column + 1).toBeLessThan(POKEMON_ICON_SHEET.columns);
      expect(cell.row).toBeLessThan(POKEMON_ICON_SHEET.rows);
    }
    expect(monIconCell('missingno')).toBeUndefined();
  });

  it('is markup naming the Pokémon, placed on its frame, with its pace', () => {
    const html = pixelMonIcon({ name: 'MANKEY', currentHp: 3, maxHp: 25, base: { id: 'mankey' } });
    expect(html).toContain('aria-label="MANKEY"');
    expect(html).toContain('is-red');
    expect(html).toMatch(/--icon-col:\d+;--icon-row:\d+/);
  });
});

describe('a tile in a grid of things', () => {
  it('is a Pokémon over its level and a short bar, or what presses more', () => {
    const mankey = { name: 'MANKEY', level: 11, currentHp: 25, maxHp: 25, isFainted: false, base: { id: 'mankey' } };
    const tile = pixelMonTile(mankey, { attributes: 'data-fit="m"' });
    expect(tile).toMatch(/^<button class="px-mon-tile" data-fit="m">/);
    expect(tile).toContain('<span class="px-mon-level">11</span>');
    expect(tile).toContain('px-hp is-short');
    // A treatment's price stands where the level would.
    const hurt = pixelMonTile({ ...mankey, currentHp: 3 }, { attributes: '', line: '<span class="px-tag px-tag-risk">−0:45</span>' });
    expect(hurt).toContain('−0:45');
    expect(hurt).not.toContain('px-mon-level');
    expect(pixelMonTile({ ...mankey, currentHp: 0, isFainted: true }, { attributes: '' })).toContain('px-mon-tile is-fainted');
  });

  it('is an item twice its size with how many on its corner, named for a reader', () => {
    const tile = pixelItemTile({ id: 'potion', displayName: 'Potion' }, '×9', 'data-supply="potion"');
    expect(tile).toContain('aria-label="Potion ×9"');
    expect(tile).toContain('<span class="px-item-tile-count">×9</span>');
    expect(tile).toContain('data-supply="potion"');
  });
});

describe('a stack of a thing', () => {
  it('draws one icon a piece, the taken ones lit, and says the rest past ten', () => {
    const potion = { id: 'potion', displayName: 'Potion' };
    const html = pixelStack(potion, 3, 9);
    expect(html.match(/px-stack-one/g)).toHaveLength(9);
    expect(html.match(/px-stack-one is-taken/g)).toHaveLength(3);
    expect(html).toContain('aria-label="3 of 9 Potion"');
    const many = pixelStack(potion, 12, 14);
    expect(many.match(/px-stack-one/g)).toHaveLength(10);
    expect(many.match(/is-taken/g)).toHaveLength(10);
    expect(many).toContain('<small class="px-stack-more">+4</small>');
    expect(pixelStack(potion, 0, 0)).not.toContain('px-stack-one');
  });
});
