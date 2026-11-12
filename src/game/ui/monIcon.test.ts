import { describe, expect, it } from 'vitest';
import { POKEMON_ICON_ORDER, POKEMON_ICON_SHEET } from '../pokemon/generated/pokemonIcons';
import { MON_ICON_TICKS, monIconCell, monIconPace, pixelMonIcon } from './monIcon';

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
