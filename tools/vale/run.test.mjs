// The AI-feel sweep's own parts: which files it reads, and how it says who
// said a line.
import { describe, expect, it } from 'vitest';
import { flatten, gameSources, quotedOn, speakerOf } from './run.mjs';

describe('the AI-feel sweep', () => {
  it('reads the game’s own sources and the vale’s district programs, never tests or generated text', () => {
    const files = gameSources();
    expect(files.some((file) => file.endsWith('src/game/hub/errands.ts'))).toBe(true);
    expect(files.some((file) => file.endsWith('tools/mapcraft/worlds/greystoneVale/millbrook.ts'))).toBe(true);
    expect(files.some((file) => /\.test\.ts$|\/generated\/|mapNames\.ts$/.test(file))).toBe(false);
  });

  it('quotes the whole string an alert is in', () => {
    expect(quotedOn(`    lost: ['Short one', 'My crate never made it home? You came back.'],`)).toBe(
      'My crate never made it home? You came back.',
    );
  });

  it('names the speaker by the line’s own NAME:, else the person it is written in, else the file', () => {
    expect(speakerOf('MARLOW: It is a chart.', 'a.ts')).toBe('MARLOW');
    const source = [
      `{ x: 1, y: 2, name: 'Digger', look: 'hiker', lines: ['It is a living.'] },`,
      `{ x: 3, y: 4, lines: ['THE ALLOTMENTS', 'Please do not eat the seedlings.'] },`,
    ];
    expect(speakerOf('It is a living.', 'worlds/millbrook.ts', source, 0)).toBe('Digger (millbrook.ts)');
    expect(speakerOf('Please do not eat the seedlings.', 'worlds/millbrook.ts', ['  },', source[1]], 1)).toBe('worlds/millbrook.ts');
  });

  it('flattens Vale’s JSON to one alert a line', () => {
    const alerts = flatten({ 'src/a.ts': [{ Line: 3, Span: [5, 9], Check: 'Tells.NoContraction', Severity: 'warning', Message: 'm', Match: 'It is' }] }, '/repo');
    expect(alerts).toEqual([{ file: 'src/a.ts', line: 3, column: 5, rule: 'Tells.NoContraction', level: 'warning', message: 'm', match: 'It is' }]);
  });
});
