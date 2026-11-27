import { describe, expect, it } from 'vitest';
import type { PickerBasics } from './boxPicker';
import { lineUpWindowClass, pickerLineUp, pickerRowIcon } from './pickerLineUp';

/**
 * A cabinet's screen was a list and nothing else, 86% of it plain white (the
 * stock-take of 27 Nov 2026, `docs/screens/wood-floor/`). The ones chosen now
 * stand over the list they were chosen from.
 */
const basics = (name: string, dexId: number, more: Partial<PickerBasics> = {}): PickerBasics => ({ id: name.toLowerCase(), name, dexId, shiny: false, level: 9, find: name, ...more });
const PIKACHU = basics('Pikachu', 25);
const SQUIRTLE = basics('Squirtle', 7);

describe("a cabinet's line-up", () => {
  const jump = { places: 3, doing: 'jumping' };

  it('stands everyone chosen by their own picture, in the order they were chosen, and keeps a place for each still free', () => {
    const markup = pickerLineUp([SQUIRTLE, PIKACHU], jump);

    const squirtle = markup.indexOf('/assets/pokemon/front/7.png');
    const pikachu = markup.indexOf('/assets/pokemon/front/25.png');
    expect(squirtle).toBeGreaterThan(-1);
    expect(pikachu).toBeGreaterThan(squirtle);
    expect(markup.match(/class="lineup-place is-free"/g)).toHaveLength(1);
    expect(markup.match(/class="lineup-place"/g)).toHaveLength(2);
    // Said for a reader who cannot see the line.
    expect(markup).toContain('aria-label="Squirtle and Pikachu are jumping; 1 place free"');
  });

  it("seats each one by FireRed's own empty rows, so all their feet are on one line", () => {
    // Squirtle's front picture has twelve empty rows under it, Charmander's thirteen (`battlePicCoords.ts`).
    expect(pickerLineUp([SQUIRTLE], jump)).toContain('style="--drop: 12"');
    expect(pickerLineUp([basics('Charmander', 4)], jump)).toContain('style="--drop: 13"');
  });

  it('draws a shiny in its own colours', () => {
    expect(pickerLineUp([basics('Magikarp', 129, { shiny: true })], jump)).toMatch(/assets\/pokemon\/[^"]*shiny[^"]*129\.png/);
  });

  it('says nobody is in yet, and a full line has no place free', () => {
    const empty = pickerLineUp([], jump);
    expect(empty).toContain('aria-label="Nobody is jumping yet; 3 places free"');
    expect(empty.match(/class="lineup-place is-free"/g)).toHaveLength(3);
    const full = pickerLineUp([SQUIRTLE, PIKACHU, basics('Rattata', 19)], jump);
    expect(full).toContain('aria-label="Squirtle, Pikachu and Rattata are jumping"');
    expect(full).not.toContain('is-free');
  });

  it('marks the window of a line of one, which stands beside its list rather than over it', () => {
    expect(lineUpWindowClass(1)).toBe('has-lineup is-one');
    expect(lineUpWindowClass(3)).toBe('has-lineup');
    expect(pickerLineUp([PIKACHU], { places: 1, doing: 'picking' })).toContain('aria-label="Pikachu is picking"');
  });

  it("heads a row of the list with its Pokémon's icon", () => {
    expect(pickerRowIcon(PIKACHU)).toContain('px-mon-icon');
  });
});
