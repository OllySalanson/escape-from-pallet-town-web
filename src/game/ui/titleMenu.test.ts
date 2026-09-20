import { describe, expect, it } from 'vitest';
import type { SaveSummary } from '../save/SaveManager';
import {
  eraseMenu,
  layoutTitleMenu,
  moveTitleChoice,
  needsEraseConfirmation,
  saveDetail,
  titleMenu,
} from './titleMenu';

const NONE: SaveSummary = { kind: 'none' };
const GAME: SaveSummary = { kind: 'game', pokemon: 5, contracts: 2, raids: 9 };
const BROKEN: SaveSummary = { kind: 'unreadable' };

describe('the title menu', () => {
  it('does not offer a continue to someone who has never played', () => {
    const menu = titleMenu(NONE);
    const carry = menu.choices.find((choice) => choice.id === 'continue')!;

    expect(carry.enabled).toBe(false);
    expect(carry.detail).toBe('NO SAVED GAME');
    expect(menu.initial).toBe('new');
    expect(menu.choices.find((choice) => choice.id === 'new')).toMatchObject({ enabled: true });
  });

  it('starts on continue for someone with a game, and says whose it is', () => {
    const menu = titleMenu(GAME);

    expect(menu.initial).toBe('continue');
    expect(menu.choices[0]).toMatchObject({ enabled: true, detail: '5 POKEMON · 2 CONTRACTS' });
    // The other choice says what it costs before it is chosen.
    expect(menu.choices[1].detail).toBe('ERASES THE SAVE');
  });

  it('counts one of a thing in the singular', () => {
    expect(saveDetail({ kind: 'game', pokemon: 1, contracts: 1, raids: 0 })).toBe('1 POKEMON · 1 CONTRACT');
  });

  it('names a save it cannot read rather than calling it empty', () => {
    const menu = titleMenu(BROKEN);

    expect(menu.choices[0]).toMatchObject({ enabled: false, detail: 'SAVE UNREADABLE' });
    expect(menu.choices[1].detail).toBe('REPLACES THE SAVE');
    expect(needsEraseConfirmation(BROKEN)).toBe(true);
  });

  it('asks before erasing, and only when there is something to erase', () => {
    expect(needsEraseConfirmation(NONE)).toBe(false);
    expect(needsEraseConfirmation(GAME)).toBe(true);
  });

  it('starts the erase question on keeping the game', () => {
    const menu = eraseMenu();

    expect(menu.initial).toBe('keep');
    expect(menu.choices.map((choice) => choice.id)).toEqual(['keep', 'erase']);
    expect(menu.question).toMatch(/ERASE/);
  });

  it('moves the cursor over enabled choices only, and stops at the ends', () => {
    const fresh = titleMenu(NONE);
    expect(moveTitleChoice(fresh, 'new', -1)).toBe('new');
    expect(moveTitleChoice(fresh, 'new', 1)).toBe('new');

    const played = titleMenu(GAME);
    expect(moveTitleChoice(played, 'continue', 1)).toBe('new');
    expect(moveTitleChoice(played, 'new', 1)).toBe('new');
    expect(moveTitleChoice(played, 'new', -1)).toBe('continue');
  });
});

describe('the title menu layout', () => {
  const stages = [
    ['the smallest stage', 320, 240],
    ['the largest stage', 400, 256],
  ] as const;

  it.each(stages)('fits under the name plate on %s, whatever it is asking', (_name, width, height) => {
    const plateBottom = Math.round(height * 0.07) + Math.round(height * 0.38);
    for (const menu of [titleMenu(NONE), titleMenu(GAME), titleMenu(BROKEN), eraseMenu()]) {
      const layout = layoutTitleMenu(menu, width, height, plateBottom);

      let previousBottom = plateBottom;
      for (const row of layout.rows) {
        expect(row.y).toBeGreaterThanOrEqual(previousBottom);
        expect(row.x).toBeGreaterThanOrEqual(0);
        expect(row.x + row.width).toBeLessThanOrEqual(width);
        expect(Number.isInteger(row.x) && Number.isInteger(row.y)).toBe(true);
        previousBottom = row.y + row.height;
      }
      // The hint is the last thing on the screen and still on it.
      expect(layout.hint.y).toBeGreaterThan(previousBottom - 1);
      expect(layout.hint.y + 6).toBeLessThanOrEqual(height);
      if (layout.question) {
        expect(layout.question.y).toBeGreaterThanOrEqual(plateBottom);
        expect(layout.question.y).toBeLessThan(layout.rows[0].y);
      }
    }
  });
});
