import { describe, expect, it } from 'vitest';
import { letterShortcut } from '../input/touchShortcuts';
import { controlsBarMarkup, keycapOf, keyPicture, splitRoundTeam, teamFrom, type BarTeamMember } from './controlsBar';

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
