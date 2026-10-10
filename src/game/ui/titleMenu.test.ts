import { describe, expect, it } from 'vitest';
import type { SaveSummary } from '../save/SaveManager';
import {
  eraseMenu,
  layoutTitleMenu,
  moveTitleChoice,
  moveTitleChoiceAcross,
  needsEraseConfirmation,
  playtestMenu,
  saveDetail,
  titleHint,
  titleMenu,
} from './titleMenu';
import { CHASE_LANE } from './titleScenery';

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

  it('moves the cursor over enabled choices only, in reading order, and stops at the ends', () => {
    const fresh = titleMenu(NONE);
    expect(moveTitleChoice(fresh, 'new', -1)).toBe('new');
    expect(moveTitleChoice(fresh, 'new', 1)).toBe('maker');
    expect(moveTitleChoice(fresh, 'maker', 1)).toBe('playtest');
    expect(moveTitleChoice(fresh, 'playtest', 1)).toBe('playtest');

    const played = titleMenu(GAME);
    expect(moveTitleChoice(played, 'continue', 1)).toBe('new');
    expect(moveTitleChoice(played, 'new', 1)).toBe('maker');
    expect(moveTitleChoice(played, 'new', -1)).toBe('continue');
    expect(moveTitleChoice(played, 'playtest', -1)).toBe('maker');
  });

  it('moves left and right only between the two choices that share a row', () => {
    const menu = titleMenu(GAME);
    expect(moveTitleChoiceAcross(menu, 'maker', 1)).toBe('playtest');
    expect(moveTitleChoiceAcross(menu, 'playtest', -1)).toBe('maker');
    expect(moveTitleChoiceAcross(menu, 'playtest', 1)).toBe('playtest');
    expect(moveTitleChoiceAcross(menu, 'maker', -1)).toBe('maker');
    expect(moveTitleChoiceAcross(menu, 'new', 1)).toBe('new');
    expect(moveTitleChoiceAcross(menu, 'continue', 1)).toBe('continue');
    expect(moveTitleChoiceAcross(eraseMenu(), 'keep', 1)).toBe('keep');
  });

  it('gives the map maker a button of its own, with the explorer run beside it rather than inside it', () => {
    for (const summary of [NONE, GAME, BROKEN]) {
      const menu = titleMenu(summary);
      const maker = menu.choices.find((choice) => choice.id === 'maker')!;
      const playtest = menu.choices.find((choice) => choice.id === 'playtest')!;

      expect(maker).toMatchObject({ label: 'MAKE A MAP', enabled: true });
      expect(playtest).toMatchObject({ label: 'PLAYTEST', enabled: true, beside: true });
      // Buttons, never a detail line: the sentence about each is the hint below.
      expect(maker.detail).toBeUndefined();
      expect(playtest.detail).toBeUndefined();
      expect(menu.initial).not.toBe('maker');
      expect(menu.initial).not.toBe('playtest');
    }
  });

  it('promises the saved game is untouched, where the promise fits', () => {
    const menu = titleMenu(GAME);

    expect(titleHint(menu, 'playtest')).toMatch(/UNTOUCHED/);
    expect(titleHint(menu, 'maker')).toBe('DRAW YOUR OWN RAID MAP');
    expect(titleHint(menu, 'continue')).toBe('ARROWS CHOOSE · SPACE SELECT');
    expect(titleHint(eraseMenu(), 'keep')).toBe('ESC KEEPS IT');
    expect(titleHint(playtestMenu(), 'resume-playtest')).toBe('ESC GOES BACK');
  });

  it('asks which explorer run, starting on the one already going', () => {
    const menu = playtestMenu();

    expect(menu.initial).toBe('resume-playtest');
    expect(menu.choices.map((choice) => choice.id)).toEqual([
      'resume-playtest',
      'fresh-playtest',
    ]);
    // Neither answer can reach the ordinary save, so neither is a warning.
    expect(menu.question).not.toMatch(/ERASE/);
  });
});

describe('the title menu layout', () => {
  const stages = [
    ['the smallest stage', 320, 240],
    ['the largest stage', 400, 256],
  ] as const;

  it.each(stages)('fits between the name and the chase on %s, whatever it is asking', (_name, width, stageHeight) => {
    // Where the title scene puts it: under the logo and its tagline, in the
    // screen less the lane the chase runs in along the foot.
    const plateBottom = 84;
    const height = stageHeight - CHASE_LANE;
    const menus = [
      titleMenu(NONE),
      titleMenu(GAME),
      titleMenu(GAME),
      titleMenu(BROKEN),
      eraseMenu(),
      playtestMenu(),
    ];
    for (const menu of menus) {
      const layout = layoutTitleMenu(menu, width, height, plateBottom);

      let previousBottom = plateBottom;
      for (const row of layout.rows) {
        if (!menu.choices.find((choice) => choice.id === row.id)?.beside) {
          expect(row.y).toBeGreaterThanOrEqual(previousBottom);
        }
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

describe('a row of two', () => {
  it.each([[320, 240], [400, 256]] as const)('shares the row its pair is on, edge to edge with the rows above, at %ix%i', (width, height) => {
    const layout = layoutTitleMenu(titleMenu(GAME), width, height, 100);
    const [carry, , maker, playtest] = layout.rows;

    expect(maker.y).toBe(playtest.y);
    expect(maker.height).toBe(playtest.height);
    expect(maker.x).toBe(carry.x);
    expect(playtest.x + playtest.width).toBe(carry.x + carry.width);
    expect(playtest.x).toBeGreaterThan(maker.x + maker.width);
    for (const row of layout.rows) {
      expect(Number.isInteger(row.width)).toBe(true);
    }
  });
});
