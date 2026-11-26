import { describe, expect, it } from 'vitest';
import { letterShortcut } from '../input/touchShortcuts';
import { controlsBarMarkup, keycapOf, menuOverTheGame, keyPicture, splitRoundTeam, teamFrom, type BarTeamMember } from './controlsBar';

const yard = [
  letterShortcut('L', 'LOOK'),
  letterShortcut('O', 'FAVOURS'),
  letterShortcut('B', 'THINGS'),
  letterShortcut('P', 'TEAM'),
  letterShortcut('X', 'DEX'),
  letterShortcut('M', 'MAP'),
  letterShortcut('T', 'SAY'),
];

const squirtle: BarTeamMember = { name: 'Squirtle', base: { id: 'squirtle' }, currentHp: 25, maxHp: 25, isFainted: false };

describe('the controls bar', () => {
  it('stands the team in the middle, the screen\'s other keys either side of it', () => {
    const { before, after, team } = splitRoundTeam(yard);
    expect(team?.code).toBe('KeyP');
    expect(before.map((key) => key.label)).toEqual(['LOOK', 'FAVOURS', 'THINGS']);
    expect(after.map((key) => key.label)).toEqual(['DEX', 'MAP', 'SAY']);
  });

  it('puts the keys a moment adds after the standing ones, never between them', () => {
    const { after } = splitRoundTeam([...yard, { ...letterShortcut('H', 'DECORATE'), extra: true }]);
    expect(after.at(-1)?.label).toBe('DECORATE');
  });

  it('presses a key only where the screen says it can be pressed', () => {
    const markup = controlsBarMarkup([...yard.slice(0, 2), { ...letterShortcut('B', 'PACK'), inert: true }], []);
    expect(markup).toContain('data-key="KeyL"');
    expect(markup).not.toContain('data-key="KeyB"');
    expect(markup).toContain('is-inert');
  });

  it('shows the team as the party\'s icons, and pressing it is P', () => {
    const markup = controlsBarMarkup(yard, [squirtle, { ...squirtle, name: 'Pikachu', base: { id: 'pikachu' }, currentHp: 0, isFainted: true }]);
    expect(markup).toContain('class="cb-team" data-key="KeyP"');
    expect(markup.match(/class="cb-mon /g)).toHaveLength(2);
    expect(markup).toContain('cb-mon is-out');
  });

  it('always offers SETTINGS and HELP', () => {
    const markup = controlsBarMarkup([], []);
    expect(markup).toContain('data-open="settings"');
    expect(markup).toContain('data-open="help"');
  });

  it('offers FULL SCREEN beside SETTINGS where the browser can, and says which way it goes', () => {
    expect(controlsBarMarkup([], [])).not.toContain('data-open="full-screen"');
    const off = controlsBarMarkup([], [], 'off');
    expect(off).toContain('data-open="full-screen"');
    expect(off).toContain('cb-expand');
    expect(off).toContain('aria-pressed="false"');
    expect(off.indexOf('full-screen')).toBeLessThan(off.indexOf('data-open="settings"'));
    const on = controlsBarMarkup([], [], 'on');
    expect(on).toContain('cb-shrink');
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain('Leave full screen (ALT ENTER)');
  });

  it('reads the team off the topmost scene that has one', () => {
    const base = { barTeam: () => [squirtle] };
    expect(teamFrom([base, {}])).toEqual([squirtle]);
    expect(teamFrom([{}])).toEqual([]);
  });

  it('writes a key as its keycap and pictures what has a picture', () => {
    expect(keycapOf('KeyB')).toBe('B');
    expect(keycapOf('Digit1')).toBe('1');
    expect(keyPicture('PACK')).toBe('raid-pack');
    expect(keyPicture('LOOK')).toBeUndefined();
  });
});

describe('the controls bar under a full-screen menu', () => {
  const running = (extra: object = {}) => ({ sys: { isActive: () => true }, ...extra });
  const paused = (extra: object = {}) => ({ sys: { isActive: () => false }, ...extra });
  const harbour = { touchShortcuts: () => [letterShortcut('L', 'LOOK')] };

  it('offers no keys of the harbour under a menu that has none of its own', () => {
    expect(menuOverTheGame([paused(harbour), running()])).toBe(true);
  });

  it('offers the harbour its keys while the harbour is what is running', () => {
    expect(menuOverTheGame([running(harbour)])).toBe(false);
    expect(menuOverTheGame([running(harbour), paused()])).toBe(false);
  });

  it('leaves a fight to dim the raid keys rather than take them away', () => {
    expect(menuOverTheGame([paused(harbour), running({ dimsTouchTray: true })])).toBe(false);
  });
});
